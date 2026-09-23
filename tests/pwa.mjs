import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('..', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('public/manifest.webmanifest', root), 'utf8'));
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.start_url, '/');
assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));
await Promise.all(manifest.icons.map(icon => access(new URL(`public${icon.src}`, root))));

const html = await readFile(new URL('public/index.html', root), 'utf8');
assert.match(html, /manifest\.webmanifest/);
assert.match(html, /apple-mobile-web-app-capable/);
assert.match(html, /viewport-fit=cover/);
assert.match(html, /data-experience="simple"/);
assert.match(html, /data-experience="pro"/);

const worker = await readFile(new URL('public/sw.js', root), 'utf8');
assert.ok(worker.includes("pathname.startsWith('/api/')") && worker.includes("pathname.startsWith('/local/')"), 'API and private local responses must bypass the cache');
console.log('PWA manifest, icons, mobile metadata, and shell cache checks passed.');
