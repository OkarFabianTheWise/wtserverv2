/**
 * Example Sora v3 API Route Handler
 * Drop-in example for Express routes
 * 
 * Use this to understand how to integrate Sora v3 into your API
 */

import express, { Request, Response } from 'express';
import {
    generateVideoWithSora,
    getSoraVideoStatus,
    downloadSoraVideo,
    generateAndDownloadSoraVideo
} from '../remotion/videoGenerator';
import { webSocketManager } from '../websocket'; // Your WS manager

const router = express.Router();

/**
 * POST /api/generate?renderVersion=v3
 * Create a Sora video generation job (v3 only)
 * 
 * Body:
 * {
 *   scriptOrQuestion: string,
 *   audioBuffer?: Buffer (optional)
 * }
 * 
 * Returns: { jobId: string }
 */
router.post('/generate', async (req: Request, res: Response) => {
    const renderVersion = req.query.renderVersion || 'v2';

    // Only v3 uses this endpoint for Sora
    if (renderVersion !== 'v3') {
        return res.status(400).json({ error: 'Use renderVersion=v3 for Sora video generation' });
    }

    try {
        const { scriptOrQuestion, audioBuffer } = req.body;

        if (!scriptOrQuestion || typeof scriptOrQuestion !== 'string') {
            return res.status(400).json({ error: 'scriptOrQuestion is required' });
        }

        console.log('📹 Creating Sora video job...');
        const jobId = await generateVideoWithSora(scriptOrQuestion, audioBuffer);

        // Send initial progress update
        webSocketManager.emitProgress(
            jobId,
            0,
            'queued',
            'Video generation job created',
            { jobId }
        );

        // Start polling in background (don't await)
        startBackgroundPolling(jobId, audioBuffer);

        res.json({
            jobId,
            message: 'Video generation started. Subscribe to jobId for updates.',
            model: 'sora-2',
            duration: '8 seconds',
            estimatedTime: '2-5 minutes'
        });
    } catch (error: any) {
        console.error('❌ Error creating video:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/status?jobId=:jobId&renderVersion=v3
 * Check status of a video generation job (v3 only)
 * 
 * Returns: { id, status, progress, url? }
*/
router.get('/status', async (req: Request, res: Response) => {
    const renderVersion = req.query.renderVersion || 'v2';
    const jobId = req.query.jobId as string;

    // Only v3 uses this endpoint for Sora
    if (renderVersion !== 'v3') {
        return res.status(400).json({ error: 'Use renderVersion=v3 for Sora video generation' });
    }

    if (!jobId) {
        return res.status(400).json({ error: 'jobId is required' });
    }

    try {
        const status = await getSoraVideoStatus(jobId);

        res.json(status);
    } catch (error: any) {
        console.error('❌ Error checking status:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/download?jobId=:jobId&renderVersion=v3
 * Download completed video (v3 only)
 * 
 * Query params:
 * - jobId: required, the job ID
 * - audioBuffer: optional audio to merge (as base64)
 * 
 * Returns: MP4 video file
 */
router.get('/download', async (req: Request, res: Response) => {
    const renderVersion = req.query.renderVersion || 'v2';
    const jobId = req.query.jobId as string;
    const audioBase64 = req.query.audioBuffer as string;

    // Only v3 uses this endpoint for Sora
    if (renderVersion !== 'v3') {
        return res.status(400).json({ error: 'Use renderVersion=v3 for Sora video generation' });
    }

    if (!jobId) {
        return res.status(400).json({ error: 'jobId is required' });
    }

    try {
        // Decode audio if provided
        let audioBuffer: Buffer | undefined;
        if (audioBase64 && typeof audioBase64 === 'string') {
            audioBuffer = Buffer.from(audioBase64, 'base64');
        }

        console.log('📥 Downloading video...');
        const videoBuffer = await downloadSoraVideo(jobId, audioBuffer);

        // Send as MP4 file
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="video-${jobId}.mp4"`);
        res.send(videoBuffer);
    } catch (error: any) {
        console.error('❌ Error downloading video:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/webhook/video-events?webhookSecret=:secret
 * Webhook endpoint to receive Sora video generation events (v3 only)
 * 
 * Receives events from OpenAI Sora API when jobs complete or fail
 * Signature verification recommended for security
 * 
 * Event types:
 * - video.completed: Video successfully generated
 * - video.failed: Video generation failed
 */
router.post('/webhook/video-events', async (req: Request, res: Response) => {
    try {
        // Optional: Verify webhook signature using OpenAI SDK
        // const event = await openai.webhooks.unwrap(req.body, req.headers, {
        //     secret: process.env.OPENAI_WEBHOOK_SECRET
        // });

        const event = req.body;
        const jobId = event.data?.id;

        if (!jobId) {
            return res.status(400).json({ error: 'Missing job ID in webhook' });
        }

        console.log(`🔔 Webhook event: ${event.type} for job ${jobId}`);

        if (event.type === 'video.completed') {
            // Notify UI via websocket
            webSocketManager.emitProgress(
                jobId,
                100,
                'completed',
                'Video generation completed via webhook',
                { readyForDownload: true, completedAt: new Date() }
            );

            // Optional: Store completion metadata in database
            // await db.updateJob(jobId, { status: 'completed' });
        } else if (event.type === 'video.failed') {
            webSocketManager.emitProgress(
                jobId,
                0,
                'failed',
                'Video generation failed',
                { error: event.data?.error || 'Unknown error', failedAt: new Date() }
            );

            // Optional: Log failure
            // await db.updateJob(jobId, { status: 'failed', error: event.data?.error });
        }

        // Always respond quickly with 2xx to acknowledge receipt
        // OpenAI will retry on any non-2xx or timeout
        res.status(200).json({ received: true });
    } catch (error: any) {
        console.error('❌ Webhook processing error:', error);
        // Still respond with 2xx to avoid retries on our processing errors
        res.status(200).json({ received: true, error: error.message });
    }
});

/**
 * Background polling function
 * Polls job status and broadcasts updates to websocket subscribers
 */
async function startBackgroundPolling(jobId: string, audioBuffer?: Buffer) {
    const maxAttempts = 120; // 10 minutes max
    let attempts = 0;

    try {
        while (attempts < maxAttempts) {
            // Wait 5 seconds between polls
            await new Promise(resolve => setTimeout(resolve, 5000));
            attempts++;

            const status = await getSoraVideoStatus(jobId);

            // Broadcast progress to all subscribers
            webSocketManager.emitProgress(
                jobId,
                status.progress || 0,
                status.status,
                `Video generation ${status.status}`,
                { progress: status.progress }
            );

            if (status.status === 'completed') {
                // Optionally auto-download or just notify
                console.log('✅ Video generation completed, ready for download');
                webSocketManager.emitProgress(
                    jobId,
                    100,
                    'completed',
                    'Video ready. Use download endpoint to retrieve.',
                    { readyForDownload: true }
                );
                break;
            } else if (status.status === 'failed') {
                console.error('❌ Video generation failed');
                webSocketManager.emitProgress(
                    jobId,
                    0,
                    'failed',
                    'Video generation failed',
                    { error: 'Sora API failed to generate video' }
                );
                break;
            }
        }

        if (attempts >= maxAttempts) {
            console.error('⏱️ Video generation timeout');
            webSocketManager.emitProgress(
                jobId,
                0,
                'failed',
                'Video generation timeout',
                { error: 'Generation exceeded maximum wait time' }
            );
        }
    } catch (error) {
        console.error('❌ Polling error:', error);
        webSocketManager.emitProgress(
            jobId,
            0,
            'failed',
            'Polling error',
            { error: String(error) }
        );
    }
}

export default router;

/**
 * Usage Examples for UI
 * 
 * RECOMMENDED: Webhook + WebSocket Pattern
 * =========================================
 * 1. UI calls POST /api/generate?renderVersion=v3 to create job
 * 2. Server registers webhook with OpenAI to be notified when complete
 * 3. OpenAI calls your /webhook/video-events when job finishes
 * 4. Webhook handler emits websocket event to UI in real-time
 * 5. UI downloads via GET /api/download?jobId=X&renderVersion=v3
 * 
 * Benefits:
 * - No polling needed
 * - Real-time updates via websocket
 * - Handles network failures gracefully
 * - OpenAI retries failed webhooks for 72 hours
 * - Webhook is the standard pattern for async operations
 * 
 * Implementation:
 * ```typescript
 * // 1. Request video generation
 * const response = await fetch('/api/generate?renderVersion=v3', {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     scriptOrQuestion: "Explain binary search",
 *     audioBuffer: narrationAudio // optional
 *   })
 * });
 * const { jobId } = await response.json();
 * 
 * // 2. Subscribe to live updates via websocket
 * ws.send(JSON.stringify({ action: 'subscribe', jobId }));
 * 
 * // 3. Listen for webhook-triggered progress events
 * ws.on('message', (data) => {
 *   const msg = JSON.parse(data);
 *   if (msg.jobId === jobId) {
 *     if (msg.status === 'completed') {
 *       // Webhook fired! Download the video
 *       downloadVideo(jobId);
 *     } else if (msg.status === 'failed') {
 *       showError(msg.message);
 *     }
 *   }
 * });
 * 
 * // 4. Download when ready
 * const videoBlob = await fetch(
 *   `/api/download?jobId=${jobId}&renderVersion=v3`
 * ).then(r => r.blob());
 * ```
 * 
 * ALTERNATIVE: Polling Pattern (if webhooks unavailable)
 * ======================================================
 * If you cannot receive webhooks, poll the status endpoint:
 * 
 * ```typescript
 * const jobId = await startVideoGeneration(...);
 * 
 * // Poll every 5 seconds
 * const pollInterval = setInterval(async () => {
 *   const status = await fetch(
 *     `/api/status?jobId=${jobId}&renderVersion=v3`
 *   ).then(r => r.json());
 *   
 *   updateUI(status);
 *   
 *   if (status.status === 'completed') {
 *     clearInterval(pollInterval);
 *     downloadVideo(jobId);
 *   }
 * }, 5000);
 * ```
 */
