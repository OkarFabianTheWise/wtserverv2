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
        const soraJobs = await pool.query(`
      SELECT 
        j.job_id,
        j.wallet_address,
        j.status,
        j.job_type,
        j.created_at,
        j.updated_at,
        j.sora_job_id,
        j.sora_status,
        j.video_buffer IS NOT NULL as has_buffer,
        j.video_size,
        COUNT(v.video_id) as video_entries,
        j.error_message
      FROM video_jobs j
      LEFT JOIN videos v ON j.job_id = v.job_id
      WHERE j.sora_job_id IS NOT NULL
      GROUP BY j.job_id, j.wallet_address, j.status, j.job_type, j.created_at, j.updated_at, j.sora_job_id, j.sora_status, j.video_buffer, j.video_size, j.error_message
      ORDER BY j.updated_at DESC
      LIMIT 5;
    `);

        console.log('\n🎬 LATEST 5 SORA JOBS WITH DETAILS:');
        soraJobs.rows.forEach((row, i) => {
            console.log(`\n${i + 1}. Job ID: ${row.job_id.slice(0, 12)}...`);
            console.log(`   Status: ${row.status} | Sora Status: ${row.sora_status}`);
            console.log(`   Has Buffer: ${row.has_buffer ? `Yes (${row.video_size} bytes)` : 'No'}`);
            console.log(`   Videos Table Entries: ${row.video_entries}`);
            if (row.error_message) {
                console.log(`   Error: ${row.error_message}`);
            }
            console.log(`   Updated: ${new Date(row.updated_at).toLocaleString()}`);
        });

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
    }
}

debug();
