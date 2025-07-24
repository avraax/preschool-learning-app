const fs = require('fs');
const path = require('path');

// Read the SVG content
const svgContent = fs.readFileSync('./public/icon-source.svg', 'utf8');

// Icon sizes needed
const iconSizes = [
  // PWA manifest icons
  { size: 192, name: 'icon-192x192.png' },
  { size: 512, name: 'icon-512x512.png' },
  
  // iOS app icons
  { size: 180, name: 'apple-touch-icon-180x180.png' },
  { size: 167, name: 'apple-touch-icon-167x167.png' },
  { size: 152, name: 'apple-touch-icon-152x152.png' },
  { size: 120, name: 'apple-touch-icon-120x120.png' },
  
  // Favicon sizes
  { size: 32, name: 'favicon-32x32.png' },
  { size: 16, name: 'favicon-16x16.png' },
  
  // Maskable versions (for Android adaptive icons)
  { size: 192, name: 'icon-192x192-maskable.png', maskable: true },
  { size: 512, name: 'icon-512x512-maskable.png', maskable: true }
];

// Generate PNG content for each size
function generatePngDataUrl(size, maskable = false) {
  // For maskable icons, we add padding to ensure the icon fits in the safe zone
  const padding = maskable ? size * 0.1 : 0; // 10% padding for maskable
  const iconSize = size - (padding * 2);
  
  const pngSvg = svgContent
    .replace('width="512"', `width="${iconSize}"`)
    .replace('height="512"', `height="${iconSize}"`)
    .replace('viewBox="0 0 512 512"', `viewBox="0 0 512 512"`);
  
  if (maskable) {
    // Wrap in centered container for maskable icons
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="#8B5CF6"/>
      <g transform="translate(${padding}, ${padding})">
        ${pngSvg.replace(/<svg[^>]*>/, '').replace('</svg>', '')}
      </g>
    </svg>`;
  }
  
  return pngSvg;
}

// Create the icons directory if it doesn't exist
const iconsDir = './public';
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate each icon (we'll create them as SVG files since we can't convert to PNG without external tools)
iconSizes.forEach(({ size, name, maskable }) => {
  const svgContent = generatePngDataUrl(size, maskable);
  const svgName = name.replace('.png', '.svg');
  const filePath = path.join(iconsDir, svgName);
  
  fs.writeFileSync(filePath, svgContent);
  console.log(`Generated ${svgName}`);
});

// Also create a favicon.ico placeholder (browsers will fall back to PNG)
const faviconSvg = generatePngDataUrl(32);
fs.writeFileSync('./public/favicon.svg', faviconSvg);

console.log('All icons generated successfully!');
console.log('Note: These are SVG files. For production, convert to PNG using an online tool or image editor.');

// Create a simple HTML file to help convert SVGs to PNGs
const conversionHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Icon Converter</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .icon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 20px; }
        .icon-item { text-align: center; border: 1px solid #ccc; padding: 10px; }
        .icon-item img { max-width: 100%; height: auto; }
    </style>
</head>
<body>
    <h1>Generated Icons - Right-click to save as PNG</h1>
    <div class="icon-grid">
        ${iconSizes.map(({ size, name }) => {
          const svgName = name.replace('.png', '.svg');
          return `
            <div class="icon-item">
                <img src="${svgName}" alt="${name}" />
                <p>${name}<br/>${size}x${size}</p>
            </div>
          `;
        }).join('')}
    </div>
    <p><strong>Instructions:</strong> Right-click each icon and "Save image as..." to convert to PNG format.</p>
</body>
</html>
`;

fs.writeFileSync('./public/icon-converter.html', conversionHtml);
console.log('Created icon-converter.html for easy PNG conversion');