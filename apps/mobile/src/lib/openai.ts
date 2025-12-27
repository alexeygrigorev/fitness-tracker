interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ParsedWorkout {
  exercises: Array<{
    name: string;
    sets: Array<{
      weight?: number;
      reps?: number;
      setType: string;
    }>;
    primaryMuscles: string[];
    secondaryMuscles?: string[];
  }>;
  duration?: number;
  notes?: string;
}

interface ParsedFood {
  foodName: string;
  portionSize: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  category: string;
  confidence: number;
}

interface ChatResponse {
  message: string;
  suggestions?: string[];
  detectedIntent?: string;
}

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';

if (!OPENAI_API_KEY) {
  throw new Error('EXPO_PUBLIC_OPENAI_API_KEY environment variable is not set');
}

class OpenAIService {
  private baseUrl = 'https://api.openai.com/v1';

  async chat(messages: ChatMessage[], context?: any): Promise<ChatResponse> {
    try {
      const systemMessage: ChatMessage = {
        role: 'system',
        content: `You are a friendly and knowledgeable fitness and nutrition assistant for a fitness tracking app.

Your role is to help users:
- Log workouts and meals through natural conversation
- Provide advice on training, nutrition, and recovery
- Answer questions about fitness and health
- Motivate and encourage users

When users describe what they did:
1. Extract the relevant information (exercises, food, sleep, etc.)
2. Acknowledge and validate their input
3. Provide brief, helpful feedback
4. Ask relevant follow-up questions if needed

Keep responses concise (2-3 sentences max) and conversational.
Be encouraging but realistic about fitness goals.

Current context: ${JSON.stringify(context || {})}`,
      };

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [systemMessage, ...messages],
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      return {
        message: content,
        detectedIntent: this.detectIntent(content),
      };
    } catch (error) {
      console.error('OpenAI chat error:', error);
      return {
        message: "Sorry, I'm having trouble connecting. Please try again.",
      };
    }
  }

  async parseWorkout(description: string): Promise<ParsedWorkout | null> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
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
      "sets": [{"weight": 60, "reps": 10, "setType": "working"}],
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
        }),
      });

      const data = await response.json();
      return JSON.parse(data.choices[0].message.content);
    } catch (error) {
      console.error('Workout parsing error:', error);
      return null;
    }
  }

  async parseFood(description: string): Promise<ParsedFood | null> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are a nutrition expert. Parse food descriptions into structured data.

Estimate calories, protein, carbs, fat, and fiber based on the description.
Classify as PROTEIN, CARB, FAT, or MIXED.

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
        }),
      });

      const data = await response.json();
      return JSON.parse(data.choices[0].message.content);
    } catch (error) {
      console.error('Food parsing error:', error);
      return null;
    }
  }

  async generateAdvice(
    trigger: string,
    userData: any
  ): Promise<{ title: string; message: string; reasoning: string } | null> {
    try {
      const context = this.buildContext(userData);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are an expert fitness and nutrition coach. Generate personalized, actionable advice.

Available triggers: MORNING, PRE_WORKOUT, POST_WORKOUT, END_OF_DAY, POOR_SLEEP, LOW_RECOVERY, CALORIE_PACING

Return ONLY valid JSON with this format:
{
  "title": "Brief advice title",
  "message": "Main advice (2-3 sentences)",
  "reasoning": "Why this advice is relevant"
}`,
            },
            {
              role: 'user',
              content: `Trigger: ${trigger}\n\nContext:\n${context}`,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7,
        }),
      });

      const data = await response.json();
      return JSON.parse(data.choices[0].message.content);
    } catch (error) {
      console.error('Advice generation error:', error);
      return null;
    }
  }

  async transcribeAudio(audioBlob: Blob): Promise<string> {
    try {
      const formData = new FormData();
      // Note: In React Native, FormData.append only takes 2 args
      formData.append('file', audioBlob as any);
      formData.append('model', 'whisper-1');

      const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: formData,
      });

      const data = await response.json();
      return data.text;
    } catch (error) {
      console.error('Transcription error:', error);
      return '';
    }
  }

  private detectIntent(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('workout') || lower.includes('exercise') || lower.includes('gym')) {
      return 'workout';
    }
    if (lower.includes('food') || lower.includes('eat') || lower.includes('meal') || lower.includes('calorie')) {
      return 'nutrition';
    }
    if (lower.includes('sleep') || lower.includes('tired') || lower.includes('rest')) {
      return 'sleep';
    }
    return 'general';
  }

  private buildContext(userData: any): string {
    const parts: string[] = [];

    if (userData.recentWorkouts?.length > 0) {
      parts.push(`Recent workouts: ${userData.recentWorkouts.length} this week`);
    }

    if (userData.recentMeals?.length > 0) {
      parts.push(`Recent meals logged: ${userData.recentMeals.length}`);
    }

    if (userData.sleepSessions?.length > 0) {
      const lastSleep = userData.sleepSessions[0];
      parts.push(`Last sleep: ${lastSleep.duration} minutes, quality: ${lastSleep.qualityScore}`);
    }

    return parts.join('\n') || 'No recent data available';
  }
}

export const openaiService = new OpenAIService();
export default OpenAIService;
