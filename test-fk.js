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
        // Check constraints
        const constraintsResult = await pool.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'videos';
    `);

        console.log('\n🔗 VIDEOS TABLE CONSTRAINTS:');
        constraintsResult.rows.forEach(c => {
            console.log(`  - ${c.constraint_name} (${c.constraint_type})`);
        });

        // Check foreign keys specifically
        const fkResult = await pool.query(`
      SELECT 
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name as foreign_table_name,
        ccu.column_name as foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'videos' AND tc.constraint_type = 'FOREIGN KEY';
    `);

        console.log('\n🔗 FOREIGN KEY CONSTRAINTS:');
        fkResult.rows.forEach(fk => {
            console.log(`  - ${fk.constraint_name}`);
            console.log(`    ${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
        });

        // Check if job_id exists in video_jobs for the recent Sora jobs
        console.log('\n🔍 Checking if Sora job_ids exist in video_jobs...');
        const jobCheck = await pool.query(`
      SELECT 
        COUNT(*) as sora_jobs_with_entries,
        STRING_AGG(DISTINCT j.job_id::text, ',') as sora_job_ids
      FROM video_jobs j
      WHERE j.job_type = 'video' AND j.sora_job_id IS NOT NULL
      LIMIT 5;
    `);
        console.log(jobCheck.rows[0]);

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
    }
}

debug();
