import express from 'express';
// import type { Request, Response } from 'express';
import { getJobStatus, getVideo } from '../db.js';
import pool from '../db.js';
const router = express.Router();
// GET /api/videos/status/:id
router.get('/videos/status/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            res.status(400).json({ error: 'No job ID provided' });
            return;
        }
        // Check job status in database
        const jobStatus = await getJobStatus(id);
        if (!jobStatus) {
            res.status(404).json({ error: 'Job not found' });
            return;
        }
        // Check if video exists and get video ID
        const video = await getVideo(id);
        let videoId = null;
        if (video) {
            // Query the videos table to get the video_id
            const videoResult = await pool.query('SELECT video_id FROM videos WHERE job_id = $1', [id]);
            videoId = videoResult.rows[0]?.video_id || null;
        }
        res.json({
            jobId: id,
            status: jobStatus.status,
            ready: jobStatus.status === 'completed' && !!video,
            error: jobStatus.error_message,
            createdAt: jobStatus.created_at,
            updatedAt: jobStatus.updated_at,
            videoAvailable: !!video,
            videoId: videoId,
            progress: jobStatus.status === 'completed' ? 100 : 50, // Simple progress indicator
        });
    }
    catch (err) {
        console.error('weaveit-generator: Error in /api/videos/status/:id:', err);
        res.status(500).json({ error: 'Internal server error' });
        return;
    }
});
export default router;
//# sourceMappingURL=videosStatusRoute.js.map