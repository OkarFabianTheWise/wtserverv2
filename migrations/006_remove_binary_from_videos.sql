-- Remove binary data from videos table to avoid large response payloads
-- Binary data is already stored in video_jobs.video_buffer
-- This migration keeps only metadata in the videos table

ALTER TABLE videos
DROP COLUMN IF EXISTS video_data CASCADE,
DROP COLUMN IF EXISTS audio_data CASCADE;

-- Add index for quick lookups
CREATE INDEX IF NOT EXISTS idx_videos_wallet_created 
ON videos(wallet_address, created_at DESC);
