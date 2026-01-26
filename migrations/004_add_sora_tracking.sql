-- Migration: Add Sora API job tracking
-- Tracks OpenAI Sora video job IDs and webhook URLs for server-driven polling

-- Add columns to video_jobs table
ALTER TABLE video_jobs
ADD COLUMN IF NOT EXISTS sora_job_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS sora_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS sora_progress INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS webhook_url TEXT,
ADD COLUMN IF NOT EXISTS last_sora_check TIMESTAMP,
ADD COLUMN IF NOT EXISTS sora_checked_at TIMESTAMP;

-- Create index for efficient polling queries
CREATE INDEX IF NOT EXISTS idx_video_jobs_sora_job_id ON video_jobs(sora_job_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_sora_status ON video_jobs(sora_status);
CREATE INDEX IF NOT EXISTS idx_video_jobs_webhook ON video_jobs(webhook_url);

-- Comments
COMMENT ON COLUMN video_jobs.sora_job_id IS 'OpenAI Sora video job ID';
COMMENT ON COLUMN video_jobs.sora_status IS 'Current status from Sora API (queued, processing, completed, failed)';
COMMENT ON COLUMN video_jobs.sora_progress IS 'Progress percentage from Sora API (0-100)';
COMMENT ON COLUMN video_jobs.webhook_url IS 'Client webhook URL to notify on status changes';
COMMENT ON COLUMN video_jobs.last_sora_check IS 'Timestamp of last Sora API check';
COMMENT ON COLUMN video_jobs.sora_checked_at IS 'When this job was last updated from Sora API';
