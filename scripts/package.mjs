import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, utimes } from 'node:fs/promises';
import path from 'node:path';

await mkdir('release', { recursive: true });
const files = [];
async function walk(dir = '') {
  for (const entry of await readdir(path.join('dist', dir), { withFileTypes: true })) {
    const name = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(name);
    else files.push(name);
  }
}
await walk();
files.sort();
const epoch = new Date('2020-01-01T00:00:00Z');
for (const file of files) await utimes(path.join('dist', file), epoch, epoch);
// Stream zip to stdout so repeat packaging cannot retain stale entries.
const zip = execFileSync('zip', ['-X', '-q', '-', ...files], { cwd: 'dist', maxBuffer: 20_000_000, env: { ...process.env, TZ: 'UTC' } });
const { writeFile } = await import('node:fs/promises');
const { version } = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
const output = `release/sponsor-skipper-${version}.zip`;
await writeFile(output, zip);
console.log(`Created ${output}`);
