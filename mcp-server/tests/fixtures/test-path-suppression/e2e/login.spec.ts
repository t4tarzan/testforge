// Playwright-style e2e directory — should be suppressed.
import { test, expect } from '@playwright/test';

test('login form rejects injection', async ({ page }) => {
  const payload = "'; DROP TABLE users; --";
  const sql = 'SELECT id FROM accounts WHERE email = ' + payload;
  await page.goto('/login');
  expect(sql).toBeTruthy();
});
