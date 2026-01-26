'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { logger } from '@/lib/utils/logger';
import { showToast } from '@/lib/utils/toast';

export default function SettingsPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    // Check for OAuth callback parameters first
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const error = params.get('error');
    
    if (connected === 'true') {
      setIsConnected(true);
      // Clean up URL
      window.history.replaceState({}, '', '/settings');
      // Re-check connection status after a brief delay to ensure cookie is set
      setTimeout(() => {
        checkStravaConnection();
      }, 500);
    } else if (error) {
      logger.error('Strava connection error:', error);
      
      // Handle quota exceeded error with special message
      if (error === 'quota_exceeded') {
        setQuotaExceeded(true);
        showToast.error('Strava connection limit reached. The app has reached its quota limit.');
      } else {
        showToast.error(`Failed to connect Strava: ${error}`);
      }
      
      // Clean up URL
      window.history.replaceState({}, '', '/settings');
    } else {
      // Check if Strava is already connected
      checkStravaConnection();
    }
  }, []);

  const checkStravaConnection = async () => {
    try {
      const response = await fetch('/api/strava/status');
      if (response.ok) {
        const data = await response.json();
        setIsConnected(data.connected);
      }
      } catch (error) {
        logger.error('Error checking Strava connection:', error);
      }
  };

  const handleConnectStrava = () => {
    setIsLoading(true);
    
    // Redirect to Strava OAuth
    window.location.href = '/api/strava/connect';
  };

  const handleDisconnectStrava = async () => {
    if (!confirm('Are you sure you want to disconnect Strava?')) return;
    
    setIsLoading(true);
    try {
      // TODO: Implement disconnect API call
      // await fetch('/api/strava/disconnect', { method: 'POST' });
      setIsConnected(false);
      setLastSync(null);
      showToast.success('Strava disconnected successfully');
    } catch (error) {
      logger.error('Error disconnecting Strava:', error);
      showToast.error('Failed to disconnect Strava');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshStrava = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/strava/refresh', {
        method: 'POST',
      });
      
      if (response.ok) {
        const data = await response.json();
        setLastSync(new Date());
        showToast.success('Strava data refreshed successfully!');
        // Optionally reload the page to show new data
        window.location.reload();
      } else {
        const errorData = await response.json();
        showToast.error(`Failed to refresh: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      logger.error('Error refreshing Strava:', error);
      showToast.error('Failed to refresh Strava data');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="mx-auto max-w-md min-h-screen bg-white">
      <div className="px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link 
            href="/chat"
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
        </div>

        {/* Strava Connection Section */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Connections</h2>
          
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">S</span>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">Strava</div>
                  <div className="text-xs text-gray-500">
                    {isConnected ? 'Connected' : 'Not connected'}
                  </div>
                </div>
              </div>
              {isConnected && (
                <span className="text-xs text-green-600 font-medium">● Connected</span>
              )}
            </div>
            
            <p className="text-xs text-gray-600 mb-4">
              Connect your Strava account to automatically sync your runs and get personalized training plans.
            </p>
            
            {quotaExceeded && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-yellow-800 mb-1">
                      Connection Limit Reached
                    </p>
                    <p className="text-xs text-yellow-700">
                      This app has reached Strava's connection limit. The developer needs to request a quota increase from Strava. You can still use the app with mock data in the meantime.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {isConnected ? (
              <div className="space-y-2">
                {lastSync && (
                  <div className="text-xs text-gray-500 text-center">
                    Last synced: {lastSync.toLocaleTimeString()}
                  </div>
                )}
                <button
                  onClick={handleRefreshStrava}
                  disabled={isRefreshing || isLoading}
                  className="w-full py-2 px-4 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isRefreshing ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh from Strava
                    </>
                  )}
                </button>
                <button
                  onClick={handleDisconnectStrava}
                  disabled={isLoading || isRefreshing}
                  className="w-full py-2 px-4 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                  aria-label="Disconnect Strava account"
                >
                  Disconnect Strava
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnectStrava}
                disabled={isLoading}
                className="w-full py-2 px-4 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                aria-busy={isLoading}
                aria-label="Connect Strava account"
              >
                {isLoading ? 'Connecting...' : 'Connect Strava'}
              </button>
            )}
          </div>
        </div>

        {/* Goal Settings Section */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Goal</h2>
          
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-600 mb-4">
              Set your target race distance, date, and goal time.
            </p>
            
            <Link
              href="/settings/goal"
              className="block w-full py-2 px-4 text-sm font-medium text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-center"
            >
              Edit Goal
            </Link>
          </div>
        </div>

        {/* Info Section */}
        {!isConnected && (
          <div className="text-xs text-gray-500 space-y-2">
            <p>
              <strong>Note:</strong> Currently using mock data. Connect Strava to sync your real runs.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
