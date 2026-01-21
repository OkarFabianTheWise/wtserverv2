import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Video generation job tracking in memory
 * In production, use a database like MongoDB or PostgreSQL
 */
const videoJobs: Map<string, {
    id: string;
    status: 'queued' | 'in_progress' | 'completed' | 'failed';
    prompt: string;
    model: 'sora-2' | 'sora-2-pro';
    size: string;
    seconds: number;
    createdAt: number;
    progress?: number;
    error?: string;
    contentPath?: string;
}> = new Map();

export interface SoraGenerationOptions {
    prompt: string;
    model?: 'sora-2' | 'sora-2-pro';
    size?: string;
    seconds?: number;
    webhookUrl?: string;
}

export interface VideoJobStatus {
    id: string;
    status: 'queued' | 'in_progress' | 'completed' | 'failed';
    prompt: string;
    model: 'sora-2' | 'sora-2-pro';
    size: string;
    seconds: number;
    progress?: number;
    error?: string;
    createdAt: number;
}

/**
 * Create a new Sora video generation job
 * @param options Generation options including prompt, model, size, and seconds
 * @param webhookUrl Optional webhook URL to receive notifications when job completes
 * @returns Video job with ID and initial status
 */
export async function createSoraVideo(options: SoraGenerationOptions): Promise<VideoJobStatus> {
    const {
        prompt,
        model = 'sora-2',
        size = '1280x720',
        seconds = 5,
        webhookUrl,
    } = options;

    try {
        console.log('🎬 Creating Sora video...');
        console.log('   Prompt:', prompt.substring(0, 100) + '...');
        console.log('   Model:', model);
        console.log('   Size:', size);
        console.log('   Duration:', seconds, 'seconds');

        // Call OpenAI Videos API
        const video = await openai.videos.create({
            model,
            prompt,
            size,
            seconds: String(seconds) as any,
        } as any);

        const jobId = (video as any).id;
        const status = (video as any).status as 'queued' | 'in_progress';

        // Store job in memory
        const jobData = {
            id: jobId,
            status,
            prompt,
            model,
            size,
            seconds,
            createdAt: Date.now(),
            progress: 0,
        };
        videoJobs.set(jobId, jobData);

        console.log('✅ Video generation started');
        console.log('   Job ID:', jobId);
        console.log('   Status:', status);

        // If webhook provided, start polling and notify on completion
        if (webhookUrl) {
            console.log('📡 Webhook registered:', webhookUrl);
            startWebhookPolling(jobId, webhookUrl);
        }

        return {
            id: jobId,
            status,
            prompt,
            model,
            size,
            seconds,
            createdAt: jobData.createdAt,
        };
    } catch (error: any) {
        console.error('❌ Failed to create Sora video:', error.message);
        throw new Error(`Sora video creation failed: ${error.message}`);
    }
}

/**
 * Get the status of a video generation job
 * @param videoId The video ID returned from createSoraVideo
 * @returns Current job status with progress information
 */
export async function getVideoStatus(videoId: string): Promise<VideoJobStatus> {
    try {
        // Check in-memory cache first
        let cachedJob = videoJobs.get(videoId);

        // If already cached and completed/failed, return cached result
        if (cachedJob && (cachedJob.status === 'completed' || cachedJob.status === 'failed')) {
            return {
                id: cachedJob.id,
                status: cachedJob.status,
                prompt: cachedJob.prompt,
                model: cachedJob.model,
                size: cachedJob.size,
                seconds: cachedJob.seconds,
                progress: cachedJob.progress,
                error: cachedJob.error,
                createdAt: cachedJob.createdAt,
            };
        }

        // Poll OpenAI API for current status (works even if not in cache)
        console.log('📊 Checking video status:', videoId);
        const video = await openai.videos.retrieve(videoId);

        const updatedStatus = (video as any).status as 'queued' | 'in_progress' | 'completed' | 'failed';
        const progress = (video as any).progress || 0;
        const error = (video as any).error?.message;

        // Update cache if job exists in memory
        if (cachedJob) {
            cachedJob.status = updatedStatus;
            cachedJob.progress = progress;
            if (error) {
                cachedJob.error = error;
            }
        }

        console.log('   Status:', updatedStatus);
        console.log('   Progress:', progress, '%');

        // Return status (with or without local cache)
        return {
            id: videoId,
            status: updatedStatus,
            prompt: cachedJob?.prompt || 'Unknown prompt',
            model: cachedJob?.model || 'sora-2',
            size: cachedJob?.size || '1280x720',
            seconds: cachedJob?.seconds || 5,
            progress,
            error,
            createdAt: cachedJob?.createdAt || Date.now(),
        };
    } catch (error: any) {
        console.error('❌ Failed to get video status:', error.message);
        throw new Error(`Failed to retrieve video status: ${error.message}`);
    }
}

