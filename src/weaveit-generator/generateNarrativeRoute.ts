import express from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import { generateNarrativeStoryboard, generateTitle } from '../codeAnalyzer.js';
import { generateSpeechBuffer } from '../textToSpeech.js';
import { processCodeWithOpenAI } from '../remotion/openaiProcessor.js';
import { renderAnimationScriptToVideo } from '../remotion/videoGenerator.js';
import { createVideoJob, updateJobStatus, storeVideo, deductUserPoints } from '../db.js';
import { wsManager } from '../websocket.js';

const router = express.Router();

// Environment variables
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'default-webhook-secret';
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3001/api/webhooks/job-update';
const VERBOSE_LOGGING = process.env.VERBOSE_LOGGING === 'true';

// Helper function to estimate audio duration from MP3 buffer (in seconds)
function estimateAudioDuration(buffer: Buffer): number {
  // MP3 bitrate estimation: use average bitrate of 128kbps
  const estimatedBitrate = 128000; // bits per second
  const durationSeconds = (buffer.length * 8) / estimatedBitrate;
  return Math.round(durationSeconds);
}

// Function to send webhook
async function sendWebhook(jobId: string, status: string, videoId?: string, duration?: number, sceneCount?: number, error?: string) {
  try {
    const payload = {
      jobId,
      status,
      videoId,
      duration,
      sceneCount,
      error,
      timestamp: new Date().toISOString(),
    };

    const body = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': signature,
      },
      body,
    });

    if (!response.ok) {
      console.error(`Webhook failed: ${response.status} ${response.statusText}`);
    } else {
      // console.log(`✅ Webhook sent for job ${jobId}: ${status}`);
    }
  } catch (err) {
    console.error('Error sending webhook:', err);
  }
}

// Background processing function
async function processNarrativeGeneration(jobId: string, walletAddress: string, script: string) {
  try {
    // console.log(`🚀 Starting background processing for narrative job ${jobId}`);

    // Emit initial progress
    wsManager.emitProgress(jobId, 0, 'generating', 'Starting narrative generation...');

    // Generate narrative storyboard
    // console.log('📖 Generating narrative storyboard...');
    wsManager.emitProgress(jobId, 2, 'generating', 'Analyzing script for narrative...');
    wsManager.emitProgress(jobId, 5, 'generating', 'Creating narrative storyboard...');
    const scenes = await generateNarrativeStoryboard(script);

    if (!scenes || scenes.length === 0) {
      throw new Error('Failed to generate narrative scenes');
    }

    // console.log(`✅ Generated ${scenes.length} narrative scenes`);
    wsManager.emitProgress(jobId, 10, 'generating', `Generated ${scenes.length} narrative scenes`);

    // Calculate total narration duration from scenes
    const totalSceneDuration = scenes.reduce((sum, scene) => sum + (scene.duration || 3), 0);
    // console.log(`📊 Total scene duration: ${totalSceneDuration}s`);

    // Generate narration text by combining all scene narrations
    const narrationText = scenes.map((s) => s.narration).join(' ');

    // Generate speech from combined narration
    // console.log('🎙️  Generating audio narration...');
    wsManager.emitProgress(jobId, 15, 'generating', 'Preparing audio generation...');
    wsManager.emitProgress(jobId, 20, 'generating', 'Generating audio narration...');
    const audioBuffer = await generateSpeechBuffer(narrationText);
    // console.log(`Generated audio: ${audioBuffer.length} bytes`);
    wsManager.emitProgress(jobId, 30, 'generating', 'Audio narration completed');

    // Process narration with OpenAI (no re-processing, just once)
    // console.log('🤖 Processing narration with OpenAI...');
    wsManager.emitProgress(jobId, 35, 'generating', 'Processing narration...');
    const animationScript = await processCodeWithOpenAI(narrationText);
    wsManager.emitProgress(jobId, 50, 'generating', 'Animation script ready');

    // Render animation to video using pre-processed script
    // console.log('🎨 Rendering narrative animation video...');
    wsManager.emitProgress(jobId, 55, 'generating', 'Rendering animation...');
    const videoBuffer = await renderAnimationScriptToVideo(animationScript, audioBuffer);
    // console.log(`Generated narrative video: ${videoBuffer.length} bytes`);
    wsManager.emitProgress(jobId, 75, 'generating', 'Video rendering completed');

    // Calculate duration from audio buffer
    const durationSec = estimateAudioDuration(audioBuffer);
    // console.log(`⏱️  Estimated duration: ${durationSec} seconds`);
    wsManager.emitProgress(jobId, 65, 'generating', 'Calculating video duration...');

    // Store video in database
    const videoId = await storeVideo(jobId, walletAddress, videoBuffer, durationSec);
    // console.log('Stored narrative video in database:', videoId);
    wsManager.emitProgress(jobId, 70, 'generating', 'Storing video in database...');

    // Update job status to completed
    await updateJobStatus(jobId, 'completed');

    // Send webhook
    await sendWebhook(jobId, 'completed', videoId, durationSec, scenes.length);

    // Emit completion
    wsManager.emitCompleted(jobId, videoId, durationSec);

  } catch (error) {
    if (VERBOSE_LOGGING) console.error(`❌ Background processing error for narrative job ${jobId}:`, error);

    // Send webhook
    await sendWebhook(jobId, 'failed', undefined, undefined, undefined, String(error));

    // Emit error
    wsManager.emitError(jobId, String(error));
  }
}

