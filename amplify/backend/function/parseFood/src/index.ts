import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { OpenAI } from 'openai';

const logger = new Logger({ serviceName: 'parseFood' });
const tracer = new Tracer({ serviceName: 'parseFood' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const handler = async (event: any) => {
  logger.debug('Received event', { event });

  try {
    const { input } = event.arguments;
    const { description, userId } = input;

    logger.info('Parsing food description', { userId, description });

    // Call OpenAI to parse food
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a nutrition expert. Parse food descriptions into structured nutritional data.

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
}`,
        },
        {
          role: 'user',
          content: description,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const parsed = JSON.parse(completion.choices[0].message.content || '{}');

    logger.info('Successfully parsed food', { parsed });

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
};