/**
 * Download the completed video content
 * @param videoId The video ID
 * @param variant Type of content: 'video' (default), 'thumbnail', or 'spritesheet'
 * @returns Buffer containing the video/asset data
 */
export async function downloadVideoContent(
    videoId: string,
    variant: 'video' | 'thumbnail' | 'spritesheet' = 'video'
): Promise<Buffer> {
    try {
        // Check if job exists in memory, but allow download even if it doesn't
        // (videos may have been generated before server restart)
        const job = videoJobs.get(videoId);

        if (job && job.status !== 'completed') {
            throw new Error(`Video not ready. Current status: ${job.status}`);
        }

        console.log(`📥 Downloading video content (${variant})...`);

        // Download content from OpenAI - this will work for videos that exist on OpenAI's servers
        // even if they're not in our local job tracking
        const content = await openai.videos.downloadContent(videoId, variant as any);
        const buffer = Buffer.from(await content.arrayBuffer());

        console.log(`✅ Downloaded ${variant}:`, buffer.length, 'bytes');

        // Optionally save to disk
        const outputDir = path.resolve('./output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const ext = variant === 'video' ? 'mp4' : variant === 'thumbnail' ? 'webp' : 'jpg';
        const fileName = `sora_${videoId}_${variant}.${ext}`;
        const filePath = path.join(outputDir, fileName);
        fs.writeFileSync(filePath, buffer);

        console.log(`💾 Saved to:`, filePath);

        // Update job with content path if it exists in memory
        if (job) {
            job.contentPath = filePath;
        }

        return buffer;
    } catch (error: any) {
        console.error('❌ Failed to download video content:', error.message);
        throw new Error(`Download failed: ${error.message}`);
    }
}

/**
 * List all video generation jobs
 * @param limit Maximum number of videos to retrieve
 * @param after Video ID to start after (pagination)
 * @returns Array of video job statuses
 */
export async function listVideos(limit: number = 10, after?: string): Promise<VideoJobStatus[]> {
    try {
        console.log('📋 Listing videos...');

        const videos = await openai.videos.list({
            limit,
            after,
        } as any);

        const videoList = (videos as any).data || [];

        return videoList.map((video: any) => ({
            id: video.id,
            status: video.status,
            prompt: video.prompt || '',
            model: video.model,
            size: video.size || '1280x720',
            seconds: video.seconds || 0,
            progress: video.progress,
            createdAt: video.created_at ? video.created_at * 1000 : Date.now(),
        }));
    } catch (error: any) {
        console.error('❌ Failed to list videos:', error.message);
        throw new Error(`Failed to list videos: ${error.message}`);
    }
}

/**
 * Delete a video from OpenAI storage
 * @param videoId The video ID to delete
 */
export async function deleteVideo(videoId: string): Promise<void> {
    try {
        console.log('🗑️  Deleting video:', videoId);

        await openai.videos.delete(videoId);

        // Remove from local cache
        videoJobs.delete(videoId);

        console.log('✅ Video deleted successfully');
    } catch (error: any) {
        console.error('❌ Failed to delete video:', error.message);
        throw new Error(`Failed to delete video: ${error.message}`);
    }
}

/**
 * Remix a completed video with a new prompt
 * @param videoId The ID of the completed video to remix
 * @param prompt The new prompt describing the changes
 * @returns New video job with remix applied
 */
export async function remixVideo(videoId: string, prompt: string): Promise<VideoJobStatus> {
    try {
        console.log('🎨 Remixing video:', videoId);
        console.log('   New prompt:', prompt.substring(0, 100) + '...');

        const video = await openai.videos.create({
            model: 'sora-2-pro',
            prompt,
            remix_video_id: videoId,
        } as any);

        const newJobId = (video as any).id;
        const status = (video as any).status;

        // Get original job data
        const originalJob = videoJobs.get(videoId);
        if (!originalJob) {
            throw new Error(`Original video not found: ${videoId}`);
        }

        // Store new remix job
        const remixJobData = {
            id: newJobId,
            status,
            prompt,
            model: 'sora-2-pro' as const,
            size: originalJob.size,
            seconds: originalJob.seconds,
            createdAt: Date.now(),
            progress: 0,
        };
        videoJobs.set(newJobId, remixJobData);

        console.log('✅ Remix job created');
        console.log('   New Job ID:', newJobId);
        console.log('   Status:', status);

        return {
            id: newJobId,
            status,
            prompt,
            model: 'sora-2-pro',
            size: originalJob.size,
            seconds: originalJob.seconds,
            createdAt: remixJobData.createdAt,
        };
    } catch (error: any) {
        console.error('❌ Failed to remix video:', error.message);
        throw new Error(`Remix failed: ${error.message}`);
    }
}

/**
 * Webhook-enabled polling: continuously poll for completion and send webhook notification
 * @param videoId The video ID to poll
 * @param webhookUrl The URL to POST completion/failure notification to
 */
async function startWebhookPolling(videoId: string, webhookUrl: string): Promise<void> {
    const maxAttempts = 720; // ~12 hours with 60-second intervals
    const pollIntervalMs = 60000; // 60 seconds
    let attempts = 0;

    const pollJob = async () => {
        try {
            attempts++;

            if (attempts > maxAttempts) {
                console.error('❌ Polling timeout for video:', videoId);
                await notifyWebhook(webhookUrl, {
                    type: 'video.failed',
                    data: { id: videoId },
                });
                return;
            }

            const status = await getVideoStatus(videoId);

            if (status.status === 'completed') {
                console.log('✅ Video completed:', videoId);
                await notifyWebhook(webhookUrl, {
                    type: 'video.completed',
                    data: { id: videoId },
                });
                return;
            }

            if (status.status === 'failed') {
                console.error('❌ Video failed:', videoId);
                await notifyWebhook(webhookUrl, {
                    type: 'video.failed',
                    data: { id: videoId, error: status.error },
                });
                return;
            }

            // Still processing, schedule next poll
            setTimeout(pollJob, pollIntervalMs);
        } catch (error: any) {
            console.error('❌ Polling error for video', videoId, ':', error.message);
            if (attempts < maxAttempts) {
                setTimeout(pollJob, pollIntervalMs);
            }
        }
    };

    // Start polling
    pollJob();
}

/**
 * Send webhook notification
 * @param webhookUrl The webhook URL to POST to
 * @param payload The event payload
 */
async function notifyWebhook(
    webhookUrl: string,
    payload: { type: 'video.completed' | 'video.failed'; data: any }
): Promise<void> {
    try {
        console.log('📡 Sending webhook notification to:', webhookUrl);

        await axios.post(webhookUrl, {
            id: `evt_${Date.now()}`,
            object: 'event',
            created_at: Math.floor(Date.now() / 1000),
            type: payload.type,
            data: payload.data,
        }, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        console.log('✅ Webhook notification sent');
    } catch (error: any) {
        console.error('❌ Failed to send webhook notification:', error.message);
    }
}

/**
 * Get all in-memory job tracking data (for debugging)
 */
export function getJobTrackingData() {
    const data: any = {};
    videoJobs.forEach((value, key) => {
        data[key] = value;
    });
    return data;
}
