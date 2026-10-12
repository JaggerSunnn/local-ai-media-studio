import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const fake = createServer(async (req, res) => {
  if(req.url==='/result.png'){res.writeHead(200,{'content-type':'image/png'});res.end(Buffer.from('89504e470d0a1a0a','hex'));return;}
  const result = req.url === '/api/remaining_credits'
    ? { code: 0, data: { available_credits: 100 } }
    : req.url === '/api/async/flux_text2image'
      ? { code: 0, data: { taskId: `provider-${Date.now()}` } }
      : req.url==='/api/getAsyncResult'
        ? {code:0,data:{task:{status:3,creditsConsumed:2,executionTime:1000},images:[{imageUrl:`http://127.0.0.1:${fakePort}/result.png`}]}}
      : { code: 404, message: 'Unknown test endpoint' };
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(result));
});
await new Promise(resolve => fake.listen(0, '127.0.0.1', resolve));
const fakePort = fake.address().port;
const dataDir = await mkdtemp(join(tmpdir(), 'local-studio-hosted-test-'));
const appPort = 18879;
const env = { ...process.env, LOCAL_STUDIO_BASE_URL: `http://127.0.0.1:${fakePort}`, LOCAL_STUDIO_DATA_DIR: dataDir, LOCAL_STUDIO_DEPLOYMENT_MODE: 'hosted', HOST: '127.0.0.1', PORT: String(appPort) };
delete env.LOCAL_STUDIO_API_KEY;
const app = spawn(process.execPath, ['server.mjs'], { cwd: new URL('..', import.meta.url).pathname, env, stdio: 'ignore' });
const base = `http://127.0.0.1:${appPort}`;
const key = ['sk', 'hostedtest1234567890abcdef'].join('-');

function cookieValues(...headers) {
  const values = new Map();
  for (const header of headers) for (const match of String(header || '').matchAll(/(?:^|,\s*)(localstudio_(?:client|session))=([a-f0-9]{64})/g)) values.set(match[1], match[2]);
  return [...values].map(([name, value]) => `${name}=${value}`).join('; ');
}

async function browserSession() {
  const health = await fetch(`${base}/api/health`);
  const clientCookie = health.headers.get('set-cookie');
  const connected = await fetch(`${base}/api/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: cookieValues(clientCookie) },
    body: JSON.stringify({ apiKey: key })
  });
  assert.equal(connected.status, 200);
  return cookieValues(clientCookie, connected.headers.get('set-cookie'));
}

try {
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) { ready = true; break; } } catch {}
    await delay(100);
  }
  assert.ok(ready, 'hosted server started');
  const browserA = await browserSession();
  const browserB = await browserSession();
  assert.notEqual(browserA, browserB);

  const payload = { modelId: 'flux-text-image', inputs: { prompt: 'Isolated task' }, options: { width: 1024, height: 1024, num: 1, seed: -1, contentProfile: 'standard' } };
  const createdResponse = await fetch(`${base}/api/tasks`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: browserA }, body: JSON.stringify(payload) });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.equal(created.task.ownerId, undefined, 'owner ID is private');

  const ownList = await fetch(`${base}/api/tasks`, { headers: { cookie: browserA } }).then(response => response.json());
  const otherList = await fetch(`${base}/api/tasks`, { headers: { cookie: browserB } }).then(response => response.json());
  assert.equal(ownList.tasks.length, 1);
  assert.equal(otherList.tasks.length, 0);

  const crossPoll = await fetch(`${base}/api/tasks/${created.task.id}`, { headers: { cookie: browserB } });
  assert.equal(crossPoll.status, 404);
  assert.equal((await fetch(`${base}/api/tasks/${created.task.id}/usage`,{method:'POST',headers:{cookie:browserB}})).status,404,'another browser cannot refresh private task usage');
  const ownResult=await fetch(`${base}/api/tasks/${created.task.id}`,{headers:{cookie:browserA}}).then(response=>response.json());
  const resultUrl=ownResult.task.outputs[0].localUrl;
  assert.equal((await fetch(`${base}${resultUrl}`,{headers:{cookie:browserA}})).status,200);
  assert.equal((await fetch(`${base}${resultUrl}`,{headers:{cookie:browserB}})).status,404,'output previews respect browser ownership');
  assert.equal((await fetch(`${base}/api/tasks/${created.task.id}/outputs/0/use-as-input`,{method:'POST',headers:{cookie:browserB}})).status,404,'another browser cannot reuse this result');
  assert.equal((await fetch(`${base}/api/tasks/${created.task.id}/outputs/0/use-as-input`,{method:'POST',headers:{cookie:browserA}})).status,201);
  const uploaded=await fetch(`${base}/api/assets`,{method:'POST',headers:{cookie:browserA,'content-type':'image/png','x-file-name':'reference.png'},body:Buffer.from('89504e470d0a1a0a','hex')}).then(response=>response.json());
  assert.equal(uploaded.localPath,undefined,'hosted asset responses do not expose filesystem paths');
  assert.equal((await fetch(`${base}${uploaded.previewUrl}`,{headers:{cookie:browserB}})).status,404,'input previews respect ownership');
  console.log('Hosted browser identity and cross-task isolation passed.');
} finally {
  app.kill();
  await new Promise(resolve => fake.close(resolve));
  await rm(dataDir, { recursive: true, force: true });
}
