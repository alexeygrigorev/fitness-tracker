// ============================================
// Fitness AI Lambda - Main Handler
// ============================================
// Unified Lambda function for all AI/ML operations
//
// Actions:
// - parseWorkout: Parse workout descriptions
// - parseFood: Parse food descriptions
// - generateAdvice: Generate personalized advice
// - transcribeVoice: Transcribe voice input
// - analyzeFoodPhoto: Analyze food photos

import { Logger } from '@aws-lambda-powertools/logger';
import type { Event, LambdaResponse, Action } from './types/index.js';

// Import handlers
import { handleParseWorkout } from './handlers/parseWorkout.js';
import { handleParseFood } from './handlers/parseFood.js';
import { handleGenerateAdvice } from './handlers/generateAdvice.js';
import { handleTranscribeVoice } from './handlers/transcribeVoice.js';
import { handleAnalyzeFoodPhoto } from './handlers/analyzeFoodPhoto.js';

const logger = new Logger({ serviceName: 'fitnessAI' });

// Handler registry for action routing
const handlers: Record<Action, (input: any) => Promise<LambdaResponse>> = {
  parseWorkout: handleParseWorkout,
  parseFood: handleParseFood,
  generateAdvice: handleGenerateAdvice,
  transcribeVoice: handleTranscribeVoice,
  analyzeFoodPhoto: handleAnalyzeFoodPhoto,
};

/**
 * Main Lambda handler
 * Routes requests to appropriate handler based on action
 */
export const handler = async (event: Event): Promise<LambdaResponse> => {
  logger.debug('Received event', { event });

  try {
    const { action, userId, ...rest } = event.arguments.input;

    logger.info('Processing action', { action, userId });

    // Route to appropriate handler
    const handlerFn = handlers[action];
    if (!handlerFn) {
      logger.error('Unknown action', { action: action as string });
      return {
        success: false,
        error: `Unknown action: ${action}`,
        confidence: 0,
      };
    }

    return await handlerFn(rest);
  } catch (error) {
    logger.error('Unexpected error', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      confidence: 0,
    };
  }
};

// Export for testing
export { handlers };
