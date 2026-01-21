# Sora v3 Video Generation API

Sora v3 provides video generation capabilities integrated with OpenAI's Sora API. It's designed to work with websocket streaming for real-time progress updates.

## Available Functions

### 1. `generateVideoWithSora(scriptOrQuestion, model?, duration?)`
Creates a Sora video generation job and returns the job ID immediately (non-blocking).

**Parameters:**
- `scriptOrQuestion` (string): The script or question to generate a video for
- `model` (string, optional): Sora model version - `'sora-2'` (default) or `'sora-2-pro'`
- `duration` (number, optional): Video duration in seconds - must be 4, 8, or 12 (default: 8)

**Returns:** `Promise<string>` - Job ID for tracking progress

**Example:**
```typescript
import { generateVideoWithSora } from './src/remotion/videoGenerator';

const jobId = await generateVideoWithSora(
    'Explain how binary search works with visual animations',
    'sora-2',
    8
);
console.log('Job created:', jobId);
// Send jobId to client for websocket subscription
```

### 2. `getSoraVideoStatus(videoId)`
Check the current status of a video generation job. Use in websocket handlers.

**Parameters:**
- `videoId` (string): The job ID returned from `generateVideoWithSora`

**Returns:** `Promise<{ id, status, progress?, url? }>`
- `status`: `'queued' | 'in_progress' | 'completed' | 'failed'`
- `progress`: Percentage (0-100)
- `url`: Video URL (only available when completed)

**Example:**
```typescript
import { getSoraVideoStatus } from './src/remotion/videoGenerator';

const status = await getSoraVideoStatus(jobId);
console.log(`Status: ${status.status} - Progress: ${status.progress}%`);

// Send to client via websocket
wsManager.emitProgress(jobId, status.progress || 0, status.status);
```

### 3. `downloadSoraVideoContent(videoId, variant?)`
Download the completed video or related assets from Sora.

**Parameters:**
- `videoId` (string): The job ID
- `variant` (string, optional): `'video'` (default), `'thumbnail'`, or `'spritesheet'`

**Returns:** `Promise<Buffer>` - Video/asset data

**Example:**
```typescript
import { downloadSoraVideoContent } from './src/remotion/videoGenerator';

const videoBuffer = await downloadSoraVideoContent(jobId, 'video');
fs.writeFileSync('output.mp4', videoBuffer);
```

### 4. `generateAndDownloadSoraVideo(scriptOrQuestion, audioBuffer?, model?, duration?)`
Combined function for simple use cases - generates video, polls for completion, downloads, and optionally merges audio.

**Parameters:**
- `scriptOrQuestion` (string): The script or question
- `audioBuffer` (Buffer, optional): Audio to sync with video
- `model` (string, optional): Sora model - `'sora-2'` (default) or `'sora-2-pro'`
- `duration` (number, optional): Video duration 4, 8, or 12 (default: 8)

**Returns:** `Promise<Buffer>` - Final video with audio (if provided)

**Note:** This function blocks until video is generated (up to 10 minutes polling)

**Example:**
```typescript
import { generateAndDownloadSoraVideo } from './src/remotion/videoGenerator';

const videoBuffer = await generateAndDownloadSoraVideo(
    'Create a tutorial video about React hooks',
    audioBuffer,
    'sora-2-pro',
    8
);
```

## WebSocket Integration Pattern

For streaming progress to the client:

```typescript
// 1. Create job (non-blocking)
const jobId = await generateVideoWithSora(question);

// 2. Send jobId to client
wsManager.emitProgress(jobId, 0, 'queued', 'Video generation started');

// 3. Start polling in background
startPollingJob(jobId, wsManager);

async function startPollingJob(jobId: string, wsManager: WebSocketManager) {
    let lastStatus = 'queued';
    
    while (lastStatus !== 'completed' && lastStatus !== 'failed') {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        
        const status = await getSoraVideoStatus(jobId);
        lastStatus = status.status;
        
        // Send progress update to subscribed clients
        wsManager.emitProgress(
            jobId,
            status.progress || 0,
            status.status,
            `Video generation ${status.status}`
        );
        
        if (status.status === 'completed') {
            // Download and save
            const videoBuffer = await downloadSoraVideoContent(jobId, 'video');
            wsManager.emitProgress(
                jobId,
                100,
                'completed',
                'Video ready for download',
                { videoBuffer }
            );
        } else if (status.status === 'failed') {
            wsManager.emitProgress(jobId, 0, 'failed', 'Video generation failed');
        }
    }
}
```

## Supported Models

- **sora-2** (default): Standard Sora model
- **sora-2-pro**: Professional model with better quality

## Video Duration Constraints

Sora only supports these exact durations:
- 4 seconds
- 8 seconds (recommended)
- 12 seconds

If you request a different duration, it will be automatically rounded to the nearest valid option.

## Prompt Optimization

The `generateVideoWithSora` function automatically enhances prompts for technical content:
- Detects keywords like "code", "function", "algorithm"
- Adds educational visual descriptors
- Optimizes for 16:9 aspect ratio

## Error Handling

All functions include comprehensive error logging:
```typescript
try {
    const jobId = await generateVideoWithSora(question);
} catch (error) {
    console.error('❌ Error creating Sora video:', error);
    // Handle error appropriately
}
```

## Environment Setup

Ensure `OPENAI_API_KEY` is set in your environment:
```bash
export OPENAI_API_KEY=sk-...
```

## API Rate Limits

- OpenAI may rate limit Sora API calls
- Implement exponential backoff for polling
- Consider caching successful generations
