import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "e2e-app-shell-pass";

function uniqueUsername() {
  return `app-shell-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function registerFreshUser(page: Page) {
  const username = uniqueUsername();
  await page.goto("/register");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Email").fill(`${username}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Today's Summary" }),
  ).toBeVisible();
  return username;
}

test.describe("App shell and preferences", () => {
  test("desktop navigation activates and renders every route", async ({
    page,
  }) => {
    await registerFreshUser(page);

    const destinations = [
      { path: "/", name: "Dashboard", heading: "Today's Summary" },
      { path: "/workouts", name: "Workouts", heading: "Workouts & Programs" },
      { path: "/nutrition", name: "Nutrition", heading: "Nutrition Tracking" },
      { path: "/weight", name: "Weight", heading: "Weight Tracking" },
      { path: "/sleep", name: "Sleep", heading: "Sleep Tracking" },
      {
        path: "/metabolism",
        name: "Metabolism",
        heading: "Metabolism & Recovery",
      },
      { path: "/profile", name: "Profile", heading: "Profile" },
    ];

    const navigation = page.getByRole("navigation").first();
    await expect(navigation).toBeVisible();

    for (const destination of destinations) {
      await navigation.getByRole("link", { name: destination.name }).click();
      await expect(page).toHaveURL(
        new RegExp(`${destination.path.replace("/", "\\/")}$`),
      );
      await expect(
        page.getByRole("heading", { name: destination.heading }),
      ).toBeVisible();
      await expect(
        navigation.getByRole("link", { name: destination.name }),
      ).toHaveAttribute("aria-current", "page");
    }
  });

  test("dark mode preference persists across reload", async ({ page }) => {
    await registerFreshUser(page);
    const toggleButton = page
      .locator('header button[title="Switch to Dark Mode"]')
      .first();
    await expect(toggleButton).toBeVisible();
    await expect(page.locator("html")).not.toHaveClass(/dark/);

    const darkSaveResponse = page.waitForResponse((response) =>
      response.url().includes("/api/auth/me/update/"),
    );
    await toggleButton.click();
    const darkSaved = await darkSaveResponse;
    expect(darkSaved.status()).toBe(200);
    await expect(darkSaved.json()).resolves.toMatchObject({ dark_mode: true });
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.reload();
    await expect(
      page.locator('header button[title="Switch to Light Mode"]').first(),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(
      page.getByRole("heading", { name: "Today's Summary" }),
    ).toBeVisible();

    const lightSaveResponse = page.waitForResponse((response) =>
      response.url().includes("/api/auth/me/update/"),
    );
    await page
      .locator('header button[title="Switch to Light Mode"]')
      .first()
      .click();
    const lightSaved = await lightSaveResponse;
    expect(lightSaved.status()).toBe(200);
    await expect(lightSaved.json()).resolves.toMatchObject({
      dark_mode: false,
    });

    await page.reload();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await expect(
      page.locator('header button[title="Switch to Dark Mode"]').first(),
    ).toBeVisible();
  });

  test("theme remains responsive when saving the preference fails", async ({
    page,
  }) => {
    await registerFreshUser(page);

    const preferenceSavePattern = "**/api/auth/me/update/";
    const rejectedWrites: unknown[] = [];

    await page.route(preferenceSavePattern, async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.fallback();
        return;
      }

      rejectedWrites.push(route.request().postDataJSON());
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          detail: "Preference service temporarily unavailable.",
        }),
      });
    });

    const darkToggle = page
      .locator('header button[title="Switch to Dark Mode"]')
      .first();
    const failedDarkSave = page.waitForResponse((response) =>
      response.url().includes("/api/auth/me/update/"),
    );
    await darkToggle.click();
    expect((await failedDarkSave).status()).toBe(503);
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(darkToggle).not.toBeVisible();
    await expect(
      page.locator('header button[title="Switch to Light Mode"]').first(),
    ).toBeVisible();

    const lightToggle = page
      .locator('header button[title="Switch to Light Mode"]')
      .first();
    const failedLightSave = page.waitForResponse((response) =>
      response.url().includes("/api/auth/me/update/"),
    );
    await lightToggle.click();
    expect((await failedLightSave).status()).toBe(503);
    await expect(rejectedWrites).toEqual([
      { dark_mode: true },
      { dark_mode: false },
    ]);
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await expect(
      page.getByRole("heading", { name: "Today's Summary" }),
    ).toBeVisible();

    await page.unroute(preferenceSavePattern);

    const recoveredDarkSave = page.waitForResponse(
      (response) =>
        response.url().includes("/api/auth/me/update/") &&
        response.request().method() === "PATCH",
    );
    await page
      .locator('header button[title="Switch to Dark Mode"]')
      .first()
      .click();
    const savedPreference = await recoveredDarkSave;
    expect(savedPreference.status()).toBe(200);
    await expect(savedPreference.json()).resolves.toMatchObject({
      dark_mode: true,
    });

    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(
      page.getByRole("heading", { name: "Today's Summary" }),
    ).toBeVisible();
  });

  test.describe("mobile navigation", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("bottom navigation reaches every tab without horizontal overflow", async ({
      page,
    }) => {
      await registerFreshUser(page);
      const mobileNavigation = page.getByRole("navigation", { name: "Mobile" });
      await expect(mobileNavigation).toBeVisible();

      const fitsViewport = () =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        );

      const destinations = [
        { path: "/", name: "Dashboard", heading: "Today's Summary" },
        { path: "/workouts", name: "Workouts", heading: "Workouts & Programs" },
        {
          path: "/nutrition",
          name: "Nutrition",
          heading: "Nutrition Tracking",
        },
        { path: "/weight", name: "Weight", heading: "Weight Tracking" },
        { path: "/sleep", name: "Sleep", heading: "Sleep Tracking" },
        {
          path: "/metabolism",
          name: "Metabolism",
          heading: "Metabolism & Recovery",
        },
        { path: "/profile", name: "Profile", heading: "Profile" },
      ];

      for (const destination of destinations) {
        await mobileNavigation
          .getByRole("link", { name: destination.name })
          .click();
        await expect(page).toHaveURL(
          new RegExp(`${destination.path.replace("/", "\\/")}$`),
        );
        await expect(
          page.getByRole("heading", { name: destination.heading }),
        ).toBeVisible();
        expect(await fitsViewport()).toBe(true);
      }
    });
  });
});
