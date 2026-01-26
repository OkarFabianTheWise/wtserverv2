# V3 Sora Video Storage Fix - Root Cause Analysis & Solution

## Problem Identified

**User reported**: "Why am I able to view V1 videos but not V3? Where are the videos?"

**Root Cause**: Sora videos were being downloaded and stored to `video_jobs.video_buffer`, but **NO entries were being created in the `videos` table**, so users couldn't see them in their content list.

### The Failure Chain

1. **Sora job completes** → `soraPollingService` detects completion
2. **Video downloaded** → Stored to `video_jobs.video_buffer` ✅
3. **Webhook sent to localhost** → FAILS (Sora servers can't reach localhost)
4. **Videos table entry NOT created** → User's getContentByWallet() returns nothing ❌

### Why It Happened

The architecture relied on:
- `soraPollingService.downloadAndSaveVideo()` → saves to `video_jobs.video_buffer`
- `soraPollingService.sendWebhook()` → sends POST to webhook URL
- **Webhook handler** → supposed to create `videos` table entry via `storeVideo()`

**Problem**: Webhook URLs were set to `http://localhost:3001`, which fails when called from Sora's external servers. The webhook handler never runs, so `storeVideo()` is never called.

## Debug Evidence

### Before Fix (Database State)
```
🎬 LATEST 10 SORA JOBS:
1. Job: 29c4927a... | Status: completed | Type: video
   Has Buffer: true (1172541 bytes) | Video Entries: 0 ❌
   
2. Job: 2d281eac... | Status: completed | Type: video
   Has Buffer: true (1238764 bytes) | Video Entries: 0 ❌

(All 10 recent Sora jobs had 0 entries in videos table)
```

All completed Sora jobs had:
- ✅ Data in `video_jobs.video_buffer`
- ❌ **Zero entries** in the `videos` table

## Solution Implemented

**Modified `soraPollingService.ts`**:
- Imported `storeVideo` function
- Updated `downloadAndSaveVideo()` to accept `walletAddress` parameter
- After successfully saving to `video_buffer`, **immediately create videos table entry** via `storeVideo()`
- Added try-catch to handle storeVideo failures gracefully (video buffer is still saved as fallback)

### Code Changes

**File**: `src/soraPollingService.ts`

```typescript
// 1. Import storeVideo
import { ..., storeVideo } from './db.js';

// 2. Pass wallet_address when calling downloadAndSaveVideo
if (newStatus === 'completed') {
    await downloadAndSaveVideo(job.job_id, job.sora_job_id, job.wallet_address);
}

// 3. Updated function signature
async function downloadAndSaveVideo(jobId: string, soraJobId: string, walletAddress: string) {
    // ... download video ...
    
    // Create videos table entry immediately after saving buffer
    try {
        const videoId = await storeVideo(jobId, walletAddress, videoBuffer, undefined, 'mp4');
        console.log(`✅ Video metadata stored in videos table: ${videoId}`);
    } catch (err) {
        console.error(`Failed to create videos table entry for job ${jobId}`);
        // Continue - video buffer is saved as fallback
    }
}
```

**File**: `src/db.ts`

Added detailed logging to `storeVideo()`:
```typescript
export async function storeVideo(...) {
  try {
    console.log(`[storeVideo] Starting: jobId=${jobId}, wallet=${walletAddress}...`);
    // ... INSERT into videos ...
    console.log(`[storeVideo] INSERT succeeded, video_id: ${result.rows[0].video_id}`);
    // ... UPDATE video_jobs ...
    console.log(`[storeVideo] UPDATE succeeded`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[storeVideo] ERROR: ${errorMsg}`);
    throw err;
  }
}
```

**File**: `src/server.ts`

Enhanced webhook handler with detailed error logging:
- Now logs detailed storeVideo failures
- Sends error to WebSocket client
- Continues processing status updates even if video storage fails

## Why This Fix Works

1. **No dependency on external webhooks** - Videos table entry is created immediately in the polling loop
2. **Resilient** - If webhook later succeeds, it attempts to create entry again (would be a duplicate but has unique constraints)
3. **Backward compatible** - Webhook still works if configured with proper external URL
4. **Visible errors** - Detailed logging helps debug future issues

## Testing

Debug scripts created to verify the fix:
- `test-v3-debug.js` - Checks video_jobs vs videos table entries
- `test-webhook-urls.js` - Verifies webhook URLs are set
- `test-insert.js` - Tests storeVideo INSERT statement directly
- `test-sora-details.js` - Lists pending Sora jobs and their status

## Migration Note

The database schema still has `video_data` and `audio_data` columns from before the refactor to separate metadata from binary data. The migration file `006_remove_binary_from_videos.sql` exists but hasn't been applied. The code correctly handles both cases:
- ✅ Works when columns are present (not included in INSERT, defaults to NULL)
- ✅ Will work after migration removes the columns

## Verification Steps

After deployment:
1. Trigger a Sora video generation
2. Wait for completion (soraPollingService detects it)
3. Check logs for `[storeVideo] INSERT succeeded`
4. Verify videos table has new entry with `SELECT * FROM videos WHERE job_id = ...`
5. Frontend should now display video in user's content list

