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
 * Execute a SQL query using tagged template literals
 * Example: query`SELECT * FROM users WHERE id = ${userId}`
 */
export async function query<T = any>(
  strings: TemplateStringsArray,
  ...values: any[]
): Promise<T[]> {
  const client = getDbClient();
  return client(strings, ...values) as Promise<T[]>;
}

/**
 * Execute a SQL query with parameters (for dynamic queries)
 */
export async function queryWithParams<T = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const client = getDbClient();
  // Convert parameterized query to tagged template
  // This is a workaround - ideally use tagged templates directly
  return client.query(sql, params) as Promise<T[]>;
}

/**
 * Execute a SQL query and return first result
 */
export async function queryOne<T = any>(
  strings: TemplateStringsArray,
  ...values: any[]
): Promise<T | null> {
  const results = await query<T>(strings, ...values);
  return results[0] || null;
}
