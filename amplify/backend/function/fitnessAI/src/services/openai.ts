// ============================================
// OpenAI Service
// ============================================

import { OpenAI } from 'openai';
import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: 'OpenAIService' });

let openaiClient: OpenAI | null = null;

/**
 * Get or create OpenAI client singleton
 */
export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openaiClient = new OpenAI({ apiKey });
    logger.info('OpenAI client initialized');
  }
  return openaiClient;
}

/**
 * Chat completion with GPT-4o
 */
export async function chatCompletion(params: {
  systemPrompt: string;
  userMessage: string;
  responseFormat?: { type: 'json_object' } | { type: 'text' };
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const client = getOpenAIClient();

  logger.debug('Calling chat completion', { systemPrompt: params.systemPrompt.substring(0, 100) });

  const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: params.systemPrompt },
      { role: 'user', content: params.userMessage },
    ],
    response_format: params.responseFormat ?? { type: 'text' },
    temperature: params.temperature || 0.7,
    max_tokens: params.maxTokens || 1000,
  });

  const content = completion.choices[0]?.message.content || '';
  logger.debug('Chat completion received', { contentLength: content.length });

  return content;
}

/**
 * Audio transcription with Whisper
 */
export async function transcribeAudio(params: {
  audioBuffer: Buffer;
  mimeType: string;
  language?: string;
}): Promise<string> {
  const client = getOpenAIClient();

  logger.info('Transcribing audio', { mimeType: params.mimeType, language: params.language });

  // Create a File object from the buffer
  const file = new File(
    [params.audioBuffer],
    `audio.${params.mimeType.includes('wav') ? 'wav' : 'm4a'}`,
    { type: params.mimeType }
  );

  const transcription = await client.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: params.language || 'en',
    response_format: 'text',
  });

  logger.info('Audio transcribed', { length: transcription.length });

  return transcription;
}

/**
 * Vision API for image analysis
 */
export async function analyzeImage(params: {
  base64Image: string;
  mimeType: string;
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
}): Promise<string> {
  const client = getOpenAIClient();

  logger.info('Analyzing image', { mimeType: params.mimeType });

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: params.systemPrompt,
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: params.userMessage },
          {
            type: 'image_url',
            image_url: {
              url: `data:${params.mimeType};base64,${params.base64Image}`,
            },
          },
        ],
      },
    ],
    max_tokens: params.maxTokens || 1000,
    temperature: 0.3,
  });

  const content = response.choices[0]?.message.content || '';
  logger.info('Image analyzed', { contentLength: content.length });

  return content;
}
