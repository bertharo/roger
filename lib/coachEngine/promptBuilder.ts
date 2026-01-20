import { CoachContext, Run } from '../types';
import {
  getWeeklyMiles,
  getRecentPaceDistribution,
  getTrainingLoadTrend,
  getDaysToGoal,
  getAveragePaceForType,
  getMostRecentRun,
} from '../metrics';

/**
 * Build the system prompt for the coach
 */
export function buildSystemPrompt(): string {
  return `You are an expert running coach with deep knowledge of training principles, periodization, and race preparation. Your role is to analyze a runner's training data and provide personalized, contextual recommendations.

Key principles:
1. Always cite specific data from the user's runs ("In your last run...", "Over the last 14 days...")
2. Vary paces by run type - easy runs should be slower than tempo runs, intervals faster, etc.
3. Consider training load trends - if volume is increasing, recommend appropriate recovery
4. Base recommendations on recent performance, not just goals
5. If data is insufficient, recommend conservative easy runs or rest
6. Explain your reasoning clearly and conversationally

Run type pace guidelines (based on recent runs):
- Easy/Recovery: 60-90 seconds slower than tempo pace, or 70-80% effort
- Tempo: Comfortably hard, sustainable for 20-40 minutes
- Interval: Faster than tempo, with recovery periods
- Long: Slower than easy pace, conversational effort
- Rest: No running, active recovery only

Always validate that:
- Distances are between 0-30 miles
- Pace ranges are realistic (5.0-14.0 min/mi) and increasing (min < max)
- Recommendations match the runner's current fitness level`;
}

/**
 * Build the user prompt with context
 */
export function buildUserPrompt(context: CoachContext): string {
  const { goal, runs, userNotes } = context;
  
  // Sort runs by date (most recent first)
  const sortedRuns = [...runs].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  
  const daysToGoal = getDaysToGoal(goal);
  const weeklyMiles7d = getWeeklyMiles(runs, 7);
  const weeklyMiles14d = getWeeklyMiles(runs, 14);
  const paceDist = getRecentPaceDistribution(runs, 14);
  const trend = getTrainingLoadTrend(runs);
  const mostRecent = getMostRecentRun(runs);
  
  // Calculate average paces by type
  const avgEasyPace = getAveragePaceForType(runs, 'easy', 14);
  const avgTempoPace = getAveragePaceForType(runs, 'tempo', 14);
  const avgIntervalPace = getAveragePaceForType(runs, 'interval', 14);
  const avgLongPace = getAveragePaceForType(runs, 'long', 14);
  
  let prompt = `Goal Race:
- Date: ${new Date(goal.raceDate).toLocaleDateString()} (${daysToGoal} days away)
- Distance: ${goal.distance} miles
- Target Time: ${goal.targetTimeMinutes} minutes (${(goal.targetTimeMinutes / goal.distance).toFixed(1)} min/mi pace)

Recent Training Summary (last 14 days):
- Weekly mileage (last 7d): ${weeklyMiles7d.toFixed(1)} miles
- Weekly mileage (previous 7d): ${trend.previous7d.toFixed(1)} miles
- Training load trend: ${trend.trend}
- Total runs: ${runs.filter(r => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    return new Date(r.date) >= cutoff;
  }).length}

Recent Pace Distribution:
`;
  
  if (paceDist.easy.length > 0) {
    const avgEasy = paceDist.easy.reduce((a, b) => a + b, 0) / paceDist.easy.length;
    prompt += `- Easy/Recovery runs: ${paceDist.easy.length} runs, avg pace ${avgEasy.toFixed(1)} min/mi\n`;
  }
  if (paceDist.tempo.length > 0) {
    const avgTempo = paceDist.tempo.reduce((a, b) => a + b, 0) / paceDist.tempo.length;
    prompt += `- Tempo runs: ${paceDist.tempo.length} runs, avg pace ${avgTempo.toFixed(1)} min/mi\n`;
  }
  if (paceDist.interval.length > 0) {
    const avgInterval = paceDist.interval.reduce((a, b) => a + b, 0) / paceDist.interval.length;
    prompt += `- Interval runs: ${paceDist.interval.length} runs, avg pace ${avgInterval.toFixed(1)} min/mi\n`;
  }
  if (paceDist.long.length > 0) {
    const avgLong = paceDist.long.reduce((a, b) => a + b, 0) / paceDist.long.length;
    prompt += `- Long runs: ${paceDist.long.length} runs, avg pace ${avgLong.toFixed(1)} min/mi\n`;
  }
  
  if (mostRecent) {
    prompt += `\nMost Recent Run:
- Date: ${new Date(mostRecent.date).toLocaleDateString()}
- Distance: ${mostRecent.distanceMiles} miles
- Pace: ${mostRecent.averagePaceMinPerMile.toFixed(1)} min/mi
- Type: ${mostRecent.type || 'unspecified'}
${mostRecent.notes ? `- Notes: ${mostRecent.notes}` : ''}
`;
  }
  
  prompt += `\nLast 5 Runs:\n`;
  sortedRuns.slice(0, 5).forEach((run, idx) => {
    prompt += `${idx + 1}. ${new Date(run.date).toLocaleDateString()}: ${run.distanceMiles} mi @ ${run.averagePaceMinPerMile.toFixed(1)} min/mi (${run.type || 'unspecified'})\n`;
  });
  
  if (userNotes) {
    prompt += `\nUser Notes: ${userNotes}\n`;
  }
  
  prompt += `\nPlease provide:
1. A conversational message that cites specific data from the runs above
2. A recommended next run with type, distance (miles), pace range (min/mi), and notes
3. Updated KPIs including days to goal, weekly miles (7d), predicted race time, and confidence level

Remember to vary paces appropriately and base recommendations on recent performance.`;
  
  return prompt;
}
