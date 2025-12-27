import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { OpenAI } from 'openai';

const logger = new Logger({ serviceName: 'parseWorkout' });
const tracer = new Tracer({ serviceName: 'parseWorkout' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const handler = async (event: any) => {
  logger.debug('Received event', { event });

  try {
    const { input } = event.arguments;
    const { description, userId } = input;

    logger.info('Parsing workout description', { userId, description });

    // Call OpenAI to parse workout
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a fitness expert. Parse workout descriptions into structured data.

Extract exercises, sets, reps, weight, and any other relevant details.
Return ONLY valid JSON.

Example output:
{
  "exercises": [
    {
      "name": "Bench Press",
      "sets": [
        {"weight": 60, "reps": 10, "setType": "working"},
        {"weight": 60, "reps": 8, "setType": "working"}
      ],
      "primaryMuscles": ["chest"],
      "secondaryMuscles": ["triceps", "shoulders"]
    }
  ],
  "duration": 45,
  "notes": "Felt strong today"
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

    logger.info('Successfully parsed workout', { parsed });

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
};
