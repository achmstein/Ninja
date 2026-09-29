// Shared helpers for recording the real apps in slow motion at full pixel density:
// the page's clock runs at SLOW speed while screenshots are taken as fast as they
// come, then the frames are laid on the page's own timeline at 30 fps. Also a
// visible touch dot / cursor, and encoding to a VP9 clip.
import { spawn, execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

export const here = new URL('./', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
export const clipsDir = here + '../clips/';
mkdirSync(clipsDir, { recursive: true });
const ffmpeg = execSync('python -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"').toString().trim();

export const SLOW = 0.25;
export const now = () => Date.now() / 1000;
/** Waits `ms` of the page's (slowed) time */
export const wait = (page, ms) => page.waitForTimeout(ms / (page.__slow || SLOW));

/** Slows the page's clock: timers, animation frames, performance.now and (optionally) Date. */
export async function slowClock(ctx, { date = true, s = SLOW } = {}) {
  await ctx.addInitScript(([s, date]) => {
    const rp = performance.now.bind(performance), p0 = rp();
    const RD = Date, d0 = RD.now();
    performance.now = () => p0 + (rp() - p0) * s;
    if (date) {
      const slowNow = () => d0 + (RD.now() - d0) * s;
      window.Date = class extends RD { constructor(...a) { a.length ? super(...a) : super(slowNow()); } static now() { return slowNow(); } };
    }
    const rAF = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => rAF(t => cb(p0 + (t - p0) * s));
    const sT = window.setTimeout.bind(window), sI = window.setInterval.bind(window);
    window.setTimeout = (f, d = 0, ...a) => sT(f, d / s, ...a);
    window.setInterval = (f, d = 0, ...a) => sI(f, d / s, ...a);
  }, [s, date]);
}
/** CSS and Web Animations follow the same slowed clock */
export async function slowAnimations(page, s = SLOW) {
  page.__slow = s;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Animation.enable'); await cdp.send('Animation.setPlaybackRate', { playbackRate: s });
}

/** A soft dot where a finger touches (phone) or a cursor that follows the mouse (desktop). */
export async function pointer(ctx, kind) {
  await ctx.addInitScript(kind => {
    const css = `
      #__touch{position:fixed;z-index:2147483647;pointer-events:none;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;
        background:rgba(15,23,42,.18);border:2px solid rgba(255,255,255,.9);box-shadow:0 2px 10px rgba(0,0,0,.25);opacity:0;transform:scale(.6);
        transition:opacity .15s ease, transform .25s cubic-bezier(.16,1,.3,1)}
      #__touch.on{opacity:1;transform:scale(1)}
      #__cursor{position:fixed;z-index:2147483647;pointer-events:none;width:26px;height:26px;left:0;top:0;transform:translate(-100px,-100px)}
      #__cursor.down svg{transform:scale(.88);transform-origin:4px 3px}`;
    const add = () => {
      const s = document.createElement('style'); s.textContent = css; document.documentElement.appendChild(s);
      // the router's dev badge (dev servers only)
      new MutationObserver(() => document.querySelectorAll('button').forEach(b => {
        if (/TanStack/i.test(b.getAttribute('aria-label') || '') || /TanStack Router/i.test(b.textContent || '')) b.style.display = 'none';
      })).observe(document.documentElement, { childList: true, subtree: true });
      if (kind === 'touch') {
        const d = document.createElement('div'); d.id = '__touch'; document.documentElement.appendChild(d);
        addEventListener('pointerdown', e => { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; d.classList.add('on'); }, true);
        addEventListener('pointerup', () => setTimeout(() => d.classList.remove('on'), 140), true);
      } else {
        const c = document.createElement('div'); c.id = '__cursor';
        c.innerHTML = '<svg width="26" height="26" viewBox="0 0 26 26"><path d="M4 3 L4 21 L9 16.5 L12.5 24 L15.5 22.6 L12 15.3 L19 15.3 Z" fill="#0b1020" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
        document.documentElement.appendChild(c);
        addEventListener('mousemove', e => { c.style.transform = `translate(${e.clientX - 4}px,${e.clientY - 3}px)`; }, true);
        addEventListener('mousedown', () => c.classList.add('down'), true);
        addEventListener('mouseup', () => c.classList.remove('down'), true);
      }
    };
    if (document.documentElement) add(); else addEventListener('DOMContentLoaded', add);
  }, kind);
}

/** Captures full-density screenshots in a loop until stop() */
export async function capture(page, scale = 2) {
  const cdp = await page.context().newCDPSession(page);
  const vp = page.viewportSize(), clip = { x: 0, y: 0, width: vp.width, height: vp.height, scale };
  const frames = []; let on = true;
  const loop = (async () => {
    while (on) {
      try {
        const t = now();
        const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 90, optimizeForSpeed: true, clip });
        frames.push({ t: (t + now()) / 2, data: Buffer.from(r.data, 'base64') });
      } catch { await new Promise(r => setTimeout(r, 30)); }
    }
  })();
  return async () => { on = false; await loop; return frames; };
}

/** Lays frames on the page's timeline (real time × SLOW) at 30 fps and encodes a VP9 webm. */
export async function encode(frames, name, t0, t1, markers = {}, SLOW = 0.25) {
  frames = frames.sort((a, b) => a.t - b.t);
  const fps = 30, dur = (t1 - t0) * SLOW, n = Math.round(dur * fps);
  const ff = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libvpx-vp9', '-crf', '18', '-b:v', '0', '-row-mt', '1', '-cpu-used', '4', '-pix_fmt', 'yuv420p', clipsDir + name + '.webm'],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  let i = 0;
  for (let k = 0; k < n; k++) {
    const t = t0 + (k / fps) / SLOW;
    while (i + 1 < frames.length && Math.abs(frames[i + 1].t - t) <= Math.abs(frames[i].t - t)) i++;
    if (!ff.stdin.write(frames[i].data)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  const rel = Object.fromEntries(Object.entries(markers).map(([k, v]) => [k, +((v - t0) * SLOW).toFixed(2)]).filter(([, v]) => v >= 0 && v <= dur));
  writeFileSync(clipsDir + name + '.json', JSON.stringify({ duration: +dur.toFixed(2), markers: rel }, null, 2));
  console.log(`clip ${name}: ${dur.toFixed(1)}s from ${frames.length} frames`, rel);
}

/** Moves the mouse smoothly in the page's time (so the cursor glides on the slowed clock) */
export async function glide(page, x, y, ms = 450) {
  const from = page.__pos || { x: x - 200, y: y + 120 }, steps = 24;
  for (let k = 1; k <= steps; k++) {
    const e = 1 - Math.pow(1 - k / steps, 3);
    await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
    await wait(page, ms / steps);
  }
  page.__pos = { x, y };
}
export async function clickAt(page, x, y, ms) {
  await glide(page, x, y, ms); await wait(page, 120);
  await page.mouse.down(); await wait(page, 90); await page.mouse.up();
}
export async function clickEl(page, locator, ms) {
  const b = await locator.boundingBox(); await clickAt(page, b.x + b.width / 2, b.y + b.height / 2, ms);
}
