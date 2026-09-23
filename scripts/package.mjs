import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const output = join(root, 'dist', 'dreamapi-local-studio');
await rm(join(root, 'dist'), { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const file of ['server.mjs', 'catalog.mjs', 'package.json', 'README.md', 'LICENSE', 'SECURITY.md', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'CHANGELOG.md', 'start.bat', 'start.command', '.env.example', 'Dockerfile', 'render.yaml']) {
  await cp(join(root, file), join(output, file));
}
for (const directory of ['public', 'docs']) await cp(join(root, directory), join(output, directory), { recursive: true });
await mkdir(join(output, 'data'), { recursive: true });
await cp(join(root, 'data', 'voice_catalog.json'), join(output, 'data', 'voice_catalog.json'));
await writeFile(join(output, 'data', 'tasks.json'), '[]\n');

const files = JSON.stringify(await import('../catalog.mjs').then(module => module.default.map(model => model.id)));
if (/sk-[A-Za-z0-9_-]{20,}/.test(await readFile(join(output, 'server.mjs'), 'utf8'))) throw new Error('Potential API key found in packaged server');
if (!files.includes('dreamvideo-3-text')) throw new Error('Catalog was not packaged correctly');
console.log(`Prepared clean release at ${output}`);