// POST /api/generate/narrative
const generateNarrativeHandler = async (req: Request, res: Response): Promise<void> => {
  let jobId: string | null = null;

  try {
    const { walletAddress, script, prompt } = req.body;

    if (!script || typeof script !== 'string' || script.trim() === '') {
      res.status(400).json({ error: 'Missing script in request body' });
      return;
    }

    if (!walletAddress || typeof walletAddress !== 'string') {
      res.status(400).json({ error: 'Missing walletAddress in request body' });
      return;
    }

    // console.log('weaveit-generator: Processing narrative animation request:', { walletAddress, scriptLength: script.length, hasPrompt: !!prompt });

    // Check credit balance (narrative video costs 3 credits - more than simple video)
    const NARRATIVE_COST = 3;
    const newBalance = await deductUserPoints(walletAddress, NARRATIVE_COST);
    if (newBalance === null) {
      res.status(402).json({
        error: 'Insufficient credits for narrative video generation',
        required: NARRATIVE_COST,
        message: 'Please purchase credits or wait for trial replenishment'
      });
      return;
    }

    // Generate title automatically based on script content
    const title = await generateTitle(script);
    // console.log('Generated title:', title);

    // Create job in database with job_type = 'narrative'
    jobId = await createVideoJob(walletAddress, script, title, 'narrative');
    // console.log('Created narrative job:', jobId);

    // Update status to generating
    await updateJobStatus(jobId, 'generating');

    // Respond immediately with job ID
    res.json({
      jobId,
      status: 'generating',
      title,
      creditsDeducted: NARRATIVE_COST,
      remainingCredits: newBalance,
      message: 'Narrative video generation started. Check status via polling or webhook.',
    });

    // Process in background
    setImmediate(() => {
      processNarrativeGeneration(jobId!, walletAddress, script);
    });

  } catch (error) {
    if (VERBOSE_LOGGING) console.error('weaveit-generator: Narrative video generation setup error:', error);

    // Update job status to failed if we have a jobId
    if (jobId) {
      await updateJobStatus(jobId, 'failed', String(error)).catch(console.error);
      await sendWebhook(jobId, 'failed', undefined, undefined, undefined, String(error));
    }

    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to start narrative video generation' });
    }
    return;
  }
};

router.post('/generate/narrative', generateNarrativeHandler);

export default router;
