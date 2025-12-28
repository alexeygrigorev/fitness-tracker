# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Technology Stack

### Frontend
- **React Native with Expo** - Cross-platform mobile (iOS/Android) and web
- **Expo Router** - File-based routing
- **Zustand** - Client state management
- **TanStack Query (React Query)** - Server state and caching

### Development Tools
- **Turbo** - Monorepo build system
- **pnpm** - Package manager with workspaces
- **TypeScript** - Type safety across frontend/backend

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
│   └── ui/                  # Shared React components
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
```

### Type Checking
```bash
# Type check all packages
pnpm typecheck

# Type check specific package
pnpm --filter @fitness-tracker/shared typecheck
```

## Key Architecture Patterns

### Monorepo with Workspaces
- Uses **pnpm workspaces** for efficient dependency management
- Packages reference each other with `workspace:*` protocol
- Turbo orchestrates build, dev, and test commands

### Type Safety Across Stack
- **Shared types package** consumed by mobile and web
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

## Important Notes

### Expo Development
- Use **Expo Go** for quick development
- Create **development build** for native modules
- Use **EAS Build** for app store submissions
- **CodePush** for OTA updates (no app store review)

## Requirements Reference

See `requirements/` for complete product specification:
- `01-product-overview.md` - Vision and design principles
- `04-exercises-domain.md` - Workout tracking model
- `05-food-domain.md` - Nutrition tracking model
- `06-sleep-domain.md` - Sleep tracking model
- `07-metabolism-domain.md` - Metabolic state modeling

## Common Development Tasks

### Adding a New Screen
1. Create file in `apps/mobile/src/app/(tabs)/`
2. Expo Router auto-routes based on filename
3. Update tab layout if adding new tab

### Modifying Shared Types
1. Update `packages/shared/src/types/`
2. Types automatically available to all workspaces
3. Run `pnpm typecheck` to verify
