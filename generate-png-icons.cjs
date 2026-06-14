const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Generates all PWA / favicon / Apple-touch PNG icons from the master app logo.
// Source is the raster logo (soft-3D, square, with its own filled background + a centered
// emblem inside the maskable safe zone), so every size is a straight cover-resize — no
// background fill or padding tricks needed. Filenames match index.html + the PWA manifest
// in vite.config.ts, so regenerating overwrites in place with no reference changes.
//
//   npm run icons:generate

console.log('🎨 Generating PNG icons from master logo...');

const SOURCE = './art-src/logo/logo.png';

const iconSizes = [
  // PWA manifest icons
  { size: 192, name: 'icon-192x192.png' },
  { size: 512, name: 'icon-512x512.png' },
  // Maskable (the logo's emblem already sits within the safe zone, bg fills the edges)
  { size: 192, name: 'icon-192x192-maskable.png' },
  { size: 512, name: 'icon-512x512-maskable.png' },
  // iOS Apple Touch Icons
  { size: 180, name: 'apple-touch-icon-180x180.png' },
  { size: 167, name: 'apple-touch-icon-167x167.png' },
  { size: 152, name: 'apple-touch-icon-152x152.png' },
  { size: 120, name: 'apple-touch-icon-120x120.png' },
  // Favicons
  { size: 32, name: 'favicon-32x32.png' },
  { size: 16, name: 'favicon-16x16.png' },
  { size: 32, name: 'favicon.png' },
];

async function generate(size, filename) {
  const outputPath = path.join('./public', filename);
  await sharp(SOURCE)
    .resize(size, size, { fit: 'cover' })
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(outputPath);
  console.log(`✅ ${filename} (${size}x${size})`);
}

async function run() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`❌ Source logo not found: ${SOURCE}`);
    process.exit(1);
  }
  console.log(`📂 Source: ${SOURCE}\n`);
  for (const { size, name } of iconSizes) {
    await generate(size, name);
  }
  console.log(`\n🎉 Generated ${iconSizes.length} icons into ./public`);
}

run().catch((err) => {
  console.error('❌ Icon generation failed:', err);
  process.exit(1);
});
