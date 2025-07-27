const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

console.log('🎨 Generating PNG icons from SVG source...');

// Read the source SVG
const svgPath = './public/icon-source.svg';
const svgBuffer = fs.readFileSync(svgPath);

// Icon sizes needed for comprehensive PWA and mobile support
const iconSizes = [
  // PWA manifest icons
  { size: 192, name: 'icon-192x192.png', purpose: 'any' },
  { size: 512, name: 'icon-512x512.png', purpose: 'any' },
  
  // iOS app icons (Apple Touch Icons)
  { size: 180, name: 'apple-touch-icon-180x180.png', purpose: 'apple' },
  { size: 167, name: 'apple-touch-icon-167x167.png', purpose: 'apple' },
  { size: 152, name: 'apple-touch-icon-152x152.png', purpose: 'apple' },
  { size: 120, name: 'apple-touch-icon-120x120.png', purpose: 'apple' },
  
  // Favicon sizes
  { size: 32, name: 'favicon-32x32.png', purpose: 'favicon' },
  { size: 16, name: 'favicon-16x16.png', purpose: 'favicon' },
  
  // Maskable versions for Android adaptive icons
  { size: 192, name: 'icon-192x192-maskable.png', purpose: 'maskable', maskable: true },
  { size: 512, name: 'icon-512x512-maskable.png', purpose: 'maskable', maskable: true }
];

// Function to generate PNG with optimal settings
async function generatePngIcon(size, filename, maskable = false) {
  try {
    let processor = sharp(svgBuffer)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 139, g: 92, b: 246, alpha: 1 } // Purple background (#8B5CF6)
      });

    // For maskable icons, add padding to ensure safe zone compliance
    if (maskable) {
      const padding = Math.round(size * 0.1); // 10% padding for safe zone
      const iconSize = size - (padding * 2);
      
      processor = sharp(svgBuffer)
        .resize(iconSize, iconSize, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent for inner icon
        })
        .extend({
          top: padding,
          bottom: padding,
          left: padding,
          right: padding,
          background: { r: 139, g: 92, b: 246, alpha: 1 } // Purple background
        });
    }

    const outputPath = path.join('./public', filename);
    await processor
      .png({
        quality: 100,
        compressionLevel: 9,
        progressive: false
      })
      .toFile(outputPath);

    console.log(`✅ Generated ${filename} (${size}x${size})`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to generate ${filename}:`, error.message);
    return false;
  }
}

// Generate all icons
async function generateAllIcons() {
  console.log(`📂 Source: ${svgPath}`);
  console.log(`🎯 Generating ${iconSizes.length} icon sizes...\n`);

  let successCount = 0;
  
  for (const { size, name, maskable } of iconSizes) {
    const success = await generatePngIcon(size, name, maskable);
    if (success) successCount++;
  }

  console.log(`\n🎉 Generated ${successCount}/${iconSizes.length} PNG icons successfully!`);
  
  // Also generate a high-quality favicon.ico equivalent
  try {
    const faviconPath = path.join('./public', 'favicon.png');
    await sharp(svgBuffer)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 139, g: 92, b: 246, alpha: 1 }
      })
      .png({ quality: 100 })
      .toFile(faviconPath);
    console.log('✅ Generated favicon.png');
  } catch (error) {
    console.error('❌ Failed to generate favicon.png:', error.message);
  }

  console.log('\n📱 Next steps:');
  console.log('1. Update manifest.json to use PNG icons');
  console.log('2. Update index.html icon references');
  console.log('3. Update vite.config.ts PWA configuration');
  console.log('4. Test on mobile devices');
}

// Check if source SVG exists
if (!fs.existsSync(svgPath)) {
  console.error(`❌ Source SVG not found: ${svgPath}`);
  console.log('Please ensure icon-source.svg exists in the public folder');
  process.exit(1);
}

// Run the generation
generateAllIcons().catch(error => {
  console.error('❌ Icon generation failed:', error);
  process.exit(1);
});