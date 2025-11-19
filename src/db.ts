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

export default pool;
