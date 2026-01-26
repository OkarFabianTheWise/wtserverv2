import express from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import { enhanceScript, generateTitle } from '../codeAnalyzer.js';
import { generateSpeechBuffer } from '../textToSpeech.js';
import { createVideoJob, updateJobStatus, storeAudio, deductUserPoints } from '../db.js';

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
async function sendWebhook(jobId: string, status: string, audioId?: string, duration?: number, error?: string) {
  try {
    const payload = {
      jobId,
      status,
      audioId,
      duration,
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
async function processAudioGeneration(jobId: string, walletAddress: string, script: string, explanation: string) {
  try {
    // console.log(`🚀 Starting background processing for audio job ${jobId}`);

    // Generate speech buffer (no file saving)
    const audioBuffer = await generateSpeechBuffer(explanation);
    // console.log(`Generated audio: ${audioBuffer.length} bytes`);

    // Calculate duration from audio buffer (in seconds)
    const durationSec = estimateAudioDuration(audioBuffer);
    // console.log(`Estimated duration: ${durationSec} seconds`);

    // Store audio in database
    const audioId = await storeAudio(jobId, walletAddress, audioBuffer, durationSec);
    // console.log('Stored audio in database:', audioId);

    // Update job status to completed
    await updateJobStatus(jobId, 'completed');

    // Send webhook
    await sendWebhook(jobId, 'completed', audioId, durationSec);

  } catch (error) {
    if (VERBOSE_LOGGING) console.error(`❌ Background processing error for audio job ${jobId}:`, error);

    // Send webhook
    await sendWebhook(jobId, 'failed', undefined, undefined, String(error));

    // Update job status to failed
    await updateJobStatus(jobId, 'failed', String(error)).catch(console.error);
  }
}

// POST /api/generate/audio
const generateAudioHandler = async (req: Request, res: Response): Promise<void> => {
  let jobId: string | null = null;

  try {
    let { walletAddress, script, prompt } = req.body;

    if (!script || typeof script !== 'string' || script.trim() === '') {
      res.status(400).json({ error: 'Missing script in request body' });
      return;
    }

    // Wallet address is required for database storage
    if (!walletAddress || typeof walletAddress !== 'string') {
      res.status(400).json({ error: 'Missing walletAddress in request body' });
      return;
    }

    // console.log('weaveit-generator: Processing audio-only request:', { walletAddress, scriptLength: script.length, hasPrompt: !!prompt });

    // Check credit balance before proceeding (audio costs 1 credit)
    const AUDIO_COST = 1;
    const newBalance = await deductUserPoints(walletAddress, AUDIO_COST);
    if (newBalance === null) {
      res.status(402).json({
        error: 'Insufficient credits for audio generation',
        required: AUDIO_COST,
        message: 'Please purchase credits or wait for trial replenishment'
      });
      return;
    }

    // Generate title automatically based on script content
    const title = await generateTitle(script);
    // console.log('Generated title:', title);

    // Create job in database with job_type = 'audio'
    jobId = await createVideoJob(walletAddress, script, title, 'audio');
    // console.log('Created audio job:', jobId);

    // Update status to generating
    await updateJobStatus(jobId, 'generating');

    // Enhance the script for narration (use custom prompt if provided)
    const explanation = await enhanceScript(script, prompt);

    // Respond immediately with job ID
    res.json({
      jobId,
      status: 'generating',
      title,
      creditsDeducted: AUDIO_COST,
      remainingCredits: newBalance,
      message: 'Audio generation started. Check status via polling or webhook.',
    });

    // Process in background
    setImmediate(() => {
      processAudioGeneration(jobId!, walletAddress, script, explanation);
    });

  } catch (error) {
    console.error('weaveit-generator: Audio generation setup error:', error);

    // Update job status to failed if we have a jobId
    if (jobId) {
      await updateJobStatus(jobId, 'failed', String(error)).catch(console.error);
      await sendWebhook(jobId, 'failed', undefined, undefined, String(error));
    }

    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to start audio generation' });
    }
    return;
  }
};

router.post('/generate/audio', generateAudioHandler);

export default router;
