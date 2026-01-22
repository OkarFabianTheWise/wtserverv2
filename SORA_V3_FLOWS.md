# Sora v3 - Flow Diagrams

## Request Flow - Streaming with Websockets

```
┌─────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                        │
│                                                               │
│  1. Input: "Explain quantum computing"                       │
│  2. Optional: Upload/Generate audio narration                │
│  3. Click: "Generate Video"                                  │
└──────────────────────────────────────────────────────────────┘
                              │
                              │ POST /api/generate?renderVersion=v3
                              │ { scriptOrQuestion, audioBuffer? }
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                      BACKEND (Express)                        │
│                                                               │
│  generateVideoWithSora(question, audio?)                     │
│    └─ Create Sora job                                        │
│    └─ Returns: jobId                                         │
│    └─ Start background polling                               │
│                                                               │
│  Response: { jobId: "..." }                                  │
└──────────────────────────────────────────────────────────────┘
                              │
                              │ jobId
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                     WEBSOCKET (Real-time)                     │
│                                                               │
│  ws.send({ action: 'subscribe', jobId })                    │
│                                                               │
│  Receives:                                                   │
│  ├─ { type: 'progress', status: 'queued', progress: 0 }    │
│  ├─ { type: 'progress', status: 'in_progress', progress: 25 }
│  ├─ { type: 'progress', status: 'in_progress', progress: 50 }
│  ├─ { type: 'progress', status: 'in_progress', progress: 75 }
│  └─ { type: 'progress', status: 'completed', progress: 100 }
└──────────────────────────────────────────────────────────────┘
                              │
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    OpenAI Sora API (Cloud)                   │
│                                                               │
│  video = create({                                            │
│    model: 'sora-2',          ← preset                        │
│    prompt: "...",                                            │
│    size: '1280x720',         ← preset                        │
│    seconds: '8'              ← preset                        │
│  })                                                          │
│                                                               │
│  ⏳ Generation: 2-5 minutes                                  │
│                                                               │
│  Returns: video MP4 buffer                                   │
└──────────────────────────────────────────────────────────────┘
                              │
                              │ (Background polling)
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                   Audio Merge Decision                        │
│                                                               │
│  if (audioBuffer provided) {                                 │
│    merge(soraVideo, userAudio)                              │
│    └─ Result: Video + narration synchronized                │
│  } else {                                                    │
│    keep(soraVideo)                                          │
│    └─ Result: Video with Sora's native sound                │
│  }                                                           │
└──────────────────────────────────────────────────────────────┘
                              │
                              │ Final video ready
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                      USER INTERFACE                           │
│                                                               │
│  ✅ "Video Ready!"                                           │
│  [Download] [Preview] [Share]                               │
│                                                               │
│  GET /api/download?jobId=:jobId&renderVersion=v3           │
│  └─ Returns: MP4 file                                        │
└──────────────────────────────────────────────────────────────┘
```

---

## Polling Flow - For Simple Cases

```
POST /api/generate?renderVersion=v3
│
└─▶ { jobId: "v123" }
    │
    └─▶ Loop every 5s:
        │
        GET /api/status?jobId=v123&renderVersion=v3
        │
        ├─ { status: 'queued', progress: 0 }
        ├─ { status: 'in_progress', progress: 30 }
        ├─ { status: 'in_progress', progress: 70 }
        ├─ { status: 'completed', progress: 100 }
        │
        └─▶ GET /api/download?jobId=v123&renderVersion=v3
            │
            └─▶ MP4 file
```

---

## Recommended: Webhook + WebSocket Flow

```
┌────────────────────────────────────────────────┐
│ Client: POST /api/generate?renderVersion=v3   │
└─────────────────────────┬──────────────────────┘
                          │
                          ▼ Returns jobId immediately
                   { jobId: "v123" }
                          │
         ┌────────────────┴────────────────┐
         │                                 │
         ▼                                 ▼
    UI subscribes          OpenAI processes
    to WebSocket           in background
         │                        │
         │                        │ (takes 2-5 mins)
         │                        │
         │                        ▼
         │                 Job completes
         │                        │
         │         ┌──────────────┘
         │         │
         │         ▼
         │   POST /api/webhook/video-events
         │         │
         │         ▼
         │   Server notifies UI
         │         │
         │         ▼
         └──────▶ WebSocket event
                        │
                        ▼
            GET /api/download?jobId=v123
                        │
                        ▼
                  MP4 video file
```

✅ **Benefits:**
- Immediate response (no blocking)
- Real-time notifications via webhook
- Automatic retry on failures (72 hours)
- Scalable architecture
- No polling needed

See [SORA_V3_WEBHOOK_SETUP.md](SORA_V3_WEBHOOK_SETUP.md) for full implementation.

---

## Polling Flow (Fallback)

```
┌─────────────────────────────────────┐
│ 1. POST /generate?renderVersion=v3  │
│    Returns: jobId                   │
└──────────────────┬──────────────────┘
                   │
                   ▼
          ┌────────────────────┐
          │ Loop every 5 secs: │
          │                    │
          │ GET /status?jobId  │
          │                    │
          │ status check:      │
          │ - queued           │
          │ - in_progress      │
          │ - completed        │
          └────────┬───────────┘
                   │
                   ├─ Not ready? Sleep 5s, retry
                   │
                   └─ Ready? Download
                        │
                        ▼
        GET /api/download?jobId
                        │
                        ▼
                  MP4 video file
```

