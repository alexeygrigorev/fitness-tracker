# Fitness AI Lambda Function

Unified AWS Lambda function for all AI/ML operations in the Fitness Tracker app.

## Overview

This Lambda function provides a single endpoint for multiple AI-powered features using OpenAI's GPT-4o and Whisper APIs. It follows a handler-per-action pattern for maintainability while keeping deployment simple.

## Supported Actions

| Action | Description | OpenAI Model |
|--------|-------------|--------------|
| `parseWorkout` | Parse workout descriptions into structured exercise data | GPT-4o |
| `parseFood` | Parse food descriptions into nutritional data | GPT-4o |
| `generateAdvice` | Generate personalized fitness/nutrition advice | GPT-4o |
| `transcribeVoice` | Transcribe voice input to text | Whisper |
| `analyzeFoodPhoto` | Analyze food photos for nutritional content | GPT-4o Vision |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AppSync GraphQL API                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Fitness AI Lambda Function                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Handler Router                     │   │
│  │  Routes requests to appropriate handler by action   │   │
│  └─────────────────────────────────────────────────────┘   │
│                         │                                   │
│         ┌───────────────┼───────────────┐                  │
│         ▼               ▼               ▼                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐            │
│  │  Workout │    │   Food   │    │  Advice  │            │
│  │  Handler │    │  Handler │    │ Handler  │            │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘            │
│       │               │               │                   │
│  ┌────┴─────┐    ┌────┴─────┐    ┌────┴─────┐            │
│  │  Voice   │    │   Photo  │    │  Shared  │            │
│  │  Handler │    │  Handler │    │   Utils  │            │
│  └────┬─────┘    └────┬─────┘    └──────────┘            │
│       │               │                                   │
│  ┌────┴───────────────┴──────────────────────┐            │
│  │         OpenAI Service Layer               │            │
│  │  - Chat Completions (GPT-4o)              │            │
│  │  - Audio Transcription (Whisper)          │            │
│  │  - Vision Analysis (GPT-4o Vision)        │            │
│  └──────────────────────┬────────────────────┘            │
└─────────────────────────┼──────────────────────────────────┘
                          │
                          ▼
                ┌─────────────────┐
                │   OpenAI API    │
                └─────────────────┘
```

## Project Structure

```
fitnessAI/
├── src/
│   ├── index.ts           # Main Lambda handler with router
│   ├── types/
│   │   └── index.ts       # TypeScript type definitions
│   ├── handlers/
│   │   ├── parseWorkout.ts
│   │   ├── parseFood.ts
│   │   ├── generateAdvice.ts
│   │   ├── transcribeVoice.ts
│   │   └── analyzeFoodPhoto.ts
│   ├── services/
│   │   └── openai.ts      # OpenAI client wrapper
│   └── utils/
│       └── context.ts     # Context builder for advice
├── tests/
│   ├── setup.ts           # Test configuration and mocks
│   ├── handlers.test.ts   # Handler tests
│   └── context.test.ts    # Context utility tests
├── dist/                  # Built output (generated)
├── package.json
├── vitest.config.ts
└── README.md
```

## Request/Response Format

### Request

```graphql
mutation FitnessAI {
  fitnessAI(action: "parseWorkout", input: {
    description: "Bench press 5x5 at 135lbs",
    userId: "user-123"
  }) {
    success
    data
    error
    confidence
  }
}
```

### Response

```json
{
  "success": true,
  "data": {
    "exercises": [
      {
        "name": "Bench Press",
        "sets": [
          { "weight": 135, "reps": 5, "setType": "working" }
        ],
        "primaryMuscles": ["chest"],
        "secondaryMuscles": ["triceps", "shoulders"]
      }
    ],
    "duration": 30
  },
  "confidence": 0.9
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for GPT-4o and Whisper |

## Development

### Install Dependencies

```bash
cd amplify/backend/function/fitnessAI
npm install
```

### Build

```bash
npm run build
```

### Run Tests

```bash
# Run tests once
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Type check
npm run typecheck
```

## Deployment

### Via AWS Amplify

```bash
amplify function add
# Select "fitnessAI" as the function name
# Choose "Serverless function" -> "Lambda function"
# Select Node.js runtime
amplify push
```

### Manual Deployment

```bash
# Build the function
npm run build

# Deploy to AWS Lambda
aws lambda update-function-code \
  --function-name fitnessAI \
  --zip-file fileb://dist/index.js
```

## Monitoring

The function uses AWS Lambda Powertools for structured logging and tracing:

- **Logs**: CloudWatch Logs under `/aws/lambda/fitnessAI`
- **Traces**: AWS X-Ray for distributed tracing
- **Metrics**: Custom CloudWatch metrics for success/failure rates

## Cost Optimization

- **Single function**: Reduces cold starts compared to multiple functions
- **Connection reuse**: OpenAI client is singleton
- **Efficient prompts**: Optimized token usage

## Error Handling

All handlers return a consistent response format:

```typescript
{
  success: boolean;
  data?: any;
  error?: string;
  confidence: number;
}
```

Errors are logged with context but never expose sensitive information.

## Testing Strategy

1. **Unit tests**: Individual handler logic
2. **Integration tests**: Full request/response flow
3. **Mocked external services**: OpenAI API calls are mocked
4. **Coverage target**: 80%+

## License

MIT
