import { test, expect, Page } from '@playwright/test';

// Single diagnostics helper
async function attachPageDiagnostics(page: Page) {
  page.on('console', msg => console.log(`[browser:${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => console.error('[pageerror]', err));
}

test.describe('Todo E2E', () => {
  // Purge existing todos before each test for isolation
  test.beforeEach(async ({ page, request }) => {
    // Clean backend state
    const list = await request.get('/api/todos');
    if (list.ok()) {
      const todos = await list.json();
      if (Array.isArray(todos)) {
        for (const t of todos) {
          if (t?.id) {
            await request.delete(`/api/todos/${t.id}`);
          }
        }
      }
    }
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
    const del = await request.delete(`/api/todos/${created.id}`);
    expect(del.ok()).toBeTruthy();
  });

  test('add item', async ({ page }) => {
    const title = 'Task ' + Date.now();
    const items = page.locator('[cdkdrag]');
    await expect(items).toHaveCount(0);
    await page.fill('input[placeholder="New task"]', title);
    await Promise.all([
      page.waitForResponse(r => r.url().endsWith('/api/todos') && r.request().method() === 'POST' && r.status() === 201),
      page.click('button:has-text("Add")')
    ]);
    await expect(items).toHaveCount(1);
    const match = page.locator('input').filter({ has: page.locator(`xpath=.`) }); // placeholder to chain
    // Find input by value using evaluateAll
    await expect.poll(async () => {
      const handles = await page.locator('input').elementHandles();
      for (const h of handles) {
        const v = await h.evaluate(el => (el as HTMLInputElement).value);
        if (v === title) return true;
      }
      return false;
    }, { timeout: 10000 }).toBeTruthy();
  });

  test('complete item', async ({ page }) => {
    const title = 'Complete ' + Date.now();
    const items = page.locator('[cdkdrag]');
    await expect(items).toHaveCount(0);
    await page.fill('input[placeholder="New task"]', title);
    await Promise.all([
      page.waitForResponse(r => r.url().endsWith('/api/todos') && r.request().method() === 'POST'),
      page.click('button:has-text("Add")')
    ]);
    await expect(items).toHaveCount(1);
  const row = items.first();
    await expect.poll(async () => {
      const handles = await page.locator('input').elementHandles();
      for (const h of handles) {
        const v = await h.evaluate(el => (el as HTMLInputElement).value);
        if (v === title) return true;
      }
      return false;
    }, { timeout: 10000 }).toBeTruthy();
  const checkbox = row.locator('input[type="checkbox"]');
    await checkbox.check();
    await expect(checkbox).toBeChecked();
  });

  test('reorder items (drag & drop simulated)', async ({ page }) => {
    const add = async (t: string) => {
      await page.fill('input[placeholder="New task"]', t);
      await Promise.all([
        page.waitForResponse(r => r.url().endsWith('/api/todos') && r.request().method() === 'POST'),
        page.click('button:has-text("Add")')
      ]);
    };
    await add('Item A');
    await add('Item B');
    const items = page.locator('[cdkdrag]');
    await expect(items).toHaveCount(2);
    await items.nth(0).dragTo(items.nth(1));
    await expect(items).toHaveCount(2); // still two items
  });
});
