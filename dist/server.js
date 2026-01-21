import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { WebSocketServer } from 'ws';
import http from 'http';
import videosStatusRoute from './weaveit-generator/videosStatusRoute.js';
import generateRoute from './weaveit-generator/generateRoute.js';
import generateAudioRoute from './weaveit-generator/generateAudioRoute.js';
import generateNarrativeRoute from './weaveit-generator/generateNarrativeRoute.js';
import generateAnimationRoute from './weaveit-generator/generateAnimationRoute.js';
import pool, { testConnection, getVideoByJobId, getVideoByVideoId, getVideosByWallet, getAudioByJobId, getAudioByAudioId, getContentByWallet, getCompletedJobsCount, getTotalDurationSecondsForWallet, getTotalUsersCount, getTotalVideosCreated, getTotalFailedJobs, updateJobStatus, storeVideo, ensureUser } from './db.js';
import paymentsRoute from './paymentsRoute.js';
import usersRoute from './usersRoute.js';
import { wsManager } from './websocket.js';
// Load environment variables from root .env file
dotenv.config({ path: path.join(process.cwd(), '.env') });
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;
// WebSocket server
const wss = new WebSocketServer({ server });
wss.on('connection', (ws, request) => {
    wsManager.handleConnection(ws, request);
});
app.use(cors());
app.use(express.json());
// Mount API routers under `/api` so frontend can call `/api/generate` and `/api/videos/status/:id`
app.use('/api', videosStatusRoute);
app.use('/api', generateRoute);
app.use('/api', generateAudioRoute);
app.use('/api', generateNarrativeRoute);
app.use('/api', generateAnimationRoute);
app.use('/api', paymentsRoute);
app.use('/api', usersRoute);
// Video serving endpoint - serves video data from database by job ID
app.get('/api/videos/job/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const videoBuffer = await getVideoByJobId(jobId);
        if (!videoBuffer) {
            res.status(404).json({ error: 'Video not found' });
            return;
        }
        // Set proper headers for video streaming
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Length', videoBuffer.length);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
        res.setHeader('Content-Disposition', 'inline'); // Play inline, don't download
        res.send(videoBuffer);
    }
    catch (err) {
        console.error('Error serving video:', err);
        res.status(500).json({ error: 'Failed to retrieve video' });
    }
});
// Video serving endpoint - serves video data from database by video ID
app.get('/api/videos/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        const videoBuffer = await getVideoByVideoId(videoId);
        if (!videoBuffer) {
            res.status(404).json({ error: 'Video not found' });
            return;
        }
        // console.log(`🎬 Serving video ${videoId}: ${videoBuffer.length} bytes`);
        // console.log(`🎬 First 20 bytes: ${videoBuffer.slice(0, 20).toString('hex')}`);
        // console.log(`🎬 Is MP4 header: ${videoBuffer.slice(4, 8).toString() === 'ftyp'}`);
        // Set proper headers for video streaming
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Length', videoBuffer.length);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
        res.setHeader('Content-Disposition', 'inline'); // Play inline, don't download
        res.send(videoBuffer);
    }
    catch (err) {
        console.error('Error serving video:', err);
        res.status(500).json({ error: 'Failed to retrieve video' });
    }
});
// Get all video IDs for a wallet address
app.get('/api/wallet/:walletAddress/videos', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        // Ensure user exists and has free credits if new
        await ensureUser(walletAddress);
        const videos = await getVideosByWallet(walletAddress);
        res.json({
            wallet_address: walletAddress,
            count: videos.length,
            videos: videos.map(v => ({
                video_id: v.video_id,
                job_id: v.job_id,
                title: v.title,
                duration_sec: v.duration_sec,
                format: v.format,
                created_at: v.created_at,
                video_url: `/api/videos/${v.video_id}`
            }))
        });
    }
    catch (err) {
        console.error('Error fetching wallet videos:', err);
        res.status(500).json({ error: 'Failed to retrieve videos' });
    }
});
// Delete a video for a wallet address
app.delete('/api/wallet/:walletAddress/videos/:videoId', async (req, res) => {
    try {
        const { walletAddress, videoId } = req.params;
        // Verify the video belongs to this wallet
        const videoBuffer = await getVideoByVideoId(videoId);
        if (!videoBuffer) {
            res.status(404).json({ error: 'Video not found' });
            return;
        }
        // Verify ownership by checking wallet_address in database
        const videoRecord = await pool.query('SELECT wallet_address FROM videos WHERE video_id = $1', [videoId]);
        if (videoRecord.rows.length === 0) {
            res.status(404).json({ error: 'Video not found' });
            return;
        }
        if (videoRecord.rows[0].wallet_address !== walletAddress) {
            res.status(403).json({ error: 'Unauthorized - video does not belong to this wallet' });
            return;
        }
        // Delete the video
        await pool.query('DELETE FROM videos WHERE video_id = $1', [videoId]);
        console.log(`🗑️ Video ${videoId} deleted by ${walletAddress}`);
        res.json({ success: true, message: 'Video deleted successfully' });
    }
    catch (err) {
        console.error('Error deleting video:', err);
        res.status(500).json({ error: 'Failed to delete video' });
    }
});
// Get all content (videos and audios) for a wallet address
app.get('/api/wallet/:walletAddress/content', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        // Ensure user exists and has free credits if new
        await ensureUser(walletAddress);
        const content = await getContentByWallet(walletAddress);
        res.json({
            wallet_address: walletAddress,
            count: content.length,
            content: content.map(c => ({
                id: c.video_id,
                job_id: c.job_id,
                title: c.title,
                content_type: c.content_type,
                duration_sec: c.duration_sec,
                format: c.format,
                created_at: c.created_at,
                url: c.content_type === 'video' ? `/api/videos/${c.video_id}` : `/api/audio/${c.video_id}`,
                preview_url: c.content_type === 'video' ? `/api/videos/${c.video_id}` : `/api/audio/${c.video_id}`
            }))
        });
    }
    catch (err) {
        console.error('Error fetching wallet content:', err);
        res.status(500).json({ error: 'Failed to retrieve content' });
    }
});
// Get global stats for landing page
app.get('/api/stats', async (req, res) => {
    try {
        // Fetch global stats in parallel
        const [totalSeconds, totalUsers, completedJobsCount, totalVideosCreated, totalFailedJobs] = await Promise.all([
            getTotalDurationSecondsForWallet(''), // Get all durations (empty wallet means global)
            getTotalUsersCount(),
            getCompletedJobsCount(''), // Get all completed jobs (empty wallet means global)
            getTotalVideosCreated(),
            getTotalFailedJobs()
        ]);
        const totalMinutes = Number((totalSeconds / 60).toFixed(2));
        const successRate = totalVideosCreated > 0
            ? Number(((completedJobsCount / totalVideosCreated) * 100).toFixed(2))
            : 0;
        console.log('Global stats - total minutes:', totalMinutes, 'total users:', totalUsers, 'completed jobs:', completedJobsCount, 'total videos:', totalVideosCreated, 'failed jobs:', totalFailedJobs);
        res.json({
            total_minutes: totalMinutes,
            total_users: totalUsers,
            completed_jobs_count: completedJobsCount,
            total_videos_created: totalVideosCreated,
            failed_jobs_count: totalFailedJobs,
            success_rate: successRate
        });
    }
    catch (err) {
        console.error('Error fetching global stats:', err);
        res.status(500).json({ error: 'Failed to retrieve stats' });
    }
});
// Audio serving endpoint - serves audio data from database by job ID
app.get('/api/audio/job/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const audioBuffer = await getAudioByJobId(jobId);
        if (!audioBuffer) {
            res.status(404).json({ error: 'Audio not found' });
            return;
        }
        // Set proper headers for audio streaming
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', audioBuffer.length);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Disposition', `inline; filename="audio-${jobId}.mp3"`);
        res.send(audioBuffer);
    }
    catch (err) {
        console.error('Error serving audio:', err);
        res.status(500).json({ error: 'Failed to retrieve audio' });
    }
});
// Audio serving endpoint - serves audio data from database by audio ID
app.get('/api/audio/:audioId', async (req, res) => {
    try {
        const { audioId } = req.params;
        const audioBuffer = await getAudioByAudioId(audioId);
        if (!audioBuffer) {
            res.status(404).json({ error: 'Audio not found' });
            return;
        }
        // Set proper headers for audio streaming
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', audioBuffer.length);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Disposition', `inline; filename="audio-${audioId}.mp3"`);
        res.send(audioBuffer);
    }
    catch (err) {
        console.error('Error serving audio:', err);
        res.status(500).json({ error: 'Failed to retrieve audio' });
    }
});
// Webhook endpoint for job updates (completion and progress)
app.post('/api/webhooks/job-update', async (req, res) => {
    try {
        const signature = req.headers['x-signature'];
        const body = JSON.stringify(req.body);
        if (!signature) {
            res.status(400).json({ error: 'Missing signature' });
            return;
        }
        const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'default-webhook-secret';
        const expectedSignature = crypto
            .createHmac('sha256', WEBHOOK_SECRET)
            .update(body)
            .digest('hex');
        if (signature !== expectedSignature) {
            res.status(401).json({ error: 'Invalid signature' });
            return;
        }
        const { jobId, status, videoId, audioId, duration, sceneCount, error, progress, step } = req.body;
        if (!jobId || !status) {
            res.status(400).json({ error: 'Missing jobId or status' });
            return;
        }
        console.log(`🔗 Webhook received for job ${jobId}: ${status}${progress ? ` (${progress}%)` : ''}`);
        // Only update database status for final states
        if (status === 'completed' || status === 'failed') {
            await updateJobStatus(jobId, status, error || undefined);
        }
        // Broadcast to SSE clients (including progress updates)
        broadcastJobUpdate(jobId, { status, videoId, audioId, duration, sceneCount, error, progress, step });
        // Log completion details
        // if (status === 'completed') {
        //   console.log(`✅ Job ${jobId} completed successfully. Video ID: ${videoId}, Audio ID: ${audioId}, Duration: ${duration}s`);
        // } else if (status === 'failed') {
        //   console.log(`❌ Job ${jobId} failed: ${error}`);
        // } else if (status === 'progress') {
        //   console.log(`📊 Job ${jobId} progress: ${progress}% - ${step || 'processing'}`);
        // }
        res.json({ received: true });
    }
    catch (err) {
        console.error('Webhook processing error:', err);
        res.status(500).json({ error: 'Webhook processing failed' });
        return;
    }
});
// Server-Sent Events for real-time job updates
const clients = new Map();
app.get('/api/jobs/events', (req, res) => {
    const jobIds = req.query.jobIds;
    if (!jobIds) {
        res.status(400).json({ error: 'Missing jobIds parameter' });
        return;
    }
    const jobIdSet = new Set(jobIds.split(','));
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
    });
    const clientId = Date.now().toString() + Math.random().toString(36);
    clients.set(clientId, { res, jobIds: jobIdSet });
    req.on('close', () => {
        clients.delete(clientId);
    });
});
function broadcastJobUpdate(jobId, data) {
    for (const [clientId, client] of clients) {
        if (client.jobIds.has(jobId)) {
            client.res.write(`data: ${JSON.stringify({ jobId, ...data })}\n\n`);
        }
    }
}
// Test endpoint to create a simple test video
app.post('/api/test-video', async (req, res) => {
    try {
        const { walletAddress } = req.body;
        if (!walletAddress) {
            res.status(400).json({ error: 'walletAddress required' });
            return;
        }
        // Create a simple test video buffer
        const { createCanvas } = await import('canvas');
        const canvas = createCanvas(640, 360);
        const ctx = canvas.getContext('2d');
        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 640, 360);
        // Add some text
        ctx.fillStyle = '#000000';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Test Video', 320, 180);
        // Create a simple MP4-like buffer (this won't be valid MP4 but will test storage/serving)
        const testBuffer = Buffer.from('test video data that is not real mp4 but tests the pipeline');
        // Store it
        const jobId = 'test-' + Date.now();
        const videoId = await storeVideo(jobId, walletAddress, testBuffer, 10, 'mp4');
        res.json({
            success: true,
            videoId,
            url: `/api/videos/${videoId}`,
            bufferSize: testBuffer.length
        });
    }
    catch (err) {
        console.error('Test video creation error:', err);
        res.status(500).json({ error: 'Failed to create test video' });
    }
});
app.get('/api/debug/video/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        const videoBuffer = await getVideoByVideoId(videoId);
        if (!videoBuffer) {
            res.status(404).json({ error: 'Video not found' });
            return;
        }
        res.json({
            videoId,
            bufferSize: videoBuffer.length,
            firstBytes: videoBuffer.slice(0, 20).toString('hex'),
            isMP4: videoBuffer.slice(4, 8).toString() === 'ftyp',
            header: videoBuffer.slice(0, 12).toString('hex')
        });
    }
    catch (err) {
        console.error('Error debugging video:', err);
        res.status(500).json({ error: 'Failed to debug video' });
    }
});
// Debug endpoint to list videos for a wallet
app.get('/api/debug/videos/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        const result = await pool.query('SELECT video_id, job_id, duration_sec, format, created_at FROM videos WHERE wallet_address = $1 ORDER BY created_at DESC LIMIT 10', [walletAddress]);
        res.json({
            walletAddress,
            videos: result.rows
        });
    }
    catch (err) {
        console.error('Error listing videos:', err);
        res.status(500).json({ error: 'Failed to list videos' });
    }
});
app.get('/api/db/health', async (_req, res) => {
    try {
        await testConnection();
        res.json({ ok: true });
    }
    catch (err) {
        res.status(500).json({ ok: false, error: String(err) });
    }
});
// Fallback 404 handler (always JSON)
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`WebSocket server available at ws://localhost:${PORT}`);
});
//# sourceMappingURL=server.js.map