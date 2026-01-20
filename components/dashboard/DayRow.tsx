'use client';

import { DayPlan } from '@/lib/types/dashboard';
import { formatPaceRange } from '@/lib/utils/formatting';

interface DayRowProps {
  day: DayPlan;
  isExpanded: boolean;
  onToggle: () => void;
}

export function DayRow({ day, isExpanded, onToggle }: DayRowProps) {
  return (
    <div className="border-b border-gray-100/50 last:border-b-0">
      {/* Collapsed Row - ultra-minimal, flat design */}
      <button
        onClick={onToggle}
        className="w-full py-2.5 text-left hover:bg-gray-50/20 transition-colors"
        style={{ 
          background: 'transparent',
          border: 'none',
          outline: 'none',
        }}
      >
        <div className="flex items-center gap-3">
          {/* Day label */}
          <span className="text-xs font-medium text-gray-400 w-10 flex-shrink-0 uppercase tracking-wide">
            {day.dayLabel}
          </span>
          
          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-900 mb-0.5">
              {day.title}
            </div>
            {day.distanceMi !== null && day.paceRangeMinPerMi && (
              <div className="text-xs text-gray-500">
                {day.distanceMi} mi · {formatPaceRange(day.paceRangeMinPerMi)}
              </div>
            )}
            {day.distanceMi === null && (
              <div className="text-xs text-gray-400">
                Rest day
              </div>
            )}
          </div>
          
          {/* Minimal chevron */}
          <svg
            className={`w-3 h-3 text-gray-300 transition-transform flex-shrink-0 ${
              isExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="pb-4 pt-2">
          <div className="pl-10 pr-6 space-y-2.5">
            <p className="text-sm text-gray-600 leading-relaxed">{day.purpose}</p>
            
            {day.structure.length > 0 && (
              <div>
                <ul className="text-sm text-gray-600 space-y-1.5">
                  {day.structure.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-gray-300 mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {day.notes && (
              <p className="text-xs text-gray-500 italic">{day.notes}</p>
            )}

            <a
              href="#chat"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTimeout(() => {
                  const chatInput = document.querySelector('input[placeholder*="Ask"]') as HTMLInputElement;
                  if (chatInput) {
                    chatInput.focus();
                    chatInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }, 100);
              }}
              className="text-xs text-blue-500 hover:text-blue-600 font-medium mt-2 inline-block"
            >
              Ask Roger about this run
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
