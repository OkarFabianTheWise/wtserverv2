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
export declare function createVideoJob(walletAddress: string, scriptBody: string, title?: string, jobType?: 'video' | 'audio'): Promise<string>;
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
export declare function getAudioByJobId(jobId: string): Promise<Buffer | null>;
export declare function getAudioByAudioId(audioId: string): Promise<Buffer | null>;
export declare function cleanupOldJobs(daysOld?: number): Promise<number>;
export declare function clearScriptBody(jobId: string): Promise<void>;
export default pool;
export declare function awardUserPoints(walletAddress: string, points: number): Promise<number>;
export declare function deductUserPoints(walletAddress: string, points: number): Promise<number | null>;
//# sourceMappingURL=db.d.ts.map