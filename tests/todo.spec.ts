import { test, expect, Page } from '@playwright/test';

async function attachPageDiagnostics(page: Page) {
  page.on('console', msg => console.log(`[browser:${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => console.error('[pageerror]', err));
}

test.describe('Todo E2E', () => {
  test.beforeEach(async ({ page }) => {
    await attachPageDiagnostics(page);
    await page.goto('/');
  });

  test('initial form renders', async ({ page }) => {
    await expect(page.locator('app-root form input[placeholder="New task"]')).toBeVisible({ timeout: 15000 });
  });

  test('API create/update/delete sequence', async ({ request }) => {
    const create = await request.post('/api/todos', { data: { title: 'API Task' } });
    expect(create.ok()).toBeTruthy();
    const created = await create.json();
    const upd = await request.put(`/api/todos/${created.id}`, { data: { title: 'API Task Updated', completed: true } });
    expect(upd.ok()).toBeTruthy();
    const updated = await upd.json();
    expect(updated.completed).toBe(true);
    const del = await request.delete(`/api/todos/${created.id}`);
    expect(del.ok()).toBeTruthy();
  });

  test('add item', async ({ page }) => {
    const unique = 'First task ' + Date.now();
    await page.fill('input[placeholder="New task"]', unique);
    const items = page.locator('[cdkdrag]');
    const before = await items.count();
    await page.click('button:has-text("Add")');
    await expect(items).toHaveCount(before + 1);
    const values = await page.locator('input[name^="title-"]').evaluateAll(els => els.map(e => (e as HTMLInputElement).value));
    console.log('Current todo titles after add:', values);
    await expect.poll(async () => {
      const vals = await page.locator('input[name^="title-"]').evaluateAll(els => els.map(e => (e as HTMLInputElement).value));
      return vals.includes(unique);
    }).toBeTruthy();
    // Debug last item HTML
    const lastHtml = await items.last().evaluate(el => el.innerHTML);
    console.log('Last item HTML after add:', lastHtml);
  });

  test('complete item', async ({ page }) => {
    await page.fill('input[placeholder="New task"]', 'Complete me');
    const items = page.locator('[cdkdrag]');
    const before = await items.count();
    await page.click('button:has-text("Add")');
    await expect(items).toHaveCount(before + 1);
    const row = items.last();
    const input = row.locator('input[name^="title-"]');
    await expect.poll(async () => await input.inputValue()).toBe('Complete me');
    const checkbox = row.locator('input[type="checkbox"]');
    await checkbox.check();
    await expect(checkbox).toBeChecked();
  });

  test('reorder items (drag & drop simulated)', async ({ page }) => {
    await page.fill('input[placeholder="New task"]', 'Item A');
    await page.click('button:has-text("Add")');
    await page.fill('input[placeholder="New task"]', 'Item B');
    await page.click('button:has-text("Add")');
    const items = page.locator('[cdkdrag]');
    await expect(items).toHaveCount(2);
    const first = items.nth(0);
    const second = items.nth(1);
    await first.dragTo(second);
    const titleInputs = page.locator('input[name^="title-"]');
    await expect.poll(async () => {
      const vals = await titleInputs.evaluateAll(els => els.map(e => (e as HTMLInputElement).value));
      return vals.includes('Item A');
    }).toBeTruthy();
    await expect.poll(async () => {
      const vals = await titleInputs.evaluateAll(els => els.map(e => (e as HTMLInputElement).value));
      return vals.includes('Item B');
    }).toBeTruthy();
  });
});
