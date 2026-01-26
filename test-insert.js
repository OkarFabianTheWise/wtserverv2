import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

function cleanDatabaseUrl(raw) {
    if (!raw) return undefined;
    let s = raw.trim();
    if (s.startsWith('psql ')) s = s.slice(5).trim();
    if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
        s = s.slice(1, -1);
    }
    s = s.replace(/[&?]channel_binding=require/g, '');
    return s;
}

const databaseUrl = cleanDatabaseUrl(process.env.DATABASE_URL);
const sslRequired = (process.env.PGSSLMODE || '').toLowerCase() === 'require' || (databaseUrl && databaseUrl.includes('sslmode=require'));

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

async function debug() {
    try {
        // Get a Sora job
        const jobResult = await pool.query(`
      SELECT j.job_id, j.wallet_address, j.video_buffer, j.video_size
      FROM video_jobs j
      WHERE j.job_type = 'video' AND j.sora_job_id IS NOT NULL 
      AND j.video_buffer IS NOT NULL
      LIMIT 1;
    `);

        if (jobResult.rows.length === 0) {
            console.log('No Sora jobs with buffers found');
            return;
        }

        const { job_id: jobId, wallet_address: walletAddress, video_buffer: videoBuffer, video_size: videoSize } = jobResult.rows[0];

        console.log(`\n📋 Test Job:`);
        console.log(`  Job ID: ${jobId}`);
        console.log(`  Wallet: ${walletAddress}`);
        console.log(`  Buffer Size: ${videoSize} bytes`);

        // Try the exact INSERT that storeVideo does
        console.log(`\n🧪 Testing INSERT (exact storeVideo code)...`);
        try {
            const result = await pool.query(
                `INSERT INTO videos (job_id, wallet_address, duration_sec, format) 
         VALUES ($1, $2, $3, $4) 
         RETURNING video_id`,
                [jobId, walletAddress, 60, 'mp4']
            );

            console.log(`✅ INSERT succeeded! video_id: ${result.rows[0].video_id}`);

            // Clean up
            await pool.query(`DELETE FROM videos WHERE video_id = $1`, [result.rows[0].video_id]);
            console.log(`🗑️  Cleaned up test entry`);

        } catch (insertErr) {
            console.error(`❌ INSERT failed:`, insertErr.message);
            console.error(`\nFull error:`);
            console.error(insertErr);
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
    }
}

debug();
