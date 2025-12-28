// ============================================
// Test Setup
// ============================================

import { vi } from 'vitest';

// Mock environment variables
process.env.OPENAI_API_KEY = 'test-api-key';

// Mock fetch for audio/image URLs
global.fetch = vi.fn();

// Create mock functions that will be used by tests
const mockChatCreate = vi.fn();
const mockTranscribeCreate = vi.fn();

// Mock OpenAI module
vi.mock('openai', () => ({
  OpenAI: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockChatCreate,
      },
    },
    audio: {
      transcriptions: {
        create: mockTranscribeCreate,
      },
    },
  })),
}));

// Export mock functions for tests to use
export { mockChatCreate, mockTranscribeCreate };

// Mock AWS Lambda Powertools
vi.mock('@aws-lambda-powertools/logger', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('@aws-lambda-powertools/tracer', () => ({
  Tracer: vi.fn().mockImplementation(() => ({
    captureMethod: vi.fn(),
    putAnnotation: vi.fn(),
    putMetadata: vi.fn(),
  })),
}));
