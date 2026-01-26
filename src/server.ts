import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import http from 'http';
import { WebSocketServer } from 'ws';
import videosStatusRoute from './weaveit-generator/videosStatusRoute.js';
import generateRoute from './weaveit-generator/generateRoute.js';
import generateAudioRoute from './weaveit-generator/generateAudioRoute.js';
import generateNarrativeRoute from './weaveit-generator/generateNarrativeRoute.js';
import generateAnimationRoute from './weaveit-generator/generateAnimationRoute.js';
import pool, { testConnection, getVideoByJobId, getVideoByVideoId, getVideosByWallet, getAudioByJobId, getAudioByAudioId, getContentByWallet, getUserInfo, getCompletedJobsCount, getTotalDurationSecondsForWallet, getTotalUsersCount, getTotalVideosCreated, getTotalFailedJobs, updateJobStatus, storeVideo, ensureUser, getVideoBuffer } from './db.js';
import paymentsRoute from './paymentsRoute.js';
import usersRoute from './usersRoute.js';
import { startSoraPolling, stopSoraPolling, setWebSocketManager } from './soraPollingService.js';
import { webSocketManager } from './websocket.js';

// Load environment variables from root .env file
dotenv.config({ path: path.join(process.cwd(), '.env') });

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Setup WebSocket server for real-time job updates
const wss = new WebSocketServer({ server });
wss.on('connection', (ws, request) => {
  webSocketManager.handleConnection(ws, request);
});

console.log('✅ WebSocket server initialized');

// Serve retrieve.html at root or /retrieve endpoint
app.get('/retrieve', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'src', 'retrieve.html'));
});

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
  } catch (err) {
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
  } catch (err) {
    console.error('Error serving video:', err);
    res.status(500).json({ error: 'Failed to retrieve video' });
  }
});

// Download Sora video from database by job ID
app.get('/api/sora/videos/:jobId/download', async (req, res) => {
  try {
    const { jobId } = req.params;

    const videoBuffer = await getVideoBuffer(jobId);

    if (!videoBuffer) {
      res.status(404).json({ error: 'Video not found in database. It may still be downloading.' });
      return;
    }

    console.log(`🎬 Serving Sora video from database: ${jobId} (${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

    // Set proper headers for video streaming
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', videoBuffer.length);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.setHeader('Content-Disposition', `attachment; filename="video-${jobId.slice(0, 8)}.mp4"`);
    res.send(videoBuffer);
  } catch (err) {
    console.error('Error serving Sora video:', err);
    res.status(500).json({ error: 'Failed to retrieve video' });
  }
});

// Get single video from OpenAI API
app.get('/api/openai/videos/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const apiKey = process.env.OPENAI_API_KEY;

    console.log(`📹 Fetching video ${videoId} from OpenAI API`);

    if (!apiKey) {
      console.error('OPENAI_API_KEY not configured');
      res.status(500).json({ error: 'OPENAI_API_KEY not configured on server' });
      return;
    }

    const response = await fetch(`https://api.openai.com/v1/videos/${videoId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      }
    });

    console.log(`OpenAI API response status: ${response.status}`);

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API error:', error);
      res.status(response.status).json({ error: error.error?.message || 'Failed to fetch video' });
      return;
    }

    const video = await response.json();
    console.log(`✅ Successfully fetched video ${videoId}`);
    res.json(video);
  } catch (err) {
    console.error('Error fetching video from OpenAI:', err);
    res.status(500).json({ error: 'Failed to fetch video from OpenAI: ' + (err as Error).message });
  }
});

// Get all videos from OpenAI API
app.get('/api/openai/videos', async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const { limit = 50, order = 'desc' } = req.query;

    console.log(`📺 Fetching videos from OpenAI API (limit: ${limit}, order: ${order})`);

    if (!apiKey) {
      console.error('OPENAI_API_KEY not configured');
      res.status(500).json({ error: 'OPENAI_API_KEY not configured on server' });
      return;
    }

    const url = new URL('https://api.openai.com/v1/videos');
    url.searchParams.append('limit', limit as string);
    url.searchParams.append('order', order as string);

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      }
    });

    console.log(`OpenAI API response status: ${response.status}`);

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API error:', error);
      res.status(response.status).json({ error: error.error?.message || 'Failed to fetch videos' });
      return;
    }

    const data = await response.json();
    console.log(`✅ Successfully fetched ${data.data?.length || 0} videos`);
    res.json(data);
  } catch (err) {
    console.error('Error fetching videos from OpenAI:', err);
    res.status(500).json({ error: 'Failed to fetch videos from OpenAI: ' + (err as Error).message });
  }
});

