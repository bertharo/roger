import OpenAI from 'openai';
import { WeeklyPlan, Run, Goal, PlanModification, ChatMessage } from '../types';

/**
 * Get OpenAI client instance (lazy initialization)
 */
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  return new OpenAI({ apiKey });
}

export interface ChatContext {
  currentPlan: WeeklyPlan;
  goal: Goal;
  recentRuns: Run[];
  chatHistory: ChatMessage[];
}

/**
 * Generate a conversational response that references the plan and recent runs.
 * Can modify individual days but never regenerates the whole plan.
 */
export async function generateCoachChatResponse(
  userMessage: string,
  context: ChatContext
): Promise<{
  assistantMessage: string;
  planModifications?: PlanModification[];
}> {
  const openai = getOpenAIClient();
  const systemPrompt = buildSystemPrompt(context);
  const userPrompt = buildUserPrompt(userMessage, context);
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });
  
  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }
  
  try {
    const parsed = JSON.parse(content);
    
    return {
      assistantMessage: parsed.assistantMessage || 'I understand. Let me help you with that.',
      planModifications: parsed.planModifications || [],
    };
  } catch (error) {
    // Fallback to natural language if JSON parsing fails
    return {
      assistantMessage: content,
    };
  }
}

function buildSystemPrompt(context: ChatContext): string {
  const { currentPlan, goal, recentRuns } = context;
  
  return `You are Roger, an expert running coach. You have a structured weekly training plan for your athlete, and you explain and adapt it through conversation.

CRITICAL RULES:
1. Always reference specific days, runs, and paces from the current plan
2. Reference recent runs by date and pace when relevant
3. You can modify INDIVIDUAL days in the plan, but NEVER regenerate the entire week
4. Be conversational and natural, not robotic
5. Cite specific data: "On Tuesday's tempo run...", "Your 5-mile run on Jan 17th at 8:0 min/mi..."
6. If modifying a day, provide a clear reason

Current Weekly Plan:
${currentPlan.days.map((day, idx) => 
  `${day.dayOfWeek}: ${day.runType} - ${day.distanceMiles}mi @ ${day.paceRangeMinPerMile[0]}-${day.paceRangeMinPerMile[1]} min/mi. ${day.coachingIntent}`
).join('\n')}

Goal Race: ${goal.distance} miles on ${new Date(goal.raceDate).toLocaleDateString()}, target time: ${goal.targetTimeMinutes} minutes

Recent Runs:
${recentRuns.slice(0, 5).map(run => 
  `${new Date(run.date).toLocaleDateString()}: ${run.distanceMiles}mi @ ${run.averagePaceMinPerMile.toFixed(1)} min/mi (${run.type || 'unspecified'})`
).join('\n')}

Respond in JSON format:
{
  "assistantMessage": "Your conversational response referencing specific days/runs",
  "planModifications": [
    {
      "dayIndex": 0,
      "changes": { "distanceMiles": 5.0 },
      "reason": "User wants to increase distance"
    }
  ]
}

If no modifications needed, use empty array for planModifications.`;
}

function buildUserPrompt(userMessage: string, context: ChatContext): string {
  return `User: ${userMessage}

Respond naturally, referencing the plan and recent runs. Modify individual days if the user requests changes.`;
}
