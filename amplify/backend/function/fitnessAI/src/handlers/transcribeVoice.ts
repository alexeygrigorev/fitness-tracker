// ============================================
// Transcribe Voice Handler
// ============================================

import { Logger } from '@aws-lambda-powertools/logger';
import { transcribeAudio } from '../services/openai.js';
import type { TranscriptionResult, LambdaResponse } from '../types/index.js';

const logger = new Logger({ serviceName: 'TranscribeVoice' });

export interface TranscribeVoiceInput {
  audioUrl: string;
  userId?: string;
  language?: string;
}

/**
 * Fetch audio from URL and return as buffer
 */
async function fetchAudioBuffer(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mimeType = response.headers.get('content-type') || 'audio/mpeg';

  return { buffer, mimeType };
}

/**
 * Transcribe voice input using Whisper API
 */
export async function handleTranscribeVoice(input: TranscribeVoiceInput): Promise<LambdaResponse> {
  const { audioUrl, userId, language = 'en' } = input;

  logger.info('Transcribing voice input', { userId, audioUrl, language });

  try {
    const { buffer, mimeType } = await fetchAudioBuffer(audioUrl);

    const text = await transcribeAudio({
      audioBuffer: buffer,
      mimeType,
      language,
    });

    logger.info('Successfully transcribed voice', {
      textLength: text.length,
      preview: text.substring(0, 100),
    });

    const result: TranscriptionResult = {
      text,
      language,
    };

    return {
      success: true,
      data: result,
      confidence: 0.95,
    };
  } catch (error) {
    logger.error('Error transcribing voice', { error });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      confidence: 0,
    };
  }
}
