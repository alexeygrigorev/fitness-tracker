# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Technology Stack

### Frontend
- **React Native with Expo** - Cross-platform mobile (iOS/Android) and web
- **Expo Router** - File-based routing
- **AWS Amplify** - SDK for AWS integrations
- **Apollo Client** - GraphQL client for AppSync
- **Zustand** - Client state management
- **TanStack Query (React Query)** - Server state and caching

### Backend (AWS Serverless)
- **AWS AppSync** - GraphQL API with real-time and offline sync
- **Amazon Cognito** - Authentication (user pools)
- **Amazon DynamoDB** - NoSQL database (on-demand, pay-per-request)
- **AWS Lambda** - Serverless compute (AI/ML processing, Garmin sync)
- **Amazon S3** - File storage (food photos, exports)
- **Amazon SNS/Pinpoint** - Push notifications

### AI/ML Services
- **OpenAI API** (GPT-4o) - Chat-based logging, workout/food parsing
- **Whisper API** - Voice transcription
- **OpenAI Vision API** - Food photo analysis

### Development Tools
- **Turbo** - Monorepo build system
- **pnpm** - Package manager with workspaces
- **TypeScript** - Type safety across frontend/backend
- **ESBuild** - Fast Lambda bundling

## Project Structure

```
fitness-tracker/
├── apps/
│   ├── mobile/              # React Native (Expo) app
│   │   └── src/
│   │       └── app/         # Expo Router pages
│   │           ├── (tabs)/  # Tab screens (Overview, Exercises, Food, etc.)
│   │           ├── _layout.tsx
│   │           └── index.tsx
│   └── web/                 # Future: Next.js web app
├── packages/
│   ├── shared/              # Shared TypeScript types and utilities
│   │   └── src/
│   │       ├── types/       # Domain types
│   │       └── utils/       # Date, validation, unit conversions
│   ├── ui/                  # Shared React components
│   ├── api/                 # GraphQL schema
│   └── functions/           # Lambda handlers
├── amplify/
│   └── backend/
│       ├── api/             # AppSync GraphQL schema
│       └── function/        # Lambda functions
├── package.json             # Root monorepo config
├── turbo.json               # Turbo build config
└── tsconfig.json            # Root TypeScript config
```

## Commands

### Installation
```bash
pnpm install
```

### Development
```bash
# Start mobile app (requires Expo Go or dev build)
pnpm --filter @fitness-tracker/mobile dev

# Run on specific platform
pnpm --filter @fitness-tracker/mobile ios
pnpm --filter @fitness-tracker/mobile android
pnpm --filter @fitness-tracker/mobile web
```

### Building
```bash
# Build all packages
pnpm build

# Build Lambda functions
cd amplify/backend/function/parseWorkout
pnpm build
```

### Type Checking
```bash
# Type check all packages
pnpm typecheck

# Type check specific package
pnpm --filter @fitness-tracker/shared typecheck
```

### AWS Amplify
```bash
# Initialize Amplify (first time only)
amplify init

# Add categories
amplify add api
amplify add auth
amplify add function
amplify add storage

# Push to AWS
amplify push

# Pull backend config
amplify pull

# View backend status
amplify status
```

### Code Generation
```bash
# Generate TypeScript types from GraphQL schema
pnpm codegen
```

## Key Architecture Patterns

### Monorepo with Workspaces
- Uses **pnpm workspaces** for efficient dependency management
- Packages reference each other with `workspace:*` protocol
- Turbo orchestrates build, dev, and test commands

### Offline-First Architecture
- **AppSync Delta Sync** - Only syncs changed data
- **Apollo Cache** - Local GraphQL cache
- **WatermelonDB or Expo SQLite** - Local persistent storage
- All mutations are queued and replayed when connection restored

### Authentication Flow
1. User signs up/logs in via **Amazon Cognito**
2. JWT tokens stored in **SecureStore**
3. Tokens attached to all **AppSync** requests
4. Refresh handled automatically by Amplify SDK

