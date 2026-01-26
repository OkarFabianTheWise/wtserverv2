# Webhook & WebSocket Client Setup Guide

## How the System Works

1. **Client sends video generation request** → Server returns `jobId` immediately
2. **Server generates video in background** → Polls OpenAI or receives webhook
3. **When complete**, server broadcasts to **all connected clients listening on that jobId**
4. **Client downloads video** using the jobId

## Option 1: WebSocket (Recommended)

### Connect to WebSocket
```javascript
const ws = new WebSocket('ws://localhost:3001');

ws.onopen = () => {
  console.log('Connected to server');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Update:', data);
  
  if (data.status === 'completed') {
    downloadVideo(data.jobId);
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};
```

### Subscribe to a Job
```javascript
// After getting jobId from POST /api/generate
function subscribeToJob(jobId) {
  ws.send(JSON.stringify({
    action: 'subscribe',
    jobId: jobId
  }));
  console.log(`📡 Subscribed to job: ${jobId}`);
}

// Example:
const response = await fetch('/api/generate?renderVersion=v3', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    walletAddress: '0x123...',
    script: 'Explain blockchain'
  })
});

const { jobId } = await response.json();
subscribeToJob(jobId);  // ← Subscribe immediately
```

### Listen for Updates
```javascript
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  
  if (msg.jobId === currentJobId) {
    console.log('Status:', msg.status);
    console.log('Progress:', msg.progress);
    
    if (msg.status === 'completed') {
      console.log('🎉 Video ready!');
      downloadVideo(msg.jobId);
    } else if (msg.status === 'failed') {
      console.error('❌ Video generation failed:', msg.error);
    }
  }
};
```

## Option 2: Server-Sent Events (Fallback)

If WebSocket is not available:

```javascript
function subscribeToJobSSE(jobId) {
  const eventSource = new EventSource(`/api/jobs/events?jobIds=${jobId}`);
  
  eventSource.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    console.log('Job update:', msg);
    
    if (msg.status === 'completed') {
      downloadVideo(msg.jobId);
      eventSource.close();
    }
  };
  
  eventSource.onerror = () => {
    console.error('SSE connection lost');
    eventSource.close();
  };
}
```

## Option 3: Polling (Simple but Not Recommended)

```javascript
async function pollJobStatus(jobId) {
  const maxAttempts = 120; // 10 minutes (5 sec intervals)
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const response = await fetch(`/api/videos/status/${jobId}`);
    const data = await response.json();
    
    console.log(`Job ${jobId} status:`, data.status);
    
    if (data.status === 'completed') {
      console.log('✅ Video ready!');
      return downloadVideo(jobId);
    } else if (data.status === 'failed') {
      console.error('❌ Generation failed:', data.error);
      return;
    }
    
    // Wait 5 seconds before polling again
    await new Promise(resolve => setTimeout(resolve, 5000));
    attempts++;
  }
  
  console.error('⏱️ Timeout: Video generation took too long');
}
```

## Download the Video

Once status is `completed`:

```javascript
async function downloadVideo(jobId) {
  try {
    const response = await fetch(`/api/download?jobId=${jobId}&renderVersion=v3`);
    
    if (!response.ok) {
      console.error('Download failed:', response.status);
      return;
    }
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `video-${jobId.slice(0, 8)}.mp4`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    console.log('✅ Video downloaded successfully!');
  } catch (error) {
    console.error('Download error:', error);
  }
}
```

## Complete Example Flow

```javascript
class VideoClient {
  constructor(walletAddress) {
    this.walletAddress = walletAddress;
    this.ws = null;
    this.currentJobId = null;
    this.connectWebSocket();
  }
  
  connectWebSocket() {
    this.ws = new WebSocket('ws://localhost:3001');
    
    this.ws.onopen = () => {
      console.log('✅ Connected to server');
    };
    
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      
      if (msg.jobId === this.currentJobId) {
        this.handleJobUpdate(msg);
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      // Fallback to polling
      this.pollFallback();
    };
  }
  
  async generateVideo(script) {
    try {
      console.log('📹 Generating video...');
      const response = await fetch('/api/generate?renderVersion=v3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: this.walletAddress,
          script: script
        })
      });
      
      const data = await response.json();
      this.currentJobId = data.jobId;
      
      console.log(`📡 Job created: ${this.currentJobId}`);
      
      // Subscribe via WebSocket
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          action: 'subscribe',
          jobId: this.currentJobId
        }));
      }
      
      return this.currentJobId;
    } catch (error) {
      console.error('Failed to generate video:', error);
    }
  }
  
  handleJobUpdate(msg) {
    console.log(`[${msg.jobId}] Status: ${msg.status}`, {
      progress: msg.progress,
      error: msg.error
    });
    
    if (msg.status === 'completed') {
      console.log('🎉 Video complete! Downloading...');
      this.downloadVideo(msg.jobId);
    } else if (msg.status === 'failed') {
      console.error('❌ Failed:', msg.error);
    }
  }
  
  async downloadVideo(jobId) {
    const response = await fetch(`/api/download?jobId=${jobId}&renderVersion=v3`);
    const blob = await response.blob();
    
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sora-${jobId.slice(0, 8)}.mp4`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    console.log('✅ Downloaded!');
  }
  
  async pollFallback() {
    // Use SSE if WebSocket fails
    const eventSource = new EventSource(`/api/jobs/events?jobIds=${this.currentJobId}`);
    eventSource.onmessage = (e) => {
      this.handleJobUpdate(JSON.parse(e.data));
    };
  }
}

// Usage:
const client = new VideoClient('0x123456...');
await client.generateVideo('Explain machine learning');
// → Automatically handles everything via WebSocket
```

## Troubleshooting

### WebSocket Connection Fails
- Check if server is running: `npm run dev`
- Check if WebSocket server is listening on correct port
- Look for CORS issues in browser console

### No Status Updates
- Ensure you subscribed with the correct `jobId`
- Check browser console for errors
- Verify wallet address in request body

### Download Returns 404
- Video might still be processing (wait for `completed` status)
- Check jobId is correct
- Verify `renderVersion=v3` in query parameter

### Video Generation Takes Too Long
- OpenAI Sora typically takes 2-5 minutes
- Check server logs for errors
- Monitor `/api/videos/status/{jobId}` for progress

---

**Key Points:**
- ✅ Use WebSocket for real-time updates (recommended)
- ✅ Subscribe immediately after getting jobId
- ✅ Only download when status is `completed`
- ✅ Use wallet address in generation request, not job ID for identification
