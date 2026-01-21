# Sora v3 - Preset Configuration Summary

## What Changed

### Before (Configurable)
```typescript
// Had to specify everything
await generateVideoWithSora(
    "question",
    'sora-2-pro',  // Model
    12             // Duration
);
```

### After (Preset - Simplified)
```typescript
// Only specify the question (and optional audio)
await generateVideoWithSora(
    "question",
    audioBuffer // optional - handles intelligently
);
// Everything else is preset!
```

---

## Preset Defaults

| Setting | Value | Lock Status |
|---------|-------|------------|
| **Model** | `sora-2` | ✅ Locked |
| **Video Duration** | `8 seconds` | ✅ Locked |
| **Video Size** | `1280x720` (HD) | ✅ Locked |
| **Audio Handling** | Intelligent merge | ✅ Locked |

### Why These Presets?

- **sora-2**: Best balance of generation speed (2-5 min) and quality
- **8 seconds**: Optimal length for educational content
- **1280x720**: Works on all devices (phones, tablets, desktops)
- **Intelligent audio**: Automatically detects if merge needed

---

## Audio Handling Logic

```
Input: scriptOrQuestion + optional audioBuffer

Generate Sora video (silent or with native sound)
    ↓
Check if audioBuffer provided:
    ├─ YES → Merge Sora video + audioBuffer
    │   └─ Result: Video with both (layered audio)
    │
    └─ NO → Use Sora video as-is
        └─ Result: Video with Sora's native sound only
```

### Examples

**With Narration**
```typescript
const narration = generateTTS("Here's how binary search works...");
const video = await generateAndDownloadSoraVideo(
    "Animate a binary search algorithm",
    narration  // Automatically merged
);
// Result: Video with animation + narration sync
```

**Without Extra Audio**
```typescript
const video = await generateAndDownloadSoraVideo(
    "Create a vibrant abstract animation"
    // No second param - just use Sora's native sound
);
// Result: Video with Sora's audio only
```

---

## Simplified API Functions

### 1. Create Job (for streaming)
```typescript
const jobId = await generateVideoWithSora(
    "Explain quantum computing",
    audioBuffer // optional
);
// Returns: jobId immediately
// Use: Websocket-based progress tracking
```

### 2. Check Status (for streaming)
```typescript
const status = await getSoraVideoStatus(jobId);
// Returns: { status, progress, url? }
```

### 3. Download (when complete)
```typescript
const video = await downloadSoraVideo(jobId, audioBuffer);
// Returns: video buffer ready to save
```

### 4. All-In-One (simple cases)
```typescript
const video = await generateAndDownloadSoraVideo(
    "question",
    audioBuffer // optional
);
// Returns: video buffer after polling completes
```

---

## UI Integration - Three Patterns

### Pattern 1: Streaming with Websockets (RECOMMENDED)
```
┌─────────┐         ┌──────────┐         ┌───────────┐
│   UI    │────────▶│ Backend  │────────▶│ Sora API  │
│         │         │          │         │           │
└─────────┘         └──────────┘         └───────────┘
    ▲                   │
    │                   │ WS Progress
    └───────────────────┘

Benefits:
- Real-time progress (0-100%)
- Responsive UI updates
- Works well with long operations
```

### Pattern 2: Polling Status
```
UI → POST /generate → Get jobId
   → Loop: GET /status/:jobId every 5s
   → When complete: GET /download/:jobId
```

### Pattern 3: Synchronous (Blocking)
```
UI → POST /generate-and-download → Wait for video
Returns video directly after generation completes
```

---

## Key Differences from v2 (Remotion)

| Feature | v2 (Remotion) | v3 (Sora) |
|---------|---------------|-----------|
| **Rendering** | Animated 2D shapes | AI video generation |
| **Speed** | Fast (seconds) | Medium (2-5 min) |
| **Quality** | Programmatic | Cinematic/natural |
| **Audio** | TTS only | Native + merge |
| **Configurability** | High | Minimal (preset) |
| **Best For** | Code animations | Explanatory videos |

---

## Migration Guide (v2 → v3)

### Old Code (Remotion v2)
```typescript
// Generated animation scripts programmatically
const script = await processCodeWithOpenAI(question);
const audio = await generateVoiceover(script.voiceover.text);
const video = await renderAnimationScriptToVideo(script, audio);
```

### New Code (Sora v3)
```typescript
// Direct natural video generation
const audio = await generateVoiceover(question); // Still needed if you want narration
const video = await generateAndDownloadSoraVideo(question, audio);
```

**Difference**: v3 skips the script processing—Sora handles the visual generation directly!

---

## Environment Variables

```bash
# Required for Sora v3
export OPENAI_API_KEY=sk-...
```

That's it. No other config needed!

---

## Error Codes

| Error | Cause | Solution |
|-------|-------|----------|
| `OPENAI_API_KEY is required` | Missing env var | Set OPENAI_API_KEY |
| `timeout` | Generation exceeded 10 min | Retry or use simpler prompt |
| `failed` | Sora API rejected request | Check prompt for violations |
| `Invalid script` | Input validation failed | Ensure scriptOrQuestion is string |

---

## Request/Response Format

### Create Job
```
POST /api/generate?renderVersion=v3
{
  "scriptOrQuestion": "string",
  "audioBuffer": Buffer (optional)
}
→ { "jobId": "..." }
```

### Check Status
```
GET /api/status?jobId=:jobId&renderVersion=v3
→ { "status": "queued|in_progress|completed|failed", "progress": 0-100 }
```

### Download Video
```
GET /api/download?jobId=:jobId&renderVersion=v3
→ MP4 video file (application/octet-stream)
```

---

## Preset Philosophy

```
Less configuration = Less errors = Faster integration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

UI sends: question + optional audio
System returns: perfect video

No model selection needed
No duration calculation needed
No format decision needed
No complex parameters needed
```

Just send the same request type from UI, only change the question text!

---

## Files Modified

- ✅ `src/remotion/videoGenerator.ts` - Simplified Sora functions with presets
- ✅ `SORA_V3_SIMPLE.md` - UI integration guide (read this first!)
- ✅ `SORA_V3_ROUTE_EXAMPLE.ts` - Express route examples
- ✅ `SORA_V3_PRESET_CONFIG.md` - This file

---

## Quick Start Checklist

- [ ] Set `OPENAI_API_KEY` environment variable
- [ ] Import `generateVideoWithSora` from `videoGenerator.ts`
- [ ] Create API route using `SORA_V3_ROUTE_EXAMPLE.ts` as template
- [ ] Connect UI to `/api/generate?renderVersion=v3` endpoint
- [ ] Use websockets for progress (or polling as fallback)
- [ ] Test with simple question first: "Explain what AI is"
