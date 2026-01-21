import axios, { AxiosInstance } from 'axios';

export interface SoraClientConfig {
    baseURL: string;
    timeout?: number;
}

export interface VideoGenerationRequest {
    prompt: string;
    model?: 'sora-2' | 'sora-2-pro';
    size?: string;
    seconds?: number;
    webhookUrl?: string;
}

export interface VideoRemixRequest {
    prompt: string;
}

export interface VideoJob {
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
 * Sora API Client
 * Simple TypeScript client for interacting with the Sora API endpoints
 */
export class SoraClient {
    private client: AxiosInstance;

    constructor(config: SoraClientConfig) {
        this.client = axios.create({
            baseURL: config.baseURL,
            timeout: config.timeout || 30000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    /**
     * Generate a new video
     */
    async generate(request: VideoGenerationRequest): Promise<{ job: VideoJob; statusUrl: string; downloadUrl: string }> {
        const response = await this.client.post('/api/sora/generate', request);
        return response.data;
    }

    /**
     * Get the status of a video generation job
     */
    async getStatus(videoId: string): Promise<{ job: VideoJob; downloadUrl: string | null }> {
        const response = await this.client.get(`/api/sora/status/${videoId}`);
        return response.data;
    }

    /**
     * Download video content
     */
    async download(
        videoId: string,
        variant: 'video' | 'thumbnail' | 'spritesheet' = 'video'
    ): Promise<Buffer> {
        const response = await this.client.get(`/api/sora/download/${videoId}`, {
            params: { variant },
            responseType: 'arraybuffer',
        });
        return Buffer.from(response.data);
    }

    /**
     * List all videos with pagination
     */
    async list(limit: number = 10, after?: string): Promise<{ count: number; videos: VideoJob[] }> {
        const response = await this.client.get('/api/sora/list', {
            params: {
                limit,
                ...(after && { after }),
            },
        });
        return response.data;
    }

    /**
     * Delete a video
     */
    async delete(videoId: string): Promise<{ message: string; videoId: string }> {
        const response = await this.client.delete(`/api/sora/delete/${videoId}`);
        return response.data;
    }

    /**
     * Remix a completed video
     */
    async remix(videoId: string, request: VideoRemixRequest): Promise<{ job: VideoJob; statusUrl: string; downloadUrl: string }> {
        const response = await this.client.post(`/api/sora/remix/${videoId}`, request);
        return response.data;
    }

    /**
     * Wait for a video to complete (polling alternative to webhooks)
     */
    async waitForCompletion(
        videoId: string,
        options?: {
            maxWaitMs?: number;
            pollIntervalMs?: number;
            onProgress?: (job: VideoJob) => void;
        }
    ): Promise<VideoJob> {
        const maxWaitMs = options?.maxWaitMs || 3600000; // 1 hour default
        const pollIntervalMs = options?.pollIntervalMs || 10000; // 10 seconds default
        const onProgress = options?.onProgress;

        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitMs) {
            const { job } = await this.getStatus(videoId);

            if (onProgress) {
                onProgress(job);
            }

            if (job.status === 'completed' || job.status === 'failed') {
                return job;
            }

            // Wait before polling again
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }

        throw new Error(`Video generation timeout after ${maxWaitMs}ms`);
    }

    /**
     * Full workflow: generate, wait for completion, and download
     */
    async generateAndDownload(
        request: VideoGenerationRequest,
        options?: {
            maxWaitMs?: number;
            pollIntervalMs?: number;
            onProgress?: (job: VideoJob) => void;
            outputPath?: string;
        }
    ): Promise<{ job: VideoJob; buffer: Buffer }> {
        // Generate video
        console.log('🎬 Generating video...');
        const { job: initialJob } = await this.generate(request);
        console.log(`✅ Video job created: ${initialJob.id}`);

        // Wait for completion
        console.log('⏳ Waiting for completion...');
        const completedJob = await this.waitForCompletion(initialJob.id, {
            maxWaitMs: options?.maxWaitMs,
            pollIntervalMs: options?.pollIntervalMs,
            onProgress: (job) => {
                if (options?.onProgress) {
                    options.onProgress(job);
                }
                console.log(`   Status: ${job.status} (${job.progress}%)`);
            },
        });

        if (completedJob.status === 'failed') {
            throw new Error(`Video generation failed: ${completedJob.error}`);
        }

        // Download video
        console.log('📥 Downloading video...');
        const buffer = await this.download(completedJob.id, 'video');
        console.log(`✅ Downloaded ${buffer.length} bytes`);

        // Optionally save to file
        if (options?.outputPath) {
            const fs = await import('fs');
            fs.writeFileSync(options.outputPath, buffer);
            console.log(`💾 Saved to: ${options.outputPath}`);
        }

        return { job: completedJob, buffer };
    }
}

/**
 * Example usage
 */
async function example() {
    const client = new SoraClient({
        baseURL: 'http://localhost:3001',
    });

    try {
        // Generate and download a video
        const { job, buffer } = await client.generateAndDownload(
            {
                prompt: 'A beautiful sunset over the ocean with waves crashing on the shore',
                model: 'sora-2',
                seconds: 5,
            },
            {
                maxWaitMs: 3600000, // 1 hour
                pollIntervalMs: 30000, // Poll every 30 seconds
                outputPath: './my_video.mp4',
                onProgress: (job) => {
                    console.log(`Progress: ${job.progress}%`);
                },
            }
        );

        console.log('✅ Video ready!', job.id);
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Run example if this file is executed directly
if (require.main === module) {
    example().catch(console.error);
}

export default SoraClient;
