/**
 * Sora Polling Service
 *
 * Server-driven polling of OpenAI's Sora API
 * - Tracks pending Sora jobs in database
 * - Polls Sora API periodically for status updates
 * - Sends webhook notifications to clients when status changes
 * - Automatically stops polling when job completes or fails
 */
import crypto from 'crypto';
import { getPendingSoraJobs, updateSoraJobStatus, registerSoraJobForPolling, getSoraPollingStats, saveVideoBuffer, storeVideo, } from './db.js';
const VERBOSE = process.env.VERBOSE_LOGGING === 'true';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'default-webhook-secret';
// Polling interval (seconds) - starts at 5s, increases with job age
const INITIAL_POLL_INTERVAL = 5000; // 5 seconds
const MAX_POLL_INTERVAL = 30000; // 30 seconds
const POLL_BACKOFF_MULTIPLIER = 1.5; // Increase interval by 50% each cycle
let openai = null;
let webSocketManager = null;
let pollingActive = false;
let pollingInterval = null;
/**
 * Set the WebSocket manager for emitting progress updates
 */
export function setWebSocketManager(wsManager) {
    webSocketManager = wsManager;
}
/**
 * Start the polling service
 * Should be called once when server starts
 */
export async function startSoraPolling() {
    if (pollingActive) {
        console.log('⚠️  Sora polling service already running');
        return;
    }
    pollingActive = true;
    console.log('🔍 Starting Sora API polling service...');
    // Initial poll immediately
    await pollAllPendingJobs();
    // Then poll every 5 seconds
    pollingInterval = setInterval(async () => {
        try {
            await pollAllPendingJobs();
        }
        catch (error) {
            console.error('❌ Error in Sora polling loop:', error);
        }
    }, INITIAL_POLL_INTERVAL);
    console.log(`✅ Sora polling service started (interval: ${INITIAL_POLL_INTERVAL}ms)`);
}
/**
 * Stop the polling service
 */
export async function stopSoraPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
    pollingActive = false;
    console.log('⏹️  Sora polling service stopped');
}
/**
 * Get all pending Sora jobs from database
 */
async function getPendingJobs() {
    const jobs = await getPendingSoraJobs();
    return jobs.map((row) => ({
        ...row,
        poll_count: 0,
    }));
}
/**
 * Poll all pending Sora jobs
 */
async function pollAllPendingJobs() {
    const jobs = await getPendingJobs();
    if (jobs.length === 0) {
        return;
    }
    console.log(`🔄 Polling ${jobs.length} Sora job(s)...`);
    for (const job of jobs) {
        await pollSoraJob(job);
    }
}
/**
 * Poll a single Sora job
 */
