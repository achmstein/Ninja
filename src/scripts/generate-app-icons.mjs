// The POS and KDS launcher icons, the tiles the admin web's apps page
// shows for them, and the splash wordmark: the platform's N mark (the
// control web favicon's path) on a tile of the app's colour, and `ninja`
// in Original Surfer on the splash. POS keeps the brand's dark tile; KDS goes
// ember so a kitchen screen is told apart from a till at a glance.
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

// The wordmark, trimmed to its ink and `width` px wide
const wordmark = async (width) => {
  const { data } = await sharp({
    text: {
      text: `<span foreground="${ink}">ninja</span>`,
      font: 'Original Surfer',
      fontfile: path.join(src, 'pos_app/assets/fonts/OriginalSurfer-Regular.ttf'),
      dpi: 4000,
      rgba: true,
    },
  }).png().toBuffer({ resolveWithObject: true });
  return sharp(data).trim().resize({ width }).png().toBuffer();
};

// The wordmark centred on a transparent canvas
const splash = async (width, height, markWidth) =>
  sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await wordmark(markWidth), gravity: 'center' }])
    .png();

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
  // The splash before Android 12: drawn centred at its own size, read as xxxhdpi (1200 px = 300 dp)
  await (await splash(1200, 400, 720)).toFile(path.join(images, 'ninja_splash.png'));
  // Android 12 and later put the splash in the icon's square slot (288 dp, 1152 px at xxxhdpi) and keep a
  // 192 dp circle of it: a square canvas, or the wordmark is squeezed, and inside the circle, or it is cut
  await (await splash(1152, 1152, 660)).toFile(path.join(images, 'ninja_splash_android12.png'));
  // The admin web's tile, as a small SVG
  const tiles = path.join(src, 'admin_web/public/apps');
  fs.mkdirSync(tiles, { recursive: true });
  fs.writeFileSync(path.join(tiles, `${app}.svg`), tile(64, background, 0.9) + '\n');
  console.log(`Generated: ${app}`);
}
