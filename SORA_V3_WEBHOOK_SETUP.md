# Sora v3 Webhook Setup Guide

Replace blocking endpoints with real-time webhooks for production-grade video generation.

## Why Webhooks?

| Blocking Endpoints | Webhooks |
|---|---|
| ❌ Hold HTTP connection for 2-5 minutes | ✅ Immediate response (< 100ms) |
| ❌ Client must stay connected | ✅ Server receives async notification |
| ❌ Network timeouts cause lost videos | ✅ OpenAI retries for 72 hours |
| ❌ No progress updates mid-generation | ✅ Can push updates via WebSocket |
| ❌ Wastes server resources | ✅ Scalable architecture |

## Setup Steps

### 1. Create Webhook Endpoint

Your server receives `POST /api/webhook/video-events`:

```typescript
// Express route in SORA_V3_ROUTE_EXAMPLE.ts
router.post('/webhook/video-events', async (req: Request, res: Response) => {
    try {
        const event = req.body;
        const jobId = event.data?.id;

        if (event.type === 'video.completed') {
            // Notify UI via WebSocket
            webSocketManager.emitProgress(jobId, 100, 'completed', 'Ready for download');
        } else if (event.type === 'video.failed') {
            webSocketManager.emitProgress(jobId, 0, 'failed', event.data?.error);
        }

        res.status(200).json({ received: true });
    } catch (error) {
        res.status(200).json({ received: true });
    }
});
```

### 2. Register Webhook in OpenAI Dashboard

1. Go to: https://platform.openai.com/settings/project/webhooks
2. Click "Create"
3. Fill in:
   - **Name**: `Sora Video Events`
   - **URL**: `https://yourdomain.com/api/webhook/video-events`
   - **Events**: Select `video.completed` and `video.failed`
4. Save and receive **webhook secret**
5. Store secret as environment variable:
   ```bash
   export OPENAI_WEBHOOK_SECRET="whsec_xxxxx"
   ```

### 3. Verify Webhook Signatures (Recommended)

Validate that webhooks are actually from OpenAI:

```typescript
import OpenAI from 'openai';

const client = new OpenAI({ webhookSecret: process.env.OPENAI_WEBHOOK_SECRET });

router.post('/webhook/video-events', async (req: Request, res: Response) => {
    try {
        // This will throw if signature is invalid
        const event = await client.webhooks.unwrap(
            req.body,
            req.headers,
            { secret: process.env.OPENAI_WEBHOOK_SECRET }
        );

        const jobId = event.data?.id;

        if (event.type === 'video.completed') {
            webSocketManager.emitProgress(jobId, 100, 'completed', 'Ready for download');
        }

        res.status(200).json({ received: true });
    } catch (error) {
        console.error('Invalid webhook signature:', error);
        res.status(400).json({ error: 'Invalid signature' });
    }
});
```

### 4. Update UI Flow

**Before** (Blocking):
```
POST /api/generate → Wait 2-5 mins → GET /api/download → Video
```

**After** (Webhooks + WebSocket):
```
POST /api/generate (returns immediately)
  ↓
WS subscribe: { action: 'subscribe', jobId }
  ↓
OpenAI calls webhook when done
  ↓
Server broadcasts via WebSocket
  ↓
UI gets real-time notification
  ↓
GET /api/download when ready
```

### 5. UI Implementation

```typescript
// 1. Start generation
const response = await fetch('/api/generate?renderVersion=v3', {
    method: 'POST',
    body: JSON.stringify({
        scriptOrQuestion: "Explain neural networks",
        audioBuffer: narrationAudio
    })
});
const { jobId } = await response.json();

// 2. Subscribe to real-time updates
ws.send(JSON.stringify({ action: 'subscribe', jobId }));

// 3. Listen for webhook-triggered completion
ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.jobId === jobId && msg.status === 'completed') {
        // Webhook fired! Download video
        downloadVideo(jobId);
    }
});

// 4. Download when notified
function downloadVideo(jobId) {
    fetch(`/api/download?jobId=${jobId}&renderVersion=v3`)
        .then(r => r.blob())
        .then(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'video.mp4';
            a.click();
        });
}
```

## Troubleshooting

### Webhook Not Being Called

1. **Check OpenAI Dashboard**: https://platform.openai.com/settings/project/webhooks
   - Verify endpoint URL is correct
   - Check "Recent Events" for deliveries
   - Look for error messages

