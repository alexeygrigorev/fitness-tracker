import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { OpenAI } from 'openai';

const logger = new Logger({ serviceName: 'transcribeVoice' });
const tracer = new Tracer({ serviceName: 'transcribeVoice' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const handler = async (event: any) => {
  logger.debug('Received event', { event });

  try {
    const { input } = event.arguments;
    const { audioUrl, userId, language } = input;

    logger.info('Transcribing voice input', { userId, audioUrl, language });

    // Fetch audio file from URL
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio: ${audioResponse.statusText}`);
    }

    const audioBlob = await audioResponse.blob();
    const audioFile = new File([audioBlob], 'audio.wav', { type: audioBlob.type || 'audio/wav' });

    // Call OpenAI Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: language || 'en',
      response_format: 'text',
    });

    logger.info('Successfully transcribed voice', { transcription: transcription.substring(0, 100) });

    return {
      success: true,
      data: {
        text: transcription,
        language: language || 'en',
      },
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
};
