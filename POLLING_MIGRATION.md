# WebSocket to Polling Migration

## Overview
The Sora integration has been migrated from WebSocket-based real-time updates to HTTP polling. This reduces complexity and provides better scalability.

## Changes Made

### 1. **Removed WebSocket Server**
- Removed `WebSocketServer` initialization from `src/server.ts`
- Removed `wsManager` imports and handler setup
- Removed dependency on `ws` library for server-side connections

### 2. **Removed WebSocket Calls from Route Handlers**
Removed all `wsManager` calls from:
- `src/weaveit-generator/generateRoute.ts` - Video generation
- `src/weaveit-generator/generateAudioRoute.ts` - Audio generation
- `src/weaveit-generator/generateAnimationRoute.ts` - Animation generation
- `src/weaveit-generator/generateNarrativeRoute.ts` - Narrative generation

**Removed calls:**
- `wsManager.emitProgress()` - Progress update events
- `wsManager.emitCompleted()` - Job completion notifications
- `wsManager.emitError()` - Error notifications

### 3. **Database-Driven Status Updates**
All status updates now go through the database:
```typescript
// Instead of: wsManager.emitProgress(jobId, 50, 'generating', 'Processing...')
// Now: Database is updated via updateJobStatus()
await updateJobStatus(jobId, 'generating');
```

## Client Migration Guide

### Old WebSocket Approach
```javascript
const ws = new WebSocket('ws://localhost:3001');

ws.onopen = () => {
  ws.send(JSON.stringify({
    action: 'subscribe',
    jobId: 'job-123'
  }));
};

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  if (update.type === 'progress') {
    console.log(`Progress: ${update.progress}%`);
  } else if (update.type === 'completed') {
    console.log(`Video ready: ${update.videoId}`);
  }
};
```

### New Polling Approach
```javascript
// Option 1: Simple polling
async function checkStatus(jobId) {
  const response = await fetch(`/api/videos/status/${jobId}`);
  const status = await response.json();
  
  console.log(`Status: ${status.status}`);
  console.log(`Ready: ${status.ready}`);
  
  if (status.ready) {
    return status.videoId;
  }
  
  // Re-poll after delay
  setTimeout(() => checkStatus(jobId), 2000);
}
```

```javascript
// Option 2: Promise-based polling with exponential backoff
async function waitForCompletion(jobId, maxWaitMs = 300000) {
  const startTime = Date.now();
  let delayMs = 500;
  
  while (Date.now() - startTime < maxWaitMs) {
    const response = await fetch(`/api/videos/status/${jobId}`);
    const status = await response.json();
    
    if (status.status === 'completed' && status.videoId) {
      return status.videoId;
    }
    
    if (status.status === 'failed') {
      throw new Error(status.error || 'Job failed');
    }
    
    // Exponential backoff: start at 500ms, cap at 5s
    await new Promise(resolve => setTimeout(resolve, delayMs));
    delayMs = Math.min(delayMs * 1.5, 5000);
  }
  
  throw new Error('Timeout waiting for job completion');
}

// Usage
const jobId = response.jobId;
const videoId = await waitForCompletion(jobId);
console.log(`Video ready: ${videoId}`);
```

## API Endpoints

### Status Polling
```
GET /api/videos/status/:jobId
```

**Response:**
```json
{
  "jobId": "job-123",
  "status": "completed|generating|failed|queued",
  "ready": true,
  "error": null,
  "createdAt": "2024-01-24T10:00:00Z",
  "updatedAt": "2024-01-24T10:05:00Z",
  "videoAvailable": true
}
```

### Job Submission
```
POST /api/generate
POST /api/generate/audio
POST /api/generate/narrative
POST /api/generate/animation
```

All endpoints immediately return with `jobId` and status `'generating'`. Use the status endpoint to track progress.

## Webhook Support

For server-to-server integration, webhooks are still available:
- `WEBHOOK_URL` - Endpoint to receive job status updates
- `WEBHOOK_SECRET` - HMAC-SHA256 signature for security

Webhook events:
- `completed` - Job finished successfully
- `failed` - Job encountered an error
- `queued` - Job queued (Sora v3 only)

## Benefits

1. **Simpler Architecture** - No WebSocket server overhead
2. **Better Scalability** - HTTP-based, works with load balancers
3. **Mobile Friendly** - HTTP polling works on all platforms
4. **Webhook Alternative** - Server-to-server integration available
5. **Reduced Complexity** - Less memory usage, fewer connections to manage

## Considerations

### Polling Frequency
- Start with 2-3 second intervals for responsive feedback
- Use exponential backoff to reduce server load over time
- Cap at 5-10 seconds for long-running jobs

### Client Timeout
- Implement maximum wait times (5-10 minutes for long renders)
- Handle job failures gracefully
- Log polling errors for debugging

## WebSocket.ts

The `src/websocket.ts` file is now unused and can be kept for backward compatibility or removed in a future cleanup.