async function pollSoraJob(job) {
    try {
        console.log(`📡 Polling Sora job: ${job.sora_job_id}`);
        // Fetch latest status from Sora API via REST
        const response = await fetch(`https://api.openai.com/v1/videos/${job.sora_job_id}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            },
        });
        if (!response.ok) {
            throw new Error(`Sora API error: ${response.status} ${response.statusText}`);
        }
        const video = await response.json();
        const newStatus = video.status;
        const newProgress = video.progress || 0;
        // Check if status changed
        const statusChanged = newStatus !== job.sora_status;
        const progressChanged = newProgress !== job.sora_progress;
        if (VERBOSE && statusChanged) {
            console.log(`   Status: ${job.sora_status} → ${newStatus} (Progress: ${job.sora_progress}% → ${newProgress}%)`);
        }
        // Update database with latest status
        await updateJobStatus(job.job_id, newStatus, newProgress);
        // Emit WebSocket progress update if anything changed
        if ((statusChanged || progressChanged) && webSocketManager) {
            webSocketManager.emitProgress(job.job_id, newProgress, newStatus, `Processing... ${newProgress}%`, { sora_status: newStatus });
        }
        // Send webhook if anything changed
        if (statusChanged || progressChanged) {
            if (job.webhook_url) {
                await sendWebhook(job, newStatus, newProgress, video);
            }
            else {
                if (VERBOSE)
                    console.log(`   ⚠️  No webhook URL for job ${job.job_id}`);
            }
        }
        // If job is done, we'll stop polling it (the WHERE clause in getPendingJobs excludes it)
        if (newStatus === 'completed') {
            console.log(`✅ Sora job completed: ${job.sora_job_id}`);
            // Download and save video buffer to database
            await downloadAndSaveVideo(job.job_id, job.sora_job_id, job.wallet_address);
        }
        else if (newStatus === 'failed') {
            const errorMsg = video.error?.message || 'Unknown error';
            console.log(`❌ Sora job failed: ${job.sora_job_id} - ${errorMsg}`);
        }
    }
    catch (error) {
        console.error(`❌ Error polling Sora job ${job.sora_job_id}:`, error instanceof Error ? error.message : error);
        // Don't fail the entire polling loop, continue with next job
    }
}
/**
 * Update job status in database
 */
async function updateJobStatus(jobId, soraStatus, progress) {
    await updateSoraJobStatus(jobId, soraStatus, progress);
}
/**
 * Send webhook notification to client
 */
async function sendWebhook(job, status, progress, videoData) {
    if (!job.webhook_url)
        return;
    try {
        const payload = {
            jobId: job.job_id,
            soraJobId: job.sora_job_id,
            status,
            progress,
            timestamp: new Date().toISOString(),
            ...(status === 'completed' && videoData?.url && {
                videoUrl: videoData.url,
                contentExpiresAt: videoData.expires_at,
            }),
            ...(status === 'failed' && videoData?.error && {
                error: videoData.error.message || 'Unknown error',
            }),
        };
        const body = JSON.stringify(payload);
        const signature = crypto
            .createHmac('sha256', WEBHOOK_SECRET)
            .update(body)
            .digest('hex');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(job.webhook_url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Signature': signature,
                'X-Timestamp': Date.now().toString(),
            },
            body,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (response.ok) {
            if (VERBOSE)
                console.log(`   ✅ Webhook sent: ${job.webhook_url}`);
        }
        else {
            console.warn(`   ⚠️  Webhook failed (${response.status}): ${job.webhook_url}`);
        }
    }
    catch (error) {
        console.error(`   ❌ Error sending webhook to ${job.webhook_url}:`, error instanceof Error ? error.message : error);
    }
}
/**
 * Register a new Sora job for polling
 * Called when a video generation job is created with Sora
 */
export async function registerSoraJob(jobId, soraJobId, webhookUrl) {
    await registerSoraJobForPolling(jobId, soraJobId, webhookUrl);
    if (VERBOSE) {
        console.log(`📝 Registered Sora job: ${jobId} -> ${soraJobId}`);
        if (webhookUrl)
            console.log(`   Webhook: ${webhookUrl}`);
    }
}
/**
 * Manually trigger a poll for a specific job
 * Useful for immediate status checks
 */
export async function forcePollJob(jobId) {
    try {
        // Get sora_job_id from database
        const jobs = await getPendingJobs();
        const job = jobs.find((j) => j.job_id === jobId);
        if (!job || !job.sora_job_id) {
            throw new Error('Job not found or not a Sora job');
        }
        const video = await openai.videos.retrieve(job.sora_job_id);
        await updateJobStatus(jobId, video.status, video.progress || 0);
        return {
            status: video.status,
            progress: video.progress || 0,
        };
    }
    catch (error) {
        console.error('❌ Error force-polling job:', error);
        throw error;
    }
}
/**
 * Get polling stats
 */
export async function getPollingStats() {
    return await getSoraPollingStats();
}
/**
 * Download video from Sora API and save to database
 */
async function downloadAndSaveVideo(jobId, soraJobId, walletAddress) {
    try {
        console.log(`📥 Downloading video for ${soraJobId}...`);
        // Download video content from Sora API
        const response = await fetch(`https://api.openai.com/v1/videos/${soraJobId}/content`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            },
        });
        if (!response.ok) {
            throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
        }
        // Convert response to buffer
        const arrayBuffer = await response.arrayBuffer();
        const videoBuffer = Buffer.from(arrayBuffer);
        const videoSize = videoBuffer.length;
        // Save to database
        const saved = await saveVideoBuffer(jobId, videoBuffer, videoSize);
        if (saved) {
            console.log(`💾 Video saved to buffer for job ${jobId} (${(videoSize / 1024 / 1024).toFixed(2)} MB)`);
            // Now create entry in videos table
            try {
                const videoId = await storeVideo(jobId, walletAddress, videoBuffer, undefined, 'mp4');
                console.log(`✅ Video metadata stored in videos table: ${videoId}`);
            }
            catch (err) {
                console.error(`❌ Failed to create videos table entry for job ${jobId}:`, err instanceof Error ? err.message : err);
                // Continue anyway - video buffer is saved, just metadata isn't in videos table
                // The webhook handler will create it if webhook works
            }
        }
        else {
            console.error(`❌ Failed to save video buffer for job ${jobId}`);
        }
    }
    catch (error) {
        console.error(`❌ Error downloading video for ${soraJobId}:`, error instanceof Error ? error.message : error);
    }
}
//# sourceMappingURL=soraPollingService.js.map