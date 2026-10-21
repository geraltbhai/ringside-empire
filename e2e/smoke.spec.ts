import { expect, type Page, test } from "@playwright/test";

async function newUniverse(page: Page, promotion = "Smoke Test Wrestling") {
  await page.goto("/new");
  await page.getByLabel("Promotion name").fill(promotion);
  await page.getByRole("button", { name: "Start universe" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: promotion })).toBeVisible();
}

test("main menu launches a new universe @mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Ringside/i })).toBeVisible();
  await newUniverse(page);
  await expect(page.getByText("This week's shows").first()).toBeVisible();
});

test("roster search, rating edit and persistence across reloads", async ({ page }) => {
  await newUniverse(page);
  await page.goto("/roster");
  await page.getByLabel("Search roster").fill("Marcus");
  await expect(page.getByRole("link", { name: /Marcus Vale/ }).first()).toBeVisible();
  await page.goto("/roster/marcus-vale/edit");
  const strength = page.getByLabel("Strength value");
  await strength.fill("40");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(/\/roster\/marcus-vale$/);
  await page.reload();
  await page.goto("/roster/marcus-vale/edit");
  await expect(page.getByLabel("Strength value")).toHaveValue("40");
});

test("booking: empty cards are blocked, AI Booker card runs, results update the universe", async ({ page }) => {
  await newUniverse(page);
  await page.goto("/booking");
  await page.getByRole("link", { name: "Book show" }).first().click();
  await expect(page.getByText("The card is empty")).toBeVisible();
  await expect(page.getByRole("button", { name: "Run show" })).toBeDisabled();
  await page.getByRole("button", { name: "AI Booker" }).click();
  await page.getByRole("button", { name: "Replace card with all" }).click();
  await expect(page.getByRole("button", { name: "Run show" })).toBeEnabled();
  await page.getByRole("button", { name: "Run show" }).click();
  await expect(page).toHaveURL(/\/shows\//);
  await expect(page.getByText("Show rating")).toBeVisible();
  await page.goto("/history");
  await expect(page.getByText(/^\d+\/100$/).first()).toBeVisible();
  await page.goto("/finances");
  await expect(page.getByText("Tickets").first()).toBeVisible();
});

test("week advances after every show runs", async ({ page }) => {
  await newUniverse(page);
  await page.getByRole("button", { name: "Simulate remaining shows" }).click();
  await expect(page.getByRole("button", { name: /Advance to week 2/ })).toBeEnabled();
  await page.getByRole("button", { name: /Advance to week 2/ }).click();
  await expect(page.getByText(/Week 2 ·/)).toBeVisible();
  // The new week survives a reload (autosave is flushed on page hide).
  await page.reload();
  await expect(page.getByText(/Week 2 ·/)).toBeVisible();
});

test("playable match starts, accepts input and can be paused", async ({ page }) => {
  await newUniverse(page);
  await page.goto("/match");
  await page.getByRole("button", { name: "Ring the bell" }).click();
  await expect(page.getByText("Press any key to ring the bell")).toBeVisible();
  await page.keyboard.press("j");
  await expect(page.getByText("The bell rings!")).toBeVisible();
  await page.keyboard.down("d");
  await page.waitForTimeout(800);
  await page.keyboard.up("d");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Paused" })).toBeVisible();
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByRole("heading", { name: "Paused" })).toBeHidden();
});

test("3D character studio saves a new look", async ({ page }) => {
  await newUniverse(page);
  await page.goto("/roster/jax-rourke/look");
  await page.getByRole("tab", { name: "Ring gear" }).click();
  await page.getByRole("button", { name: "Singlet" }).click();
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Save look" }).click();
  await expect(page).toHaveURL(/\/roster\/jax-rourke$/);
  await page.goto("/roster/jax-rourke/look");
  await page.getByRole("tab", { name: "Ring gear" }).click();
  await expect(page.getByRole("button", { name: "Singlet" })).toHaveAttribute("aria-pressed", "true");
});
