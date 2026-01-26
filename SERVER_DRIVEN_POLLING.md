# Server-Driven Sora Polling with Webhooks

## Overview

The system now uses **server-driven polling** instead of client-side polling. The server actively monitors Sora jobs and sends webhook notifications to clients when status changes.

### Benefits
- ✅ Zero polling load on client
- ✅ Real-time notifications via webhooks
- ✅ Server manages all Sora API polling
- ✅ Automatic exponential backoff
- ✅ Handles job failures gracefully

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ 1. Submit job
       │ (GET jobId)
       ▼
┌──────────────────────────┐
│   Server (Your API)      │
│  - Stores job in DB      │
│  - Submits to Sora API   │
└──────────────────────────┘
       │ 2. Registers for polling
       ▼
┌──────────────────────────┐
│  Sora Polling Service    │
│  - Polls Sora API        │
│  - Tracks job status     │
│  - Sends webhooks to     │
│    client webhook URL    │
└──────────────────────────┘
       │ 3. Status updates
       │ (Webhook POST)
       ▼
┌─────────────┐
│   Client    │
│  Webhook    │
│  Endpoint   │
└─────────────┘
```

## Client Implementation

### 1. Submit a Video Job

```javascript
async function submitVideo(script) {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletAddress: 'user-wallet',
      script: script,
      renderVersion: 'v3' // Enable Sora
    })
  });
  
  const { jobId } = await response.json();
  return jobId;
}
```

### 2. Create a Webhook Endpoint

Your client app needs a public webhook endpoint to receive status updates:

```javascript
app.post('/webhooks/sora-status', express.json(), async (req, res) => {
  // Verify webhook signature (optional but recommended)
  const signature = req.headers['x-signature'];
  const timestamp = req.headers['x-timestamp'];
  
  if (!verifySignature(req.body, signature, timestamp)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  const { jobId, status, progress, videoUrl, error } = req.body;
  
  console.log(`Job ${jobId}: ${status} (${progress}%)`);
  
  switch (status) {
    case 'queued':
      updateUI('Video queued for processing');
      break;
      
    case 'processing':
      updateUI(`Processing: ${progress}%`);
      break;
      
    case 'completed':
      updateUI(`Done! Video: ${videoUrl}`);
      // Download or play the video
      downloadVideo(videoUrl);
      break;
      
    case 'failed':
      updateUI(`Failed: ${error}`);
      break;
  }
  
  res.json({ ok: true });
});
```

### 3. Verify Webhook Signature

```javascript
import crypto from 'crypto';

function verifySignature(payload, signature, timestamp) {
  const webhookSecret = process.env.WEBHOOK_SECRET;
  const body = JSON.stringify(payload);
  
  const computed = crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex');
  
  return computed === signature;
}
```

## Webhook Payload Format

### Status Update (Progress)
```json
{
  "jobId": "job-123",
  "soraJobId": "video_abc123",
  "status": "queued|processing|completed|failed",
  "progress": 0-100,
  "timestamp": "2024-01-25T10:00:00Z"
}
```

### Completed (with video URL)
```json
{
  "jobId": "job-123",
  "soraJobId": "video_abc123",
  "status": "completed",
  "progress": 100,
  "videoUrl": "https://api.openai.com/v1/videos/video_abc123/content",
  "contentExpiresAt": 1234567890,
  "timestamp": "2024-01-25T10:05:00Z"
}
```

### Failed (with error)
```json
{
  "jobId": "job-123",
  "soraJobId": "video_abc123",
  "status": "failed",
  "progress": 50,
  "error": "Sora API error message",
  "timestamp": "2024-01-25T10:02:00Z"
}
```

## Environment Setup

### Server Configuration

```bash
# .env
WEBHOOK_SECRET=your-secret-key
WEBHOOK_URL=https://your-client.com/webhooks/sora-status
```

### Client Configuration

```bash
# Your client's .env
VITE_WEBHOOK_SECRET=your-secret-key
VITE_SERVER_URL=https://your-server.com
```

## Status Lifecycle

```
┌──────────┐
│  queued  │  Initial status when job submitted to Sora
└────┬─────┘
     │
     ▼
┌──────────────┐
│  processing  │  Sora is generating the video
└────┬─────────┘
     │
     ├─ progress: 0-100% (sent on each poll)
     │
     ▼
   ┌─────────────┬──────────┐
   │             │          │
   ▼             ▼          ▼
┌──────────┐ ┌────────┐ ┌────────┐
│completed │ │ failed │ │ timeout│
└──────────┘ └────────┘ └────────┘
```

## Server Polling Details

The polling service:
- Starts automatically when the server starts
- Polls every 5 seconds initially (adaptive backoff)
- Tracks up to 100 pending jobs
- Stops polling after 24 hours (max job age)
- Sends webhook for every status/progress change
- Handles errors gracefully

### Polling Stats Endpoint

```bash
GET /api/sora/stats

Response:
{
  "total_jobs": 15,
  "queued_jobs": 3,
  "processing_jobs": 2,
  "completed_jobs": 8,
  "failed_jobs": 2
}
```

## Testing

### 1. Mock Webhook with ngrok

```bash
# Expose local port to internet
ngrok http 3000

# Update WEBHOOK_URL in server .env
WEBHOOK_URL=https://your-ngrok-url.ngrok.io/webhooks/sora-status
```

### 2. Test with curl

```bash
# Submit a video job
curl -X POST http://localhost:3001/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "test-wallet",
    "script": "Explain loops",
    "renderVersion": "v3"
  }'

