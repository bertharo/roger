import { auth } from '@/lib/auth/config';

/**
 * Get the current user session on the server
 */
export async function getSession() {
  return auth();
}

/**
 * Get the current user ID from session
 */
export async function getUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id || null;
}
