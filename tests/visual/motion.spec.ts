import { test, expect } from '@playwright/test';

test('Windows reduced motion does not suppress Papier motion or pointer lighting', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('papier-preferences', JSON.stringify({ motion: 'System', ambient: true })));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
  await expect(page.locator('.home-light')).toBeVisible();
  const field = page.locator('.home-light');
  await page.mouse.move(160, 180);
  await page.waitForTimeout(450);
  const before = await field.evaluate(el => el.style.getPropertyValue('--light-x'));
  await page.mouse.move(1170, 750);
  await expect.poll(() => field.evaluate(el => parseFloat(el.style.getPropertyValue('--light-x')))).toBeGreaterThan(65);
  const after = await field.evaluate(el => el.style.getPropertyValue('--light-x'));
  expect(after).not.toBe(before);
  expect(await page.locator('.light-horizon').evaluate(el => el.getAnimations().some(a => a.playState === 'running'))).toBe(true);
  expect(await page.locator('.prism-mark animate').count()).toBeGreaterThan(0);
  await page.getByRole('button', { name: /^New document/ }).click();
  expect(await page.locator('dialog').evaluate(el => parseFloat(getComputedStyle(el).animationDuration))).toBeGreaterThan(.3);
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(page.locator('dialog')).toHaveCount(0);
});

test('Papier manual motion and light controls work independently', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
  await page.getByRole('button', { name: 'Motion', exact: true }).click();
  const picker = page.getByRole('combobox', { name: 'Motion language' });
  await picker.click();
  await expect(page.getByRole('option', { name: 'System', exact: true })).toHaveCount(0);
  await page.getByRole('option', { name: 'Reduced', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  expect(await page.locator('dialog').evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length)).toBe(0);
  await picker.click();
  await page.getByRole('option', { name: 'Full', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
  await page.getByRole('switch', { name: /Living light/ }).uncheck();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(page.locator('.home-light')).toBeHidden();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
  await expect(page.locator('html')).toHaveAttribute('data-ambient', 'false');
});
