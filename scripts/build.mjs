import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

await mkdir('dist/assets', { recursive: true });
await build({
  entryPoints: { background: 'src/background/index.ts', content: 'src/content/index.ts', bridge: 'src/youtube/bridge.ts', popup: 'src/popup/index.ts', options: 'src/options/index.ts' },
  bundle: true, outdir: 'dist', format: 'iife', target: 'chrome111', minify: false, legalComments: 'none', logLevel: 'info',
});
await Promise.all([
  cp('manifest.json', 'dist/manifest.json'), cp('src/popup/popup.html', 'dist/popup.html'),
  cp('src/options/options.html', 'dist/options.html'), cp('src/ui/settings.css', 'dist/settings.css'),
]);
// Deterministic code-drawn extension icon: two forward chevrons. No image dependency.
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) { crc ^= b; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(name, data) {
  const bytes = Buffer.concat([Buffer.from(name), data]);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(bytes));
  return Buffer.concat([length, bytes, crc]);
}
for (const size of [16, 48, 128]) {
  const rows = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const mark = [0.22, 0.48].some(left => u >= left && u <= left + 0.29 && Math.abs(v - 0.5) <= (left + 0.29 - u) * 0.9 && Math.abs(v - 0.5) >= Math.max(0, (left + 0.19 - u) * 0.9));
    const offset = y * (size * 4 + 1) + 1 + x * 4;
    rows.set(mark ? [221, 250, 229, 255] : [30, 103, 72, 255], offset);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
  await writeFile(`dist/assets/icon${size}.png`, png);
}
const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
if (manifest.manifest_version !== 3 || manifest.permissions.join() !== 'storage') throw new Error('Unexpected manifest permissions');
console.log('Load dist/ as an unpacked extension.');
