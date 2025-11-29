import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import videosStatusRoute from './weaveit-generator/videosStatusRoute';
import generateRoute from './weaveit-generator/generateRoute';
import generateAudioRoute from './weaveit-generator/generateAudioRoute';
import { testConnection, getVideoByJobId, getVideoByVideoId, getVideosByWallet, getAudioByJobId, getAudioByAudioId, getContentByWallet } from './db';
import paymentsRoute from './paymentsRoute';
import usersRoute from './usersRoute';
// Load environment variables from root .env file
dotenv.config({ path: path.join(process.cwd(), '.env') });
const app = express();
const PORT = 3001;
app.use(cors());
app.use(express.json());
// Mount API routers under `/api` so frontend can call `/api/generate` and `/api/videos/status/:id`
app.use('/api', videosStatusRoute);
app.use('/api', generateRoute);
app.use('/api', generateAudioRoute);
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
        // Set proper headers for video streaming
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Length', videoBuffer.length);
        res.setHeader('Accept-Ranges', 'bytes');
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
// Get all content (videos and audios) for a wallet address
app.get('/api/wallet/:walletAddress/content', async (req, res) => {
    try {
        const { walletAddress } = req.params;
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
// DB health endpoint
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
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
//# sourceMappingURL=server.js.map