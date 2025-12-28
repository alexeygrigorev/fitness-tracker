// ============================================
// Parse Workout Handler
// ============================================

import { Logger } from '@aws-lambda-powertools/logger';
import { chatCompletion } from '../services/openai.js';
import type { ParsedWorkout, LambdaResponse } from '../types/index.js';

const logger = new Logger({ serviceName: 'ParseWorkout' });

const SYSTEM_PROMPT = `You are a fitness expert. Parse workout descriptions into structured data.

Extract exercises, sets, reps, weight, and any other relevant details.
Return ONLY valid JSON.

Example output:
{
  "exercises": [
    {
      "name": "Bench Press",
      "sets": [{"weight": 60, "reps": 10, "setType": "working"}],
      "primaryMuscles": ["chest"],
      "secondaryMuscles": ["triceps", "shoulders"]
    }
  ],
  "duration": 45,
  "notes": "Felt strong today"
}`;

export interface ParseWorkoutInput {
  description: string;
  userId?: string;
}

/**
 * Parse workout description into structured data
 */
export async function handleParseWorkout(input: ParseWorkoutInput): Promise<LambdaResponse> {
  const { description, userId } = input;

  logger.info('Parsing workout description', { userId, description });

  try {
    const result = await chatCompletion({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: description,
      responseFormat: { type: 'json_object' },
      temperature: 0.3,
    });

    const parsed = JSON.parse(result) as ParsedWorkout;

    logger.info('Successfully parsed workout', {
      exerciseCount: parsed.exercises?.length,
      duration: parsed.duration,
    });

    return {
      success: true,
      data: parsed,
      confidence: 0.9,
    };
  } catch (error) {
    logger.error('Error parsing workout', { error });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      confidence: 0,
    };
  }
}
