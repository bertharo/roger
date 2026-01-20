import { neon } from '@neondatabase/serverless';

/**
 * Get Neon database client
 * Uses connection pooling for serverless environments
 */
export function getDbClient() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  
  return neon(connectionString);
}

/**
 * Execute a SQL query
 */
export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const client = getDbClient();
  return client(sql, params) as Promise<T[]>;
}

/**
 * Execute a SQL query and return first result
 */
export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const results = await query<T>(sql, params);
  return results[0] || null;
}
