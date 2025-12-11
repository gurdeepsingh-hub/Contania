import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import pg from 'pg';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

if (!process.env.DATABASE_URI) {
  console.error('❌ Error: DATABASE_URI is not defined in .env file');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URI,
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Connecting to database...');
    
    // Read the SQL file
    const sqlPath = path.resolve(__dirname, '../migrations/reset_freight_tables.sql');
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Migration file not found at: ${sqlPath}`);
    }
    
    console.log(`📖 Reading migration file: ${sqlPath}`);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('🚀 Running migration...');
    // Execute the SQL
    await client.query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('\nRemember to restart your Payload server now:');
    console.log('  pnpm dev');
    
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
