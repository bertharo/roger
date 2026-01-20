'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function SettingsPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if Strava is already connected
    // In production, this would check your database/API
    checkStravaConnection();
  }, []);

  const checkStravaConnection = async () => {
    try {
      // TODO: Replace with actual API call to check connection status
      // const response = await fetch('/api/strava/status');
      // const data = await response.json();
      // setIsConnected(data.connected);
      setIsConnected(false); // Currently using mock data
    } catch (error) {
      console.error('Error checking Strava connection:', error);
    }
  };

  const handleConnectStrava = () => {
    setIsLoading(true);
    
    // Redirect to Strava OAuth
    // In production, this would be: window.location.href = '/api/strava/connect';
    const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_STRAVA_REDIRECT_URI || 'http://localhost:3000/api/strava/callback')}&scope=activity:read_all`;
    
    // For now, show a message since we don't have Strava credentials set up
    alert('Strava OAuth integration coming soon!\n\nTo set this up:\n1. Create a Strava app at https://www.strava.com/settings/api\n2. Add STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET to .env\n3. Implement OAuth flow in /app/api/strava/');
    
    setIsLoading(false);
  };

  const handleDisconnectStrava = async () => {
    if (!confirm('Are you sure you want to disconnect Strava?')) return;
    
    setIsLoading(true);
    try {
      // TODO: Implement disconnect API call
      // await fetch('/api/strava/disconnect', { method: 'POST' });
      setIsConnected(false);
      alert('Strava disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting Strava:', error);
      alert('Failed to disconnect Strava');
    } finally {
      setIsLoading(false);
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
            
            {isConnected ? (
              <button
                onClick={handleDisconnectStrava}
                disabled={isLoading}
                className="w-full py-2 px-4 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                Disconnect Strava
              </button>
            ) : (
              <button
                onClick={handleConnectStrava}
                disabled={isLoading}
                className="w-full py-2 px-4 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
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
        <div className="text-xs text-gray-500 space-y-2">
          <p>
            <strong>Note:</strong> Currently using mock data. Connect Strava to sync your real runs.
          </p>
          <p>
            To set up Strava OAuth, see the implementation guide in the codebase.
          </p>
        </div>
      </div>
    </div>
  );
}