2. **Check Server Logs**:
   ```bash
   # Should show incoming POST requests
   tail -f /var/log/nginx/access.log | grep webhook
   ```

3. **Test with Sample Data**:
   - In OpenAI dashboard, click "Send test event"
   - Check if your server receives it

4. **Verify URL is Public**:
   ```bash
   # Must be reachable from internet
   curl https://yourdomain.com/api/webhook/video-events
   ```

### OpenAI Not Retrying Failed Webhooks

- Webhook endpoint must respond with `2xx` status code
- Always return `200` even on processing errors
- OpenAI retries with exponential backoff for 72 hours
- Check `webhook-id` header for deduplication

### Signature Verification Failing

1. **Ensure Secret is Correct**:
   ```bash
   # Compare with dashboard
   echo $OPENAI_WEBHOOK_SECRET
   ```

2. **Check Request Body Format**:
   - Must pass raw request body to `unwrap()`
   - Don't parse JSON before verification
   - Signature includes exact body bytes

3. **Use Standard Webhooks Library** (if SDK doesn't work):
   ```typescript
   import { Webhook } from 'standardwebhooks';

   const wh = new Webhook(process.env.OPENAI_WEBHOOK_SECRET);
   const event = wh.verify(req.body, req.headers);
   ```

## Monitoring

### Log Webhook Events

```typescript
const eventLog = [];

router.post('/webhook/video-events', async (req: Request, res: Response) => {
    const event = req.body;
    eventLog.push({
        timestamp: new Date(),
        type: event.type,
        jobId: event.data?.id,
        headers: req.headers
    });

    // ... rest of handler
});

// Endpoint to check recent events
router.get('/webhook/events', (req, res) => {
    res.json(eventLog.slice(-100)); // Last 100 events
});
```

### Dashboard Integration

OpenAI provides:
- Recent event history
- Delivery status (success/failed)
- Retry attempts
- Webhook secret rotation

## Best Practices

✅ **Do:**
- Respond to webhooks within 2-3 seconds
- Use `webhook-id` header for deduplication
- Offload heavy processing to background workers
- Store webhook secret in environment variables
- Verify signatures in production
- Log all webhook events for debugging

❌ **Don't:**
- Block on long operations in webhook handler
- Ignore non-2xx responses
- Store webhook secrets in code
- Assume webhooks arrive in order
- Parse JSON before signature verification

## Example: Full Webhook Flow

```typescript
// 1. Handle webhook from OpenAI
router.post('/webhook/video-events', async (req: Request, res: Response) => {
    try {
        // Verify signature
        const event = await client.webhooks.unwrap(req.body, req.headers);

        // Log for monitoring
        console.log(`Webhook: ${event.type} for job ${event.data.id}`);

        // Process asynchronously
        handleWebhookAsync(event).catch(err => {
            console.error('Async webhook handling error:', err);
        });

        // Respond immediately
        res.status(200).json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(200).json({ received: true, error: error.message });
    }
});

// 2. Process webhook in background
async function handleWebhookAsync(event) {
    const jobId = event.data.id;

    if (event.type === 'video.completed') {
        // Update database
        await db.updateJob(jobId, { status: 'completed', completedAt: new Date() });

        // Notify subscribers
        webSocketManager.emitProgress(jobId, 100, 'completed', 'Ready for download');

        // Optional: pre-download video
        // const video = await downloadSoraVideo(jobId);
        // await storage.save(jobId, video);
    } else if (event.type === 'video.failed') {
        await db.updateJob(jobId, { status: 'failed', error: event.data.error });
        webSocketManager.emitProgress(jobId, 0, 'failed', event.data.error);
    }
}

// 3. UI polls status as fallback (if WebSocket disconnects)
router.get('/status', async (req: Request, res: Response) => {
    const { jobId, renderVersion } = req.query;

    if (renderVersion !== 'v3') {
        return res.status(400).json({ error: 'renderVersion=v3 required' });
    }

    const job = await db.getJob(jobId);
    res.json({
        jobId,
        status: job.status,
        progress: job.progress,
        message: job.message
    });
});
```

This pattern provides:
- **Fast UI Response**: POST returns immediately
- **Real-Time Updates**: WebSocket + WebHook
- **Reliability**: OpenAI retries failures
- **Scalability**: No blocking connections
- **Monitoring**: Full event audit trail
