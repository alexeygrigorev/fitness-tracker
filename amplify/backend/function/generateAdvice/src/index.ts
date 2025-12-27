import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { OpenAI } from 'openai';

const logger = new Logger({ serviceName: 'generateAdvice' });
const tracer = new Tracer({ serviceName: 'generateAdvice' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface UserData {
  recentWorkouts?: any[];
  recentMeals?: any[];
  sleepSessions?: any[];
  currentGoals?: any[];
  userProfile?: any;
}

export const handler = async (event: any) => {
  logger.debug('Received event', { event });

  try {
    const { input } = event.arguments;
    const { trigger, userId, userData } = input as { trigger: string; userId: string; userData: UserData };

    logger.info('Generating advice', { userId, trigger, userData });

    // Build context for AI
    const context = buildContext(trigger, userData);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert fitness and nutrition coach. Generate personalized, actionable advice based on user data.

Your advice should be:
- Specific and actionable
- Based on the provided data
- Encouraging but realistic
- Concise (2-3 sentences max)

Available triggers: MORNING, PRE_WORKOUT, POST_WORKOUT, END_OF_DAY, POOR_SLEEP, LOW_RECOVERY, CALORIE_PACING

Return ONLY valid JSON with this format:
{
  "title": "Brief advice title",
  "message": "Main advice message (2-3 sentences)",
  "reasoning": "Why this advice is relevant based on the data",
  "priority": "high" | "medium" | "low",
  "actionable": true
}`,
        },
        {
          role: 'user',
          content: `Trigger: ${trigger}\n\nContext:\n${context}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const advice = JSON.parse(completion.choices[0].message.content || '{}');

    logger.info('Successfully generated advice', { advice });

    return {
      success: true,
      data: advice,
      confidence: 0.85,
    };
  } catch (error) {
    logger.error('Error generating advice', { error });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      confidence: 0,
    };
  }
};

function buildContext(trigger: string, userData: UserData): string {
  const parts: string[] = [];

  if (userData.recentWorkouts && userData.recentWorkouts.length > 0) {
    parts.push(`Recent workouts: ${userData.recentWorkouts.length} in the past week`);
    const lastWorkout = userData.recentWorkouts[0];
    if (lastWorkout) {
      parts.push(`Last workout: ${lastWorkout.type || 'various exercises'}`);
    }
  }

  if (userData.recentMeals && userData.recentMeals.length > 0) {
    const totalCalories = userData.recentMeals.reduce((sum: number, m: any) => sum + (m.calories || 0), 0);
    parts.push(`Recent meals: ${userData.recentMeals.length} logged, ~${totalCalories} calories`);
  }

  if (userData.sleepSessions && userData.sleepSessions.length > 0) {
    const lastSleep = userData.sleepSessions[0];
    if (lastSleep) {
      parts.push(`Last sleep: ${lastSleep.duration || 0} minutes, quality score: ${lastSleep.qualityScore || 'N/A'}`);
    }
  }

  if (userData.currentGoals && userData.currentGoals.length > 0) {
    parts.push(`Active goals: ${userData.currentGoals.map((g: any) => g.type).join(', ')}`);
  }

  return parts.join('\n') || 'No user data available';
}
