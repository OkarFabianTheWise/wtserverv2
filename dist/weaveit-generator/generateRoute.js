import express from 'express';
import crypto from 'crypto';
import { enhanceScript, generateTitle } from '../codeAnalyzer.js';
import { generateSpeechBuffer } from '../textToSpeech.js';
import { generateScrollingScriptVideoBuffer } from '../videoGenerator.js';
import { setupRemotionV2 } from '../remotion/openaiProcessor.js';
import { renderAnimationScriptToVideo } from '../remotion/videoGenerator.js';
import { generateVideoWithSora } from '../remotion/videoGenerator.js';
import { createVideoJob, updateJobStatus, storeVideo, deductUserPoints } from '../db.js';
import pool from '../db.js';
import { registerSoraJob } from '../soraPollingService.js';
const router = express.Router();
// Environment variables
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'default-webhook-secret';
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3001/api/webhooks/job-update';
const VERBOSE_LOGGING = process.env.VERBOSE_LOGGING === 'true';
// Helper function to estimate audio duration from MP3 buffer (in seconds)
function estimateAudioDuration(buffer) {
    // MP3 bitrate estimation: use average bitrate of 128kbps
    const estimatedBitrate = 128000; // bits per second
    const durationSeconds = (buffer.length * 8) / estimatedBitrate;
    return Math.round(durationSeconds);
}
// Function to send webhook
async function sendWebhook(jobId, status, videoId, duration, error) {
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
        }
        else {
            // console.log(`✅ Webhook sent for job ${jobId}: ${status}`);
        }
    }
    catch (err) {
        console.error('Error sending webhook:', err);
    }
}
// Background processing function
async function processVideoGeneration(jobId, walletAddress, script, voiceoverText, renderVersion = 'v2', animationScriptData) {
    try {
        // if (VERBOSE_LOGGING) console.log(`🚀 Starting background processing for job ${jobId} using ${renderVersion}`);
        let videoBuffer;
        let durationSec;
        let audioBuffer;
        if (renderVersion === 'v3') {
            // ===== SORA V3 GENERATION =====
            // Generate Sora video (already includes native audio)
            const soraJobId = await generateVideoWithSora(voiceoverText);
            // Register for server-driven polling
            // Server will poll Sora API and send webhook updates to client
            const webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:3001/api/webhooks/job-update';
            await registerSoraJob(jobId, soraJobId, webhookUrl);
            // Update status to pending (waiting for Sora API)
            await updateJobStatus(jobId, 'pending');
            return;
        }
        else {
            // ===== AUDIO GENERATION PHASE (V1 & V2) =====
            // Generate speech buffer from voiceover text
            audioBuffer = await generateSpeechBuffer(voiceoverText);
            // if (VERBOSE_LOGGING) console.log(`Generated audio: ${audioBuffer.length} bytes`);
            // ===== VIDEO RENDERING PHASE =====
            // Choose rendering engine based on version
            if (renderVersion === 'v2') {
                // For v2, animationScript is pre-processed in setup phase
                if (animationScriptData) {
                    // Use pre-processed AnimationScript from setup phase
                    // This merges the rendered animation with the audio
                    videoBuffer = await renderAnimationScriptToVideo(animationScriptData, audioBuffer);
                }
                else {
                    // Fallback: shouldn't happen in v2, but keep for safety
                    throw new Error('AnimationScript not provided for v2 rendering');
                }
            }
            else {
                // v1 rendering
                videoBuffer = await generateScrollingScriptVideoBuffer(script, audioBuffer);
            }
            // if (VERBOSE_LOGGING) console.log(`Generated video: ${videoBuffer.length} bytes`);
            // ===== VIDEO STORAGE PHASE =====
            // Calculate duration from audio buffer (in seconds)
            durationSec = estimateAudioDuration(audioBuffer);
            // if (VERBOSE_LOGGING) console.log(`Estimated duration: ${durationSec} seconds`);
            // Store video in database
            const videoId = await storeVideo(jobId, walletAddress, videoBuffer, durationSec);
            // if (VERBOSE_LOGGING) console.log('Stored video in database:', videoId);
            await sendWebhook(jobId, 'completed', videoId, durationSec);
            // Update job to completed
            await updateJobStatus(jobId, 'completed');
        }
    }
    catch (error) {
        if (VERBOSE_LOGGING)
            console.error(`❌ Background processing error for job ${jobId}:`, error);
        // Send webhook
        await sendWebhook(jobId, 'failed', undefined, undefined, String(error));
        // Update job status to failed
        await updateJobStatus(jobId, 'failed', String(error)).catch(console.error);
    }
}
// POST /api/generate
const generateHandler = async (req, res) => {
    let jobId = null;
    try {
        let { walletAddress, script, prompt } = req.body;
        const renderVersion = req.query.renderVersion || 'v2'; // Default to v2
        // Validate render version
        if (!['v1', 'v2', 'v3'].includes(renderVersion)) {
            res.status(400).json({ error: 'Invalid renderVersion. Use v1, v2, or v3' });
            return;
        }
        if (!script || typeof script !== 'string' || script.trim() === '') {
            res.status(400).json({ error: 'Missing script in request body' });
            return;
        }
        // Wallet address is required for database storage
        if (!walletAddress || typeof walletAddress !== 'string') {
            res.status(400).json({ error: 'Missing walletAddress in request body' });
            return;
        }
        // if (VERBOSE_LOGGING) console.log('weaveit-generator: Processing tutorial request:', { walletAddress, scriptLength: script.length, hasPrompt: !!prompt, renderVersion });
        // Check credit balance before proceeding (video costs 2 credits)
        const VIDEO_COST = 2;
        const newBalance = await deductUserPoints(walletAddress, VIDEO_COST);
        if (newBalance === null) {
            res.status(402).json({
                error: 'Insufficient credits for video generation',
                required: VIDEO_COST,
                message: 'Please purchase credits or wait for trial replenishment'
            });
            return;
        }
        // ===== SETUP PHASE =====
        let title;
        let explanation;
        let animationScript = null;
        if (renderVersion === 'v2') {
            // V2: Setup Remotion and get everything we need
            console.log('🚀 Setting up Remotion v2 for script...');
            const remotionSetup = await setupRemotionV2(script);
            title = remotionSetup.title;
            explanation = remotionSetup.voiceoverText; // Use the voiceover from AnimationScript
            animationScript = remotionSetup.animationScript; // Save for background rendering
            // Log the AnimationScript response for vetting
            console.log('\n📋 ===== OPENAI RESPONSE (AnimationScript) =====');
            console.log('Title:', title);
            console.log('Voiceover Text:', explanation);
            console.log('AnimationScript Structure:');
            console.log(JSON.stringify(animationScript, null, 2));
            console.log('===== END RESPONSE =====\n');
            console.log('✅ Remotion v2 setup complete');
        }
        else if (renderVersion === 'v3') {
            // V3: Sora video generation - minimal setup
            console.log('🚀 Setting up Sora v3 for script...');
            title = script.substring(0, 50) + (script.length > 50 ? '...' : '');
            explanation = script; // Pass the entire script to Sora
            console.log('✅ Sora v3 setup complete');
        }
        else {
            // V1: Use old approach
            title = await generateTitle(script);
            explanation = await enhanceScript(script, prompt);
        }
        // Create job in database with job_type = 'video'
        jobId = await createVideoJob(walletAddress, script, title, 'video');
        // if (VERBOSE_LOGGING) console.log('Created job:', jobId);
        // Update status to generating
        await updateJobStatus(jobId, 'generating');
        // Respond immediately with job ID
        res.json({
            jobId,
            status: 'generating',
            title,
            renderVersion,
            creditsDeducted: VIDEO_COST,
            remainingCredits: newBalance,
            message: `Video generation started using ${renderVersion}. Check status via polling or webhook.`,
        });
        // ===== BACKGROUND PROCESSING PHASE =====
        // Process in background
        setImmediate(() => {
            processVideoGeneration(jobId, walletAddress, script, explanation, renderVersion, animationScript);
        });
    }
    catch (error) {
        if (VERBOSE_LOGGING)
            console.error('weaveit-generator: Video generation setup error:', error);
        // Update job status to failed if we have a jobId
        if (jobId) {
            await updateJobStatus(jobId, 'failed', String(error)).catch(console.error);
            await sendWebhook(jobId, 'failed', undefined, undefined, String(error));
        }
    }
    if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to start video generation' });
    }
    return;
};
router.post('/generate', generateHandler);
// GET /api/download?jobId=:jobId&renderVersion=v3
// Download completed v3 Sora video from database
router.get('/download', async (req, res) => {
    try {
        const renderVersion = req.query.renderVersion || 'v2';
        const jobId = req.query.jobId;
        // Only v3 uses this endpoint for Sora
        if (renderVersion !== 'v3') {
            res.status(400).json({ error: 'Download endpoint is for renderVersion=v3 (Sora videos)' });
            return;
        }
        if (!jobId) {
            res.status(400).json({ error: 'jobId is required' });
            return;
        }
        console.log(`📥 Downloading v3 video for job ${jobId}`);
        // Get video from database
        const result = await pool.query('SELECT video_data FROM videos WHERE job_id = $1', [jobId]);
        if (result.rows.length === 0 || !result.rows[0].video_data) {
            res.status(404).json({ error: 'Video not found or still processing' });
            return;
        }
        const videoBuffer = result.rows[0].video_data;
        console.log(`✅ Streaming v3 video ${jobId} (${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
        // Stream video to client
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Length', videoBuffer.length);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.setHeader('Content-Disposition', `attachment; filename="sora-video-${jobId.slice(0, 8)}.mp4"`);
        res.send(videoBuffer);
    }
    catch (err) {
        console.error('Error downloading video:', err);
        res.status(500).json({ error: 'Failed to download video' });
    }
});
export default router;
//# sourceMappingURL=generateRoute.js.map