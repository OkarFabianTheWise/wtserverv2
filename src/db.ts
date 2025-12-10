import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: process.cwd() + '/.env' });

function cleanDatabaseUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  // handle a string that was copied from a shell command like:
  // psql 'postgresql://user:pass@host/db?sslmode=require'
  let s = raw.trim();
  if (s.startsWith('psql ')) s = s.slice(5).trim();
  // remove surrounding single or double quotes
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    s = s.slice(1, -1);
  }
  // Remove channel_binding parameter that pg library doesn't support
  s = s.replace(/[&?]channel_binding=require/g, '');
  return s;
}

const rawDatabaseUrl = process.env.DATABASE_URL;
const databaseUrl = cleanDatabaseUrl(rawDatabaseUrl);

const sslMode = (process.env.PGSSLMODE || '').toLowerCase();
const sslRequired = sslMode === 'require' || (databaseUrl && databaseUrl.includes('sslmode=require'));

const pool = new Pool(
  databaseUrl
    ? { connectionString: databaseUrl, ssl: sslRequired ? { rejectUnauthorized: false } : undefined }
    : {
        host: process.env.PGHOST,
        database: process.env.PGDATABASE,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : undefined,
        ssl: sslRequired ? { rejectUnauthorized: false } : undefined
      }
);

export async function testConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}

