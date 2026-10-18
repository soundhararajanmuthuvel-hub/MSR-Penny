import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

async function generateAllIcons() {
  const publicDir = path.resolve('public');
  const svgPath = path.join(publicDir, 'icon.svg');

  if (!fs.existsSync(svgPath)) {
    console.error('icon.svg does not exist!');
    process.exit(1);
  }

  const svgBuffer = fs.readFileSync(svgPath);

  // 1. Standard PWA 192x192
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('✓ Generated pwa-192x192.png');

  // 2. Standard PWA 512x512
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('✓ Generated pwa-512x512.png');

  // 3. Apple Touch Icon 180x180
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('✓ Generated apple-touch-icon.png');

  // 4. Favicon 48x48 PNG (saved as favicon.ico)
  await sharp(svgBuffer)
    .resize(48, 48)
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));
  console.log('✓ Generated favicon.ico');

  // 5. Maskable Icon 512x512 (with 10% safe zone padding on emerald background)
  const paddedIcon = await sharp(svgBuffer)
    .resize(410, 410)
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 8, g: 51, b: 33, alpha: 1 }, // #083321
    },
  })
    .composite([{ input: paddedIcon, gravity: 'center' }])
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('✓ Generated pwa-maskable-512x512.png');

  console.log('All MSR Penny PWA icons rendered successfully!');
}

generateAllIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
