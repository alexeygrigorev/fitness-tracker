import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'responsive-navigation-pass';

type Destination = {
  path: string;
  name: string;
  heading: string;
  shortLabel?: string;
};

type Rect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

type NavigationItem = {
  name: string;
  renderedText: string;
  rect: Rect;
  scrollWidth: number;
  clientWidth: number;
};

type NavigationMetrics = {
  viewportWidth: number;
  documentScrollWidth: number;
  documentClientWidth: number;
  navigation: Rect;
  items: NavigationItem[];
};

const destinations: Destination[] = [
  { path: '/', name: 'Dashboard', heading: "Today's Summary", shortLabel: 'Home' },
  { path: '/workouts', name: 'Workouts', heading: 'Workouts & Programs', shortLabel: 'Train' },
  { path: '/nutrition', name: 'Nutrition', heading: 'Nutrition Tracking', shortLabel: 'Food' },
  { path: '/weight', name: 'Weight', heading: 'Weight Tracking' },
  { path: '/sleep', name: 'Sleep', heading: 'Sleep Tracking' },
  { path: '/metabolism', name: 'Metabolism', heading: 'Metabolism & Recovery', shortLabel: 'Meta' },
  { path: '/profile', name: 'Profile', heading: 'Profile' },
];

async function registerFreshUser(page: Page): Promise<void> {
  const username = `nav-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await page.goto('/register');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Email').fill(`${username}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: destinations[0].heading })).toBeVisible();
}

async function collectNavigationMetrics(
  page: Page,
  mode: 'desktop' | 'mobile',
): Promise<NavigationMetrics> {
  return page.locator(`nav[aria-label="${mode === 'desktop' ? 'Primary' : 'Mobile'}"]`).evaluate((navigation) => {
    const navigationRect = navigation.getBoundingClientRect();
    const items = Array.from(navigation.querySelectorAll<HTMLAnchorElement>('a')).map((link) => {
      const rect = link.getBoundingClientRect();
      return {
        name: link.getAttribute('aria-label') ?? link.textContent?.trim() ?? '',
        renderedText: link.innerText,
        rect: {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        },
        scrollWidth: link.scrollWidth,
        clientWidth: link.clientWidth,
      };
    });

    return {
      viewportWidth: window.innerWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
      navigation: {
        left: navigationRect.left,
        right: navigationRect.right,
        top: navigationRect.top,
        bottom: navigationRect.bottom,
        width: navigationRect.width,
        height: navigationRect.height,
      },
      items,
    };
  });
}

function expectRowToBeUsable(metrics: NavigationMetrics): void {
  expect(metrics.documentScrollWidth).toBe(metrics.documentClientWidth);
  expect(metrics.items).toHaveLength(destinations.length);
  expect(metrics.navigation.left).toBeGreaterThanOrEqual(-0.5);
  expect(metrics.navigation.right).toBeLessThanOrEqual(metrics.viewportWidth + 0.5);

  let previous: NavigationItem['rect'] | undefined;
  for (const item of metrics.items) {
    expect(item.name).toBeTruthy();
    expect(item.rect.left).toBeGreaterThanOrEqual(metrics.navigation.left - 0.5);
    expect(item.rect.right).toBeLessThanOrEqual(metrics.navigation.right + 0.5);
    expect(item.rect.width).toBeGreaterThanOrEqual(44);
    expect(item.rect.height).toBeGreaterThanOrEqual(44);
    expect(item.scrollWidth).toBeLessThanOrEqual(item.clientWidth + 0.5);

    if (previous) {
      expect(previous.right).toBeLessThanOrEqual(item.rect.left + 0.5);
    }
    previous = item.rect;
  }
}

test.describe('Responsive navigation', () => {
  test.setTimeout(60_000);

  test('keeps every mobile tab reachable and fully visible across phone widths', async ({ browser }) => {
    const viewports = [
      { width: 320, height: 568 },
      { width: 375, height: 812 },
      { width: 768, height: 1024 },
    ];

    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport });
      try {
        const page = await context.newPage();
        await registerFreshUser(page);
        const mobileNavigation = page.getByRole('navigation', { name: 'Mobile' });
        await expect(mobileNavigation).toBeVisible();
        await expect(page.getByRole('navigation', { name: 'Primary' })).toBeHidden();

        for (const destination of destinations) {
          await mobileNavigation.getByRole('link', { name: destination.name }).click();
          await expect(page).toHaveURL(new RegExp(`${destination.path.replace('/', '\\/')}$`));
          await expect(page.getByRole('heading', { name: destination.heading })).toBeVisible();
          await expect(
            mobileNavigation.getByRole('link', { name: destination.name }),
          ).toHaveAttribute('aria-current', 'page');

          const metrics = await collectNavigationMetrics(page, 'mobile');
          expectRowToBeUsable(metrics);

          for (const [index, destination] of destinations.entries()) {
            const tab = metrics.items[index];
            const expectedLabel = viewport.width < 400
              ? destination.shortLabel ?? destination.name
              : destination.name;
            expect(tab.renderedText).toBe(expectedLabel);
          }
        }
      } finally {
        await context.close();
      }
    }
  });

  test('switches to a fitting desktop bar at the large-screen boundary', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1024, height: 720 } });
    try {
      const page = await context.newPage();
      await registerFreshUser(page);
      const desktopNavigation = page.getByRole('navigation', { name: 'Primary' });
      const mobileNavigation = page.getByRole('navigation', { name: 'Mobile' });
      await expect(desktopNavigation).toBeVisible();
      await expect(mobileNavigation).toBeHidden();

      for (const destination of destinations) {
        await desktopNavigation.getByRole('link', { name: destination.name }).click();
        await expect(page).toHaveURL(new RegExp(`${destination.path.replace('/', '\\/')}$`));
        await expect(page.getByRole('heading', { name: destination.heading })).toBeVisible();
        await expect(
          desktopNavigation.getByRole('link', { name: destination.name }),
        ).toHaveAttribute('aria-current', 'page');

        const metrics = await collectNavigationMetrics(page, 'desktop');
        expectRowToBeUsable(metrics);
      }
    } finally {
      await context.close();
    }
  });
});
