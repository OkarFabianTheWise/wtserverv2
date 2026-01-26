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
        // Get a Sora job wallet
        const jobResult = await pool.query(`
      SELECT DISTINCT wallet_address
      FROM video_jobs
      WHERE job_type = 'video' AND sora_job_id IS NOT NULL
      LIMIT 1;
    `);

        if (jobResult.rows.length === 0) {
            console.log('No Sora jobs found');
            return;
        }

        const walletAddress = jobResult.rows[0].wallet_address;
        console.log(`\n🔍 Checking wallet: ${walletAddress}`);

        // Check if wallet exists in users table
        const userCheck = await pool.query(
            `SELECT wallet_address FROM users WHERE wallet_address = $1`,
            [walletAddress]
        );

        if (userCheck.rows.length > 0) {
            console.log(`✅ Wallet EXISTS in users table`);
        } else {
            console.log(`❌ Wallet DOES NOT EXIST in users table`);
            console.log(`\nThis is the problem! storeVideo() tries to INSERT with wallet_address FK that doesn't exist`);
            console.log(`\nFix: Call ensureUser(walletAddress) in webhook handler BEFORE calling storeVideo()`);
        }

        // Try inserting with ensureUser first
        console.log(`\n🧪 Testing with ensureUser() first...`);

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
    }
}

debug();
