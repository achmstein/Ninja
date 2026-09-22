import { test, expect, type Page } from '@playwright/test';

// The plan, through the control app, against the dry-run AppHost: a café is
// stamped as a customer on Starter, the plan tab says what that entitles it
// to, the storeroom is bought on top, and the stack is told — the
// entitlements job's steps land Done. Then the café is destroyed.
//
// The dry run records every command instead of running docker, so this
// proves the plan's arithmetic, the job it enqueues and the control app's
// flow, not a stack. tests/Control.AcceptanceTests stamps a real one.

const CONTROL_URL = process.env.CONTROL_URL ?? 'http://localhost:5177';
const PLATFORM_USER = process.env.PLATFORM_USER ?? 'platform';
const PLATFORM_PASSWORD = process.env.PLATFORM_PASSWORD ?? 'Platform123$';

async function signIn(page: Page) {
  await page.goto(CONTROL_URL + '/');
  await expect(page.locator('#username')).toBeVisible({ timeout: 60_000 });
  await page.locator('#username').fill(PLATFORM_USER);
  await page.locator('#password').fill(PLATFORM_PASSWORD);
  await page.locator('#kc-login').click();

  const newPassword = page.locator('#password-new');
  if (await newPassword.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await newPassword.fill(PLATFORM_PASSWORD);
    await page.locator('#password-confirm').fill(PLATFORM_PASSWORD);
    await page.getByRole('button', { name: /submit|save|update/i }).first().click();
  }

  await expect(page.getByRole('heading', { name: 'Tenants' })).toBeVisible({ timeout: 60_000 });
}

test('a café on Starter buys the storeroom on top, and the stack is told', async ({ page }) => {
  test.setTimeout(6 * 60_000);
  await signIn(page);

  const slug = `plan-${Date.now().toString(36).slice(-6)}`;

  // A paying café, on the smallest plan that has anything in it
  await page.getByRole('link', { name: 'New tenant' }).click();
  await page.locator('#name').first().fill(`Plan ${slug}`);
  await page.locator('#ownerEmail').fill(`owner@${slug}.test`);
  await page.locator('#kind').click();
  await page.getByRole('option', { name: 'Customer', exact: true }).click();
  // A paying café is asked for its own domain; the field appearing is the kind taking
  await expect(page.locator('#customerDomain')).toBeVisible();
  await page.locator('#slug').fill(slug);
  // The plan sits in the form's second section, folded away until it is asked for
  await page.getByRole('button', { name: 'Contact' }).click();
  await page.locator('#plan').click();
  await page.getByRole('option', { name: 'Starter', exact: true }).click();
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page).toHaveURL(new RegExp(`/t/${slug}`), { timeout: 30_000 });
  await expect(page.getByText('Running', { exact: true }).first()).toBeVisible({ timeout: 120_000 });

  // What the plan entitles it to, and what it does not
  await page.goto(CONTROL_URL + `/t/${slug}?tab=subscription`);
  const entitled = page.getByText(/^Entitled to:/);
  await expect(entitled).toBeVisible({ timeout: 30_000 });
  await expect(entitled).toContainText('Kitchen display');
  await expect(entitled).not.toContainText('Inventory');
  // What the plan includes is on and cannot be switched off; what it does not is free to buy
  await expect(page.locator('#module-Kds')).toBeDisabled();
  await expect(page.locator('#module-Inventory')).toBeEnabled();

  // Bought on top
  await page.locator('#module-Inventory').click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Subscription saved')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/^Entitled to:/)).toContainText('Inventory');

  // The café's stack is told: the entitlements job runs and every step lands Done
  await page.goto(CONTROL_URL + `/t/${slug}`);
  const steps = page.getByText('Done', { exact: true });
  await expect.poll(async () => steps.count(), { timeout: 120_000 }).toBeGreaterThan(0);
  await expect(page.getByText('Failed', { exact: true })).toHaveCount(0);

  // And the café is gone again
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Destroy' }).click();
  await page.getByRole('textbox').last().fill(slug);
  await page.getByRole('button', { name: 'Destroy' }).click();
  await expect(page.getByText('Destroyed', { exact: true }).first()).toBeVisible({ timeout: 120_000 });
});
