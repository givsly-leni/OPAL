import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import url from 'url';

// Generates placeholder PNG icons (1x1 transparent pixel) for all declared sizes so PWA manifest stops 404s.
// Replace later with real artwork.
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'public', 'icons');
const sizes = [72,96,128,144,152,192,384,512];

// 1x1 transparent PNG
const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
const buf = Buffer.from(base64, 'base64');

async function run(){
  await mkdir(outDir, { recursive: true });
  for (const s of sizes){
    const file = path.join(outDir, `icon-${s}x${s}.png`);
    await writeFile(file, buf);
    console.log('Wrote placeholder', file);
  }
}

run().catch(e=>{ console.error(e); process.exit(1); });
