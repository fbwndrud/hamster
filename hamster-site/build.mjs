import { execFileSync } from 'node:child_process';
import { copyFile, lstat, mkdir, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copy } from './copy.mjs';
import { render, renderInstall, outfits, clips } from './template.mjs';

const dist = new URL('./dist/', import.meta.url);
const assets = new URL('assets/', dist);
const appAssets = new URL('../desktop-pet/assets/', import.meta.url);
const appIconSource = new URL('../desktop-pet/build/icon-source.png', import.meta.url);
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const staticFiles = ['styles.css', 'demo.js', '_headers'];
const pages = { ko: 'index.html', en: 'en/index.html' };
const installPages = { ko: 'install/index.html', en: 'en/install/index.html' };
const accessories = new Set(outfits.flatMap(({ hat, face }) => [hat, face]).filter(Boolean));
const publicFiles = new Set([
  ...staticFiles,
  ...Object.values(pages),
  ...Object.values(installPages),
  'assets/hamster-icon.png',
  ...clips.map(([name]) => 'assets/' + name + '.png'),
  ...clips.filter(([name]) => name !== 'idle').map(([name]) => 'assets/' + name + '.gif'),
  ...Array.from(accessories, name => 'assets/' + name),
]);
const publicFolders = new Set(['assets', 'en', 'install', 'en/install']);

await mkdir(dist, { recursive: true });
if (!(await lstat(dist)).isDirectory()) throw new Error('dist must be a regular directory');
for (const entry of await readdir(dist, { recursive: true, withFileTypes: true })) {
  const path = relative(fileURLToPath(dist), join(entry.parentPath, entry.name));
  const allowed = entry.isDirectory() ? publicFolders.has(path) : entry.isFile() && publicFiles.has(path);
  if (!allowed) throw new Error('Unexpected entry in deploy folder: ' + path);
}
await mkdir(assets, { recursive: true });
await mkdir(new URL('en/install/', dist), { recursive: true });
await mkdir(new URL('install/', dist), { recursive: true });

execFileSync(ffmpeg, [
  '-v', 'error', '-y', '-i', fileURLToPath(appIconSource),
  '-vf', 'crop=1034:1034:110:206,scale=96:96:flags=lanczos',
  '-frames:v', '1', '-pix_fmt', 'rgba', '-update', '1',
  fileURLToPath(new URL('hamster-icon.png', assets)),
]);

for (const [name, source, frame] of clips) {
  const gif = new URL(source + '.gif', appAssets);
  execFileSync(ffmpeg, [
    '-v', 'error', '-y', '-i', fileURLToPath(gif),
    '-vf', `select=eq(n\\,${frame})`, '-frames:v', '1', '-pix_fmt', 'rgba', '-update', '1',
    fileURLToPath(new URL(name + '.png', assets)),
  ]);
  if (name !== 'idle') await copyFile(gif, new URL(name + '.gif', assets));
}

for (const name of accessories) {
  await copyFile(new URL('accessories/' + name, appAssets), new URL(name, assets));
}

for (const name of staticFiles) {
  await copyFile(new URL(name, import.meta.url), new URL(name, dist));
}
for (const [language, content] of Object.entries(copy)) {
  await writeFile(new URL(pages[language], dist), render(language, content));
  await writeFile(new URL(installPages[language], dist), renderInstall(language, content));
}

console.log('Built ' + publicFiles.size + ' public files in hamster-site/dist.');
