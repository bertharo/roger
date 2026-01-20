import { query, queryOne } from '@/lib/db/client';
import bcrypt from 'bcryptjs';

export interface User {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
}

/**
 * Create a new user account
 */
export async function createUser(
  email: string,
  password: string,
  name?: string
): Promise<User> {
  // Check if user already exists
  const existing = await queryOne<{ id: string }>`
    SELECT id FROM users WHERE email = ${email}
  `;

  if (existing) {
    throw new Error('User with this email already exists');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Create user - handle case where name column might not exist yet
  // If name column doesn't exist, it will be NULL
  let user: User | null;
  try {
    user = await queryOne<User>`
      INSERT INTO users (email, name, password_hash)
      VALUES (${email}, ${name || null}, ${passwordHash})
      RETURNING id, email, COALESCE(name, NULL) as name, created_at
    `;
  } catch (error: any) {
    // If name column doesn't exist, try without it
    if (error?.code === '42703' && error?.message?.includes('name')) {
      user = await queryOne<User>`
        INSERT INTO users (email, password_hash)
        VALUES (${email}, ${passwordHash})
        RETURNING id, email, NULL as name, created_at
      `;
    } else {
      throw error;
    }
  }

  if (!user) {
    throw new Error('Failed to create user');
  }

  return user;
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  return queryOne<User>`
    SELECT id, email, name, created_at
    FROM users
    WHERE id = ${userId}
  `;
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  return queryOne<User>`
    SELECT id, email, name, created_at
    FROM users
    WHERE email = ${email}
  `;
}