// User management
export async function ensureUser(walletAddress: string): Promise<void> {
  // First, ensure any expired trial is processed for this wallet (no-op if user missing)
  try {
    await expireTrialsForWallet(walletAddress);
  } catch (err) {
    // ignore expiry errors here; we'll continue to ensure user exists
    console.error('Error expiring trials during ensureUser:', err);
  }

  // If the user doesn't exist, create them with a 7-day trial of 28 credits.
  // We attempt to set `trial_expires_at` if that column exists; if not, fall back to inserting only prompt_points.
  const exists = await pool.query('SELECT 1 FROM users WHERE wallet_address = $1', [walletAddress]);
  if (exists.rowCount === 0) {
    try {
      await pool.query(
        `INSERT INTO users (wallet_address, prompt_points, trial_expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
        [walletAddress, 28]
      );
    } catch (err) {
      // Fallback if `trial_expires_at` column doesn't exist or other schema differences
      await pool.query(
        `INSERT INTO users (wallet_address, prompt_points)
         VALUES ($1, $2)`,
        [walletAddress, 28]
      );
    }
  }
}

// Expire trial credits for a wallet if trial_expires_at is passed.
// Behavior:
// - If `trial_expires_at` column is missing, this is a no-op.
// - If trial has expired and the user's `prompt_points` is <= initialTrialCredits (28), zero the points.
// - Clear `trial_expires_at` after processing so it is not processed again.
export async function expireTrialsForWallet(walletAddress: string, initialTrialCredits: number = 28): Promise<number | null> {
  try {
    const result = await pool.query(
      'SELECT trial_expires_at, prompt_points FROM users WHERE wallet_address = $1',
      [walletAddress]
    );
    if (result.rowCount === 0) return null;
    const row = result.rows[0];
    const expiresAt: Date | null = row.trial_expires_at || null;
    const points: number = row.prompt_points || 0;
    if (!expiresAt) return points;

    const now = new Date();
    const expired = new Date(expiresAt) < now;
    if (!expired) return points;

    if (points <= initialTrialCredits) {
      // Likely only trial credits remain — zero them
      await pool.query(
        'UPDATE users SET prompt_points = 0, trial_expires_at = NULL WHERE wallet_address = $1',
        [walletAddress]
      );
      return 0;
    }

    // User has more than initial trial credits — preserve their balance but clear the trial marker
    await pool.query(
      'UPDATE users SET trial_expires_at = NULL WHERE wallet_address = $1',
      [walletAddress]
    );
    return points;
  } catch (err: any) {
    // If the column doesn't exist, ignore and return null so callers can continue safely
    const m = String(err?.message || '').toLowerCase();
    if (m.includes('column') && m.includes('trial_expires_at')) return null;
    throw err;
  }
}

// Get basic user info for frontend balance checks
export async function getUserInfo(walletAddress: string): Promise<{ prompt_points: number; trial_expires_at: Date | null } | null> {
  try {
    const result = await pool.query('SELECT prompt_points, trial_expires_at FROM users WHERE wallet_address = $1', [walletAddress]);
    if (result.rowCount === 0) return null;
    return { prompt_points: result.rows[0].prompt_points || 0, trial_expires_at: result.rows[0].trial_expires_at || null };
  } catch (err: any) {
    // If trial_expires_at column missing, fall back to only prompt_points
    const m = String(err?.message || '').toLowerCase();
    if (m.includes('column') && m.includes('trial_expires_at')) {
      const r2 = await pool.query('SELECT prompt_points FROM users WHERE wallet_address = $1', [walletAddress]);
      if (r2.rowCount === 0) return null;
      return { prompt_points: r2.rows[0].prompt_points || 0, trial_expires_at: null };
    }
    throw err;
  }
}

export async function getUserPoints(walletAddress: string): Promise<number> {
  const result = await pool.query(
    'SELECT prompt_points FROM users WHERE wallet_address = $1',
    [walletAddress]
  );
  return result.rows[0]?.prompt_points || 0;
}

// Job management
export async function createVideoJob(
  walletAddress: string,
  scriptBody: string,
  title?: string,
  jobType: 'video' | 'audio' = 'video'
): Promise<string> {
  await ensureUser(walletAddress);
  const result = await pool.query(
    `INSERT INTO video_jobs (wallet_address, script_body, title, job_type, status) 
     VALUES ($1, $2, $3, $4, 'pending') 
     RETURNING job_id`,
    [walletAddress, scriptBody, title || null, jobType]
  );
  return result.rows[0].job_id;
}

export async function updateJobStatus(
  jobId: string,
  status: 'pending' | 'generating' | 'failed' | 'completed',
  errorMessage?: string
): Promise<void> {
  await pool.query(
    `UPDATE video_jobs 
     SET status = $1, error_message = $2 
     WHERE job_id = $3`,
    [status, errorMessage || null, jobId]
  );
}

export async function getJobStatus(jobId: string): Promise<{
  status: string;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
} | null> {
  const result = await pool.query(
    `SELECT status, error_message, created_at, updated_at 
     FROM video_jobs 
     WHERE job_id = $1`,
    [jobId]
  );
  return result.rows[0] || null;
}

// Video storage
export async function storeVideo(
  jobId: string,
  walletAddress: string,
  videoData: Buffer,
  durationSec?: number,
  format: string = 'mp4',
  audioData?: Buffer
): Promise<string> {
  const result = await pool.query(
    `INSERT INTO videos (job_id, wallet_address, video_data, duration_sec, format, audio_data) 
     VALUES ($1, $2, $3, $4, $5, $6) 
     RETURNING video_id`,
    [jobId, walletAddress, videoData, durationSec, format, audioData || null]
  );
  return result.rows[0].video_id;
}

// Audio-only storage
export async function storeAudio(
  jobId: string,
  walletAddress: string,
  audioData: Buffer,
  durationSec?: number,
  format: string = 'mp3'
): Promise<string> {
  const result = await pool.query(
    `INSERT INTO videos (job_id, wallet_address, audio_data, duration_sec, format) 
     VALUES ($1, $2, $3, $4, $5) 
     RETURNING video_id`,
    [jobId, walletAddress, audioData, durationSec, format]
  );
  return result.rows[0].video_id;
}

export async function getVideo(jobId: string): Promise<{
  video_id: string;
  video_data: Buffer;
  duration_sec: number | null;
  format: string;
  created_at: Date;
} | null> {
  const result = await pool.query(
    `SELECT video_id, video_data, duration_sec, format, created_at 
     FROM videos 
     WHERE job_id = $1`,
    [jobId]
  );
  return result.rows[0] || null;
}

export async function getVideoByJobId(jobId: string): Promise<Buffer | null> {
  const result = await pool.query(
    'SELECT video_data FROM videos WHERE job_id = $1',
    [jobId]
  );
  return result.rows[0]?.video_data || null;
}

export async function getVideoByVideoId(videoId: string): Promise<Buffer | null> {
  const result = await pool.query(
    'SELECT video_data FROM videos WHERE video_id = $1',
    [videoId]
  );
  return result.rows[0]?.video_data || null;
}

export async function getVideosByWallet(walletAddress: string): Promise<Array<{
  video_id: string;
  job_id: string;
  duration_sec: number | null;
  format: string;
  created_at: Date;
  title: string | null;
}>> {
  const result = await pool.query(
    `SELECT v.video_id, v.job_id, v.duration_sec, v.format, v.created_at, j.title
     FROM videos v
     LEFT JOIN video_jobs j ON v.job_id = j.job_id
     WHERE v.wallet_address = $1 
     ORDER BY v.created_at DESC`,
    [walletAddress]
  );
  return result.rows;
}

// Get all content (videos and audios) for a wallet
export async function getContentByWallet(walletAddress: string): Promise<Array<{
  video_id: string;
  job_id: string;
  duration_sec: number | null;
  format: string;
  content_type: 'video' | 'audio';
  created_at: Date;
  title: string | null;
}>> {
  const result = await pool.query(
    `SELECT 
       v.video_id, 
       v.job_id, 
       v.duration_sec, 
       v.format, 
       v.created_at,
       j.title,
       CASE 
         WHEN v.video_data IS NOT NULL THEN 'video'
         ELSE 'audio'
       END as content_type
     FROM videos v
     LEFT JOIN video_jobs j ON v.job_id = j.job_id
     WHERE v.wallet_address = $1 
     ORDER BY v.created_at DESC`,
    [walletAddress]
  );
  return result.rows;
}

// Count completed jobs for a wallet
export async function getCompletedJobsCount(walletAddress: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*)::int as count FROM video_jobs WHERE wallet_address = $1 AND status = 'completed'`,
    [walletAddress]
  );
  return result.rows[0]?.count || 0;
}

// Sum total duration seconds for all content (video or audio) for a wallet
export async function getTotalDurationSecondsForWallet(walletAddress: string): Promise<number> {
  const result = await pool.query(
    `SELECT COALESCE(SUM(duration_sec), 0) as total_seconds FROM videos WHERE wallet_address = $1`,
    [walletAddress]
  );
  return Number(result.rows[0]?.total_seconds || 0);
}

// Total number of users in the system
export async function getTotalUsersCount(): Promise<number> {
  const result = await pool.query(`SELECT COUNT(*)::int as count FROM users`);
  return result.rows[0]?.count || 0;
}

// Audio retrieval
export async function getAudioByJobId(jobId: string): Promise<Buffer | null> {
  const result = await pool.query(
    'SELECT audio_data FROM videos WHERE job_id = $1',
    [jobId]
  );
  return result.rows[0]?.audio_data || null;
}

export async function getAudioByAudioId(audioId: string): Promise<Buffer | null> {
  const result = await pool.query(
    'SELECT audio_data FROM videos WHERE video_id = $1',
    [audioId]
  );
  return result.rows[0]?.audio_data || null;
}

// Cleanup old jobs
export async function cleanupOldJobs(daysOld: number = 7): Promise<number> {
  const result = await pool.query(
    `DELETE FROM video_jobs 
     WHERE status = 'failed' AND created_at < NOW() - INTERVAL '${daysOld} days'`
  );
  return result.rowCount || 0;
}

// Clear script body after successful completion
export async function clearScriptBody(jobId: string): Promise<void> {
  await pool.query(
    'UPDATE video_jobs SET script_body = NULL WHERE job_id = $1',
    [jobId]
  );
}

export default pool;

// Award prompt points to a user (create user if necessary)
export async function awardUserPoints(walletAddress: string, points: number): Promise<number> {
  await ensureUser(walletAddress);
  const result = await pool.query(
    `UPDATE users SET prompt_points = COALESCE(prompt_points, 0) + $1 WHERE wallet_address = $2 RETURNING prompt_points`,
    [points, walletAddress]
  );
  return result.rows[0]?.prompt_points || 0;
}

// Deduct prompt points atomically, checking balance first.
// Returns new balance if successful, or null if insufficient credits.
export async function deductUserPoints(walletAddress: string, points: number): Promise<number | null> {
  const result = await pool.query(
    `UPDATE users 
     SET prompt_points = prompt_points - $1 
     WHERE wallet_address = $2 AND prompt_points >= $1 
     RETURNING prompt_points`,
    [points, walletAddress]
  );
  if (result.rowCount === 0) {
    return null; // insufficient credits
  }
  return result.rows[0]?.prompt_points || 0;
}