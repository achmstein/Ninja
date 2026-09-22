// The POS and KDS launcher icons, and the tiles the admin web's apps page
// shows for them: the platform's N mark (the control web favicon's path)
// on a tile of the app's colour. POS keeps the brand's dark tile; KDS goes
// ember so a kitchen screen is told apart from a till at a glance.
//
//   node scripts/generate-app-icons.mjs        (from src/, needs the root's sharp)
//   cd pos_app && dart run flutter_launcher_icons   (then the same in kds_app)
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const src = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const favicon = fs.readFileSync(path.join(src, 'control_web/public/favicon.svg'), 'utf8');
const nPath = favicon.match(/<path d="([^"]+)"/)[1];
const ink = '#FAFAFA';
const apps = { pos: '#18181B', kds: '#EA580C' };

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
  // The full-bleed icon: the N at 70%, so a circular launcher mask keeps its corners
  await sharp(Buffer.from(tile(1024, background, 0.7))).png().toFile(path.join(images, 'ninja_icon.png'));
  // The adaptive foreground: launchers show the middle 66%, so the N shrinks to look the same size
  await sharp(Buffer.from(tile(1024, null, 0.7 * 0.66))).png().toFile(path.join(images, 'ninja_foreground.png'));
  // The admin web's tile, as a small SVG
  const tiles = path.join(src, 'admin_web/public/apps');
  fs.mkdirSync(tiles, { recursive: true });
  fs.writeFileSync(path.join(tiles, `${app}.svg`), tile(64, background, 0.7) + '\n');
  console.log(`Generated: ${app}`);
}
