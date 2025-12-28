// ============================================
// Generate Advice Handler
// ============================================

import { Logger } from '@aws-lambda-powertools/logger';
import { chatCompletion } from '../services/openai.js';
import { buildContext } from '../utils/context.js';
import type { Advice, UserData, LambdaResponse } from '../types/index.js';

const logger = new Logger({ serviceName: 'GenerateAdvice' });

const SYSTEM_PROMPT = `You are an expert fitness and nutrition coach. Generate personalized, actionable advice based on user data.

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
}`;

export interface GenerateAdviceInput {
  trigger: string;
  userId?: string;
  userData?: UserData;
}

/**
 * Generate personalized advice based on user data
 */
export async function handleGenerateAdvice(input: GenerateAdviceInput): Promise<LambdaResponse> {
  const { trigger, userId, userData } = input;

  logger.info('Generating advice', { userId, trigger, userData });

  try {
    const context = buildContext(trigger, userData || {});

    const result = await chatCompletion({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: `Trigger: ${trigger}\n\nContext:\n${context}`,
      responseFormat: { type: 'json_object' },
      temperature: 0.7,
    });

    const advice = JSON.parse(result) as Advice;

    logger.info('Successfully generated advice', {
      title: advice.title,
      priority: advice.priority,
    });

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
}
