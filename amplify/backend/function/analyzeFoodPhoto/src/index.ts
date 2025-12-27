import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { OpenAI } from 'openai';

const logger = new Logger({ serviceName: 'analyzeFoodPhoto' });
const tracer = new Tracer({ serviceName: 'analyzeFoodPhoto' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const handler = async (event: any) => {
  logger.debug('Received event', { event });

  try {
    const { input } = event.arguments;
    const { photoUrl, userId } = input;

    logger.info('Analyzing food photo', { userId, photoUrl });

    // Fetch the image
    const imageResponse = await fetch(photoUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
    }

    // Get image as base64
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

    // Call OpenAI Vision API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert nutritionist. Analyze food photos and provide detailed nutritional information.

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
}`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this meal and provide nutritional information.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0.3,
    });

    const analysisText = response.choices[0].message.content || '{}';
    const analysis = JSON.parse(analysisText);

    logger.info('Successfully analyzed food photo', { analysis });

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
};
