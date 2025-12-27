# Agent Instructions

## Git Commit Behavior

This agent should commit to git periodically during development work.

### When to Commit
- After completing a logical unit of work (feature, bug fix, refactoring)
- After implementing and testing a significant change
- Before moving to a new task
- When enough changes have accumulated that losing them would be problematic

### Commit Message Guidelines
- Use clear, descriptive commit messages
- Focus on the "why" rather than the "what"
- Keep messages concise (1-2 sentences typically)
- Include context about what was changed and why

### Example Commit Flow
1. Complete implementation or fix
2. Run relevant tests
3. Stage the changes with `git add`
4. Create commit with appropriate message
5. Continue with next task

The agent should proactively manage git commits without needing explicit user instruction, using good judgment about when commits are warranted.
