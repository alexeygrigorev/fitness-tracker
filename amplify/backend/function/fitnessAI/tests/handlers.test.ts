// ============================================
// Handler Tests
// ============================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handler } from '../src/index.js';
import type { Event } from '../src/types/index.js';

// Mock the OpenAI service functions
vi.mock('../src/services/openai.js', () => ({
  getOpenAIClient: vi.fn(),
  chatCompletion: vi.fn(),
  transcribeAudio: vi.fn(),
  analyzeImage: vi.fn(),
}));

// Import after mocking
import { chatCompletion, transcribeAudio, analyzeImage } from '../src/services/openai.js';

describe('Fitness AI Lambda Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('parseWorkout action', () => {
    it('should parse workout description successfully', async () => {
      const mockWorkout = {
        exercises: [
          {
            name: 'Bench Press',
            sets: [{ weight: 60, reps: 10, setType: 'working' }],
            primaryMuscles: ['chest'],
            secondaryMuscles: ['triceps'],
          },
        ],
        duration: 45,
      };

      vi.mocked(chatCompletion).mockResolvedValue(JSON.stringify(mockWorkout));

      const event: Event = {
        arguments: {
          input: {
            action: 'parseWorkout',
            userId: 'user-123',
            description: 'Bench press 5x5 at 60kg',
          },
        },
      };

      const result = await handler(event);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockWorkout);
      expect(result.confidence).toBe(0.9);
    });

    it('should handle parseWorkout errors gracefully', async () => {
      vi.mocked(chatCompletion).mockRejectedValue(new Error('API Error'));

      const event: Event = {
        arguments: {
          input: {
            action: 'parseWorkout',
            userId: 'user-123',
            description: 'Bench press 5x5',
          },
        },
      };

      const result = await handler(event);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
      expect(result.confidence).toBe(0);
    });
  });

  describe('parseFood action', () => {
    it('should parse food description successfully', async () => {
      const mockFood = {
        foodName: 'Grilled Chicken Breast',
        portionSize: 150,
        calories: 248,
        protein: 46,
        carbs: 0,
        fat: 5,
        fiber: 0,
        category: 'PROTEIN',
        confidence: 0.9,
      };

      vi.mocked(chatCompletion).mockResolvedValue(JSON.stringify(mockFood));

      const event: Event = {
        arguments: {
          input: {
            action: 'parseFood',
            userId: 'user-123',
            description: 'grilled chicken breast with rice',
          },
        },
      };

      const result = await handler(event);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockFood);
      expect(result.confidence).toBe(0.9);
    });
  });

  describe('generateAdvice action', () => {
    it('should generate advice successfully', async () => {
      const mockAdvice = {
        title: 'Hydration Reminder',
        message: 'Drink water before your workout.',
        reasoning: 'Proper hydration improves performance.',
        priority: 'medium',
        actionable: true,
      };

      vi.mocked(chatCompletion).mockResolvedValue(JSON.stringify(mockAdvice));

      const event: Event = {
        arguments: {
          input: {
            action: 'generateAdvice',
            userId: 'user-123',
            trigger: 'PRE_WORKOUT',
            userData: {
              recentWorkouts: [{ type: 'strength' }],
              recentMeals: [],
            },
          },
        },
      };

      const result = await handler(event);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAdvice);
      expect(result.confidence).toBe(0.85);
    });
  });

  describe('transcribeVoice action', () => {
    it('should transcribe voice successfully', async () => {
      // Mock fetch for audio file
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'audio/mpeg' : null),
        },
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
      } as Response);

      // Mock transcribeAudio function
      vi.mocked(transcribeAudio).mockResolvedValue('Hello world');

      const event: Event = {
        arguments: {
          input: {
            action: 'transcribeVoice',
            userId: 'user-123',
            audioUrl: 'https://example.com/audio.mp3',
            language: 'en',
          },
        },
      };

      const result = await handler(event);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ text: 'Hello world', language: 'en' });
      expect(result.confidence).toBe(0.95);
      expect(vi.mocked(transcribeAudio)).toHaveBeenCalledWith({
        audioBuffer: expect.any(Buffer),
        mimeType: 'audio/mpeg',
        language: 'en',
      });
    });

    it('should handle transcribeVoice fetch errors', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      } as Response);

      const event: Event = {
        arguments: {
          input: {
            action: 'transcribeVoice',
            userId: 'user-123',
            audioUrl: 'https://example.com/invalid.mp3',
          },
        },
      };

      const result = await handler(event);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to fetch audio');
    });
  });

  describe('analyzeFoodPhoto action', () => {
    it('should analyze food photo successfully', async () => {
      // Mock fetch for image file
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'image/jpeg' : null),
        },
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(2048)),
      } as Response);

      const mockAnalysis = {
        foods: [
          {
            name: 'Grilled Chicken',
            portionSize: 150,
            calories: 248,
            protein: 46,
            carbs: 0,
            fat: 5,
            fiber: 0,
            category: 'PROTEIN',
          },
        ],
        totalCalories: 248,
        totalProtein: 46,
        totalCarbs: 0,
        totalFat: 5,
        totalFiber: 0,
        confidence: 0.85,
      };

      // Mock analyzeImage function
      vi.mocked(analyzeImage).mockResolvedValue(JSON.stringify(mockAnalysis));

      const event: Event = {
        arguments: {
          input: {
            action: 'analyzeFoodPhoto',
            userId: 'user-123',
            photoUrl: 'https://example.com/meal.jpg',
          },
        },
      };

      const result = await handler(event);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAnalysis);
      expect(result.confidence).toBe(0.85);
    });
  });

  describe('unknown action', () => {
    it('should return error for unknown action', async () => {
      const event: Event = {
        arguments: {
          input: {
            action: 'unknownAction' as any,
            userId: 'user-123',
          },
        },
      };

      const result = await handler(event);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown action: unknownAction');
      expect(result.confidence).toBe(0);
    });
  });

  describe('malformed responses', () => {
    it('should handle invalid JSON gracefully', async () => {
      vi.mocked(chatCompletion).mockResolvedValue('not valid json');

      const event: Event = {
        arguments: {
          input: {
            action: 'parseWorkout',
            userId: 'user-123',
            description: 'Bench press',
          },
        },
      };

      const result = await handler(event);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });
});
