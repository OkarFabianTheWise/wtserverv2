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
        const constraints = await pool.query(`
      SELECT 
        column_name,
        is_nullable,
        column_default,
        data_type
      FROM information_schema.columns
      WHERE table_name = 'videos'
      ORDER BY ordinal_position;
    `);

        console.log('\n📋 VIDEO TABLE COLUMNS (with constraints):');
        constraints.rows.forEach(col => {
            console.log(`  ${col.column_name}:`);
            console.log(`    - Type: ${col.data_type}`);
            console.log(`    - Nullable: ${col.is_nullable === 'YES' ? 'Yes ✅' : 'No ❌'}`);
            console.log(`    - Default: ${col.column_default || 'None'}`);
        });

        // Try a test insert
        console.log('\n🧪 Testing INSERT into videos table...');
        try {
            const testResult = await pool.query(
                `INSERT INTO videos (job_id, wallet_address, duration_sec, format) 
         VALUES (gen_random_uuid(), $1, 60, 'mp4') 
         RETURNING video_id`,
                ['test_wallet']
            );
            console.log(`✅ INSERT succeeded! video_id: ${testResult.rows[0].video_id}`);

            // Clean up
            await pool.query(`DELETE FROM videos WHERE wallet_address = 'test_wallet'`);
        } catch (insertErr) {
            console.error(`❌ INSERT failed:`, insertErr.message);
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
    }
}

debug();
