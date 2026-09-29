// Renders index.html to an MP4, frame by frame, with the music underneath.
//   node render.mjs [--lang en|ar] [--fps 30] [--music music.mp3] [--out ninja-explainer.mp4]
//   node render.mjs --stills 2,9,13,18   (PNG stills for a quick look)
//   node render.mjs --page index-v2.html --lang ar   (the 60-second cut → ninja-explainer-v2-ar.mp4)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; };
const lang = arg('lang', 'en');
const pageFile = arg('page', 'index.html');
const cut = pageFile === 'index.html' ? '' : pageFile.replace(/^index-?|\.html$/g, '') + '-';
const fps = +arg('fps', 30);
// v2's track is the same music with its 2-second break cut out and the end extended (gapless for 60 s)
const music = arg('music', path.join(here, cut === 'v2-' ? 'music-v2.mp3' : 'music.mp3'));
const out = arg('out', path.join(here, `ninja-explainer-${cut}${lang}.mp4`));
const stills = arg('stills', null);
const ffmpeg = process.env.FFMPEG || execSync('python -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"').toString().trim();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(here, pageFile)).href + `?render=1&lang=${lang}`);
await page.waitForFunction(() => window.__ready === true);
await page.waitForTimeout(500);
const duration = await page.evaluate(() => window.__duration);

if (stills) {
  const dir = path.join(here, 'stills'); mkdirSync(dir, { recursive: true });
  for (const t of stills.split(',').map(Number)) {
    await page.evaluate(t => window.__seek(t), t);
    await page.screenshot({ path: path.join(dir, `${cut}${lang}-${String(t).padStart(5, '0')}.png`) });
  }
  await browser.close();
  process.exit(0);
}

const hasMusic = existsSync(music);
const args = ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-'];
if (hasMusic) args.push('-i', music);
args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(fps));
if (hasMusic) args.push('-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k',
  '-af', `afade=t=in:d=0.3,afade=t=out:st=${duration - 1.8}:d=1.8`, '-t', String(duration));
args.push('-movflags', '+faststart', out);

const ff = spawn(ffmpeg, args, { stdio: ['pipe', 'inherit', 'inherit'] });
const frames = Math.round(duration * fps);
for (let f = 0; f < frames; f++) {
  await page.evaluate(t => window.__seek(t), f / fps);
  const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (f % fps === 0) process.stdout.write(`\r${lang}: ${(f / fps).toFixed(0)}s / ${duration}s`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
console.log(`\nWrote ${out}${hasMusic ? ' (with music)' : ' (silent: no music.mp3 found)'}`);