# Get job status (fallback)
curl http://localhost:3001/api/videos/status/job-123
```

### 3. Monitor Webhooks

```javascript
// Simple webhook test server
const express = require('express');
const app = express();
app.use(express.json());

app.post('/webhooks/test', (req, res) => {
  console.log('📩 Webhook received:', req.body);
  res.json({ ok: true });
});

app.listen(3000, () => console.log('Webhook test server on :3000'));
```

## Error Handling

### Webhook Failures
If webhook delivery fails:
- Server will log the failure
- Retries are NOT automatic (design choice: server polls instead)
- Job status remains in database for fallback polling

### Sora API Failures
If Sora API is unreachable:
- Server will continue polling (exponential backoff)
- Webhook will NOT be sent
- Job status remains "processing" or "queued"

### Recovery

For production, implement:
1. **Webhook retry logic** (optional, server doesn't auto-retry)
2. **Fallback polling** endpoint at `/api/videos/status/:jobId`
3. **Status persistence** in database (already implemented)
4. **Error logging** and monitoring

```javascript
// Client fallback polling if webhook doesn't arrive
async function checkStatus(jobId, maxWait = 600000) {
  const start = Date.now();
  
  while (Date.now() - start < maxWait) {
    const response = await fetch(`/api/videos/status/${jobId}`);
    const status = await response.json();
    
    if (status.status !== 'generating' && status.status !== 'queued') {
      return status;
    }
    
    await new Promise(r => setTimeout(r, 10000)); // Poll every 10s as fallback
  }
  
  throw new Error('Job timeout');
}
```

## API Reference

### Poll Statistics

```bash
GET /api/sora/stats
```

### Force Poll Job

```bash
POST /api/sora/poll/:jobId
```

### Job Status (Fallback)

```bash
GET /api/videos/status/:jobId
```

## Monitoring & Logs

Watch for these log messages:

```bash
# Service startup
🔍 Starting Sora API polling service...
✅ Sora polling service started (interval: 5000ms)

# Active polling
🔄 Polling 5 Sora job(s)...
📡 Polling Sora job: video_123
   Status: queued → processing (Progress: 0% → 25%)
   ✅ Webhook sent: https://your-client.com/webhooks/sora-status

# Completion
✅ Sora job completed: video_123
❌ Sora job failed: video_456 - Rate limit exceeded
```

## Migration from Client Polling

### Old Way (Removed)
```javascript
// Client polls server repeatedly
setInterval(async () => {
  const status = await fetch(`/api/videos/status/${jobId}`);
  // ... update UI
}, 1000); // Heavy client load
```

### New Way
```javascript
// Server polls Sora, sends webhook to client
// Client just waits for webhook (zero polling)
// Webhook endpoint receives updates
```

## Performance Considerations

- **CPU**: Polling service uses minimal CPU (1 thread)
- **Network**: ~1 request/job/5 seconds to Sora API
- **Database**: One UPDATE per status/progress change
- **Client**: Zero polling load

For 100 concurrent jobs: ~1,200 Sora API requests per hour (~0.33 req/sec)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Webhook not received | Check WEBHOOK_URL in env, verify endpoint is public |
| Job stuck in "queued" | Check server logs, verify OpenAI API key, check Sora API status |
| Slow status updates | Normal - polling interval starts at 5s, increases with time |
| Missing webhook signature | Pass `WEBHOOK_SECRET` to both server and client |

## Related Documentation

- [POLLING_MIGRATION.md](./POLLING_MIGRATION.md) - Previous polling implementation
- [SORA_V3_WEBHOOK_SETUP.md](./SORA_V3_WEBHOOK_SETUP.md) - Webhook configuration
