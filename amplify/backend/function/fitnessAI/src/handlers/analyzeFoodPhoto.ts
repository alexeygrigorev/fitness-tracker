// ============================================
// Analyze Food Photo Handler
// ============================================

import { Logger } from '@aws-lambda-powertools/logger';
import { analyzeImage } from '../services/openai.js';
import type { FoodAnalysis, LambdaResponse } from '../types/index.js';

const logger = new Logger({ serviceName: 'AnalyzeFoodPhoto' });

const SYSTEM_PROMPT = `You are an expert nutritionist. Analyze food photos and provide detailed nutritional information.

Identify:
1. All foods visible in the photo
2. Estimate portion sizes in grams
3. Calculate estimated macros (protein, carbs, fat, calories, fiber)

Return ONLY valid JSON in this exact format:
{
  "foods": [
    {
      "name": "Grilled Chicken Breast",
      "portionSize": 150,
      "calories": 248,
      "protein": 46,
      "carbs": 0,
      "fat": 5,
      "fiber": 0,
      "category": "PROTEIN"
    }
  ],
  "totalCalories": 248,
  "totalProtein": 46,
  "totalCarbs": 0,
  "totalFat": 5,
  "totalFiber": 0,
  "confidence": 0.85
}`;

export interface AnalyzeFoodPhotoInput {
  photoUrl: string;
  userId?: string;
}

/**
 * Fetch image from URL and return as base64
 */
async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const mimeType = response.headers.get('content-type') || 'image/jpeg';

  return { base64, mimeType };
}

/**
 * Analyze food photo using Vision API
 */
export async function handleAnalyzeFoodPhoto(input: AnalyzeFoodPhotoInput): Promise<LambdaResponse> {
  const { photoUrl, userId } = input;

  logger.info('Analyzing food photo', { userId, photoUrl });

  try {
    const { base64: base64Image, mimeType } = await fetchImageAsBase64(photoUrl);

    const result = await analyzeImage({
      base64Image,
      mimeType,
      systemPrompt: SYSTEM_PROMPT,
      userMessage: 'Analyze this meal and provide nutritional information.',
      maxTokens: 1000,
    });

    const analysis = JSON.parse(result) as FoodAnalysis;

    logger.info('Successfully analyzed food photo', {
      foodCount: analysis.foods?.length,
      totalCalories: analysis.totalCalories,
    });

    return {
      success: true,
      data: analysis,
      confidence: analysis.confidence || 0.8,
    };
  } catch (error) {
    logger.error('Error analyzing food photo', { error });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      confidence: 0,
    };
  }
}