### GraphQL Schema Organization
- **@model** directive = DynamoDB table with CRUD operations
- **@connection** = Relationships between tables
- **@auth** rules = Row-level security (owner-based access)
- Public canonical data (exercises, food) uses IAM auth
- User data uses Cognito user pools auth

### Lambda Function Patterns
- Entry point: `src/index.ts` exports `handler` function
- Uses **AWS Lambda Powertools** for logging and tracing
- **ESBuild** for fast, minified bundles
- Environment variables for API keys (OpenAI, Garmin)

### Type Safety Across Stack
- **Shared types package** consumed by mobile, web, and Lambda
- **GraphQL Code Generator** creates TypeScript types from schema
- **Zod** schemas for runtime validation

## Domain Architecture

See `requirements/README.md` for complete domain documentation.

### Primary Tabs
- **Overview** - Dashboard with chat-based logging
- **Exercises** - Workout tracking, training programs, presets
- **Food** - Nutrition logging, barcodes, AI photo recognition
- **Sleep** - Sleep tracking with Garmin integration
- **Metabolism** - Educational metabolic state models
- **Insights** - AI-powered, context-aware advice
- **Settings** - User preferences, goals, integrations

### Data Flow Example (Workout Logging)
1. User logs workout (manual or AI-assisted)
2. App writes to local cache (Apollo)
3. Mutation queued with AppSync
4. When online: syncs to DynamoDB via AppSync
5. Lambda processes AI parsing if needed
6. Real-time subscription updates UI
7. Advice engine triggers post-workout recommendations

## AWS Cost Optimization

### Free Tier Usage
- **Cognito**: 50,000 MAUs free
- **DynamoDB**: 25GB storage + 200M requests/month free
- **Lambda**: 1M requests/month free
- **AppSync**: 1M queries/month free
- **S3**: 5GB storage free

### Cost Controls
- DynamoDB **on-demand** mode (no capacity planning)
- Lambda **pay-per-use** (no provisioned concurrency)
- S3 **intelligent tiering** for old data
- CloudWatch **basic** monitoring (detailed only when debugging)

### Estimated Costs
- **Single user**: $0 (all within free tiers)
- **1000 users**: ~$50-80/month

## Important Notes

### AppSync + DynamoDB
- GSIs (Global Secondary Indices) are costly - use sparingly
- On-demand mode is cheapest for unpredictable workloads
- Consider **query** over **scan** - always filter by partition key

### Lambda Best Practices
- Bundle size matters (cold start time)
- Use ESBuild tree-shaking
- Keep dependencies minimal
- Reuse connections outside handler (database, HTTP clients)

### Expo Development
- Use **Expo Go** for quick development
- Create **development build** for native modules
- Use **EAS Build** for app store submissions
- **CodePush** for OTA updates (no app store review)

### Garmin Integration
- OAuth flow stores tokens encrypted in Cognito user attributes
- Polling Lambda runs every 15-30 minutes
- Data normalized before writing to DynamoDB

## Requirements Reference

See `requirements/` for complete product specification:
- `01-product-overview.md` - Vision and design principles
- `04-exercises-domain.md` - Workout tracking model
- `05-food-domain.md` - Nutrition tracking model
- `06-sleep-domain.md` - Sleep tracking model
- `07-metabolism-domain.md` - Metabolic state modeling

## Common Development Tasks

### Adding a New GraphQL Type
1. Update `amplify/backend/api/schema.graphql`
2. Run `amplify api push` to deploy changes
3. Run `pnpm codegen` to regenerate TypeScript types

### Creating a New Lambda Function
1. Create in `amplify/backend/function/`
2. Add `package.json` with esbuild build script
3. Run `amplify function add` to register
4. Attach to AppSync resolver or API Gateway

### Adding a New Screen
1. Create file in `apps/mobile/src/app/(tabs)/`
2. Expo Router auto-routes based on filename
3. Update tab layout if adding new tab

### Modifying Shared Types
1. Update `packages/shared/src/types/`
2. Types automatically available to all workspaces
3. Run `pnpm typecheck` to verify
