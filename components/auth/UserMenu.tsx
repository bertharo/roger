'use client';

import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function UserMenu() {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === 'loading') {
    return (
      <div className="px-4 py-2">
        <div className="h-6 w-20 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="px-4 py-2 flex items-center gap-2">
        <Link
          href="/auth/signin"
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          Sign in
        </Link>
        <span className="text-gray-300">|</span>
        <Link
          href="/auth/signup"
          className="text-sm font-medium text-gray-900 hover:underline"
        >
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-gray-900 rounded-full flex items-center justify-center">
          <span className="text-white text-xs font-medium">
            {session.user?.name?.[0]?.toUpperCase() || session.user?.email?.[0]?.toUpperCase() || 'U'}
          </span>
        </div>
        <span className="text-sm text-gray-700">
          {session.user?.name || session.user?.email}
        </span>
      </div>
      <button
        onClick={() => {
          signOut({ redirect: false }).then(() => {
            router.push('/auth/signin');
            router.refresh();
          });
        }}
        className="text-sm text-gray-600 hover:text-gray-900"
      >
        Sign out
      </button>
    </div>
  );
}
