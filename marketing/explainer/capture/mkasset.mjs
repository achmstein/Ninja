import { chromium } from 'playwright';
const here = new URL('../assets/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 800, height: 900 } });
await p.goto('file:///' + here + 'supplier-receipt.html'); await p.waitForTimeout(500);
await p.screenshot({ path: here + 'supplier-receipt.jpg', type: 'jpeg', quality: 88 }); await b.close();
