import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const clientAssets = path.resolve('client_app/assets/images');
const outputDir = path.resolve('play-store-graphics');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const cupPath = path.join(clientAssets, 'cup.png');
const logoPath = path.join(clientAssets, 'logo.png');
// The white wordmark, kept beside this script since the Flutter admin app (its old home) retired
const logoWhitePath = path.resolve('scripts/logo_white.png');

async function generateAppIcon() {
  // 512x512 white background with cup centered
  const cup = await sharp(cupPath)
    .resize(360, 360, { fit: 'inside' })
    .toBuffer();

  await sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
  })
    .composite([{ input: cup, gravity: 'centre' }])
    .png()
    .toFile(path.join(outputDir, 'app-icon-512x512.png'));

  console.log('Generated: app-icon-512x512.png');
}

async function generateFeatureGraphic() {
  // 1024x500 dark grey background with white Chillax logo centered
  const logo = await sharp(logoWhitePath)
    .resize(600, 180, { fit: 'inside' })
    .toBuffer();

  await sharp({
    create: { width: 1024, height: 500, channels: 4, background: { r: 24, g: 24, b: 27, alpha: 1 } }
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toFile(path.join(outputDir, 'feature-graphic-1024x500.png'));

  console.log('Generated: feature-graphic-1024x500.png');
}

async function generatePhoneScreenshot() {
  // 1080x1920 (9:16) phone screenshot placeholder with branding
  const cup = await sharp(cupPath)
    .resize(400, 400, { fit: 'inside' })
    .toBuffer();

  const logo = await sharp(logoPath)
    .resize(600, 160, { fit: 'inside' })
    .toBuffer();

  await sharp({
    create: { width: 1080, height: 1920, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
  })
    .composite([
      { input: cup, left: 340, top: 580 },
      { input: logo, left: 240, top: 1060 }
    ])
    .png()
    .toFile(path.join(outputDir, 'phone-screenshot-1080x1920.png'));

  console.log('Generated: phone-screenshot-1080x1920.png');
}

async function generateTabletScreenshot7() {
  // 1080x1920 for 7-inch tablet (same as phone, portrait)
  const cup = await sharp(cupPath)
    .resize(400, 400, { fit: 'inside' })
    .toBuffer();

  const logo = await sharp(logoPath)
    .resize(600, 160, { fit: 'inside' })
    .toBuffer();

  await sharp({
    create: { width: 1080, height: 1920, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
  })
    .composite([
      { input: cup, left: 340, top: 580 },
      { input: logo, left: 240, top: 1060 }
    ])
    .png()
    .toFile(path.join(outputDir, 'tablet-7inch-1080x1920.png'));

  console.log('Generated: tablet-7inch-1080x1920.png');
}

async function generateTabletScreenshot10() {
  // 1920x1080 for 10-inch tablet (landscape, min 1080px)
  const cup = await sharp(cupPath)
    .resize(500, 500, { fit: 'inside' })
    .toBuffer();

  const logo = await sharp(logoPath)
    .resize(700, 200, { fit: 'inside' })
    .toBuffer();

  await sharp({
    create: { width: 1920, height: 1080, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
  })
    .composite([
      { input: cup, left: 400, top: 200 },
      { input: logo, left: 1000, top: 400 }
    ])
    .png()
    .toFile(path.join(outputDir, 'tablet-10inch-1920x1080.png'));

  console.log('Generated: tablet-10inch-1920x1080.png');
}

async function main() {
  console.log('Generating Play Store graphics...\n');
  await generateAppIcon();
  await generateFeatureGraphic();
  await generatePhoneScreenshot();
  await generateTabletScreenshot7();
  await generateTabletScreenshot10();
  console.log(`\nAll graphics saved to: ${outputDir}`);
}

main().catch(console.error);
