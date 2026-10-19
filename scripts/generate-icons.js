import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

async function generateAllIcons() {
  const publicDir = path.resolve('public');
  const sourcePath = path.join(publicDir, 'icon-source.jpg');

  if (!fs.existsSync(sourcePath)) {
    console.error('icon-source.jpg does not exist!');
    process.exit(1);
  }

  const imageBuffer = fs.readFileSync(sourcePath);

  // 1. Standard PWA 192x192
  await sharp(imageBuffer)
    .resize(192, 192, { fit: 'cover' })
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('✓ Generated pwa-192x192.png');

  // 2. Standard PWA 512x512
  await sharp(imageBuffer)
    .resize(512, 512, { fit: 'cover' })
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('✓ Generated pwa-512x512.png');

  // 3. Apple Touch Icon 180x180
  await sharp(imageBuffer)
    .resize(180, 180, { fit: 'cover' })
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('✓ Generated apple-touch-icon.png');

  // 4. Favicon 48x48 PNG (saved as favicon.ico and favicon-32x32.png)
  await sharp(imageBuffer)
    .resize(48, 48, { fit: 'cover' })
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));
  console.log('✓ Generated favicon.ico');

  await sharp(imageBuffer)
    .resize(32, 32, { fit: 'cover' })
    .png()
    .toFile(path.join(publicDir, 'favicon-32x32.png'));
  console.log('✓ Generated favicon-32x32.png');

  // 5. App brand logo 512x512
  await sharp(imageBuffer)
    .resize(512, 512, { fit: 'cover' })
    .png()
    .toFile(path.join(publicDir, 'msr-penny-logo.png'));
  console.log('✓ Generated msr-penny-logo.png');

  // 6. Maskable Icon 512x512 (with 10% safe zone padding on #006948 background)
  const paddedIcon = await sharp(imageBuffer)
    .resize(410, 410, { fit: 'cover' })
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 0, g: 105, b: 72, alpha: 1 }, // #006948
    },
  })
    .composite([{ input: paddedIcon, gravity: 'center' }])
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('✓ Generated pwa-maskable-512x512.png');

  console.log('All MSR Penny PWA icons rendered successfully from new coin branding!');
}

generateAllIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
