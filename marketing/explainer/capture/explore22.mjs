import { chromium } from 'playwright';
const here = new URL('./', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'); const out = here + 'shots/';
const browser = await chromium.launch();
const a = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: here + 'admin-state.json' })).newPage();
await a.goto('http://localhost:5173/inventory/menu-cost'); await a.waitForTimeout(5000); await a.screenshot({ path: out + 'cost-1.png' });
await a.goto('http://localhost:5173/inventory'); await a.waitForTimeout(5000); await a.screenshot({ path: out + 'stock-1.png' });
await a.getByRole('button', { name: /^Receive$/ }).click(); await a.waitForTimeout(3000); await a.screenshot({ path: out + 'receive-1.png' });
console.log((await a.locator('[role=dialog] button').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | '));
await browser.close();
