# Sora v3 - Quick Reference Card

## 🎯 The Idea

Same request format, change only the question text. Everything else preset!

```
Before: { scriptOrQuestion, model, duration, size, audio? }
After:  { scriptOrQuestion, audio? }
```

---

## 📦 What You Get

| v2 (Remotion) | v3 (Sora) |
|---|---|
| 2D animated shapes | AI-generated video |
| Programmable | Natural/cinematic |
| Script-based | Direct generation |
| Few seconds | 2-5 minutes |

---

## 🚀 Main Functions

```typescript
// 1. Create job (returns immediately)
const jobId = await generateVideoWithSora(question, audio?);

// 2. Check status (for polling fallback)
const { status, progress } = await getSoraVideoStatus(jobId);

// 3. Download when ready
const video = await downloadSoraVideo(jobId, audio?);

// RECOMMENDED: Use webhooks instead!
// Register webhook in OpenAI dashboard for real-time notifications
// See SORA_V3_WEBHOOK_SETUP.md for details
```

---

## 🔧 Presets (Locked)

```
model:     sora-2         (fastest + best quality)
duration:  8 seconds      (ideal for education)
size:      1280x720       (HD, works everywhere)
audio:     intelligent    (Sora + optional merge)
```

---

## 📝 Usage Pattern

```typescript
// From UI - ALWAYS send same format
const response = await fetch('/api/generate?renderVersion=v3', {
  method: 'POST',
  body: JSON.stringify({
    scriptOrQuestion: "Your question here",
    audioBuffer: narrationAudio // optional
  })
});

const { jobId } = await response.json();

// Subscribe to updates
ws.send(JSON.stringify({
  action: 'subscribe',
  jobId: jobId
}));

// Listen for progress
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.status === 'completed') {
    downloadVideo(jobId);
  }
});
```

---

## 🎵 Audio Strategy

```
If audioBuffer:
  ├─ Sora video might have native sound
  └─ Merge: Sora (background) + User (foreground)

If NO audioBuffer:
  └─ Use Sora's native sound only
```

**Result**: Always optimal audio!

---

## 🔄 Request Flow

```
POST /api/generate?renderVersion=v3
  ↓
{ jobId }
  ↓
WS subscribe: { action: 'subscribe', jobId }
  ↓
Progress updates: { status, progress }
  ↓
When complete: GET /api/download?jobId=:jobId&renderVersion=v3
  ↓
MP4 video file
```

---

## 📊 Status Codes

| Status | Meaning | Action |
|--------|---------|--------|
| `queued` | Waiting | Keep polling |
| `in_progress` | Generating | Update progress bar |
| `completed` | Ready | Download video |
| `failed` | Error | Show error message |

---

## ⏱️ Expected Times

```
Creating job:   < 1 second
Generating:     2-5 minutes
Downloading:    < 1 second
Total:          2-5 minutes
```

---

## 🛡️ Error Handling

```typescript
try {
  const jobId = await generateVideoWithSora(question, audio);
} catch (error) {
  if (error.includes('OPENAI_API_KEY'))
    // Set environment variable

  if (error.includes('timeout'))
    // Video took too long, try simpler question

  if (error.includes('policy'))
    // Question violates content policy

  if (error.includes('failed'))
    // Sora API error, retry later
}
```

---

## 📱 UI Components Needed

- [ ] Text input for question
- [ ] Audio file upload / TTS integration
- [ ] Progress bar (0-100%)
- [ ] Status indicator (queued → in_progress → completed)
- [ ] Download button (shown when ready)
- [ ] Error message display

---

## 🔗 API Endpoints

```
POST   /api/generate?renderVersion=v3                    Create job
GET    /api/status?jobId=:id&renderVersion=v3           Check status (polling fallback)
GET    /api/download?jobId=:id&renderVersion=v3         Download video
POST   /api/webhook/video-events                         Webhook for real-time events
```

---

## 🔐 Environment

```bash
export OPENAI_API_KEY=sk-...
```

That's all!

---

## 📚 Documentation Files

- **SORA_V3_SIMPLE.md** - Full integration guide (start here!)
- **SORA_V3_PRESET_CONFIG.md** - Preset philosophy & details
- **SORA_V3_FLOWS.md** - Diagrams & flow charts
- **SORA_V3_ROUTE_EXAMPLE.ts** - Express route examples
- **SORA_V3_QUICK_REFERENCE.md** - This file!

---

## ✅ Checklist

- [ ] Read SORA_V3_SIMPLE.md
- [ ] Set OPENAI_API_KEY environment variable
- [ ] Copy route examples from SORA_V3_ROUTE_EXAMPLE.ts
- [ ] Use `/api/generate?renderVersion=v3` endpoint
- [ ] Connect UI to new endpoint
- [ ] Implement websocket subscription
- [ ] Add progress bar UI component
- [ ] Add error handling
- [ ] Test with simple question
- [ ] Deploy!

---

## 🎓 Example: From UI to Video

```typescript
// 1. User inputs
const question = "Explain blockchain technology";
const narration = await generateTTS("Blockchain uses...");

// 2. Send to backend
const { jobId } = await POST('/api/generate?renderVersion=v3', {
  scriptOrQuestion: question,
  audioBuffer: narration
});

// 3. Subscribe to updates
ws.subscribe(jobId);

// 4. Server generates (2-5 min)
// WS: { status: 'queued', progress: 0 }
// WS: { status: 'in_progress', progress: 45 }
// WS: { status: 'completed', progress: 100 }

// 5. Download when ready
const videoBlob = await GET(`/api/download?jobId=${jobId}&renderVersion=v3`);

// 6. Save or display
saveToFile(videoBlob, 'blockchain.mp4');
```

**That's it!** No model selection, no duration choice, no format decision. Just question → video!

---

## 🚨 Common Issues

| Issue | Fix |
|-------|-----|
| "OPENAI_API_KEY not found" | `export OPENAI_API_KEY=...` |
| "Video generation timeout" | Simplify your question |
| "Content policy violation" | Check question for violations |
| "Not generating in time" | Normal (2-5 min), be patient |
| "Audio out of sync" | Provide correct TTS audio |

---

## 🎯 Key Principle

**Preset everything except the question.**

Makes integration fast, reduces errors, simplifies maintenance.
