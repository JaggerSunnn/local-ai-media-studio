import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

let fakePort;
const fake=createServer(async(req,res)=>{
  if(req.url==='/result.png'){
    res.writeHead(200,{'content-type':'image/png'});res.end(Buffer.from('89504e470d0a1a0a','hex'));return;
  }
  const result=req.url==='/api/remaining_credits'?{code:0,data:{available_credits:100}}:
    req.url==='/api/async/flux_text2image'?{code:0,data:{taskId:'fake-provider-task'}}:
    req.url==='/api/getAsyncResult'?{code:0,data:{task:{status:3,creditsConsumed:2},images:[{imageUrl:`http://127.0.0.1:${fakePort}/result.png`}]}}:
    {code:404,message:'Unknown test endpoint'};
  res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(result));
});
await new Promise(resolve=>fake.listen(0,'127.0.0.1',resolve));
fakePort=fake.address().port;
const dataDir=await mkdtemp(join(tmpdir(),'dreamapi-starter-test-'));
const appPort=18878;
const env={...process.env,DREAMAPI_BASE_URL:`http://127.0.0.1:${fakePort}`,DREAMAPI_DATA_DIR:dataDir,PORT:String(appPort),DREAMAPI_MOCK:'false'};
delete env.DREAMAPI_API_KEY;
const app=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url).pathname,env,stdio:'ignore'});
const base=`http://127.0.0.1:${appPort}`;
try{
  let ready=false;
  for(let i=0;i<40;i++){try{const response=await fetch(`${base}/api/health`);if(response.ok){ready=true;break}}catch{}await delay(100)}
  assert.ok(ready,'local server started');
  const blocked=await fetch(`${base}/api/tasks`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
  assert.equal(blocked.status,401);
  const testKey=['sk','testkey1234567890abcdef'].join('-');
  const connected=await fetch(`${base}/api/session`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({apiKey:testKey})});
  assert.equal(connected.status,200);
  const cookie=connected.headers.get('set-cookie');
  assert.match(cookie,/HttpOnly/);
  const payload={modelId:'flux-text-image',inputs:{prompt:'A quiet lake'},options:{width:1024,height:1024,num:1,seed:-1,contentProfile:'standard'}};
  const calls=await Promise.all(Array.from({length:3},()=>fetch(`${base}/api/tasks`,{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify(payload)})));
  assert.deepEqual(calls.map(response=>response.status),[201,201,201]);
  const created=await Promise.all(calls.map(response=>response.json()));
  assert.equal(new Set(created.map(result=>result.task.id)).size,3);
  const polled=await fetch(`${base}/api/tasks/${created[0].task.id}`,{headers:{cookie}}).then(response=>response.json());
  assert.equal(polled.task.status,'succeeded');
  assert.equal(polled.task.outputs[0].kind,'image');
  assert.match(polled.task.outputs[0].localUrl,/^\/local\/outputs\//);
  assert.equal((await readdir(join(dataDir,'outputs'))).length,1);
  const localOutput=await fetch(`${base}${polled.task.outputs[0].localUrl}`);
  assert.equal(localOutput.status,200);
  assert.equal(localOutput.headers.get('content-type'),'image/png');
  const history=await fetch(`${base}/api/tasks`,{headers:{cookie}}).then(response=>response.json());
  assert.equal(history.tasks.length,3);
  const offlineHistory=await fetch(`${base}/api/tasks`).then(response=>response.json());
  assert.equal(offlineHistory.tasks.length,3);
  const saved=await readFile(join(dataDir,'tasks.json'),'utf8');
  assert.ok(!saved.includes(testKey),'API Key is not persisted in task history');
  console.log('Local auth, 3-task batch, polling, offline history, output download, and key non-persistence passed.');
}finally{
  app.kill();
  await new Promise(resolve=>fake.close(resolve));
  await rm(dataDir,{recursive:true,force:true});
}
