# Sora Polling Implementation - Quick Reference

## Quick Start for Frontend Developers

### 1. Submit a Job
```javascript
const response = await fetch('/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    walletAddress: 'user-wallet',
    script: 'Your code explanation here'
  })
});

const { jobId } = await response.json();
console.log(`Job submitted:`, jobId);
```

### 2. Poll for Status
```javascript
async function getJobStatus(jobId) {
  const response = await fetch(`/api/videos/status/${jobId}`);
  return await response.json();
}

// Check status
const status = await getJobStatus(jobId);
console.log(status);
// {
//   jobId: "job-xxx",
//   status: "generating|completed|failed|queued",
//   ready: true/false,
//   error: null,
//   videoAvailable: true/false,
//   ...
// }
```

### 3. Wait for Completion (Recommended Pattern)
```javascript
async function waitForVideo(jobId) {
  let delayMs = 500;
  const maxDelay = 5000;
  const timeout = Date.now() + 300000; // 5 minutes
  
  while (Date.now() < timeout) {
    const status = await getJobStatus(jobId);
    
    if (status.ready) {
      return status.videoId; // Success!
    }
    
    if (status.status === 'failed') {
      throw new Error(status.error || 'Job failed');
    }
    
    // Wait before next poll (exponential backoff)
    await new Promise(r => setTimeout(r, delayMs));
    delayMs = Math.min(delayMs * 1.5, maxDelay);
  }
  
  throw new Error('Timeout waiting for video');
}

// Usage
try {
  const videoId = await waitForVideo(jobId);
  console.log('Video ready:', videoId);
  // Download video at /api/videos/:videoId
} catch (error) {
  console.error('Job failed:', error.message);
}
```

## API Endpoints Reference

### Submit Jobs
| Endpoint | Type | Use Case |
|----------|------|----------|
| `/api/generate` | POST | Full video with audio |
| `/api/generate/audio` | POST | Audio only |
| `/api/generate/animation` | POST | Animation from code |
| `/api/generate/narrative` | POST | Narrative animation |

**Query Parameters:**
- `generateRoute.ts` accepts `renderVersion` (v1, v2, v3)

### Poll Status
```
GET /api/videos/status/:jobId
```

**Status Values:**
- `generating` - In progress
- `completed` - Ready to download
- `failed` - Error occurred
- `queued` - Sora API queue (v3 only)

### Download Content
```
GET /api/videos/:videoId         # Video file
GET /api/videos/job/:jobId       # Video by job ID
```

## Polling Strategies

### Aggressive Polling (Quick Feedback)
```javascript
const delay = 500; // ms
// Use for: UI with progress indication, user is watching
```

### Balanced Polling (Recommended)
```javascript
let delay = 500;
const maxDelay = 3000;
delay = Math.min(delay * 1.5, maxDelay);
// Use for: Most applications
```

### Conservative Polling (Resource Efficient)
```javascript
let delay = 2000;
const maxDelay = 10000;
delay = Math.min(delay * 1.2, maxDelay);
// Use for: Background jobs, batch processing
```

## Error Handling

```javascript
async function robustWait(jobId) {
  let attempts = 0;
  const maxAttempts = 360; // 60 minutes with 10s delays
  
  while (attempts < maxAttempts) {
    try {
      const status = await getJobStatus(jobId);
      
      switch (status.status) {
        case 'completed':
          return { success: true, videoId: status.videoId };
        case 'failed':
          return { success: false, error: status.error };
        case 'generating':
        case 'queued':
          attempts++;
          await new Promise(r => setTimeout(r, 10000));
          break;
      }
    } catch (networkError) {
      console.warn('Network error, retrying...', networkError);
      attempts++;
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  
  return { success: false, error: 'Maximum wait time exceeded' };
}
```

## Webhook Alternative (Server-to-Server)

For production scenarios, use webhooks instead of polling:

```bash
# Environment variables
WEBHOOK_URL=https://your-api.com/callbacks/video-done
WEBHOOK_SECRET=your-secret-key
```

**Webhook Payload:**
```javascript
{
  jobId: "job-123",
  status: "completed|failed|queued",
  videoId: "video-456",
  duration: 45,
  error: null,
  timestamp: "2024-01-24T10:00:00Z"
}
```

**Verify Webhook:**
```javascript
import crypto from 'crypto';

function verifyWebhook(payload, signature) {
  const computed = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return computed === signature;
}
```

## Migration from WebSockets

### Old WebSocket Code (No Longer Works)
```javascript
const ws = new WebSocket('ws://localhost:3001');
ws.send(JSON.stringify({ action: 'subscribe', jobId }));
ws.onmessage = (event) => { /* ... */ };
```

### New Polling Code (Required)
```javascript
const status = await getJobStatus(jobId);
// or
const videoId = await waitForVideo(jobId);
```

## Common Issues

| Issue | Solution |
|-------|----------|
| "Job not found" | Wait 1-2 seconds before first poll |
| Timeout after 5 min | Increase timeout, check server logs |
| 404 on video endpoint | Ensure `videoId` is returned in status |
| Network errors | Retry with exponential backoff |
| High polling frequency | Increase initial delay to 2-5 seconds |

## Performance Tips

1. **Don't poll too aggressively**
   - Start with 500-1000ms intervals
   - Cap maximum at 5-10 seconds

2. **Use exponential backoff**
   - Multiplier: 1.2x to 1.5x
   - Reduces server load as job runs longer

3. **Set reasonable timeouts**
   - Video: 5-10 minutes max
   - Audio: 2-5 minutes max
   - Animations: 10-20 minutes max

4. **Consider webhooks for production**
   - Better for server-to-server integration
   - No polling overhead
   - Real-time notifications

## Debugging

```javascript
// Log all status changes
async function debugWait(jobId) {
  let lastStatus = null;
  
  while (true) {
    const status = await getJobStatus(jobId);
    
    if (status.status !== lastStatus) {
      console.log(`[${new Date().toISOString()}] Status: ${status.status}`);
      lastStatus = status.status;
    }
    
    if (status.ready || status.status === 'failed') {
      return status;
    }
    
    await new Promise(r => setTimeout(r, 2000));
  }
}
```

## Related Documentation

- [POLLING_MIGRATION.md](./POLLING_MIGRATION.md) - Detailed migration guide
- [WEBSOCKET_TO_POLLING_SUMMARY.md](./WEBSOCKET_TO_POLLING_SUMMARY.md) - Technical summary
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - General API reference
