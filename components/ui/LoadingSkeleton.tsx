'use client';

export function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-md min-h-screen bg-white">
      <div className="animate-pulse">
        {/* Header skeleton */}
        <div className="h-12 bg-gray-100 border-b border-gray-200" />
        
        {/* Content skeleton */}
        <div className="px-4 py-6 space-y-4">
          <div className="h-20 bg-gray-100 rounded-lg" />
          <div className="h-32 bg-gray-100 rounded-lg" />
          <div className="h-24 bg-gray-100 rounded-lg" />
        </div>
        
        {/* Chat input skeleton */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
          <div className="h-10 bg-gray-100 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function PlanLoadingSkeleton() {
  return (
    <div className="px-4 py-4 space-y-3">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} className="animate-pulse">
          <div className="h-16 bg-gray-100 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
