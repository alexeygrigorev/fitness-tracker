# Fitness Tracker

A personal fitness, nutrition, and metabolism tracking application designed to be goal-flexible and adaptable as user goals change over time.

## Project Status

**Early planning phase** - Requirements specification complete.

## Overview

This application allows tracking, reconstruction, and understanding of:
- Physical activity and workouts
- Food intake and nutrition
- Sleep and recovery
- Metabolic states and patterns

The system connects exercises and food through a metabolism model and provides explainable, context-aware guidance. The app is designed to be goal-flexible and adapts as user goals change over time (weight gain/loss, maintenance, performance, health).

### Key Design Principles

- **Retrospective-friendly**: Supports real-time and post-hoc logging
- **AI-assisted but human-controlled**: AI helps with logging and analysis but never finalizes without user confirmation
- **Everything is timestamped**: Event time vs log time is tracked; estimated data is clearly labeled
- **Goal-flexible**: No assumption of a single long-term goal
- **Explainable**: All advice explains reasoning and assumptions

## Requirements Documentation

The requirements are organized into focused documents:

- [Product Overview](01-product-overview.md) - Vision, primary user, and core design philosophy
- [Roles and Data Ownership](02-roles-and-data-ownership.md) - User/admin roles and food item ownership model
- [App Structure and Navigation](03-app-structure-and-navigation.md) - Primary tabs and navigation
- [Exercises Domain](04-exercises-domain.md) - Exercise knowledge, muscle model, training programs, workout sessions, set logging
- [Food Domain](05-food-domain.md) - Food items, meals, barcode support, AI-assisted logging
- [Sleep Domain](06-sleep-domain.md) - Sleep tracking, quality metrics, device integration
- [Passive Activities](07-passive-activities.md) - Garmin integration for non-exercise movement
- [Metabolism Domain](08-metabolism-domain.md) - Educational models for metabolic states
- [Advice System](09-advice-system.md) - Context-aware, explainable recommendations
- [AI Workout Logging](10-ai-workout-logging.md) - Voice and text-based workout reconstruction
- [Voice and Chat Interface](11-voice-and-chat.md) - Natural input methods
- [Time Handling](12-time-handling.md) - Event time vs log time, retrospective editing
- [Future-Proofing](13-future-proofing.md) - Periodization support
- [Data Principles](14-data-principles.md) - Core data philosophy
- [Version 1 Scope](15-scope-summary.md) - What's included and excluded

## Version 1 Scope

**Included:**
- Manual and AI-assisted logging
- Voice and chat input
- Barcode food entry
- Training presets and free-form sessions
- Sleep tracking (Garmin integration, manual entry)
- Garmin integration (activities and sleep)
- Basic metabolism modeling
- Rule-based advice

**Excluded:**
- Medical claims
- Automatic decision-making
- Advanced periodization UI
- Multi-user support

## Technology Stack

*To be determined*

## License

*To be determined*
