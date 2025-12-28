// ============================================
// Parse Food Handler
// ============================================

import { Logger } from '@aws-lambda-powertools/logger';
import { chatCompletion } from '../services/openai.js';
import type { ParsedFood, LambdaResponse } from '../types/index.js';

const logger = new Logger({ serviceName: 'ParseFood' });

const SYSTEM_PROMPT = `You are a nutrition expert. Parse food descriptions into structured nutritional data.

Estimate calories, protein, carbs, fat, and fiber based on the description.
Also classify the food (PROTEIN, CARB, FAT, MIXED) and estimate portion size in grams.

Return ONLY valid JSON.

Example output:
{
  "foodName": "Grilled Chicken Breast",
  "portionSize": 150,
  "calories": 248,
  "protein": 46,
  "carbs": 0,
  "fat": 5,
  "fiber": 0,
  "category": "PROTEIN",
  "confidence": 0.9
}`;

export interface ParseFoodInput {
  description: string;
  userId?: string;
}

/**
 * Parse food description into nutritional data
 */
export async function handleParseFood(input: ParseFoodInput): Promise<LambdaResponse> {
  const { description, userId } = input;

  logger.info('Parsing food description', { userId, description });

  try {
    const result = await chatCompletion({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: description,
      responseFormat: { type: 'json_object' },
      temperature: 0.3,
    });

    const parsed = JSON.parse(result) as ParsedFood;

    logger.info('Successfully parsed food', {
      foodName: parsed.foodName,
      calories: parsed.calories,
    });

    return {
      success: true,
      data: parsed,
      confidence: parsed.confidence || 0.85,
    };
  } catch (error) {
    logger.error('Error parsing food', { error });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      confidence: 0,
    };
  }
}
