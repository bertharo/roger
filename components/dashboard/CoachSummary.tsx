import { RecentRun, WeeklyPlan } from '@/lib/types/dashboard';
import { formatPace } from '@/lib/utils/formatting';

interface CoachSummaryProps {
  recentRun: RecentRun | null;
  plan: WeeklyPlan | null;
}

export function CoachSummary({ recentRun, plan }: CoachSummaryProps) {
  if (!recentRun && !plan) {
    return null;
  }

  let summary = '';
  
  if (recentRun && plan) {
    const hasWorkout = plan.days.some(d => d.runType === 'workout');
    const workoutType = plan.days.find(d => d.runType === 'workout')?.title.toLowerCase() || 'workout';
    
    summary = `Based on your last run (${recentRun.distanceMi} mi @ ${formatPace(recentRun.avgPaceMinPerMi)}/mi), keep this week aerobic${hasWorkout ? ` with one controlled ${workoutType}` : ''}.`;
  } else if (recentRun) {
    summary = `Based on your last run (${recentRun.distanceMi} mi @ ${formatPace(recentRun.avgPaceMinPerMi)}/mi), focus on consistent aerobic training this week.`;
  } else if (plan) {
    const hasWorkout = plan.days.some(d => d.runType === 'workout');
    summary = `This week's plan focuses on building endurance${hasWorkout ? ' with one quality workout' : ' through consistent easy running'}.`;
  }

  if (!summary) return null;

  return (
    <div className="py-3 border-b border-gray-100/50">
      <p className="text-sm text-gray-600 leading-relaxed">
        {summary}
      </p>
    </div>
  );
}
