'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface DataSourceIndicatorProps {
  isStravaConnected: boolean;
  lastSyncTime?: Date | null;
}

export function DataSourceIndicator({ isStravaConnected, lastSyncTime }: DataSourceIndicatorProps) {
  const [timeSinceSync, setTimeSinceSync] = useState<string>('');

  useEffect(() => {
    if (!isStravaConnected || !lastSyncTime) {
      return;
    }

    const updateTime = () => {
      const now = new Date();
      const diff = now.getTime() - lastSyncTime.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      
      if (minutes < 1) {
        setTimeSinceSync('Just now');
      } else if (minutes < 60) {
        setTimeSinceSync(`${minutes}m ago`);
      } else if (hours < 24) {
        setTimeSinceSync(`${hours}h ago`);
      } else {
        const days = Math.floor(hours / 24);
        setTimeSinceSync(`${days}d ago`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [isStravaConnected, lastSyncTime]);

  if (isStravaConnected) {
    return (
      <div className="px-4 py-2 bg-green-50 border-b border-green-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-green-600">●</span>
            <span className="text-xs text-green-700 font-medium">Connected to Strava</span>
            {timeSinceSync && (
              <span className="text-xs text-green-600">• Last synced {timeSinceSync}</span>
            )}
          </div>
          <Link
            href="/settings"
            className="text-xs text-green-600 hover:text-green-700 font-medium"
          >
            Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">○</span>
          <span className="text-xs text-gray-600">Using mock data</span>
        </div>
        <Link
          href="/settings"
          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          Connect Strava
        </Link>
      </div>
    </div>
  );
}
