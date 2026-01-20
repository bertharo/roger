'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function SettingsPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
      console.error('Strava connection error:', error);
      alert(`Failed to connect Strava: ${error}`);
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
      console.error('Error checking Strava connection:', error);
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
