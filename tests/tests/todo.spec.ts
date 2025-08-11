import { test, expect, Page, APIRequestContext } from '@playwright/test';

// Single diagnostics helper
async function attachPageDiagnostics(page: Page) {
  page.on('console', msg => console.log(`[browser:${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => console.error('[pageerror]', err));
}

async function retry<T>(fn: () => Promise<T>, attempts = 5, delayMs = 500): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) {
      lastErr = e;
      // Only retry on DNS/network errors
      const msg = (e as Error)?.message || '';
      if (!/ENOTFOUND|EAI_AGAIN|ECONNREFUSED/.test(msg)) throw e;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

// Helper to build backend URL inside docker network
const backendBase = 'http://backend:8080';

test.describe('Todo E2E', () => {
  // Purge existing todos before each test for isolation with polling
  test.beforeEach(async ({ page, request }) => {
    async function fetchTodos() {
      const resp = await retry(() => request.get(backendBase + '/api/todos'));
      return resp.ok() ? await resp.json() : [];
    }
    for (let attempt = 0; attempt < 4; attempt++) {
      const todos = await fetchTodos();
      if (!Array.isArray(todos) || todos.length === 0) break;
      for (const t of todos) {
        if (t?.id) {
          try { await request.delete(`${backendBase}/api/todos/${t.id}`); } catch {}
        }
      }
      await new Promise(r => setTimeout(r, 200));
    }
    await attachPageDiagnostics(page);
    await page.goto('/?t=' + Date.now());
    await page.waitForResponse(r => r.url().endsWith('/config.json') && r.status() === 200, { timeout: 5000 }).catch(() => {});
  });

  test('initial form renders', async ({ page }) => {
    await expect(page.locator('app-root form input[placeholder="New task"]')).toBeVisible({ timeout: 15000 });
  });

  test('API create/update/delete sequence', async ({ request }) => {
  const create = await retry(() => request.post(backendBase + '/api/todos', { data: { title: 'API Task' } }));
    expect(create.ok()).toBeTruthy();
    const created = await create.json();
  const upd = await retry(() => request.put(`${backendBase}/api/todos/${created.id}`, { data: { title: 'API Task Updated', completed: true } }));
    expect(upd.ok()).toBeTruthy();
  const del = await retry(() => request.delete(`${backendBase}/api/todos/${created.id}`));
    expect(del.ok()).toBeTruthy();
  });

  test('add item', async ({ page }) => {
    const title = 'Task ' + Date.now();
    const items = page.locator('[cdkdrag]');
    const initial = await items.count();
    await page.fill('input[placeholder="New task"]', title);
    await Promise.all([
      page.waitForResponse(r => r.url().endsWith('/api/todos') && r.request().method() === 'POST' && r.status() === 201),
      page.click('button:has-text("Add")')
    ]);
    await expect.poll(async () => await items.count(), { timeout: 10000 }).toBe(initial + 1);
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
    const initial = await items.count();
    await page.fill('input[placeholder="New task"]', title);
    await Promise.all([
      page.waitForResponse(r => r.url().endsWith('/api/todos') && r.request().method() === 'POST'),
      page.click('button:has-text("Add")')
    ]);
    await expect.poll(async () => await items.count(), { timeout: 10000 }).toBe(initial + 1);
    const row = items.filter({ hasText: title }).first();
    const checkbox = row.locator('input[type="checkbox"]');
    await checkbox.check();
    await expect(checkbox).toBeChecked();
  });

  test('reorder items (drag & drop simulated)', async ({ page }) => {
    const items = page.locator('[cdkdrag]');
    const start = await items.count();
    const add = async (t: string) => {
      await page.fill('input[placeholder="New task"]', t);
      await Promise.all([
        page.waitForResponse(r => r.url().endsWith('/api/todos') && r.request().method() === 'POST'),
        page.click('button:has-text("Add")')
      ]);
    };
    await add('Item A');
    await add('Item B');
    await expect.poll(async () => await items.count(), { timeout: 10000 }).toBe(start + 2);
    await items.nth(start).dragTo(items.nth(start + 1));
    await expect.poll(async () => await items.count()).toBe(start + 2);
  });
});
