import OpenAI from 'openai';
import { CoachContext, CoachResponse } from '../types';
import { buildSystemPrompt, buildUserPrompt } from './promptBuilder';
import { validateCoachResponse, validatePredictedTime } from './validator';
import { logger } from '../utils/logger';

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

/**
 * Generate coach reply with structured output
 */
export async function generateCoachReply(
  context: CoachContext
): Promise<CoachResponse> {
  const openai = getOpenAIClient();
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(context);
  
  // Request structured JSON output
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini', // Using mini for cost efficiency, can upgrade to gpt-4o if needed
    messages: [
      {
        role: 'system',
        content: `${systemPrompt}

IMPORTANT: You must respond with ONLY valid JSON in this exact format:
{
  "assistantMessage": "Your conversational message here, citing specific data from the runs",
  "recommendedNextRun": {
    "type": "easy|tempo|interval|long|rest",
    "distanceMiles": 0.0-30.0,
    "paceRangeMinPerMile": [min, max],
    "notes": "Brief notes about the run"
  },
  "kpis": {
    "daysToGoal": 0,
    "weeklyMiles7d": 0.0,
    "predictedTimeMinutes": 0.0,
    "confidence": "low|medium|high"
  }
}

Do not include any text before or after the JSON.`,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    temperature: 0.7, // Some variation in responses
    response_format: { type: 'json_object' },
  });
  
  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }
  
  // Parse JSON response
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    // Retry once with a more explicit prompt
    logger.warn('Failed to parse JSON, retrying...');
    const retryCompletion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `${systemPrompt}

CRITICAL: Respond with ONLY valid JSON, no other text. The JSON must match this exact structure:
{
  "assistantMessage": "string",
  "recommendedNextRun": {
    "type": "easy|tempo|interval|long|rest",
    "distanceMiles": number,
    "paceRangeMinPerMile": [number, number],
    "notes": "string"
  },
  "kpis": {
    "daysToGoal": number,
    "weeklyMiles7d": number,
    "predictedTimeMinutes": number,
    "confidence": "low|medium|high"
  }
}`,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      temperature: 0.5,
      response_format: { type: 'json_object' },
    });
    
    const retryContent = retryCompletion.choices[0]?.message?.content;
    if (!retryContent) {
      throw new Error('No response from OpenAI retry');
    }
    parsed = JSON.parse(retryContent);
  }
  
  // Validate and sanitize response
  const validated = validateCoachResponse(parsed);
  
  // Validate predicted time plausibility
  const timeValidation = validatePredictedTime(
    validated.kpis.predictedTimeMinutes,
    context.goal.distance
  );
  
  if (!timeValidation.isValid && timeValidation.adjusted !== undefined) {
    validated.kpis.predictedTimeMinutes = timeValidation.adjusted;
    validated.kpis.confidence = timeValidation.confidence;
    if (!validated.assistantMessage.includes('uncertain')) {
      validated.assistantMessage += ' Note: Predicted time has been adjusted to a plausible range based on your goal distance.';
    }
  } else if (timeValidation.confidence) {
    validated.kpis.confidence = timeValidation.confidence;
  }
  
  return validated;
}
