import { Pool } from 'pg';
declare const pool: Pool;
export declare function testConnection(): Promise<void>;
export declare function ensureUser(walletAddress: string): Promise<void>;
export declare function expireTrialsForWallet(walletAddress: string, initialTrialCredits?: number): Promise<number | null>;
export declare function getUserInfo(walletAddress: string): Promise<{
    prompt_points: number;
    trial_expires_at: Date | null;
} | null>;
export declare function getUserPoints(walletAddress: string): Promise<number>;
export declare function createVideoJob(walletAddress: string, scriptBody: string, title?: string, jobType?: 'video' | 'audio' | 'narrative' | 'animation'): Promise<string>;
export declare function updateJobStatus(jobId: string, status: 'pending' | 'generating' | 'failed' | 'completed', errorMessage?: string): Promise<void>;
export declare function getJobStatus(jobId: string): Promise<{
    status: string;
    error_message: string | null;
    created_at: Date;
    updated_at: Date;
} | null>;
export declare function storeVideo(jobId: string, walletAddress: string, videoData: Buffer, durationSec?: number, format?: string, audioData?: Buffer): Promise<string>;
export declare function storeAudio(jobId: string, walletAddress: string, audioData: Buffer, durationSec?: number, format?: string): Promise<string>;
export declare function getVideo(jobId: string): Promise<{
    video_id: string;
    video_data: Buffer;
    duration_sec: number | null;
    format: string;
    created_at: Date;
} | null>;
export declare function getVideoByJobId(jobId: string): Promise<Buffer | null>;
export declare function getVideoByVideoId(videoId: string): Promise<Buffer | null>;
export declare function getVideosByWallet(walletAddress: string): Promise<Array<{
    video_id: string;
    job_id: string;
    duration_sec: number | null;
    format: string;
    created_at: Date;
    title: string | null;
}>>;
export declare function getContentByWallet(walletAddress: string): Promise<Array<{
    video_id: string;
    job_id: string;
    duration_sec: number | null;
    format: string;
    content_type: 'video' | 'audio';
    created_at: Date;
    title: string | null;
}>>;
export declare function getCompletedJobsCount(walletAddress: string): Promise<number>;
export declare function getTotalDurationSecondsForWallet(walletAddress: string): Promise<number>;
export declare function getTotalUsersCount(): Promise<number>;
export declare function getTotalVideosCreated(): Promise<number>;
export declare function getTotalFailedJobs(): Promise<number>;
export declare function getAudioByJobId(jobId: string): Promise<Buffer | null>;
export declare function getAudioByAudioId(audioId: string): Promise<Buffer | null>;
export declare function cleanupOldJobs(daysOld?: number): Promise<number>;
export declare function clearScriptBody(jobId: string): Promise<void>;
export default pool;
export declare function awardUserPoints(walletAddress: string, points: number, isPaid?: boolean): Promise<number>;
export declare function resetDailyUsageIfNeeded(walletAddress: string): Promise<void>;
export declare function deductUserPoints(walletAddress: string, points: number): Promise<number | null>;
export declare function saveScrollImage(jobId: string, imageBuffer: Buffer): Promise<string>;
export declare function getScrollImageByJobId(jobId: string): Promise<Buffer | null>;
export declare function saveScrollVideo(jobId: string, videoBuffer: Buffer): Promise<string>;
/**
 * Register a Sora job for server-driven polling
 */
export declare function registerSoraJobForPolling(jobId: string, soraJobId: string, webhookUrl?: string): Promise<void>;
/**
 * Update Sora job status and progress
 */
export declare function updateSoraJobStatus(jobId: string, soraStatus: string, progress?: number): Promise<void>;
/**
 * Get all pending Sora jobs
 */
export declare function getPendingSoraJobs(): Promise<any[]>;
/**
 * Get Sora polling statistics
 */
export declare function getSoraPollingStats(): Promise<{
    total_jobs: number;
    queued_jobs: number;
    processing_jobs: number;
    completed_jobs: number;
    failed_jobs: number;
} | null>;
/**
 * Save video buffer to database
 */
export declare function saveVideoBuffer(jobId: string, videoBuffer: Buffer, videoSize: number): Promise<boolean>;
/**
 * Get video buffer from database
 */
export declare function getVideoBuffer(jobId: string): Promise<Buffer | null>;
//# sourceMappingURL=db.d.ts.map