⚠️ **Use only if webhooks unavailable**

---

## Audio Merge Decision Tree

```
                    ┌─────────────────────┐
                    │ Has audioBuffer?    │
                    └─────────┬───────────┘
                              │
                ┌─────────────┴──────────────┐
                │                            │
               YES                          NO
                │                            │
                ▼                            ▼
    ┌──────────────────────┐      ┌─────────────────┐
    │ Merge audio with     │      │ Use Sora video  │
    │ Sora video           │      │ as-is with      │
    │                      │      │ native sound    │
    │ Result: Layered      │      │                 │
    │ - Sora animation     │      │ Result: Clean   │
    │ - User narration     │      │ video with      │
    │                      │      │ native audio    │
    └──────────────────────┘      └─────────────────┘
                │                            │
                └────────────┬───────────────┘
                             │
                             ▼
                    ┌─────────────────────┐
                    │ Return final video  │
                    │ buffer              │
                    └─────────────────────┘
```

---

## Function Call Graph

```
┌──────────────────────────────────────┐
│ UI / API Endpoint                    │
└──────────────────────────────────────┘
           │
           ├─────────────────────────────────────┐
           │                                     │
           ▼                                     ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│ generateVideoWithSora()  │  │ generateAndDownloadSora()│
│                          │  │                          │
│ Returns: jobId (quick)   │  │ Returns: Buffer (slow)   │
│ Use: Streaming           │  │ Use: Simple cases        │
└──────────────────────────┘  └──────────────────────────┘
           │                            │
           │                            ├─▶ generateVideoWithSora()
           │                            │
           │                            ├─▶ getSoraVideoStatus() x N
           │                            │
           │                            └─▶ downloadSoraVideo()
           │
           ├─▶ getSoraVideoStatus()
           │   (in background loop)
           │
           ├─▶ downloadSoraVideo()
           │   (when status === 'completed')
           │
           └─▶ Emit progress via websocket
```

---

## Data Flow - Request to Response

```
Request
─────────────────────────────────────────────────────
{
  scriptOrQuestion: "Explain photosynthesis",
  audioBuffer: <Buffer ...> (optional)
}

Processing
─────────────────────────────────────────────────────
1. Parse & validate input ✓
2. Generate optimized prompt ✓
3. Call OpenAI Sora API ✓
4. Return jobId immediately ✓
5. Background polling loop ✓
6. Check status: queued → in_progress → completed
7. Download video from Sora ✓
8. Merge audio if provided ✓
9. Emit progress updates via WS ✓

Response (Streaming)
─────────────────────────────────────────────────────
Initial:
{ jobId: "video_abc123" }

Progress Updates (via WebSocket):
{ type: 'progress', jobId: "...", status: 'in_progress', progress: 50 }

Final (when ready):
{ type: 'progress', jobId: "...", status: 'completed', progress: 100 }

Download:
GET /api/download?jobId=:jobId&renderVersion=v3 → MP4 File
- **Webhook** for real-time event notifications instead of polling
```

---

## Preset Values Lock

```
┌─────────────────────────────────────┐
│         Sora v3 Parameters          │
├─────────────────────┬───────────────┤
│ Parameter           │ Value         │
├─────────────────────┼───────────────┤
│ Model               │ sora-2        │ 🔒
│ Duration            │ 8 seconds     │ 🔒
│ Size                │ 1280x720      │ 🔒
│ Audio handling      │ Intelligent   │ 🔒
├─────────────────────┼───────────────┤
│ Script              │ User input    │ ✏️  (only var)
│ Narration audio     │ Optional      │ ✏️  (only option)
└─────────────────────┴───────────────┘

🔒 = Preset (cannot change)
✏️  = User configurable
```

---

## Comparison: Before & After

### Before (v3 unconfigured)
```
Client Request:
POST /generate-video
{
  scriptOrQuestion: "...",
  model: "sora-2-pro",      ← Extra param
  duration: 12,              ← Extra param
  audioBuffer: ...
}
```

### After (v3 preset)
```
Client Request:
POST /generate-video
{
  scriptOrQuestion: "...",
  audioBuffer: ...          ← Only 2 fields!
}
```

**Result**: Simpler, faster, less error-prone!

---

## Timeline Example

```
T+0s   │ User clicks "Generate Video"
       │ Request sent: { question, audio? }
       │
T+1s   │ Job created on Sora
       │ WS: { status: 'queued', progress: 0 }
       │
T+5s   │ Generation started
       │ WS: { status: 'in_progress', progress: 15 }
       │
T+90s  │ Still generating...
       │ WS: { status: 'in_progress', progress: 45 }
       │
T+180s │ Almost done...
       │ WS: { status: 'in_progress', progress: 85 }
       │
T+240s │ ✅ Complete!
       │ WS: { status: 'completed', progress: 100 }
       │
T+241s │ User clicks Download
       │ Receives: video.mp4 (50-100MB)
       │
T+242s │ Video ready to use!
```

---

## Error Paths

```
Request
   │
   ├─ Validation Error
   │  └─ Return: 400 Bad Request
   │
   ├─ API Key Missing
   │  └─ Return: 500 Server Error
   │
   ├─ Sora Generation Timeout
   │  └─ WS: { status: 'failed', error: 'Timeout' }
   │
   ├─ Sora Rejects Prompt
   │  └─ WS: { status: 'failed', error: 'Content policy violation' }
   │
   └─ Download Fails
      └─ Return: 500 Server Error
```
