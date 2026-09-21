import { test, expect, type Page } from '@playwright/test';

// The control plane end to end, against the dry-run AppHost: sign in as the
// platform user in the ninja realm, stamp a demo, watch every step land
// Done, and destroy it. The dry run records every command instead of
// running docker, so this proves the queue, the provisioner's steps and the
// control app's flow, not a stack.
//
// The control app is at http://localhost:5177 in the AppHost; the platform
// user's first password is the dev realm's (a temporary one, changed on the
// first sign-in of a fresh Keycloak).

const CONTROL_URL = process.env.CONTROL_URL ?? 'http://localhost:5177';
const PLATFORM_USER = process.env.PLATFORM_USER ?? 'platform';
const PLATFORM_PASSWORD = process.env.PLATFORM_PASSWORD ?? 'Platform123$';

async function signIn(page: Page) {
  await page.goto(CONTROL_URL + '/');
  // The app sends an anonymous visitor straight to Keycloak
  await expect(page.getByPlaceholder('Username')).toBeVisible({ timeout: 60_000 });
  await page.getByPlaceholder('Username').fill(PLATFORM_USER);
  await page.getByPlaceholder('Password').fill(PLATFORM_PASSWORD);
  await page.getByRole('button', { name: 'Login' }).click();

  // A fresh realm asks for a new password once; the same one will do in dev
  const newPassword = page.locator('#password-new');
  if (await newPassword.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await newPassword.fill(PLATFORM_PASSWORD);
    await page.locator('#password-confirm').fill(PLATFORM_PASSWORD);
    await page.getByRole('button', { name: /submit|save|update/i }).first().click();
  }

  await expect(page.getByRole('heading', { name: 'Tenants' })).toBeVisible({ timeout: 60_000 });
}

test('a demo is stamped, its steps land Done, and it is destroyed', async ({ page }) => {
  test.setTimeout(5 * 60_000);
  await signIn(page);

  const slug = `e2e-${Date.now().toString(36).slice(-6)}`;
  await page.getByRole('link', { name: 'New tenant' }).click();
  await page.locator('#name').first().fill(`E2E ${slug}`);
  await page.locator('#ownerEmail').fill(`owner@${slug}.test`);
  await page.locator('#slug').fill(slug);
  await page.getByRole('button', { name: 'Create' }).click();

  // The tenant's page: the dry run's stamp runs the steps within seconds
  await expect(page).toHaveURL(new RegExp(`/t/${slug}`), { timeout: 30_000 });
  await expect(page.getByText('Running', { exact: true }).first()).toBeVisible({ timeout: 120_000 });
  const steps = page.getByText('Done', { exact: true });
  await expect(steps.first()).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => steps.count(), { timeout: 60_000 }).toBeGreaterThanOrEqual(9);
  await expect(page.getByText('Failed', { exact: true })).toHaveCount(0);

  // The queue has run dry
  await page.goto(CONTROL_URL + '/?tab=queue');
  await expect(page.getByText(`provision`).first()).toBeVisible({ timeout: 30_000 });

  // Destroy: the dialog wants the slug typed
  await page.goto(CONTROL_URL + `/t/${slug}`);
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Destroy' }).click();
  await page.getByRole('textbox').last().fill(slug);
  await page.getByRole('button', { name: 'Destroy' }).click();
  await expect(page.getByText('Destroyed', { exact: true }).first()).toBeVisible({ timeout: 120_000 });
});
