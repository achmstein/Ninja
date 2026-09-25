// The POS and KDS launcher icons, the tiles the admin web's apps page
// shows for them, and the launch splash: the platform's N mark (the
// control web favicon's path) on a tile of the app's colour, and control
// web's `ninja | POS` lockup on the splash. POS keeps the brand's dark tile;
// KDS goes ember so a kitchen screen is told apart from a till at a glance.
//
//   node scripts/generate-app-icons.mjs        (from src/, needs the root's sharp)
//   cd pos_app && dart run flutter_launcher_icons && dart run flutter_native_splash:create
//   (then the same in kds_app)
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const src = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const favicon = fs.readFileSync(path.join(src, 'control_web/public/favicon.svg'), 'utf8');
const nPath = favicon.match(/<path d="([^"]+)"/)[1];
const ink = '#FAFAFA';
const apps = { pos: '#18181B', kds: '#EA580C' };

// The splash is control_web's lockup (components/wordmark.tsx, size lg): `ninja` in
// Original Surfer at 48 px, a 1 px hairline 28 px tall 16 px either side, and the
// app's name in 14 px Inter Medium caps tracked 0.2em. The native splash can't use
// the fonts, so it is drawn here at xxxhdpi (4 px to the dp), in each reading's
// colours: the till follows the device (the app's slate theme, light and dark),
// the kitchen is black. The in-app splash (core/router/app_router.dart) draws the
// same lockup with the bundled fonts once Flutter is up.
const splashes = {
  pos: {
    label: 'POS',
    light: { background: '#FFFFFF', ink: '#020618', line: '#E2E8F0', muted: '#62748E' },
    // The dark theme's border is white at 10%; over the background that is this
    dark: { background: '#020618', ink: '#F8FAFC', line: '#1C1F2F', muted: '#90A1B9' },
  },
  kds: {
    label: 'KDS',
    light: { background: '#000000', ink: '#FFFFFF', line: '#3F3F46', muted: '#A1A1AA' },
  },
};
const dp = 4;
const fonts = path.join(src, 'pos_app/assets/fonts');

// A line of text at `pt` dp, trimmed to its ink across but keeping the font's line box up and down, so lines
// centre on each other as they do on the page rather than on their ink (the j's tail would pull `ninja` down)
const text = async (markup, font, fontfile, pt) => {
  const { data, info } = await sharp({
    text: { text: markup, font: `${font} ${pt}`, fontfile: path.join(fonts, fontfile), dpi: 72 * dp, rgba: true },
  }).png().toBuffer({ resolveWithObject: true });
  const { info: ink } = await sharp(data).trim().toBuffer({ resolveWithObject: true });
  const input = await sharp(data)
    .extract({ left: -ink.trimOffsetLeft, top: 0, width: ink.width, height: info.height })
    .png()
    .toBuffer();
  return { input, width: ink.width, height: info.height };
};

// The lockup on a transparent canvas just big enough for it, each part centred on one line as flex items-center does
const lockup = async ({ ink, line, muted }, label) => {
  const name = await text(`<span foreground="${ink}">ninja</span>`, 'Original Surfer', 'OriginalSurfer-Regular.ttf', 48);
  // Pango units (1/1024) of a point at 72 dpi, so at `dp` times that
  const tracking = Math.round(14 * 0.2 * dp * 1024);
  const caps = await text(
    `<span foreground="${muted}" weight="500" letter_spacing="${tracking}">${label}</span>`,
    'Inter', 'Inter-Medium.ttf', 14);
  const rule = { width: 1 * dp, height: 28 * dp };
  const gap = 16 * dp;
  const width = name.width + gap + rule.width + gap + caps.width;
  const height = Math.max(name.height, rule.height, caps.height);
  const middle = (h) => Math.round((height - h) / 2);
  const hairline = await sharp({ create: { ...rule, channels: 4, background: line } }).png().toBuffer();
  const buffer = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: name.input, left: 0, top: middle(name.height) },
      { input: hairline, left: name.width + gap, top: middle(rule.height) },
      { input: caps.input, left: width - caps.width, top: middle(caps.height) },
    ])
    .png()
    .toBuffer();
  return { buffer, width, height };
};

// The lockup centred on a transparent canvas; `fit` scales it down to that width and height
const splash = async (colours, label, canvas, fit) => {
  const mark = await lockup(colours, label);
  const scale = fit ? Math.min(1, fit.width / mark.width, fit.height / mark.height) : 1;
  const input = scale < 1 ? await sharp(mark.buffer).resize({ width: Math.round(mark.width * scale) }).png().toBuffer() : mark.buffer;
  const width = canvas?.width ?? mark.width + 32 * dp;
  const height = canvas?.height ?? mark.height + 32 * dp;
  return sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input, gravity: 'center' }])
    .png();
};

// Android 12 and later show the splash as the icon's square slot (288 dp) and keep only a 192 dp circle of it, so a
// wide lockup has to sit inside that circle or its ends are cut: fitted to a box whose diagonal is 180 dp, it reads
// smaller there than on older Androids and the in-app splash. That is the platform's limit, not a choice.
const android12 = async (colours, label) => {
  const mark = await lockup(colours, label);
  const diagonal = 180 * dp;
  const k = diagonal / Math.hypot(mark.width, mark.height);
  return splash(colours, label, { width: 288 * dp, height: 288 * dp }, { width: mark.width * k, height: mark.height * k });
};

// The N sits at `frac` of the tile; the favicon draws it on a 64-unit grid
const tile = (size, background, frac) => {
  const mark = size * frac;
  const offset = (size - mark) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">${
    background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : ''
  }<g transform="translate(${offset} ${offset}) scale(${mark / 64})"><path d="${nPath}" fill="${ink}"/></g></svg>`;
};

for (const [app, background] of Object.entries(apps)) {
  const images = path.join(src, `${app}_app/assets/images`);
  // The full-bleed icon: the N's box at 90% (its ink is about half the tile), so a circular launcher mask keeps its corners
  await sharp(Buffer.from(tile(1024, background, 0.9))).png().toFile(path.join(images, 'ninja_icon.png'));
  // The adaptive foreground: launchers show the middle 66% and keep a 61% circle whatever the mask, so the N's ink
  // (37% of the layer) fills most of what shows and its corners stay inside the circle
  await sharp(Buffer.from(tile(1024, null, 0.7))).png().toFile(path.join(images, 'ninja_foreground.png'));
  // The splash, one pair per reading (`_dark` for the till's dark one): before Android 12 drawn centred at its
  // own size, read as xxxhdpi; from Android 12 in the icon's slot
  const { label, ...readings } = splashes[app];
  for (const [reading, colours] of Object.entries(readings)) {
    const suffix = reading === 'dark' ? '_dark' : '';
    await (await splash(colours, label)).toFile(path.join(images, `ninja_splash${suffix}.png`));
    await (await android12(colours, label)).toFile(path.join(images, `ninja_splash_android12${suffix}.png`));
  }
  // The admin web's tile, as a small SVG
  const tiles = path.join(src, 'admin_web/public/apps');
  fs.mkdirSync(tiles, { recursive: true });
  fs.writeFileSync(path.join(tiles, `${app}.svg`), tile(64, background, 0.9) + '\n');
  console.log(`Generated: ${app}`);
}
