import { chromium } from 'playwright';
for (const opts of [{ headless: true }, { headless: true, args: ['--headless=new'] }]) {
  const b = await chromium.launch(opts);
  const c = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3 });
  const p = await c.newPage(); await p.goto('http://localhost:5174/p/14'); await p.waitForTimeout(3000);
  const cdp = await c.newCDPSession(p); let got;
  cdp.on('Page.screencastFrame', f => { got ??= f; cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 1179, maxHeight: 2556 });
  await p.mouse.wheel(0, 50); await p.waitForTimeout(800);
  console.log(JSON.stringify(opts.args || 'old'), got && got.metadata.deviceWidth, got && got.metadata.pageScaleFactor, got && Buffer.from(got.data, 'base64').readUInt16BE(163));
  const img = Buffer.from(got.data, 'base64'); let i = 2; while (i < img.length) { const mk = img[i + 1], len = img.readUInt16BE(i + 2); if (mk >= 0xC0 && mk <= 0xC2) { console.log(' size', img.readUInt16BE(i + 7), 'x', img.readUInt16BE(i + 5)); break; } i += 2 + len; }
  await b.close();
}
