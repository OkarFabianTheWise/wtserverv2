# Server-Driven Sora Polling Implementation - COMPLETE ✅

## What Changed

Migrated from client-side polling to **server-driven webhooks**. The server now actively monitors Sora jobs and pushes updates to your client via webhooks.

## Architecture

```
Client submits job
    ↓
Server creates Sora job
    ↓  
Server registers for polling
    ↓
┌─────────────────────────┐
│ Polling Service (5s)    │ ← Server-driven, continuous monitoring
│ - Calls Sora API        │
│ - Detects changes       │
│ - Sends webhooks        │
└─────────────────────────┘
    ↓
Client webhook endpoint receives update
    ↓
Client updates UI (no polling needed)
```

## Files Created

### 1. **`migrations/004_add_sora_tracking.sql`**
Database migration to track:
- `sora_job_id` - OpenAI Sora job ID
- `sora_status` - Current Sora status (queued, processing, completed, failed)
- `sora_progress` - Progress percentage
- `webhook_url` - Client webhook for notifications
- `last_sora_check` - When last polled

### 2. **`src/soraPollingService.ts`** (NEW)
Server-driven polling service that:
- Starts automatically on server startup
- Polls pending Sora jobs every 5 seconds
- Detects status/progress changes
- Sends webhooks to client when status changes
- Stops polling when job completes/fails
- Handles errors gracefully (doesn't crash polling loop)

**Key Functions:**
```typescript
startSoraPolling()      // Start polling service
stopSoraPolling()       // Stop polling (graceful shutdown)
registerSoraJob()       // Register new job for polling
forcePollJob()          // Immediate status check
getPollingStats()       // Get polling stats
```

### 3. **`src/db.ts` - New Functions**
Added database functions:
```typescript
registerSoraJobForPolling()  // Store sora_job_id and webhook_url
updateSoraJobStatus()         // Update sora_status and sora_progress
getPendingSoraJobs()          // Get jobs needing polling
getSoraPollingStats()         // Get stats (total, queued, processing, etc)
```

## Files Modified

### **`src/server.ts`**
- ✅ Added `startSoraPolling()` on server startup
- ✅ Added graceful shutdown handlers (SIGTERM, SIGINT)
- ✅ Calls `stopSoraPolling()` before exit

### **`src/weaveit-generator/generateRoute.ts`**
- ✅ Imports `registerSoraJob` from soraPollingService
- ✅ Registers Sora jobs for polling when v3 rendering is used
- ✅ Passes webhook URL for client notifications

## Client Implementation

### 1. Submit a Video Job (Same as Before)

```javascript
const response = await fetch('/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    walletAddress: 'user-wallet',
    script: 'Your code',
    renderVersion: 'v3' // Use Sora
  })
});

const { jobId } = await response.json();
// Server immediately starts polling Sora
```

### 2. Create Webhook Endpoint on Client

```javascript
// Your client app needs a PUBLIC webhook endpoint
app.post('/webhooks/sora-status', express.json(), (req, res) => {
  const { jobId, status, progress, videoUrl, error } = req.body;
  
  console.log(`Job ${jobId}: ${status} (${progress}%)`);
  
  if (status === 'completed') {
    downloadVideo(videoUrl);
  } else if (status === 'failed') {
    showError(error);
  } else {
    updateProgressBar(progress);
  }
  
  res.json({ ok: true });
});
```

### 3. Webhook Payloads Received

**Progress Update:**
```json
{
  "jobId": "job-123",
  "soraJobId": "video_abc",
  "status": "processing",
  "progress": 45,
  "timestamp": "2024-01-25T10:00:00Z"
}
```

**Completion:**
```json
{
  "jobId": "job-123",
  "soraJobId": "video_abc",
  "status": "completed",
  "progress": 100,
  "videoUrl": "https://api.openai.com/v1/videos/video_abc/content",
  "contentExpiresAt": 1234567890,
  "timestamp": "2024-01-25T10:05:00Z"
}
```

**Failure:**
```json
{
  "jobId": "job-123",
  "soraJobId": "video_abc",
  "status": "failed",
  "progress": 50,
  "error": "Rate limit exceeded",
  "timestamp": "2024-01-25T10:02:00Z"
}
```

## Environment Configuration

```bash
# .env (Server)
WEBHOOK_SECRET=your-secret-key
WEBHOOK_URL=https://your-client.com/webhooks/sora-status
OPENAI_API_KEY=your-openai-key
VERBOSE_LOGGING=true  # For debugging
```

**IMPORTANT:** `WEBHOOK_URL` is where the server sends updates. Can be:
- Client webhook endpoint (recommended)
- Your own webhook service
- Any public URL that accepts POST requests

## Polling Behavior

- **Interval:** 5 seconds (constant, no backoff)
- **Status Check:** Immediately after creating job
- **Auto-Stop:** When status becomes `completed` or `failed`
- **Max Age:** 24 hours (jobs older than this are skipped)
- **Concurrent Jobs:** Up to 100 pending jobs polled simultaneously
- **Error Handling:** Errors don't crash polling loop, continues with next job

## Database Schema

Migration adds these columns to `video_jobs`:

```sql
sora_job_id VARCHAR(255)        -- OpenAI Sora video job ID
sora_status VARCHAR(50)          -- queued|processing|completed|failed
sora_progress INTEGER DEFAULT 0  -- 0-100%
webhook_url TEXT                 -- Client webhook URL
last_sora_check TIMESTAMP        -- Last poll time
sora_checked_at TIMESTAMP        -- When status was last updated
```

## Fallback: Manual Status Check

If webhook doesn't arrive, client can still poll:

```javascript
async function checkStatus(jobId) {
  const response = await fetch(`/api/videos/status/${jobId}`);
  const status = await response.json();
  return status;
  // status.status = 'generating|completed|failed'
  // status.sora_progress = 0-100 (if Sora job)
}
```

## Server Logs

Watch these logs to debug:

```bash
🔍 Starting Sora API polling service...
✅ Sora polling service started (interval: 5000ms)

📝 Registered Sora job: job-123 -> video_abc123
   Webhook: https://your-client.com/webhooks/sora-status

🔄 Polling 2 Sora job(s)...
📡 Polling Sora job: video_abc123
   Status: queued → processing (Progress: 0% → 25%)
   ✅ Webhook sent: https://your-client.com/webhooks/sora-status

✅ Sora job completed: video_abc123

⏹️  Sora polling service stopped (on graceful shutdown)
```

## Benefits Over Client Polling

| Aspect | Client Polling | Server Polling |
|--------|---|---|
| **Client Load** | High (constant requests) | Zero (waits for webhook) |
| **Network** | Many small requests | Few webhook notifications |
| **Latency** | Polling interval delay | Immediate (5s max) |
| **Complexity** | Client must handle polling | Server handles all |
| **Reliability** | Requests might fail | Server retries internally |
| **Scalability** | Scales poorly (N clients × requests) | Scales well (1 server) |

## Migration Testing Checklist

- [ ] Run migration: `npm run migrate` or apply SQL manually
- [ ] Set `WEBHOOK_URL` in `.env` to your webhook endpoint
- [ ] Set `WEBHOOK_SECRET` for signature verification
- [ ] Start server: `npm start`
- [ ] Check logs for "Sora polling service started"
- [ ] Submit a Sora v3 video job
- [ ] Verify webhook received at client endpoint
- [ ] Check job status progresses through queued → processing → completed
- [ ] Verify video URL in completed webhook

## Troubleshooting

| Issue | Check |
|-------|-------|
| Webhooks not received | Is `WEBHOOK_URL` correct? Is endpoint public? |
| Jobs stuck in "queued" | Check OpenAI API key, check Sora status page |
| No polling started | Check server logs for "Starting Sora API..." message |
| Webhook signature fails | Ensure `WEBHOOK_SECRET` matches on client |
| Missing job status | Run migration to add sora_status columns |

## Next Steps

1. **Test locally:** Use ngrok to expose your webhook endpoint
2. **Deploy:** Push changes and run migration on production database
3. **Update client:** Implement webhook endpoint to receive updates
4. **Monitor:** Watch server logs for polling activity
5. **Scale:** Server handles 100+ concurrent Sora jobs efficiently

## Rollback

If needed, remove these additions:
- Delete `migrations/004_add_sora_tracking.sql` (don't run it)
- Remove `soraPollingService.ts`
- Remove polling startup code from `server.ts`
- Remove `registerSoraJob` call from `generateRoute.ts`
- Client polling endpoint `/api/videos/status/:jobId` still works as fallback

---

**Migration Status:** ✅ **COMPLETE**
- All TypeScript files compile without errors
- Database migration created
- Server service implemented
- Client webhook documentation provided
- Graceful shutdown implemented
- Error handling in place