// Download video from OpenAI API and serve it
app.get('/api/openai/videos/:videoId/download', async (req, res) => {
  try {
    const { videoId } = req.params;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      res.status(500).json({ error: 'OPENAI_API_KEY not configured on server' });
      return;
    }

    console.log(`📥 Downloading video content from OpenAI: ${videoId}`);

    // Use the /content endpoint to download the actual video bytes
    const contentResponse = await fetch(`https://api.openai.com/v1/videos/${videoId}/content`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      }
    });

    if (!contentResponse.ok) {
      const errorText = await contentResponse.text();
      console.error(`OpenAI content error (${contentResponse.status}):`, errorText);

      // Try to parse as JSON for better error message
      try {
        const error = JSON.parse(errorText);
        res.status(contentResponse.status).json({
          error: error.error?.message || `Failed to download video (${contentResponse.status})`
        });
      } catch {
        res.status(contentResponse.status).json({
          error: `Failed to download video from OpenAI (${contentResponse.status}): ${errorText}`
        });
      }
      return;
    }

    const videoBuffer = Buffer.from(await contentResponse.arrayBuffer());

    console.log(`✅ Successfully downloaded video ${videoId} (${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

    // Stream the video to the client
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', videoBuffer.length);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.setHeader('Content-Disposition', `attachment; filename="sora-video-${videoId.slice(0, 8)}.mp4"`);
    res.send(videoBuffer);
  } catch (err) {
    console.error('Error downloading video from OpenAI:', err);
    res.status(500).json({ error: 'Failed to download video from OpenAI: ' + (err as Error).message });
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
  } catch (err) {
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
    const videoRecord = await pool.query(
      'SELECT wallet_address FROM videos WHERE video_id = $1',
      [videoId]
    );

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
  } catch (err) {
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
  } catch (err) {
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
  } catch (err) {
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
  } catch (err) {
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
  } catch (err) {
    console.error('Error serving audio:', err);
    res.status(500).json({ error: 'Failed to retrieve audio' });
  }
});

// Webhook endpoint for job updates (completion and progress)
app.post('/api/webhooks/job-update', async (req, res) => {
  try {
    const signature = req.headers['x-signature'] as string;
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

    // Check if this is a Sora v3 job by looking for sora_job_id
    const jobResult = await pool.query(
      'SELECT sora_job_id FROM video_jobs WHERE job_id = $1',
      [jobId]
    );
    const isSoraJob = jobResult.rows.length > 0 && jobResult.rows[0].sora_job_id;

    // Handle Sora v3 video completion
    // The soraPollingService has already downloaded and stored to video_jobs.video_buffer
    // and created the videos table entry. We just need to broadcast the completion.
    if (isSoraJob && status === 'completed') {
      console.log(`📥 Processing Sora video for job ${jobId}`);
      try {
        // Get the video entry that soraPollingService should have created
        const videoResult = await pool.query(
          'SELECT video_id FROM videos WHERE job_id = $1 LIMIT 1',
          [jobId]
        );

        if (videoResult.rows.length > 0) {
          const dbVideoId = videoResult.rows[0].video_id;
          console.log(`✅ Sora video found in database for job ${jobId}: ${dbVideoId}`);
          webSocketManager.emitCompleted(jobId, dbVideoId, parseInt(duration?.toString() || '0'));
        } else {
          // Video entry not yet created - soraPollingService might still be processing
          console.warn(`⚠️  Video entry not found for job ${jobId} yet - still processing`);
          // Don't emit error - soraPollingService will handle it
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`❌ Failed to process Sora video:`, errorMsg);
        // Don't fail the webhook - soraPollingService is the source of truth
      }
    } else if (!isSoraJob && status === 'completed' && videoId) {
      // For v1/v2 jobs, the videoId is already the database video ID
      // Just broadcast completion with the videoId
      console.log(`✅ V1/V2 job ${jobId} completed (videoId: ${videoId})`);
      webSocketManager.emitCompleted(jobId, videoId, parseInt(duration?.toString() || '0'));
    }

    // Update database status for final states
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
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
    return;
  }
});

// Server-Sent Events for real-time job updates
const clients = new Map<string, { res: any; jobIds: Set<string> }>();

app.get('/api/jobs/events', (req, res) => {
  const jobIds = req.query.jobIds as string;
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

function broadcastJobUpdate(jobId: string, data: any) {
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
  } catch (err) {
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
  } catch (err) {
    console.error('Error debugging video:', err);
    res.status(500).json({ error: 'Failed to debug video' });
  }
});

// Debug endpoint to list videos for a wallet
app.get('/api/debug/videos/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;

    const result = await pool.query(
      'SELECT video_id, job_id, duration_sec, format, created_at FROM videos WHERE wallet_address = $1 ORDER BY created_at DESC LIMIT 10',
      [walletAddress]
    );

    res.json({
      walletAddress,
      videos: result.rows
    });
  } catch (err) {
    console.error('Error listing videos:', err);
    res.status(500).json({ error: 'Failed to list videos' });
  }
});

app.get('/api/db/health', async (_req, res) => {
  try {
    await testConnection();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Fallback 404 handler (always JSON)
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

server.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Poll job status at /api/videos/status/:jobId`);

  // Start Sora polling service for server-driven webhooks
  try {
    setWebSocketManager(webSocketManager);
    await startSoraPolling();
  } catch (error) {
    console.error('Failed to start Sora polling service:', error);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await stopSoraPolling();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await stopSoraPolling();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
