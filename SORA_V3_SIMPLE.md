# Sora v3 Simplified API - For UI Integration

All Sora parameters are now **preset**. UI only needs to send `scriptOrQuestion` and optionally `audioBuffer`.

## Single Request Type for All UI Calls

### Streaming Mode (Recommended for UI)
Use websockets for real-time progress updates:

```typescript
// 1. Send from UI
const jobId = await generateVideoWithSora(
    "Explain how binary search works with visual examples",
    audioBuffer // optional: TTS audio for narration
);

// 2. Client subscribes to websocket job updates
ws.send(JSON.stringify({
    action: 'subscribe',
    jobId: jobId
}));

// 3. Server polls and broadcasts progress
while (job not completed) {
    const status = await getSoraVideoStatus(jobId);
    ws.send({ type: 'progress', jobId, status, progress });
}

// 4. When complete, download via ID
const videoBuffer = await downloadSoraVideo(jobId, audioBuffer);
```

### Synchronous Mode (Simple Use Cases)
For direct server-side generation without websockets:

```typescript
// One call does everything: generate → poll → download
const videoBuffer = await generateAndDownloadSoraVideo(
    "Explain machine learning concepts",
    audioBuffer // optional
);
// Returns ready-to-use video buffer
```

## Presets (No Longer Configurable)

| Parameter | Value | Reason |
|-----------|-------|--------|
| Model | `sora-2` | Best balance of quality and speed |
| Duration | `8` seconds | Optimal for educational content |
| Size | `1280x720` | Standard HD for all devices |
| Audio | Intelligent | Uses Sora's native sound + optional merge |

## Audio Handling Strategy

### Smart Audio Detection
```
If audioBuffer provided:
  ├─ If Sora video has native sound
  │  └─ Merge: Sora sound (background) + provided audio (foreground)
  │
  └─ If Sora video is silent
     └─ Merge: Provided audio as main soundtrack
```

### Examples

**Case 1: With Narration Audio**
```typescript
const audioBuffer = fs.readFileSync('narration.mp3'); // TTS generated

const videoBuffer = await generateAndDownloadSoraVideo(
    "Demonstrate the Fibonacci sequence",
    audioBuffer // This will be intelligently merged
);
// Result: Video with Sora visuals + narration sync
```

**Case 2: Without Audio** 
```typescript
const videoBuffer = await generateAndDownloadSoraVideo(
    "Show a colorful animation of CSS gradients"
    // No audioBuffer - just use Sora's native sound
);
// Result: Video with Sora's native audio only
```

## UI Integration Pattern

```typescript
// From UI - Always send the same type of request
async function requestVideoGeneration(question: string, narrationAudio?: Buffer) {
    try {
        // Only param changes: the question text
        // Model/duration/etc are preset
        const jobId = await generateVideoWithSora(question, narrationAudio);
        
        // Subscribe to updates
        subscribeToJobProgress(jobId);
        
        return jobId;
    } catch (error) {
        console.error('Failed to generate video:', error);
    }
}

// Listen for progress updates
function subscribeToJobProgress(jobId: string) {
    ws.send(JSON.stringify({
        action: 'subscribe',
        jobId: jobId
    }));
    
    ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.type === 'progress' && msg.jobId === jobId) {
            updateUI({
                status: msg.status,
                progress: msg.progress,
                message: msg.message
            });
            
            if (msg.status === 'completed') {
                showDownloadButton(jobId);
            } else if (msg.status === 'failed') {
                showErrorMessage(msg.message);
            }
        }
    });
}
```

## Function Signatures

### `generateVideoWithSora(scriptOrQuestion, audioBuffer?)`
- **Purpose**: Create a job, return immediately for websocket tracking
- **Returns**: `string` (jobId)
- **Use**: Streaming progress with websockets

### `getSoraVideoStatus(videoId)`
- **Purpose**: Check job status and progress
- **Returns**: `{ id, status, progress, url }`
- **Use**: Called by server polling logic

### `downloadSoraVideo(videoId, audioBuffer?)`
- **Purpose**: Download completed video with intelligent audio handling
- **Returns**: `Buffer` (ready-to-save video)
- **Use**: After job is completed

### `generateAndDownloadSoraVideo(scriptOrQuestion, audioBuffer?)`
- **Purpose**: One-call complete workflow (create → poll → download)
- **Returns**: `Buffer` (video)
- **Use**: Simple scenarios without real-time progress

## Status Values

```
queued        → Job created, waiting to start
in_progress   → Video is being generated
completed     → Video ready for download
failed        → Generation failed
```

## Error Handling

```typescript
try {
    const jobId = await generateVideoWithSora(question, audio);
} catch (error) {
    if (error.message.includes('timeout')) {
        // Video generation took too long
    } else if (error.message.includes('failed')) {
        // Sora API returned failure
    } else {
        // Network or other error
    }
}
```

## Environment Setup

```bash
export OPENAI_API_KEY=sk-...
```

That's it! Everything else is preset and handled automatically.
