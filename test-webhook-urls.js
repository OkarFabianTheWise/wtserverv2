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
        j.webhook_url,
        j.status,
        j.sora_status,
        j.updated_at,
        j.video_buffer IS NOT NULL as has_buffer
      FROM video_jobs j
      WHERE j.sora_job_id IS NOT NULL
      ORDER BY j.updated_at DESC
      LIMIT 10;
    `);

        console.log('\n🔗 SORA JOBS - WEBHOOK_URL STATUS:');
        let withWebhook = 0, withoutWebhook = 0;

        soraJobs.rows.forEach((row, i) => {
            if (row.webhook_url) {
                withWebhook++;
                console.log(`${i + 1}. ✅ ${row.job_id.slice(0, 12)}... -> ${row.webhook_url}`);
            } else {
                withoutWebhook++;
                console.log(`${i + 1}. ❌ ${row.job_id.slice(0, 12)}... -> NO WEBHOOK URL`);
            }
        });

        console.log(`\nSummary: ${withWebhook} with webhooks, ${withoutWebhook} WITHOUT webhooks`);
        if (withoutWebhook > 0) {
            console.log(`\n⚠️  PROBLEM FOUND: Sora jobs created without webhook URLs!`);
            console.log(`   This is why videos aren't being stored to the videos table.`);
            console.log(`   Fix: Check where Sora jobs are created and ensure webhook_url is set.`);
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
    }
}

debug();
