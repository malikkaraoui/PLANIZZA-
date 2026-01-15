import { test, expect } from '@playwright/test';

test('transition callable envoie action', async ({ page }) => {
  await page.route('**/pizzaioloTransitionOrderV2', async (route) => {
    const body = route.request().postDataJSON();
    expect(body?.data?.action).toBe('ACCEPT');
    expect(body?.data?.orderId).toBe('e2e-test-order');

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ result: { ok: true } }),
    });
  });

  await page.goto('/__e2e__/transition');
  await page.getByRole('button', { name: 'Send ACCEPT' }).click();
  await expect(page.getByTestId('e2e-result')).toContainText('ok');
});
