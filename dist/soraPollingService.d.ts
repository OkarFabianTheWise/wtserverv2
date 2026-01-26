/**
 * Sora Polling Service
 *
 * Server-driven polling of OpenAI's Sora API
 * - Tracks pending Sora jobs in database
 * - Polls Sora API periodically for status updates
 * - Sends webhook notifications to clients when status changes
 * - Automatically stops polling when job completes or fails
 */
/**
 * Set the WebSocket manager for emitting progress updates
 */
export declare function setWebSocketManager(wsManager: any): void;
/**
 * Start the polling service
 * Should be called once when server starts
 */
export declare function startSoraPolling(): Promise<void>;
/**
 * Stop the polling service
 */
export declare function stopSoraPolling(): Promise<void>;
/**
 * Register a new Sora job for polling
 * Called when a video generation job is created with Sora
 */
export declare function registerSoraJob(jobId: string, soraJobId: string, webhookUrl?: string): Promise<void>;
/**
 * Manually trigger a poll for a specific job
 * Useful for immediate status checks
 */
export declare function forcePollJob(jobId: string): Promise<{
    status: any;
    progress: any;
}>;
/**
 * Get polling stats
 */
export declare function getPollingStats(): Promise<{
    total_jobs: number;
    queued_jobs: number;
    processing_jobs: number;
    completed_jobs: number;
    failed_jobs: number;
} | null>;
//# sourceMappingURL=soraPollingService.d.ts.map