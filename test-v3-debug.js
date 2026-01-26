// Debug script to check V3 video storage
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
        // Check if video_data column still exists
        const schemaCheck = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'videos'
      ORDER BY ordinal_position;
    `);

        console.log('\n📊 VIDEO TABLE SCHEMA:');
        schemaCheck.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type}`);
        });

        // Check video_jobs schema
        const jobsSchemaCheck = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'video_jobs'
      ORDER BY ordinal_position;
    `);

        console.log('\n📊 VIDEO_JOBS TABLE SCHEMA:');
        jobsSchemaCheck.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type}`);
        });

        // Check latest V1 and V3 videos
        const videosCheck = await pool.query(`
      SELECT 
        v.video_id,
        v.job_id,
        v.format,
        v.created_at,
        j.status,
        j.job_type,
        j.wallet_address,
        j.video_buffer IS NOT NULL as has_buffer,
        j.video_size,
        LENGTH(j.video_buffer)::int as actual_buffer_size
      FROM videos v
      LEFT JOIN video_jobs j ON v.job_id = j.job_id
      ORDER BY v.created_at DESC
      LIMIT 10;
    `);

        console.log('\n📹 LATEST 10 VIDEOS:');
        videosCheck.rows.forEach((row, i) => {
            console.log(`  ${i + 1}. ID: ${row.video_id.slice(0, 8)}... | Type: ${row.job_type || 'V1'} | Format: ${row.format} | Buffer: ${row.has_buffer ? row.actual_buffer_size + ' bytes' : 'none'}`);
            console.log(`     Job: ${row.job_id} | Status: ${row.status} | Created: ${new Date(row.created_at).toLocaleString()}`);
        });

        // Check for Sora jobs specifically
        const soraJobs = await pool.query(`
      SELECT 
        j.job_id,
        j.wallet_address,
        j.status,
        j.job_type,
        j.created_at,
        j.updated_at,
        j.video_buffer IS NOT NULL as has_buffer,
        j.video_size,
        COUNT(v.video_id) as video_entries
      FROM video_jobs j
      LEFT JOIN videos v ON j.job_id = v.job_id
      WHERE j.job_type IN ('sora', 'v3') OR j.sora_job_id IS NOT NULL
      GROUP BY j.job_id, j.wallet_address, j.status, j.job_type, j.created_at, j.updated_at, j.video_buffer, j.video_size
      ORDER BY j.created_at DESC
      LIMIT 10;
    `);

        console.log('\n🎬 LATEST 10 SORA JOBS:');
        soraJobs.rows.forEach((row, i) => {
            console.log(`  ${i + 1}. Job: ${row.job_id.slice(0, 8)}... | Status: ${row.status} | Type: ${row.job_type}`);
            console.log(`     Wallet: ${row.wallet_address} | Has Buffer: ${row.has_buffer} (${row.video_size} bytes) | Video Entries: ${row.video_entries}`);
            console.log(`     Updated: ${new Date(row.updated_at).toLocaleString()}`);
        });

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
    }
}

debug();
