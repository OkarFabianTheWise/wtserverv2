import express from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import { generateIllustrationVideoWithRemotion } from '../remotionVideoGenerator.js';
import { createVideoJob, updateJobStatus, storeVideo, deductUserPoints } from '../db.js';
import { generateSpeechBuffer } from '../textToSpeech.js';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { generateAnimationScript } from '../animationScriptGenerator.js';

const router = express.Router();

// Environment variables
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'default-webhook-secret';
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3001/api/webhooks/job-update';
const VERBOSE_LOGGING = process.env.VERBOSE_LOGGING === 'true';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Function to generate metaphorical explanation using OpenAI
async function generateExplanation(code: string): Promise<string> {
    const prompt = `Explain this code snippet using real-life scenarios and analogies, like sand, wind, market scenes, school scenes, etc. Make it engaging and illustrative for a 2D animation. Don't just read the code, explain what it does metaphorically.

Code:
${code}

Provide a narrative explanation suitable for voice over and animation, around 100-200 words. Focus on creating vivid scenes that can be visualized.`;

    const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
    });

    return response.choices[0].message.content?.trim() || 'Explanation not available.';
}

// Function to generate animation script using AI
async function generateAnimationScriptForCode(code: string): Promise<any> {
    const explanation = await generateExplanation(code);
    // Use the explanation as the article for the animation script
    return await generateAnimationScript(explanation);
}

// Helper function to estimate duration (fixed for animation)
function estimateDuration(script: string): number {
    // Simple estimation: 5 seconds base + 0.1s per word, max 30s
    const wordCount = script.split(' ').length;
    return Math.min(5000 + wordCount * 100, 30000);
}

// Function to send webhook
async function sendWebhook(jobId: string, status: string, videoId?: string, duration?: number, error?: string) {
    try {
        const payload = {
            jobId,
            status,
            videoId,
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
async function processAnimationGeneration(jobId: string, walletAddress: string, script: string) {
    try {
        // console.log(`🚀 Starting background processing for animation job ${jobId}`);

        // Generate animation script
        const animationScript = await generateAnimationScriptForCode(script);
        // console.log(`Generated animation script:`, animationScript);

        // Generate voice over audio
        const audioBuffer = await generateSpeechBuffer(animationScript.voiceover.text);
        // console.log(`Generated voice over audio: ${audioBuffer.length} bytes`);

        // Generate animation video with Remotion
        const videoBuffer = await generateIllustrationVideoWithRemotion(script, audioBuffer);
        // console.log(`Generated animation video: ${videoBuffer.length} bytes`);

        // Calculate duration in seconds
        const durationSec = Math.round(animationScript.totalDuration / 1000);

        // Store video in database
        const videoId = await storeVideo(jobId, walletAddress, videoBuffer, durationSec);
        // console.log('Stored animation video with voice over in database:', videoId);

        // Update job status to completed
        await updateJobStatus(jobId, 'completed');

        // Send webhook
        await sendWebhook(jobId, 'completed', videoId, durationSec);

        // Update job to completed (redundant but explicit)

    } catch (error) {
        if (VERBOSE_LOGGING) console.error(`❌ Background processing error for animation job ${jobId}:`, error);

        // Send webhook
        await sendWebhook(jobId, 'failed', undefined, undefined, String(error));

        // Update job status to failed
        await updateJobStatus(jobId, 'failed', String(error)).catch(console.error);
    }
}

// POST /api/generate/animation
const generateAnimationHandler = async (req: Request, res: Response): Promise<void> => {
    let jobId: string | null = null;

    try {
        const { walletAddress, script } = req.body;

        if (!script || typeof script !== 'string' || script.trim() === '') {
            res.status(400).json({ error: 'Missing script in request body' });
            return;
        }

        if (!walletAddress || typeof walletAddress !== 'string') {
            res.status(400).json({ error: 'Missing walletAddress in request body' });
            return;
        }

        // console.log('weaveit-generator: Processing animation request:', { walletAddress, scriptLength: script.length });

        // Check credit balance (animation with voice over costs 3 credits)
        const ANIMATION_COST = 2;
        const newBalance = await deductUserPoints(walletAddress, ANIMATION_COST);
        if (newBalance === null) {
            res.status(402).json({
                error: 'Insufficient credits for animation video generation',
                required: ANIMATION_COST,
                message: 'Please purchase credits or wait for trial replenishment'
            });
            return;
        }

        // Generate title automatically based on script content (simple version)
        const title = script.split(' ').slice(0, 5).join(' ') + '...';
        // console.log('Generated title:', title);

        // Create job in database with job_type = 'animation'
        jobId = await createVideoJob(walletAddress, script, title, 'animation');
        // console.log('Created animation job:', jobId);

        // Update status to generating
        await updateJobStatus(jobId, 'generating');

        // Respond immediately with job ID
        res.json({
            jobId,
            status: 'generating',
            title,
            creditsDeducted: ANIMATION_COST,
            remainingCredits: newBalance,
            message: 'Animation video generation started. Check status via polling or webhook.',
        });

        // Process in background
        setImmediate(() => {
            processAnimationGeneration(jobId!, walletAddress, script);
        });

    } catch (error) {
        if (VERBOSE_LOGGING) console.error('weaveit-generator: Animation video generation setup error:', error);

        // Update job status to failed if we have a jobId
        if (jobId) {
            await updateJobStatus(jobId, 'failed', String(error)).catch(console.error);
            await sendWebhook(jobId, 'failed', undefined, undefined, String(error));
        }

        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to start animation video generation' });
        }
        return;
    }
};

router.post('/generate/animation', generateAnimationHandler);

export default router;