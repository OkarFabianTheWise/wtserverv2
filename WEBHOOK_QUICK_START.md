# Quick Start: Server-Driven Sora Webhooks

## TL;DR

Your **client no longer polls**. The server polls Sora and sends you webhook notifications.

## 3-Step Implementation

### Step 1: Server Configuration (.env)

```bash
WEBHOOK_SECRET=your-random-secret-here
WEBHOOK_URL=https://your-app.com/webhooks/sora-status
OPENAI_API_KEY=sk-...
```

### Step 2: Client Webhook Endpoint

```javascript
import express from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.json());

// Webhook receiver
app.post('/webhooks/sora-status', (req, res) => {
  // Verify signature (optional but recommended)
  const signature = req.headers['x-signature'];
  const expected = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');
  
  if (signature !== expected) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Handle update
  const { jobId, status, progress, videoUrl, error } = req.body;
  
  switch (status) {
    case 'queued':
      console.log(`📝 ${jobId}: Video queued`);
      break;
    case 'processing':
      console.log(`⏳ ${jobId}: ${progress}% complete`);
      updateProgressBar(jobId, progress);
      break;
    case 'completed':
      console.log(`✅ ${jobId}: Ready to download`);
      downloadVideo(jobId, videoUrl);
      break;
    case 'failed':
      console.log(`❌ ${jobId}: ${error}`);
      showError(jobId, error);
      break;
  }
  
  res.json({ ok: true });
});

app.listen(3000);
```

### Step 3: Submit Jobs (No Change)

```javascript
async function submitVideo(script) {
  const res = await fetch('https://api.yourserver.com/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletAddress: userWallet,
      script,
      renderVersion: 'v3'  // Enable Sora
    })
  });
  
  const { jobId } = await res.json();
  console.log(`Job submitted: ${jobId}`);
  // That's it! Server will send webhook updates
  // No polling needed
}
```

## Webhook Payloads

### Progress (every 5 seconds or when it changes)
```json
{
  "jobId": "job-xxx",
  "soraJobId": "video_yyy",
  "status": "processing",
  "progress": 35,
  "timestamp": "2024-01-25T10:00:00Z"
}
```

### Complete (with video URL)
```json
{
  "jobId": "job-xxx",
  "soraJobId": "video_yyy",
  "status": "completed",
  "progress": 100,
  "videoUrl": "https://api.openai.com/v1/videos/video_yyy/content",
  "contentExpiresAt": 1234567890,
  "timestamp": "2024-01-25T10:05:00Z"
}
```

### Failed (with error)
```json
{
  "jobId": "job-xxx",
  "soraJobId": "video_yyy",
  "status": "failed",
  "progress": 50,
  "error": "Sora API error message",
  "timestamp": "2024-01-25T10:02:00Z"
}
```

## Status Lifecycle

```
Job Created
   ↓
queued (server registering with Sora)
   ↓
processing (Sora generating video, progress: 0-100%)
   ↓
   ├─ completed (video ready at videoUrl)
   │
   └─ failed (error occurred)
```

## Environment (.env)

```bash
# Client
WEBHOOK_SECRET=your-random-secret-here

# Server sends webhooks to this URL
VITE_SERVER_WEBHOOK_URL=https://your-app.com/webhooks/sora-status
```

## Testing with ngrok

```bash
# Terminal 1: Start your webhook server
npm start  # runs on :3000

# Terminal 2: Expose to internet
ngrok http 3000
# Copy the URL like: https://xxx-yyy.ngrok.io

# Update server .env
WEBHOOK_URL=https://xxx-yyy.ngrok.io/webhooks/sora-status

# Now submit a Sora job and watch webhooks arrive!
```

## Verify It's Working

Watch server logs:
```
🔍 Starting Sora API polling service...
✅ Sora polling service started
📝 Registered Sora job: job-123 -> video_abc
🔄 Polling 1 Sora job(s)...
📡 Polling Sora job: video_abc
   Status: queued → processing (0%)
   ✅ Webhook sent: https://your-webhook.url
```

Watch client logs:
```
⏳ job-123: 0% complete
⏳ job-123: 25% complete
⏳ job-123: 50% complete
✅ job-123: Ready to download
   Video URL: https://api.openai.com/v1/videos/.../content
```

## That's It!

- ✅ No polling code needed
- ✅ Server handles everything
- ✅ Webhooks push real-time updates
- ✅ Zero client latency
- ✅ Scales to 1000+ jobs

## Troubleshooting

**Webhook not received?**
- Check that `WEBHOOK_URL` points to your public endpoint
- Verify endpoint is accessible from the internet (not localhost)
- Check network firewall/security groups allow inbound

**Wrong job ID?**
- Each webhook includes `jobId` and `soraJobId`
- `jobId` = your internal job ID
- `soraJobId` = OpenAI's Sora job ID

**Signature verification fails?**
- Make sure `WEBHOOK_SECRET` on server matches client
- Verify you're signing the request body (not headers)

## Production Checklist

- [ ] Set strong `WEBHOOK_SECRET` in .env
- [ ] Use HTTPS for webhook URL
- [ ] Implement signature verification
- [ ] Log webhooks for debugging
- [ ] Set timeout on webhook receiver (10 seconds)
- [ ] Handle webhook retries/duplicates
- [ ] Monitor webhook delivery failures
- [ ] Test with ngrok before deploying

---

**That's all you need. Webhooks handle the rest!** 🚀
