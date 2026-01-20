/**
 * Database Setup Script
 * 
 * Run this script to set up the database schema:
 * npx tsx scripts/setup-db.ts
 * 
 * Or use: npm run setup-db (if added to package.json)
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function setupDatabase() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.log('Please add DATABASE_URL to your .env.local file');
    process.exit(1);
  }
  
  console.log('🔌 Connecting to database...');
  const sql = neon(connectionString);
  
  try {
    // Read schema file
    const schemaPath = join(process.cwd(), 'lib/db/schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    
    console.log('📄 Running schema...');
    
    // Split by semicolons and execute each statement
    // Remove comments and empty lines
    const statements = schema
      .split(';')
      .map(s => {
        // Remove single-line comments
        return s.split('\n')
          .filter(line => !line.trim().startsWith('--'))
          .join('\n')
          .trim();
      })
      .filter(s => s.length > 0);
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          // Use sql.query() for raw SQL strings
          await sql.query(statement);
          const preview = statement.split('\n')[0].substring(0, 50);
          console.log('✅ Executed:', preview + '...');
        } catch (error: any) {
          // Ignore "already exists" errors
          if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
            const preview = statement.split('\n')[0].substring(0, 50);
            console.log('⚠️  Already exists:', preview + '...');
          } else {
            console.error('❌ Error executing statement:', statement.substring(0, 100));
            throw error;
          }
        }
      }
    }
    
    console.log('\n✅ Database setup complete!');
    console.log('\n📊 Verifying tables...');
    
    // Verify tables exist using tagged template
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    
    console.log('Tables created:');
    tables.forEach((row: any) => {
      console.log(`  - ${row.table_name}`);
    });
    
    console.log('\n🎉 All done! Your database is ready.');
    
  } catch (error: any) {
    console.error('❌ Error setting up database:', error.message);
    console.error(error);
    process.exit(1);
  }
}

setupDatabase();
