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
 * ALTERNATIVE: POST /api/generate?renderVersion=v3&complete=true
 * One-call workflow: generate → poll → download (v3 only)
 * 
 * This is an alternative to the streaming endpoints above.
 * Use this if you need a single synchronous call.
 * 
 * Body:
 * {
 *   scriptOrQuestion: string,
 *   audioBuffer?: Buffer (optional)
 * }
 * 
 * Returns: MP4 video file
 * 
 * Note: This endpoint blocks until video is ready (up to 10 minutes)
 * For better UX, use the streaming pattern above instead.
 * 
 * IMPLEMENTATION EXAMPLE:
 * 
 * if (renderVersion === 'v3' && complete) {
 *     try {
 *         const { scriptOrQuestion, audioBuffer } = req.body;
 *         
 *         if (!scriptOrQuestion || typeof scriptOrQuestion !== 'string') {
 *             return res.status(400).json({ error: 'scriptOrQuestion is required' });
 *         }
 *         
 *         console.log('🎬 Starting complete video generation...');
 *         const videoBuffer = await generateAndDownloadSoraVideo(scriptOrQuestion, audioBuffer);
 *         
 *         // Send as MP4 file
 *         res.setHeader('Content-Type', 'video/mp4');
 *         res.setHeader('Content-Disposition', 'attachment; filename="video.mp4"');
 *         res.send(videoBuffer);
 *     } catch (error: any) {
 *         console.error('❌ Error in generate-and-download:', error);
 *         res.status(500).json({ error: error.message });
 *     }
 *     return;
 * }
 * 
 * // Handle other renderVersion values (v1, v2, etc.)
 * // ... rest of handler for non-v3 versions
 */

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
 * 1. Streaming Mode (Recommended)
 * ```typescript
 * // Request
 * const response = await fetch('/api/v3/generate-video', {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     scriptOrQuestion: "Explain binary search",
 *     audioBuffer: narrationAudio // optional
 *   })
 * });
 * const { jobId } = await response.json();
 * 
 * // Subscribe to updates
 * ws.send(JSON.stringify({ action: 'subscribe', jobId }));
 * 
 * // Listen for progress
 * ws.on('message', (data) => {
 *   const msg = JSON.parse(data);
 *   if (msg.jobId === jobId) {
 *     updateProgressBar(msg.progress);
 *     if (msg.status === 'completed') {
 *       downloadVideo(jobId);
 *     }
 *   }
 * });
 * ```
 * 
 * 2. Simple Download After Ready
 * ```typescript
 * // After video is completed (check status first)
 * const videoBlob = await fetch(`/api/v3/download/${jobId}`).then(r => r.blob());
 * const url = URL.createObjectURL(videoBlob);
 * // Display or download
 * ```
 * 
 * 3. Synchronous (Blocking)
 * ```typescript
 * // One call returns the video (up to 10 minute wait)
 * const videoBlob = await fetch('/api/v3/generate-and-download', {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     scriptOrQuestion: "Make a tutorial video",
 *     audioBuffer: narration
 *   })
 * }).then(r => r.blob());
 * ```
 */
