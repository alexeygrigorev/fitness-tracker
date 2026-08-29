---
name: mobile-audit
description: Audit and assess mobile design quality using Playwright screenshots and best practices
---

# Mobile Design Audit

## Overview

This skill provides a systematic approach to auditing web application designs for mobile friendliness. It uses Playwright to capture screenshots at mobile viewport sizes and evaluates them against industry-standard mobile design criteria.

## Capturing Screenshots

### Playwright Script Template

Create a script file in `e2e/scripts/` (e.g., `mobile-screenshots.ts`):

```typescript
import { test, type Page } from '@playwright/test';

// Viewport sizes
const MOBILE = { width: 375, height: 812 };      // iPhone X
const MOBILE_SMALL = { width: 320, height: 568 }; // iPhone 5 SE
const TABLET = { width: 768, height: 1024 };      // iPad

// Helper to login
async function login(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('username').fill('test');
  await page.getByPlaceholder('password').fill('test');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 10000 });
}

test.describe('Mobile Screenshots', () => {
  test.use({ viewport: MOBILE });

  test('capture screenshots', async ({ page }) => {
    await login(page);
    await page.goto('/your-page');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(300);

    await page.screenshot({
      path: '.tmp/viewport-page-name.png',
      fullPage: false  // Only what fits on screen
    });
    await page.screenshot({
      path: '.tmp/full-page-name.png',
      fullPage: true  // Entire page with scrolling
    });
  });
});
```

### Running the Script

The scripts directory has a separate Playwright config (`playwright.scripts.config.ts`) so these scripts don't run as part of the main test suite.

```bash
cd e2e
npx playwright test --config=playwright.scripts.config.ts --reporter=list
```

## Assessment Criteria

### 1. Typography & Readability (20 points)

**Base font size** - /4 points
- Minimum 16px (1rem) for body text to prevent iOS auto-zoom on input focus

**Line height** - /4 points
- 1.4-1.6 for body text
- 1.2-1.4 for headings

**Text contrast** - /4 points
- WCAG AA: 4.5:1 for normal text
- WCAG AA: 3:1 for large text (18px+ or 14px bold)

**Text truncation** - /4 points
- Long text properly truncated with ellipsis
- No text overflow or breaking layout

**Responsive sizing** - /4 points
- Text scales appropriately across breakpoints
- Uses `text-sm`, `text-base`, `text-lg` utility classes

### 2. Touch Targets & Interactive Elements (20 points)

**Minimum touch size** - /5 points
- Buttons/links: minimum 44x44px (iOS) or 48x48dp (Android)
- Includes padding, not just the visible element

**Touch target spacing** - /5 points
- Minimum 8px between adjacent touch targets
- Prevents accidental taps on neighboring buttons

**Interactive feedback** - /5 points
- Visual feedback on tap (active/pressed state)
- Clear focus indication for keyboard navigation

**No hover-only interactions** - /5 points
- All actions accessible via touch
- No dropdowns that only appear on hover
- No critical info hidden behind hover

### 3. Layout & Spacing (20 points)

**No horizontal scroll** - /5 points
- Page content fits within viewport width
- No overflow-x on any element

**Adequate padding** - /5 points
- Minimum 16px padding on edges
- Content has breathing room from screen edges

**Grid responsiveness** - /5 points
- Multi-column layouts stack to single column on mobile
- Uses `grid-cols-1 md:grid-cols-2` pattern

**Safe area handling** - /5 points
- Content respects device safe areas
- Not cut off by notch or home indicator

### 4. Navigation & Wayfinding (15 points)

**Visible navigation** - /4 points
- Navigation always accessible
- Not hidden or cut off on small screens

**Back/navigation affordance** - /4 points
- Clear way to return to previous screen
- Back button or breadcrumbs where needed

**Active state indication** - /4 points
- Current location clearly indicated in nav
- Active tab or link visually distinct

**Hierarchy clarity** - /3 points
- Parent/child relationships clear
- Breadcrumbs or back button context

### 5. Content Priority (15 points)

**Mobile-first content** - /5 points
- Primary content visible above fold
- Minimal scrolling to reach main content

**Progressive disclosure** - /5 points
- Secondary content hidden behind expand/collapse
- Uses tabs, accordions, or "show more" patterns

**Mobile-specific patterns** - /5 points
- Bottom sheets instead of desktop modals
- Slide-overs for secondary content
- Full-screen pages for complex forms

### 6. Forms & Input (10 points)

**Input field sizing** - /3 points
- Minimum 44px height for touch-friendly inputs
- Adequate padding for comfortable tapping

**Label visibility** - /3 points
- Labels always visible
- Not placeholder-only (placeholders disappear on input)

**Input types** - /2 points
- Uses appropriate input types (tel, email, number)
- Triggers correct keyboard on mobile

**Error/validation** - /2 points
- Inline validation messages
- No blocking alerts for errors

## Scoring Rubric

- **90-100 points: A (Excellent)** - Production-ready mobile experience
- **80-89 points: B (Good)** - Minor issues, generally usable
- **70-79 points: C (Fair)** - Usable but has noticeable friction points
- **60-69 points: D (Poor)** - Significant issues affecting usability
- **0-59 points: F (Fail)** - Not suitable for mobile use

## Critical Failures (Automatic Score Penalty)

- Content requires horizontal scrolling
- Touch targets smaller than 32x32px
- Body text smaller than 14px
- Navigation completely inaccessible
- Overlapping or cut-off content
- No way to complete primary action

## Frequent Problems

- Desktop modals on mobile (should use bottom sheets)
- Hover-only dropdown menus
- Cramped buttons with insufficient padding
- Long URLs/emails breaking layout
- Fixed headers taking too much viewport height
- Text inputs zooming on iOS (font-size < 16px)
- Two-column layouts that don't stack on mobile

## Assessment Workflow

1. **Capture TWO types of screenshots at 375px width (primary mobile target):**
   - **Viewport screenshot** (what fits on screen without scrolling): Shows what users see first
   - **Full page screenshot** (entire page with scrolling): Shows complete content
2. Review viewport screenshot for above-the-fold issues (critical content, navigation)
3. Review full page screenshot for overall layout and content issues
4. Review against criteria using the scoring sheet
5. Document issues with specific line/file references
6. Prioritize fixes by impact (Critical > High > Medium > Low)
7. Re-audit after fixes to verify improvement

## Example Assessment Format

```
## Page: Workouts List

### Typography & Readability: 15/20
- ✓ Base font size 16px
- ✓ Line height appropriate
- ✓ Good contrast
- ✗ Long exercise names overflow (missing text-overflow: ellipsis)
- ✓ Responsive sizing

### Touch Targets: 12/20
- ✗ Edit/Delete buttons < 44px (actual: 32px)
- ✓ Button spacing adequate
- ✗ No active state feedback on touch
- ✓ No hover-only interactions

### Layout & Spacing: 14/20
- ✓ No horizontal scroll
- ✗ Edge padding only 8px (need 16px minimum)
- ✓ Grid stacks properly
- ✓ Safe areas respected

**Total: 41/100 (F - Fail)**

**Priority fixes:**
1. Increase button touch targets to 44px minimum
2. Add edge padding of 16px
3. Add active/touch state styles
4. Fix text overflow on exercise names
```
