import { readFile, writeFile } from 'fs/promises';
import { createCanvas, loadImage } from 'canvas';
import path from 'path';
import url from 'url';

// Simple icon generator: converts public/icons/icon.svg into required PNG sizes.
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const srcSvg = path.join(root, 'public', 'icons', 'icon.svg');
const outDir = path.join(root, 'public', 'icons');
const sizes = [72,96,128,144,152,192,384,512];

async function ensurePng(size){
  const svgData = await readFile(srcSvg, 'utf8');
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  // Load SVG as image
  const img = await loadImage('data:image/svg+xml;base64,' + Buffer.from(svgData).toString('base64'));
  ctx.clearRect(0,0,size,size);
  ctx.drawImage(img,0,0,size,size);
  const buf = canvas.toBuffer('image/png');
  const outPath = path.join(outDir, `icon-${size}x${size}.png`);
  await writeFile(outPath, buf);
  console.log('Generated', outPath);
}

(async () => {
  try {
    for(const s of sizes){
      await ensurePng(s);
    }
    console.log('All icons generated.');
  } catch (e){
    console.error('Icon generation failed', e);
    process.exit(1);
  }
})();
