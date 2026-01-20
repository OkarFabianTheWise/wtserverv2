/**
 * RENDERING VERSION GUIDE
 * 
 * The `/api/generate` endpoint now supports both v1 and v2 rendering via query parameter.
 * 
 * DEFAULT: v2 (Remotion 2.0 with AI-generated animation scripts)
 */

// ============================================================================
// FRONTEND USAGE EXAMPLES
// ============================================================================

// Using v2 (default - recommended)
fetch('/api/generate?renderVersion=v2', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    walletAddress: '0x123...',
    script: 'Explain how APIs work',
    prompt: 'Use a restaurant metaphor' // optional
  })
})
.then(res => res.json())
.then(data => console.log(data))
// Response:
// {
//   jobId: 'job_xxx',
//   status: 'generating',
//   title: 'Generated title',
//   renderVersion: 'v2',
//   creditsDeducted: 2,
//   remainingCredits: 48,
//   message: 'Video generation started using v2...'
// }

// ============================================================================

// Using v1 (legacy - scrolling text rendering)
fetch('/api/generate?renderVersion=v1', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    walletAddress: '0x123...',
    script: 'JavaScript tutorial content here...',
    prompt: 'Custom narration prompt' // optional
  })
})
.then(res => res.json())
.then(data => console.log(data))
// Response:
// {
//   jobId: 'job_yyy',
//   status: 'generating',
//   title: 'Generated title',
//   renderVersion: 'v1',
//   creditsDeducted: 2,
//   remainingCredits: 48,
//   message: 'Video generation started using v1...'
// }

// ============================================================================

// Omitting renderVersion defaults to v2
fetch('/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    walletAddress: '0x123...',
    script: 'Any tutorial content...'
  })
})
// Automatically uses v2

// ============================================================================
// RENDERING DIFFERENCES
// ============================================================================

/**
 * V1: Legacy Scrolling Text Rendering
 * ─────────────────────────────────────
 * - Displays code/text scrolling on screen
 * - Uses videoGenerator.ts (generateScrollingScriptVideoBuffer)
 * - Simple but effective for code tutorials
 * - Deterministic output (same input = same video)
 * - No AI-generated animation scripts
 * - Best for: Code-heavy tutorials, step-by-step guides
 * 
 * V2: Remotion 2.0 AI-Generated Animations (NEW)
 * ────────────────────────────────────────────────
 * - AI (GPT-4) generates animation scripts from text
 * - Uses Remotion 2D component library with:
 *   - Characters: AppCharacter, ChefCharacter, CustomerCharacter, WorkerCharacter
 *   - Buildings: Restaurant, Bakery, Library, Factory
 *   - UI Elements: MessageBox, DataPacket, LoadingSpinner, etc.
 * - Dynamic composition selection (RestaurantComposition, FactoryComposition, etc.)
 * - Contextual analogies (APIs as restaurants, pipelines as factories, etc.)
 * - Variable output (AI can create different interpretations)
 * - Best for: Concept explanations, metaphor-based learning
 */

// ============================================================================
// QUERY PARAMETER VALIDATION
// ============================================================================

/**
 * Valid values:
 * - 'v1' → Use legacy scrolling text rendering
 * - 'v2' → Use Remotion 2.0 AI animations (default)
 * - anything else → Returns 400 error "Invalid renderVersion. Use v1 or v2"
 * - undefined/omitted → Defaults to 'v2'
 */

// INVALID
fetch('/api/generate?renderVersion=v3', { ... })
// Returns: { error: 'Invalid renderVersion. Use v1 or v2' }

// INVALID
fetch('/api/generate?renderVersion=latest', { ... })
// Returns: { error: 'Invalid renderVersion. Use v1 or v2' }

// VALID
fetch('/api/generate?renderVersion=v2', { ... })
// Works

// VALID (defaults to v2)
fetch('/api/generate', { ... })
// Works

// ============================================================================
// A/B TESTING SETUP
// ============================================================================

/**
 * To compare v1 and v2 output with same input:
 */

const walletAddress = '0x123...';
const script = 'Explain callbacks in JavaScript';
const sharedConfig = { walletAddress, script, prompt: 'Use relatable analogies' };

// Generate v1 version
const v1Response = await fetch('/api/generate?renderVersion=v1', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(sharedConfig)
}).then(r => r.json());

// Generate v2 version
const v2Response = await fetch('/api/generate?renderVersion=v2', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(sharedConfig)
}).then(r => r.json());

console.log('V1 Job:', v1Response.jobId);
console.log('V2 Job:', v2Response.jobId);

// Both videos will be stored with the same content but different rendering
// Poll /api/videos/status/:jobId to check completion

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

/**
 * Progress messages indicate which rendering engine is active:
 * 
 * V1: "Starting video generation (v1)..."
 *     → "Initializing audio generation..."
 *     → "Audio narration completed"
 *     → "Creating video from script..."
 *     → "Video creation completed"
 *     → "Storing video in database..."
 * 
 * V2: "Starting video generation (v2)..."
 *     → "Initializing audio generation..."
 *     → "Audio narration completed"
 *     → "Preparing Remotion 2.0 rendering..."
 *     → "Generating animation with AI script..."
 *     → "Remotion 2.0 rendering completed"
 *     → "Storing video in database..."
 */

// Listen to progress via WebSocket or SSE
const eventSource = new EventSource(`/api/jobs/events?jobIds=${jobId}`);
eventSource.onmessage = (event) => {
  const { progress, step } = JSON.parse(event.data);
  console.log(`Progress: ${progress}% - ${step}`);
  // Example output for v2:
  // Progress: 20% - Generating animation with AI script...
};

// ============================================================================
