-- Migration: Add video buffer storage
-- Stores the raw video content downloaded from Sora API

ALTER TABLE video_jobs
ADD COLUMN IF NOT EXISTS video_buffer BYTEA,
ADD COLUMN IF NOT EXISTS video_size INTEGER,
ADD COLUMN IF NOT EXISTS buffer_downloaded_at TIMESTAMP;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_video_jobs_buffer_downloaded ON video_jobs(buffer_downloaded_at);

-- Comments
COMMENT ON COLUMN video_jobs.video_buffer IS 'Raw video content downloaded from Sora API';
COMMENT ON COLUMN video_jobs.video_size IS 'Size of the video buffer in bytes';
COMMENT ON COLUMN video_jobs.buffer_downloaded_at IS 'When the video buffer was downloaded and saved';
