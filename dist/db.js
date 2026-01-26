import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: process.cwd() + '/.env' });
function cleanDatabaseUrl(raw) {
    if (!raw)
        return undefined;
    // handle a string that was copied from a shell command like:
    // psql 'postgresql://user:pass@host/db?sslmode=require'
    let s = raw.trim();
    if (s.startsWith('psql '))
        s = s.slice(5).trim();
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
const pool = new Pool(databaseUrl
    ? { connectionString: databaseUrl, ssl: sslRequired ? { rejectUnauthorized: false } : undefined }
    : {
        host: process.env.PGHOST,
        database: process.env.PGDATABASE,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : undefined,
        ssl: sslRequired ? { rejectUnauthorized: false } : undefined
    });
export async function testConnection() {
    const client = await pool.connect();
    try {
        await client.query('SELECT 1');
    }
    finally {
        client.release();
    }
}
// User management
export async function ensureUser(walletAddress) {
    // First, ensure any expired trial is processed for this wallet (no-op if user missing)
    try {
        await expireTrialsForWallet(walletAddress);
    }
    catch (err) {
        // ignore expiry errors here; we'll continue to ensure user exists
        console.error('Error expiring trials during ensureUser:', err);
    }
    // If the user doesn't exist, create them with a 7-day trial of 28 credits.
    // We attempt to set `trial_expires_at` if that column exists; if not, fall back to inserting only prompt_points.
    const exists = await pool.query('SELECT 1 FROM users WHERE wallet_address = $1', [walletAddress]);
    if (exists.rowCount === 0) {
        try {
            await pool.query(`INSERT INTO users (wallet_address, prompt_points, trial_expires_at, last_daily_reset, daily_used, paid_points)
         VALUES ($1, $2, NOW() + INTERVAL '7 days', NOW(), 0, 0)`, [walletAddress, 28]);
        }
        catch (err) {
            // Fallback if `trial_expires_at` or daily/paid columns don't exist
            try {
                await pool.query(`INSERT INTO users (wallet_address, prompt_points, trial_expires_at, paid_points)
           VALUES ($1, $2, NOW() + INTERVAL '7 days', 0)`, [walletAddress, 28]);
            }
            catch (err2) {
                try {
                    await pool.query(`INSERT INTO users (wallet_address, prompt_points, trial_expires_at)
             VALUES ($1, $2, NOW() + INTERVAL '7 days')`, [walletAddress, 28]);
                }
                catch (err3) {
                    await pool.query(`INSERT INTO users (wallet_address, prompt_points)
             VALUES ($1, $2)`, [walletAddress, 28]);
                }
            }
        }
    }
}
// Expire trial credits for a wallet if trial_expires_at is passed.
// Behavior:
// - If `trial_expires_at` column is missing, this is a no-op.
// - If trial has expired and the user's `prompt_points` is <= initialTrialCredits (28), zero the points.
// - Clear `trial_expires_at` after processing so it is not processed again.
export async function expireTrialsForWallet(walletAddress, initialTrialCredits = 28) {
    try {
        const result = await pool.query('SELECT trial_expires_at, prompt_points, paid_points FROM users WHERE wallet_address = $1', [walletAddress]);
        if (result.rowCount === 0)
            return null;
        const row = result.rows[0];
        const expiresAt = row.trial_expires_at || null;
        const freePoints = Number(row.prompt_points || 0);
        const paidPoints = Number(row.paid_points || 0);
        const totalPoints = freePoints + paidPoints;
        if (!expiresAt)
            return totalPoints;
        const now = new Date();
        const expired = new Date(expiresAt) < now;
        if (!expired)
            return totalPoints;
        // Only remove up to the original trial grant (e.g. 28 points).
        // This clears the trial marker and subtracts at most initialTrialCredits
        // from the user's free prompt_points (never touch paid_points).
        const amountToClear = Math.min(initialTrialCredits, freePoints);
        if (amountToClear > 0) {
            await pool.query(`UPDATE users 
         SET prompt_points = GREATEST(COALESCE(prompt_points, 0) - $1, 0), 
             trial_expires_at = NULL 
         WHERE wallet_address = $2`, [amountToClear, walletAddress]);
            return totalPoints - amountToClear;
        }
        // Nothing to subtract, just clear the trial marker
        await pool.query('UPDATE users SET trial_expires_at = NULL WHERE wallet_address = $1', [walletAddress]);
        return totalPoints;
    }
    catch (err) {
        // If the column doesn't exist, ignore and return null so callers can continue safely
        const m = String(err?.message || '').toLowerCase();
        if (m.includes('column') && m.includes('trial_expires_at'))
            return null;
        throw err;
    }
}
// Get basic user info for frontend balance checks
export async function getUserInfo(walletAddress) {
    try {
        const result = await pool.query('SELECT prompt_points, paid_points, trial_expires_at FROM users WHERE wallet_address = $1', [walletAddress]);
        if (result.rowCount === 0)
            return null;
        const row = result.rows[0];
        return {
            prompt_points: (row.prompt_points || 0) + (row.paid_points || 0),
            trial_expires_at: row.trial_expires_at || null
        };
    }
    catch (err) {
        // If trial_expires_at column missing, fall back to only prompt_points
        const m = String(err?.message || '').toLowerCase();
        if (m.includes('column') && m.includes('trial_expires_at')) {
            const r2 = await pool.query('SELECT prompt_points, paid_points FROM users WHERE wallet_address = $1', [walletAddress]);
            if (r2.rowCount === 0)
                return null;
            const row2 = r2.rows[0];
            return {
                prompt_points: (row2.prompt_points || 0) + (row2.paid_points || 0),
                trial_expires_at: null
            };
        }
        throw err;
    }
}
export async function getUserPoints(walletAddress) {
    const result = await pool.query('SELECT prompt_points, paid_points FROM users WHERE wallet_address = $1', [walletAddress]);
    const row = result.rows[0];
    return (row?.prompt_points || 0) + (row?.paid_points || 0);
}
// Job management
export async function createVideoJob(walletAddress, scriptBody, title, jobType = 'video') {
    await ensureUser(walletAddress);
    const result = await pool.query(`INSERT INTO video_jobs (wallet_address, script_body, title, job_type, status) 
     VALUES ($1, $2, $3, $4, 'pending') 
     RETURNING job_id`, [walletAddress, scriptBody, title || null, jobType]);
    return result.rows[0].job_id;
}
export async function updateJobStatus(jobId, status, errorMessage) {
    await pool.query(`UPDATE video_jobs 
     SET status = $1, error_message = $2 
     WHERE job_id = $3`, [status, errorMessage || null, jobId]);
}
export async function getJobStatus(jobId) {
    const result = await pool.query(`SELECT status, error_message, created_at, updated_at 
     FROM video_jobs 
     WHERE job_id = $1`, [jobId]);
    return result.rows[0] || null;
}
// Video storage
export async function storeVideo(jobId, walletAddress, videoData, durationSec, format = 'mp4', audioData) {
    try {
        console.log(`[storeVideo] Starting: jobId=${jobId}, wallet=${walletAddress}, format=${format}, duration=${durationSec}`);
        // Store metadata only in videos table
        // Binary data is stored in video_jobs.video_buffer
        console.log(`[storeVideo] Executing INSERT into videos table...`);
        const result = await pool.query(`INSERT INTO videos (job_id, wallet_address, duration_sec, format) 
       VALUES ($1, $2, $3, $4) 
       RETURNING video_id`, [jobId, walletAddress, durationSec, format]);
        console.log(`[storeVideo] INSERT succeeded, video_id: ${result.rows[0].video_id}`);
        // Also store the video buffer in video_jobs for streaming
        console.log(`[storeVideo] Executing UPDATE on video_jobs...`);
        await pool.query(`UPDATE video_jobs 
       SET video_buffer = $1, video_size = $2, buffer_downloaded_at = NOW()
       WHERE job_id = $3`, [videoData, videoData.length, jobId]);
        console.log(`[storeVideo] UPDATE succeeded`);
        return result.rows[0].video_id;
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[storeVideo] ERROR: ${errorMsg}`);
        console.error(`[storeVideo] Full stack:`, err);
        throw err;
    }
}
// Audio-only storage
export async function storeAudio(jobId, walletAddress, audioData, durationSec, format = 'mp3') {
    // Store metadata only in videos table
    // Binary data is stored in video_jobs.video_buffer
    const result = await pool.query(`INSERT INTO videos (job_id, wallet_address, duration_sec, format) 
     VALUES ($1, $2, $3, $4) 
     RETURNING video_id`, [jobId, walletAddress, durationSec, format]);
    // Also store the audio buffer in video_jobs for streaming
    await pool.query(`UPDATE video_jobs 
     SET video_buffer = $1, video_size = $2, buffer_downloaded_at = NOW()
     WHERE job_id = $3`, [audioData, audioData.length, jobId]);
    return result.rows[0].video_id;
}
export async function getVideo(jobId) {
    // Get metadata from videos table and buffer from video_jobs
    const result = await pool.query(`SELECT v.video_id, v.duration_sec, v.format, v.created_at, j.video_buffer 
     FROM videos v
     LEFT JOIN video_jobs j ON v.job_id = j.job_id
     WHERE v.job_id = $1`, [jobId]);
    if (!result.rows[0])
        return null;
    return {
        video_id: result.rows[0].video_id,
        video_data: result.rows[0].video_buffer,
        duration_sec: result.rows[0].duration_sec,
        format: result.rows[0].format,
        created_at: result.rows[0].created_at
    };
}
export async function getVideoByJobId(jobId) {
    const result = await pool.query('SELECT video_buffer FROM video_jobs WHERE job_id = $1', [jobId]);
    return result.rows[0]?.video_buffer || null;
}
export async function getVideoByVideoId(videoId) {
    const result = await pool.query(`SELECT j.video_buffer FROM videos v
     LEFT JOIN video_jobs j ON v.job_id = j.job_id
     WHERE v.video_id = $1`, [videoId]);
    const buffer = result.rows[0]?.video_buffer || null;
    if (buffer) {
        // console.log(`🗄️ Retrieved video ${videoId} from DB: ${buffer.length} bytes`);
        // console.log(`🗄️ DB buffer first 20 bytes: ${buffer.slice(0, 20).toString('hex')}`);
        // console.log(`🗄️ DB buffer is MP4: ${buffer.slice(4, 8).toString() === 'ftyp'}`);
    }
    else {
        // console.log(`🗄️ Video ${videoId} not found in DB`);
    }
    return buffer;
}
export async function getVideosByWallet(walletAddress) {
    const result = await pool.query(`SELECT v.video_id, v.job_id, v.duration_sec, v.format, v.created_at, j.title
     FROM videos v
     LEFT JOIN video_jobs j ON v.job_id = j.job_id
     WHERE v.wallet_address = $1 
     ORDER BY v.created_at DESC`, [walletAddress]);
    return result.rows;
}
// Get all content (videos and audios) for a wallet
export async function getContentByWallet(walletAddress) {
    const result = await pool.query(`SELECT 
       v.video_id, 
       v.job_id, 
       v.duration_sec, 
       v.format, 
       v.created_at,
       j.title,
       CASE 
         WHEN v.format IN ('mp3', 'wav', 'm4a', 'aac') THEN 'audio'
         ELSE 'video'
       END as content_type
     FROM videos v
     LEFT JOIN video_jobs j ON v.job_id = j.job_id
     WHERE v.wallet_address = $1 
     ORDER BY v.created_at DESC
     LIMIT 100`, [walletAddress]);
    return result.rows;
}
// Count completed jobs for a wallet
export async function getCompletedJobsCount(walletAddress) {
    const result = await pool.query(`SELECT COUNT(*)::int as count FROM video_jobs WHERE wallet_address = $1 AND status = 'completed'`, [walletAddress]);
    return result.rows[0]?.count || 0;
}
// Sum total duration seconds for all content (video or audio) for a wallet
export async function getTotalDurationSecondsForWallet(walletAddress) {
    const result = await pool.query(`SELECT COALESCE(SUM(duration_sec), 0) as total_seconds FROM videos WHERE wallet_address = $1`, [walletAddress]);
    return Number(result.rows[0]?.total_seconds || 0);
}
// Total number of users in the system
export async function getTotalUsersCount() {
    const result = await pool.query(`SELECT COUNT(*)::int as count FROM users`);
    return result.rows[0]?.count || 0;
}
// Total number of videos created (all job statuses)
export async function getTotalVideosCreated() {
    const result = await pool.query(`SELECT COUNT(*)::int as count FROM video_jobs`);
    return result.rows[0]?.count || 0;
}
// Number of failed jobs
export async function getTotalFailedJobs() {
    const result = await pool.query(`SELECT COUNT(*)::int as count FROM video_jobs WHERE status = 'failed'`);
    return result.rows[0]?.count || 0;
}
// Audio retrieval
export async function getAudioByJobId(jobId) {
    const result = await pool.query('SELECT video_buffer FROM video_jobs WHERE job_id = $1', [jobId]);
    return result.rows[0]?.video_buffer || null;
}
export async function getAudioByAudioId(audioId) {
    const result = await pool.query(`SELECT j.video_buffer FROM videos v
     LEFT JOIN video_jobs j ON v.job_id = j.job_id
     WHERE v.video_id = $1`, [audioId]);
    return result.rows[0]?.video_buffer || null;
}
// Cleanup old jobs
export async function cleanupOldJobs(daysOld = 7) {
    const result = await pool.query(`DELETE FROM video_jobs 
     WHERE status = 'failed' AND created_at < NOW() - INTERVAL '${daysOld} days'`);
    return result.rowCount || 0;
}
// Clear script body after successful completion
export async function clearScriptBody(jobId) {
    await pool.query('UPDATE video_jobs SET script_body = NULL WHERE job_id = $1', [jobId]);
}
export default pool;
// Award prompt points to a user (create user if necessary)
export async function awardUserPoints(walletAddress, points, isPaid = false) {
    await ensureUser(walletAddress);
    const column = isPaid ? 'paid_points' : 'prompt_points';
    const result = await pool.query(`UPDATE users SET ${column} = COALESCE(${column}, 0) + $1 WHERE wallet_address = $2 RETURNING prompt_points, paid_points`, [points, walletAddress]);
    const row = result.rows[0];
    return (row?.prompt_points || 0) + (row?.paid_points || 0);
}
// Reset daily usage if 24 hours have passed since last reset
export async function resetDailyUsageIfNeeded(walletAddress) {
    try {
        await pool.query(`UPDATE users 
       SET daily_used = 0, last_daily_reset = NOW()
       WHERE wallet_address = $1 AND last_daily_reset < NOW() - INTERVAL '24 hours'`, [walletAddress]);
    }
    catch (err) {
        // If columns don't exist, ignore (for backward compatibility)
        const m = String(err?.message || '').toLowerCase();
        if (m.includes('column') && (m.includes('last_daily_reset') || m.includes('daily_used'))) {
            return;
        }
        throw err;
    }
}
// Deduct prompt points atomically, checking balance first.
// Returns new balance if successful, or null if insufficient credits.
// Deducts from free points first, then paid points.
export async function deductUserPoints(walletAddress, points) {
    // First, ensure daily usage is reset if 24 hours have passed
    await resetDailyUsageIfNeeded(walletAddress);
    // Get current balances
    const balanceResult = await pool.query('SELECT prompt_points, paid_points FROM users WHERE wallet_address = $1', [walletAddress]);
    if (balanceResult.rowCount === 0)
        return null;
    const row = balanceResult.rows[0];
    const freePoints = Number(row.prompt_points || 0);
    const paidPoints = Number(row.paid_points || 0);
    const totalPoints = freePoints + paidPoints;
    if (totalPoints < points)
        return null; // insufficient total credits
    // Determine how much must be taken from free (trial) vs paid points
    const deductFree = Math.min(points, freePoints);
    const deductPaid = points - deductFree;
    // Check daily limit ONLY for free (trial) points, but skip if user has paid points
    const dailyResult = await pool.query('SELECT COALESCE(daily_used, 0) as daily_used FROM users WHERE wallet_address = $1', [walletAddress]);
    const dailyUsed = Number(dailyResult.rows[0]?.daily_used || 0);
    if (paidPoints === 0 && dailyUsed + deductFree > 4)
        return null; // daily trial limit exceeded
    // Perform atomic update: subtract free & paid appropriately, increment daily_used only by free deduction
    const updateResult = await pool.query(`UPDATE users 
     SET prompt_points = GREATEST(COALESCE(prompt_points, 0) - $1, 0), 
         paid_points = GREATEST(COALESCE(paid_points, 0) - $2, 0),
         daily_used = COALESCE(daily_used, 0) + $3
     WHERE wallet_address = $4
     RETURNING prompt_points, paid_points`, [deductFree, deductPaid, deductFree, walletAddress]);
    if (updateResult.rowCount === 0)
        return null;
    const updatedRow = updateResult.rows[0];
    return (Number(updatedRow.prompt_points || 0) + Number(updatedRow.paid_points || 0));
}
export async function saveScrollImage(jobId, imageBuffer) {
    if (!imageBuffer || imageBuffer.length === 0) {
        throw new Error("saveScrollImage: imageBuffer is empty");
    }
    const result = await pool.query(`
    INSERT INTO scroll_images (job_id, image_data)
    VALUES ($1, $2)
    RETURNING image_id
    `, [jobId, imageBuffer]);
    return result.rows[0].image_id;
}
export async function getScrollImageByJobId(jobId) {
    const result = await pool.query(`
    SELECT image_data 
    FROM scroll_images
    WHERE job_id = $1
    ORDER BY created_at DESC
    LIMIT 1
    `, [jobId]);
    return result.rows[0]?.image_data ?? null;
}
export async function saveScrollVideo(jobId, videoBuffer) {
    const result = await pool.query(`
    INSERT INTO scroll_videos (job_id, video_data)
    VALUES ($1, $2)
    RETURNING video_id
    `, [jobId, videoBuffer]);
    return result.rows[0].video_id;
}
// ===== SORA POLLING FUNCTIONS =====
/**
 * Register a Sora job for server-driven polling
 */
export async function registerSoraJobForPolling(jobId, soraJobId, webhookUrl) {
    try {
        await pool.query(`UPDATE video_jobs
       SET sora_job_id = $1,
           sora_status = 'queued',
           webhook_url = $2,
           updated_at = NOW()
       WHERE job_id = $3`, [soraJobId, webhookUrl || null, jobId]);
    }
    catch (error) {
        // If columns don't exist, this is a non-Sora job, silently continue
        if (String(error?.message || '').includes('sora')) {
            console.error('Error registering Sora job:', error);
        }
    }
}
/**
 * Update Sora job status and progress
 */
export async function updateSoraJobStatus(jobId, soraStatus, progress = 0) {
    try {
        await pool.query(`UPDATE video_jobs
       SET sora_status = $1,
           sora_progress = $2,
           last_sora_check = NOW(),
           updated_at = NOW()
       WHERE job_id = $3`, [soraStatus, progress, jobId]);
    }
    catch (error) {
        console.error('Error updating Sora job status:', error);
    }
}
/**
 * Get all pending Sora jobs
 */
export async function getPendingSoraJobs() {
    try {
        const result = await pool.query(`SELECT 
        job_id,
        sora_job_id,
        wallet_address,
        webhook_url,
        sora_status,
        sora_progress,
        created_at,
        last_sora_check
       FROM video_jobs
       WHERE sora_job_id IS NOT NULL
         AND sora_status NOT IN ('completed', 'failed')
         AND created_at > NOW() - INTERVAL '24 hours'
       ORDER BY last_sora_check ASC NULLS FIRST
       LIMIT 100`);
        return result.rows;
    }
    catch (error) {
        console.error('Error fetching pending Sora jobs:', error);
        return [];
    }
}
/**
 * Get Sora polling statistics
 */
export async function getSoraPollingStats() {
    try {
        const result = await pool.query(`SELECT 
        COUNT(*) as total_jobs,
        COUNT(CASE WHEN sora_status = 'queued' THEN 1 END) as queued_jobs,
        COUNT(CASE WHEN sora_status IN ('processing', 'in_progress') THEN 1 END) as processing_jobs,
        COUNT(CASE WHEN sora_status = 'completed' THEN 1 END) as completed_jobs,
        COUNT(CASE WHEN sora_status = 'failed' THEN 1 END) as failed_jobs
       FROM video_jobs
       WHERE sora_job_id IS NOT NULL`);
        return result.rows[0] || null;
    }
    catch (error) {
        console.error('Error getting polling stats:', error);
        return null;
    }
}
/**
 * Save video buffer to database
 */
export async function saveVideoBuffer(jobId, videoBuffer, videoSize) {
    try {
        await pool.query(`UPDATE video_jobs 
       SET video_buffer = $1, 
           video_size = $2, 
           buffer_downloaded_at = NOW()
       WHERE job_id = $3`, [videoBuffer, videoSize, jobId]);
        return true;
    }
    catch (error) {
        console.error(`Error saving video buffer for job ${jobId}:`, error);
        return false;
    }
}
/**
 * Get video buffer from database
 */
export async function getVideoBuffer(jobId) {
    try {
        const result = await pool.query(`SELECT video_buffer FROM video_jobs WHERE id = $1 AND video_buffer IS NOT NULL`, [jobId]);
        if (result.rows.length === 0)
            return null;
        return result.rows[0].video_buffer;
    }
    catch (error) {
        console.error(`Error retrieving video buffer for job ${jobId}:`, error);
        return null;
    }
}
//# sourceMappingURL=db.js.map