import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import models from '../catalog.mjs';
import {capabilities,resolveLaunchModel} from '../public/launch-config.js';
import {ttsLanguages,languageLabel} from '../public/languages.js';

let fakePort;
const providerRequests=[];
const fake=createServer(async(req,res)=>{
  if(req.url==='/result.png'){
    res.writeHead(200,{'content-type':'image/png'});res.end(Buffer.from('89504e470d0a1a0a','hex'));return;
  }
  if(req.url.startsWith('/api/async/')){const chunks=[];for await(const chunk of req)chunks.push(chunk);providerRequests.push({path:req.url,body:JSON.parse(Buffer.concat(chunks).toString())});}
  const result=req.url==='/api/remaining_credits'?{code:0,data:{available_credits:100}}:
    req.url.startsWith('/api/async/')?{code:0,data:{taskId:'fake-provider-task'}}:
    req.url==='/api/getAsyncResult'?{code:0,data:{task:{status:3,creditsConsumed:2},images:[{imageUrl:`http://127.0.0.1:${fakePort}/result.png`}]}}:
    {code:404,message:'Unknown test endpoint'};
  res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(result));
});
await new Promise(resolve=>fake.listen(0,'127.0.0.1',resolve));
fakePort=fake.address().port;
const dataDir=await mkdtemp(join(tmpdir(),'local-studio-test-'));
const appPort=18878;
const env={...process.env,LOCAL_STUDIO_BASE_URL:`http://127.0.0.1:${fakePort}`,LOCAL_STUDIO_DATA_DIR:dataDir,PORT:String(appPort),LOCAL_STUDIO_MOCK:'false'};
delete env.LOCAL_STUDIO_API_KEY;
const app=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url).pathname,env,stdio:'ignore'});
const base=`http://127.0.0.1:${appPort}`;
try{
  let ready=false;
  for(let i=0;i<40;i++){try{const response=await fetch(`${base}/api/health`);if(response.ok){ready=true;break}}catch{}await delay(100)}
  assert.ok(ready,'local server started');
  const publicVoices=await fetch(`${base}/api/voices`);
  assert.equal(publicVoices.status,200,'browsing voices does not require an API key');
  const voiceDirectory=await publicVoices.json();
  assert.ok(voiceDirectory.voices.length>100);
  assert.ok(voiceDirectory.voices.some(voice=>voice.previewUrl),'official sample URLs are exposed without creating tasks');
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
  const postTask=payload=>fetch(`${base}/api/tasks`,{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify(payload)});
  let launchCases=0;
  for(const [category,definition] of Object.entries(capabilities))for(const op of definition.operations){
    assert.ok(op.models.includes(op.defaultModel),'the default model is listed');
    for(const id of op.models){
      const model=resolveLaunchModel(models.find(item=>item.id===id),op.id);
      assert.ok(model,'all first-release menu models have a real catalog mapping');
      const inputs=Object.fromEntries(model.inputs.map(field=>[field.id,field.multiple?[`http://127.0.0.1:${fakePort}/${field.id}.png`]:['image','video','audio'].includes(field.type)?`http://127.0.0.1:${fakePort}/${field.id}.png`:field.value||'Sample text']));
      const options=Object.fromEntries(model.options.map(option=>[option.id,option.value]));
      const result=await postTask({modelId:id,inputs,options,meta:{category,operation:op.id}});
      assert.equal(result.status,201,`${id}/${op.id}: default request accepted`);
      const sent=providerRequests.at(-1);
      assert.equal(sent.path,model.endpoint,'submission uses the correct endpoint');
      for(const field of model.inputs){const expected=field.apiArray?model.inputs.filter(item=>item.api===field.api).map(item=>inputs[item.id]):inputs[field.id];assert.deepEqual(sent.body[field.api],expected,`${id}/${op.id}: ${field.api} serialization`);}
      for(const option of model.options){const container=option.container?sent.body[option.container]:sent.body;assert.deepEqual(container[option.api],option.value===''?undefined:option.type==='number'?Number(option.value):option.value,`${id}/${op.id}: ${option.api} default`);}
      if(model.fixed)for(const [key,value] of Object.entries(model.fixed))assert.equal(sent.body[key],value,'provider model identifier');
      if(op.id==='first-last-frame'){
        const last=model.inputs.find(field=>['last','endImageUrl'].includes(field.id));
        assert.equal((await postTask({modelId:id,inputs:{...inputs,[last.id]:''},options,meta:{category,operation:op.id}})).status,422,'missing last frame is rejected before calling the provider');
      }
      if(op.id==='image-to-image')assert.equal((await postTask({modelId:id,inputs:{prompt:'Sample'},options,meta:{category,operation:op.id}})).status,422,'image-to-image requires reference input');
      if(op.id==='reference-to-video')assert.equal((await postTask({modelId:id,inputs:{prompt:'Sample'},options,meta:{category,operation:op.id}})).status,422,'reference-to-video requires reference input');
      if(id.startsWith('gpt-image-2-5'))assert.equal((await postTask({modelId:id,inputs,options:{...options,width:848,height:480},meta:{category,operation:op.id}})).status,422,'unsupported 480p is rejected for GPT Image 2.5');
      launchCases++;
    }
  }
  console.log(`First-release contracts passed for ${launchCases} task/model combinations across 12 tasks (local test provider, no paid calls).`);
  for(const [id,languages] of Object.entries(ttsLanguages)){
    const model=resolveLaunchModel(models.find(item=>item.id===id),'text-to-speech');
    const inputs=Object.fromEntries(model.inputs.map(field=>[field.id,field.value||'Speech sample']));
    const options=Object.fromEntries(model.options.map(option=>[option.id,option.value]));
    const languageOption=model.options.find(option=>option.id==='language');
    for(const code of languages){
      assert.equal(languageOption.valueLabels[code],languageLabel(code),'language labels use one display format');
      assert.equal((await postTask({modelId:id,inputs,options:{...options,language:code},meta:{category:'audio',operation:'text-to-speech'}})).status,201);
      assert.equal(providerRequests.at(-1).body.lan,code,'the API receives its code, not a display label');
    }
    assert.equal((await postTask({modelId:id,inputs,options:{...options,language:'zh-EN'},meta:{category:'audio',operation:'text-to-speech'}})).status,422,'unknown language is rejected');
  }
  console.log('All 29 model/language combinations preserve provider language codes.');
  const chosenVoice=voiceDirectory.voices.find(voice=>voice.type==='common'&&voice.languageCode==='en');
  const tts=resolveLaunchModel(models.find(model=>model.id==='tts-common'),'text-to-speech');
  const ttsOptions=Object.fromEntries(tts.options.map(option=>[option.id,option.value]));
  for(const voiceId of [chosenVoice.id,'user-owned-custom-voice-id']){
    const response=await postTask({modelId:tts.id,inputs:{audioId:voiceId,text:'A short sample'},options:ttsOptions,meta:{category:'audio',operation:'text-to-speech'}});
    assert.equal(response.status,201);assert.equal(providerRequests.at(-1).body.audioId,voiceId,'selected and manually entered IDs reach the provider unchanged');
  }
  console.log('Local auth, 3-task batch, polling, offline history, output download, and key non-persistence passed.');
}finally{
  app.kill();
  await new Promise(resolve=>fake.close(resolve));
  await rm(dataDir,{recursive:true,force:true});
}
