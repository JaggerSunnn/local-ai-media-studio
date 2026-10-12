import http from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import models from './catalog.mjs';
import {capabilities,resolveLaunchModel} from './public/launch-config.js';
import {normalizeVoices,VOICE_SOURCE} from './voice-catalog.mjs';
import {reportedCredits} from './provider-usage.mjs';

const ROOT = new URL('.', import.meta.url).pathname;
const PUBLIC = join(ROOT, 'public');
const DATA = process.env.LOCAL_STUDIO_DATA_DIR || join(ROOT, 'data');
const TASK_FILE = join(DATA, 'tasks.json');
const OUTPUTS = join(DATA, 'outputs');
const BASE_URL = process.env.LOCAL_STUDIO_BASE_URL || 'https://api.newportai.com';
const ENV_KEY = process.env.LOCAL_STUDIO_API_KEY?.trim() || '';
const MOCK = process.env.LOCAL_STUDIO_MOCK === 'true';
const PORT = Number(process.env.PORT || 8788);
const DEPLOYMENT_MODE = process.env.LOCAL_STUDIO_DEPLOYMENT_MODE === 'hosted' ? 'hosted' : 'local';
const HOST = process.env.HOST || (DEPLOYMENT_MODE === 'hosted' ? '0.0.0.0' : '127.0.0.1');
const MAX_TASK_CREDITS = Number(process.env.MAX_TASK_CREDITS || 1000);
const displayRate=process.env.LOCAL_STUDIO_USD_PER_CREDIT?.trim()?Number(process.env.LOCAL_STUDIO_USD_PER_CREDIT):NaN;
const billing={unit:process.env.LOCAL_STUDIO_COST_UNIT==='usd'&&Number.isFinite(displayRate)&&displayRate>=0?'usd':'credits',usdPerCredit:Number.isFinite(displayRate)&&displayRate>=0?displayRate:null};
const sessions = new Map();
const tasks = new Map();
const assets = new Map();
let voices=[];
let voiceMetadata={source:'bundled',updatedAt:null};
let voiceRefresh=null;

await mkdir(join(DATA, 'uploads'), { recursive: true });
await mkdir(OUTPUTS, { recursive: true });
try { for (const task of JSON.parse(await readFile(TASK_FILE, 'utf8'))) tasks.set(task.id, task); } catch {}
try { voices=JSON.parse(await readFile(join(ROOT,'data','voice_catalog.json'),'utf8')); } catch {}
try {voiceMetadata={...JSON.parse(await readFile(join(ROOT,'data','voice_catalog_source.json'),'utf8')),source:'bundled'};}catch{}
async function refreshVoiceDirectory(){
  if(voiceRefresh)return voiceRefresh;
  voiceRefresh=(async()=>{
    const response=await fetch(VOICE_SOURCE,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({vision:'All',lan:'All',timbre:'All'}),signal:AbortSignal.timeout(12_000)});
    if(!response.ok)throw new Error('Provider voice directory refresh failed');
    const payload=await response.json();if(payload.code!==0)throw new Error('Provider voice directory is unavailable');
    voices=normalizeVoices(payload);voiceMetadata={url:VOICE_SOURCE,updatedAt:new Date().toISOString(),source:'live',count:voices.length};
    return {voices,...voiceMetadata};
  })();
  try{return await voiceRefresh}finally{voiceRefresh=null}
}

const json = (res, status, body) => { res.writeHead(status, {'content-type':'application/json; charset=utf-8','cache-control':'no-store'}); res.end(JSON.stringify(body)); };
const readBody = async (req, limit = 1_000_000) => {
  const chunks=[]; let size=0;
  for await (const chunk of req) { size += chunk.length; if(size>limit) throw Object.assign(new Error('Request body is too large'),{status:413}); chunks.push(chunk); }
  return Buffer.concat(chunks);
};
const readJson = async req => JSON.parse((await readBody(req)).toString('utf8') || '{}');
let persistQueue=Promise.resolve();
const persist = () => {
  const snapshot=JSON.stringify([...tasks.values()].slice(-100), null, 2);
  persistQueue=persistQueue.catch(()=>{}).then(()=>writeFile(TASK_FILE,snapshot));
  return persistQueue;
};
const modelById = id => models.find(model => model.id === id && model.status === 'active');
const publicModel = ({endpoint,pricing,...model}) => ({...model,pricing});

function validate(model, payload, ownerId) {
  const errors=[]; const inputs=payload.inputs || {}; const options=payload.options || {};
  for (const field of model.inputs) if(field.required && (Array.isArray(inputs[field.id]) ? !inputs[field.id].length : !String(inputs[field.id] ?? '').trim())) errors.push(`Provide ${field.label}`);
  if(DEPLOYMENT_MODE==='hosted')for(const field of model.inputs.filter(field=>['image','video','audio'].includes(field.type))){for(const id of [inputs[field.id]].flat().filter(Boolean)){if(!/^https?:\/\//.test(id)&&assets.get(id)?.ownerId!==ownerId)errors.push('The input asset is not available to this browser');}}
  for (const field of model.inputs.filter(field=>field.type==='textarea')) if(String(inputs[field.id] || '').length > 4000) errors.push(`${field.label} must be 4,000 characters or fewer`);
  for (const option of model.options || []) {
    const value=options[option.id];
    if(option.type==='number'&&(!Number.isFinite(Number(value))||!Number.isInteger(Number(value))||(option.step&&Number(value)%option.step!==0)))errors.push(`${option.label} must be a valid integer`);
    if(option.type==='select' && !option.values.map(String).includes(String(value))) errors.push(`${option.label} is invalid`);
    if(option.type==='number' && ((option.min!==undefined && Number(value)<option.min)||(option.max!==undefined && Number(value)>option.max))) errors.push(`${option.label} must be ${option.min ?? 'valid values'}–${option.max ?? 'valid values'}`);
  }
  if(!model.contentProfiles.includes(options.contentProfile||'standard')) errors.push('This content profile is not supported');
  if(model.referenceRequired&&!model.inputs.filter(field=>['image','audio','video'].includes(field.type)).some(field=>Array.isArray(inputs[field.id])?inputs[field.id].length:Boolean(inputs[field.id])))errors.push('Upload at least one reference image, video or audio file');
  if(model.id.startsWith('gpt-image-2-5')){const pixels=Number(options.width)*Number(options.height);if(pixels<655360||pixels>8294400||Number(options.width)%16||Number(options.height)%16||Math.max(Number(options.width),Number(options.height))/Math.min(Number(options.width),Number(options.height))>3)errors.push('GPT Image 2.5 requires aligned dimensions and 655,360–8,294,400 pixels');}
  const text=Object.values(inputs).filter(value=>typeof value==='string').join(' ').toLowerCase();
  const immutable=[/未成年|儿童色情|幼女|幼男|child sexual|underage|rape|强奸|胁迫|偷拍|非自愿/];
  if(immutable.some(rule=>rule.test(text))) errors.push('This request does not meet age, consent, and safety requirements');
  return errors;
}

function estimate(model, options={}) {
  const pricing=model.pricing;
  if(pricing.unit==='free') return {credits:0,label:pricing.label,assumption:'Lookup'};
  if(pricing.unit==='dynamic') return {credits:null,label:pricing.label,assumption:'Based on model and assets'};
  if(pricing.requiresMediaDuration) return {credits:null,label:'Billed by media duration',assumption:'Confirmed by the provider after upload'};
  if(pricing.unit==='credits_per_task') return {credits:pricing.flat,label:`${pricing.flat} credits`,assumption:'Per task'};
  const rate=pricing.byResolution?.[options.resolution] ?? pricing.flat;
  const credits=rate * Number(options.duration || 0);
  return {credits,label:`${credits} credits`,assumption:`${options.resolution} · ${options.duration} seconds`};
}

async function dreamPost(path, body, key,timeout=30_000) {
  const response=await fetch(`${BASE_URL}${path}`,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${key}`},body:JSON.stringify(body),signal:AbortSignal.timeout(timeout)});
  const data=await response.json().catch(()=>({code:-1,message:`HTTP ${response.status}`}));
  if(!response.ok || data.code!==0) throw Object.assign(new Error(data.message || 'API request failed'),{providerCode:data.code,httpStatus:response.status});
  return data.data || {};
}

async function resolveAsset(value, key) {
  if(/^https?:\/\//.test(value)) return value;
  const asset=assets.get(value); if(!asset) throw new Error('The uploaded asset is missing or expired');
  if(MOCK) return `mock://asset/${asset.id}`;
  if(asset.providerUrl) return asset.providerUrl;
  const policy=await dreamPost('/api/file/v1/get_policy',{scene:'Dream-CN'},key);
  const host=policy.host; const accessId=policy.OSSAccessKeyId || policy.accessId; const uploadKey=policy.key || `${policy.dir || ''}${asset.name}`;
  if(!host || !accessId || !uploadKey || !policy.policy || !policy.signature) throw new Error('Incomplete upload policy response. Check the storage API configuration.');
  const bytes=await readFile(asset.path); const form=new FormData();
  form.set('key',uploadKey); form.set('policy',policy.policy); form.set('OSSAccessKeyId',accessId); form.set('signature',policy.signature);
  if(policy.callback) form.set('callback',policy.callback); form.set('success_action_status','200'); form.set('file',new Blob([bytes],{type:asset.type}),asset.name);
  const upload=await fetch(host,{method:'POST',body:form,signal:AbortSignal.timeout(300_000)});
  if(!upload.ok) throw new Error(`Asset upload failed（HTTP ${upload.status}）`);
  const uploadData=await upload.json().catch(()=>({})); const reqId=uploadData.data?.reqId || policy.reqId;
  const result=await dreamPost('/api/file/v1/policy_upload_finish',{reqId},key); asset.providerUrl=result.url; return result.url;
}

function assignBody(body, definition, value){if(value===undefined||value===''||value===null)return;const target=definition.container?(body[definition.container]??={}):body;target[definition.api||definition.id]=value;}
async function providerBody(model, inputs, options, key) {
  const body={...(model.fixed||{})};
  for(const field of model.inputs){let value=inputs[field.id];if(['image','audio','video'].includes(field.type)){if(field.multiple)value=await Promise.all((value||[]).map(item=>resolveAsset(item,key)));else if(value)value=await resolveAsset(value,key);}if(field.apiArray&&value){const key=field.api||field.id;(body[key]??=[]).push(value)}else assignBody(body,field,value);}
  for(const option of model.options||[]){let value=options[option.id];if(option.type==='number'||(option.type==='select'&&option.values?.length&&option.values.every(item=>typeof item==='number')))value=Number(value);if(option.type==='boolean')value=Boolean(value);assignBody(body,option,value);}
  return body;
}

function normalizeProvider(data) {
  const info=data.task || {}; const map={0:'queued',1:'processing',2:'processing',3:'succeeded',4:'failed'};
  const outputs=[...(data.images||[]).map(x=>({kind:'image',url:x.imageUrl})),...(data.videos||[]).map(x=>({kind:'video',url:x.videoUrl})),...(data.audios||[]).map(x=>({kind:'audio',url:x.audioUrl}))];
  if(data.mattingResult)for(const [name,url] of Object.entries(data.mattingResult))if(typeof url==='string'&&/^https?:\/\//.test(url))outputs.push({kind:'video',url,name});
  if(data.cloneId)outputs.push({kind:'data',items:[{name:'Cloned voice ID',value:data.cloneId}]});
  const usage=reportedCredits(data);
  return {status:map[info.status]||'unknown',outputs,providerCode:info.errorCode,error:info.reason||null,consumedCredits:usage.credits,usageSource:usage.field,executionTimeMs:typeof info.executionTime==='number'&&info.executionTime>=0?info.executionTime:null,expiresAt:info.expire};
}

async function refreshUsage(task,key){
  if(!task.providerTaskId||task.mode==='mock')return task;
  try{
    const data=await dreamPost('/api/getAsyncResult',{taskId:task.providerTaskId},key,12_000);
    const usage=reportedCredits(data);
    if(usage.credits!==null){task.consumedCredits=usage.credits;task.usageSource=usage.field;}
    task.usageCheckedAt=new Date().toISOString();
    task.usageError=usage.credits===null?'Provider has not returned creditsConsumed.':null;
    if(typeof data.task?.executionTime==='number'&&data.task.executionTime>=0)task.executionTimeMs=data.task.executionTime;
    task.usageFields={task:Object.keys(data.task||{}),data:Object.keys(data)};
  }catch{task.usageError='Usage lookup failed; reconnect the task owner’s API key or check provider retention.';}
  await persist();return task;
}

const outputExtensions={image:'.jpg',video:'.mp4',audio:'.mp3'};
const contentExtensions={'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp','image/avif':'.avif','video/mp4':'.mp4','video/webm':'.webm','audio/mpeg':'.mp3','audio/wav':'.wav','audio/x-wav':'.wav','audio/mp4':'.m4a','audio/ogg':'.ogg'};
async function localizeTaskOutputs(task){
  if(task.status!=='succeeded'||!task.outputs?.some(output=>output.url&&!output.localUrl))return task;
  let changed=false;
  task.outputs=await Promise.all(task.outputs.map(async(output,index)=>{
    if(!output.url||output.localUrl||output.kind==='data')return output;
    try{
      const response=await fetch(output.url,{signal:AbortSignal.timeout(10*60_000)});
      if(!response.ok||!response.body)throw new Error(`Download failed（HTTP ${response.status}）`);
      const type=(response.headers.get('content-type')||'').split(';')[0].toLowerCase();
      let extension='';
      try{extension=extname(new URL(output.url).pathname).toLowerCase();}catch{}
      if(!/^\.[a-z0-9]{2,5}$/.test(extension))extension=contentExtensions[type]||outputExtensions[output.kind]||'.bin';
      const filename=`${task.id}-${index}${extension}`;
      const path=join(OUTPUTS,filename);
      await pipeline(Readable.fromWeb(response.body),createWriteStream(path));
      const info=await stat(path);changed=true;
      return {...output,sourceUrl:output.url,localUrl:`/local/outputs/${filename}`,localPath:path,bytes:info.size,contentType:type||null,localSaveError:null};
    }catch(error){changed=true;return {...output,localSaveError:error.message};}
  }));
  if(changed)await persist();
  return task;
}

async function refreshTask(task, key) {
  if(task.status==='succeeded') return localizeTaskOutputs(task);
  if(task.status==='failed') return task;
  if(task.mode==='mock'){
    const elapsed=Date.now()-new Date(task.createdAt).getTime();
    task.status=elapsed>4200?'succeeded':elapsed>900?'processing':'queued'; task.progress=Math.min(100,Math.round(elapsed/42));
    if(task.status==='succeeded'){task.progress=100;task.consumedCredits=task.estimatedCredits;task.outputs=[{kind:'mock',url:null}];task.completedAt=new Date().toISOString();}
  } else if(task.providerTaskId){
    try{Object.assign(task,normalizeProvider(await dreamPost('/api/getAsyncResult',{taskId:task.providerTaskId},key)));task.progress=task.status==='succeeded'?100:task.status==='processing'?55:12;}
    catch(error){task.lastPollError=error.message;task.status='unknown';}
  }
  if(['succeeded','failed'].includes(task.status)&&!task.completedAt)task.completedAt=new Date().toISOString();
  await persist();
  if(task.status==='succeeded')await localizeTaskOutputs(task);
  return task;
}

function sessionFor(req){const cookie=req.headers.cookie?.match(/(?:^|;\s*)localstudio_session=([a-f0-9]{64})(?:;|$)/);const session=cookie?sessions.get(cookie[1]):null;if(session&&Date.now()-session.createdAt>8*60*60*1000){sessions.delete(cookie[1]);return null}return session;}
function keyFor(req){return sessionFor(req)?.key || ENV_KEY;}
function sameOrigin(req){const origin=req.headers.origin;if(!origin)return true;try{return new URL(origin).host===req.headers.host;}catch{return false;}}
function cookieOptions(req){const secure=DEPLOYMENT_MODE==='hosted'&&(req.headers['x-forwarded-proto']==='https'||req.socket.encrypted);return `HttpOnly; SameSite=Strict; Path=/${secure?'; Secure':''}`;}
function ownerFor(req,res){
  if(DEPLOYMENT_MODE==='local')return 'local';
  const found=req.headers.cookie?.match(/(?:^|;\s*)localstudio_client=([a-f0-9]{64})(?:;|$)/)?.[1];
  if(found)return found;
  const owner=randomUUID().replaceAll('-','')+randomUUID().replaceAll('-','');
  res.appendHeader('set-cookie',`localstudio_client=${owner}; ${cookieOptions(req)}; Max-Age=31536000`);
  return owner;
}
function taskForOwner(id,ownerId){const task=tasks.get(id);return task&&(DEPLOYMENT_MODE==='local'||task.ownerId===ownerId)?task:null;}
function taskForClient(task){if(!task)return task;const {ownerId,...safe}=task;if(DEPLOYMENT_MODE==='hosted'&&safe.outputs)safe.outputs=safe.outputs.map(({localPath,...output})=>output);return safe;}
function safeBatch(body,ownerId){
  const source=body.batch;if(!source)return null;
  if(!/^[a-f0-9-]{36}$/i.test(source.id||''))throw Object.assign(new Error('Invalid batch ID'),{status:422});
  const existing=[...tasks.values()].find(task=>task.batch?.id===source.id&&(DEPLOYMENT_MODE==='local'||task.ownerId===ownerId));
  if(existing){if(!existing.batch.modelIds.includes(body.modelId)||existing.batch.operation!==body.meta?.operation||existing.batch.category!==body.meta?.category)throw Object.assign(new Error('Batch task mismatch'),{status:422});return existing.batch;}
  const op=capabilities[source.category]?.operations.find(item=>item.id===source.operation);
  const modelIds=[...new Set(source.modelIds||[])].filter(id=>op?.models.includes(id));
  if(source.category!==body.meta?.category||source.operation!==body.meta?.operation||!modelIds.includes(body.modelId)||!Number.isInteger(source.expectedTasks)||source.expectedTasks<1||source.expectedTasks>10)throw Object.assign(new Error('Invalid generation batch'),{status:422});
  const inputAssets=(source.assets||[]).slice(0,40).map(item=>{
    const asset=assets.get(item.assetId);if(!asset||(DEPLOYMENT_MODE==='hosted'&&asset.ownerId!==ownerId))return null;
    return {assetId:asset.id,name:asset.name,type:asset.type.split('/')[0],previewUrl:asset.previewUrl||null};
  }).filter(Boolean);
  const options=Object.fromEntries(Object.entries(source.options||{}).filter(([key,value])=>['resolution','duration','aspectRatio','ratio','width','height','imageSize','size','quality','language'].includes(key)&&['string','number','boolean'].includes(typeof value)));
  return {id:source.id,createdAt:new Date().toISOString(),category:source.category,operation:source.operation,prompt:String(source.prompt||'').slice(0,4000),modelIds,options,assets:inputAssets,expectedTasks:source.expectedTasks};
}
async function verifyKey(key){
  const response=await fetch(`${BASE_URL}/api/remaining_credits`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','authorization':`Bearer ${key}`},body:'',signal:AbortSignal.timeout(12_000)});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.code!==0)throw Object.assign(new Error('API key verification failed. Check your key and account status.'),{status:401});
  return result.data?.available_credits ?? null;
}
async function handleApi(req,res,url){
  if(!['GET','HEAD'].includes(req.method)&&!sameOrigin(req)) return json(res,403,{error:'Invalid request origin'});
  const ownerId=ownerFor(req,res);
  if(req.method==='GET'&&url.pathname==='/api/health') return json(res,200,{ok:true,mode:MOCK?'mock':keyFor(req)?'live':'disconnected',deploymentMode:DEPLOYMENT_MODE,keyConfigured:Boolean(keyFor(req)),authSource:sessionFor(req)?'session':ENV_KEY?'environment':null,billing});
  if(req.method==='GET'&&url.pathname==='/api/voices'){
    let warning=null;
    if(url.searchParams.get('refresh')==='1')try{await refreshVoiceDirectory()}catch{warning='Provider refresh unavailable';}
    return json(res,200,{voices,...voiceMetadata,warning});
  }
  if(req.method==='POST'&&url.pathname==='/api/session'){
    const body=await readJson(req);const key=String(body.apiKey||'').trim();
    if(!/^sk-[A-Za-z0-9_-]{16,}$/.test(key))return json(res,422,{error:'Enter a valid API key'});
    const credits=await verifyKey(key);const token=randomUUID().replaceAll('-','')+randomUUID().replaceAll('-','');
    sessions.set(token,{key,createdAt:Date.now()});
    res.appendHeader('set-cookie',`localstudio_session=${token}; ${cookieOptions(req)}; Max-Age=28800`);
    return json(res,200,{connected:true,credits});
  }
  if(req.method==='DELETE'&&url.pathname==='/api/session'){
    const cookie=req.headers.cookie?.match(/(?:^|;\s*)localstudio_session=([a-f0-9]{64})(?:;|$)/);if(cookie)sessions.delete(cookie[1]);
    res.appendHeader('set-cookie',`localstudio_session=; ${cookieOptions(req)}; Max-Age=0`);return json(res,200,{connected:false});
  }
  const key=keyFor(req);
  const usageMatch=url.pathname.match(/^\/api\/tasks\/([a-f0-9-]+)\/usage$/i);
  if(req.method==='POST'&&usageMatch){
    if(!key&&!MOCK)return json(res,401,{error:'Connect your API key to fetch reported credits'});
    const task=taskForOwner(usageMatch[1],ownerId);if(!task)return json(res,404,{error:'Task not found'});
    if(!['succeeded','failed'].includes(task.status))return json(res,422,{error:'Wait for the task to finish before refreshing usage'});
    await refreshUsage(task,key);return json(res,200,{task:taskForClient(task)});
  }
  const reuseMatch=url.pathname.match(/^\/api\/tasks\/([a-f0-9-]+)\/outputs\/(\d+)\/use-as-input$/i);
  if(req.method==='POST'&&reuseMatch){
    const task=taskForOwner(reuseMatch[1],ownerId);if(!task)return json(res,404,{error:'Task not found'});
    const output=task.outputs?.[Number(reuseMatch[2])];
    if(task.status!=='succeeded'||!['image','video','audio'].includes(output?.kind))return json(res,422,{error:'This result cannot be used as media input'});
    const id=randomUUID();let name=`${task.modelId}-${Number(reuseMatch[2])+1}${outputExtensions[output.kind]}`;
    const localFilename=output.localUrl?.split('/').pop();const path=localFilename?join(OUTPUTS,localFilename):null;
    if(path)try{await stat(path)}catch{return json(res,422,{error:'The saved result is no longer available'});}
    const type=output.contentType||({image:'image/jpeg',video:'video/mp4',audio:'audio/mpeg'}[output.kind]);
    if(!path&&!output.url)return json(res,422,{error:'The result media is not available'});
    if(localFilename)name=`${task.modelId}-${Number(reuseMatch[2])+1}${extname(localFilename)}`;
    const previewUrl=output.localUrl||output.url;
    assets.set(id,{id,ownerId,name,path,type,size:output.bytes||null,previewUrl,...(!path?{providerUrl:output.url}:{})});
    return json(res,201,{assetId:id,name,type:output.kind,size:output.bytes||null,previewUrl});
  }
  const taskMatch=url.pathname.match(/^\/api\/tasks\/([a-f0-9-]+)$/i);
  if(req.method==='GET'&&url.pathname==='/api/tasks') return json(res,200,{tasks:[...tasks.values()].filter(task=>DEPLOYMENT_MODE==='local'||task.ownerId===ownerId).slice(-100).reverse().map(taskForClient)});
  if(req.method==='GET'&&taskMatch&&!key&&!MOCK){const task=taskForOwner(taskMatch[1],ownerId);if(!task)return json(res,404,{error:'Task not found'});if(task.status==='succeeded'&&DEPLOYMENT_MODE==='local')await localizeTaskOutputs(task);return json(res,200,{task:taskForClient(task)});}
  if(!key&&!MOCK&&url.pathname!=='/api/models'&&url.pathname!=='/api/storage'&&url.pathname!=='/api/estimate')return json(res,401,{error:'Connect your API key first'});
  if(req.method==='GET'&&url.pathname==='/api/storage') return json(res,200,DEPLOYMENT_MODE==='local'?{mode:'local',projectRoot:ROOT,dataPath:DATA,historyPath:TASK_FILE,uploadsPath:join(DATA,'uploads'),outputsPath:OUTPUTS,resultPolicy:'Completed media is automatically saved to the local outputs folder. Task metadata is stored in tasks.json.'}:{mode:'hosted',projectRoot:null,dataPath:null,historyPath:null,uploadsPath:null,outputsPath:null,resultPolicy:'PWA mode: tasks are visible only to this browser. Download results to your device or save to Photos.'});
  if(req.method==='GET'&&url.pathname==='/api/models') return json(res,200,{models:models.map(publicModel)});
  if(req.method==='POST'&&url.pathname==='/api/estimate'){
    const body=await readJson(req); let model=modelById(body.modelId); if(!model) return json(res,404,{error:'Model not found'});
    if(body.meta?.operation){const op=capabilities[body.meta.category]?.operations.find(item=>item.id===body.meta.operation);if(!op?.models.includes(model.id))return json(res,422,{error:'Invalid task and model combination'});model=resolveLaunchModel(model,op.id);}
    return json(res,200,estimate(model,body.options));
  }
  if(req.method==='POST'&&url.pathname==='/api/assets'){
    const bytes=await readBody(req,25*1024*1024); const id=randomUUID(); const name=(req.headers['x-file-name']||'upload.bin').replace(/[^a-zA-Z0-9._-]/g,'_'); const path=join(DATA,'uploads',`${id}${extname(name)}`);
    await writeFile(path,bytes);const previewUrl=`/local/uploads/${id}${extname(name)}`;assets.set(id,{id,ownerId,name,path,type:req.headers['content-type']||'application/octet-stream',size:bytes.length,previewUrl});return json(res,201,{assetId:id,name,size:bytes.length,previewUrl,...(DEPLOYMENT_MODE==='local'?{localPath:path}:{})});
  }
  if(req.method==='POST'&&url.pathname==='/api/tasks'){
    const body=await readJson(req); let model=modelById(body.modelId); if(!model) return json(res,404,{error:'Model not found'});
    if(body.meta?.operation){const op=capabilities[body.meta.category]?.operations.find(item=>item.id===body.meta.operation);if(!op?.models.includes(model.id))return json(res,422,{error:'Invalid task and model combination'});model=resolveLaunchModel(model,op.id);}
    const errors=validate(model,body,ownerId); if(errors.length) return json(res,422,{error:errors[0],details:errors,creditsConsumed:0});
    const estimateData=estimate(model,body.options); if(estimateData.credits>MAX_TASK_CREDITS) return json(res,422,{error:'Estimated usage exceeds the per-task limit',creditsConsumed:0});
    const safeMeta={category:String(body.meta?.category||'').slice(0,24),operation:String(body.meta?.operation||'').slice(0,48),prompt:String(body.meta?.prompt||'').slice(0,4000),label:String(body.meta?.label||model.label).slice(0,180),comparisonKey:String(body.meta?.comparisonKey||'default').slice(0,80),variantLabel:String(body.meta?.variantLabel||'').slice(0,120)};
    const batch=safeBatch(body,ownerId);
    const id=randomUUID(); const task={id,ownerId,modelId:model.id,status:'queued',progress:4,mode:MOCK?'mock':'live',estimatedCredits:estimateData.credits,consumedCredits:null,executionTimeMs:null,batch,options:body.options,meta:safeMeta,inputFingerprint:createHash('sha256').update(JSON.stringify(body.inputs)).digest('hex').slice(0,16),createdAt:new Date().toISOString(),policyVersion:'2026-09-23'};
    tasks.set(id,task); await persist();
    if(model.utility==='voice-catalog'){
      const selected=voices.filter(voice=>(!body.options.type||body.options.type==='all'||voice.type===body.options.type)&&(!body.options.language||voice.language===body.options.language)&&(!body.options.timbre||body.options.timbre==='all'||voice.timbre===body.options.timbre));
      task.status='succeeded';task.progress=100;task.completedAt=new Date().toISOString();task.outputs=[{kind:'data',items:selected.slice(0,100)}];await persist();return json(res,201,{task:taskForClient(task)});
    }
    if(!MOCK){
      try{if(!model.endpoint)throw new Error('This is a local lookup and does not create a generation task');const provider=await dreamPost(model.endpoint,await providerBody(model,body.inputs,body.options,key),key);task.providerTaskId=provider.taskId;task.status='processing';await persist();}
      catch(error){task.status=error.name==='TimeoutError'?'unknown':'failed';task.error=error.message;task.providerCode=error.providerCode;await persist();return json(res,502,{task:taskForClient(task),error:task.error,creditsConsumed:0});}
    }
    return json(res,201,{task:taskForClient(task)});
  }
  if(req.method==='GET'&&taskMatch){const task=taskForOwner(taskMatch[1],ownerId);if(!task)return json(res,404,{error:'Task not found'});const refreshed=await refreshTask(task,key);return json(res,200,{task:taskForClient(refreshed)});}
  return false;
}

const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.mp4':'video/mp4','.webm':'video/webm','.mp3':'audio/mpeg','.wav':'audio/wav','.m4a':'audio/mp4','.ogg':'audio/ogg'};
async function serveLocalOutput(req,res,path){
  const info=await stat(path);const type=types[extname(path).toLowerCase()]||'application/octet-stream';const range=req.headers.range;
  if(range){const match=range.match(/bytes=(\d*)-(\d*)/);const start=match?.[1]?Number(match[1]):0;const end=match?.[2]?Math.min(Number(match[2]),info.size-1):info.size-1;if(!match||start>end||start>=info.size){res.writeHead(416,{'content-range':`bytes */${info.size}`});return res.end();}res.writeHead(206,{'content-type':type,'accept-ranges':'bytes','content-range':`bytes ${start}-${end}/${info.size}`,'content-length':end-start+1});return createReadStream(path,{start,end}).pipe(res);}
  res.writeHead(200,{'content-type':type,'content-length':info.size,'accept-ranges':'bytes','cache-control':'private, max-age=3600'});createReadStream(path).pipe(res);
}
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://${req.headers.host||'localhost'}`); if(url.pathname.startsWith('/api/')){const handled=await handleApi(req,res,url);if(handled!==false)return;}
    if(url.pathname.startsWith('/local/outputs/')){const filename=decodeURIComponent(url.pathname.slice('/local/outputs/'.length));if(!/^[a-f0-9-]+-\d+\.[a-z0-9]{2,5}$/i.test(filename))return json(res,403,{error:'Forbidden'});if(DEPLOYMENT_MODE==='hosted'){const task=taskForOwner(filename.replace(/-\d+\.[a-z0-9]+$/i,''),ownerFor(req,res));if(!task)return json(res,404,{error:'Output not found'});}return serveLocalOutput(req,res,join(OUTPUTS,filename));}
    if(url.pathname.startsWith('/local/uploads/')){const filename=decodeURIComponent(url.pathname.slice('/local/uploads/'.length));if(!/^[a-f0-9-]{36}\.[a-z0-9]{2,5}$/i.test(filename))return json(res,403,{error:'Forbidden'});if(DEPLOYMENT_MODE==='hosted'){const asset=assets.get(filename.replace(/\.[a-z0-9]+$/i,''));if(asset?.ownerId!==ownerFor(req,res))return json(res,404,{error:'Asset not found'});}return serveLocalOutput(req,res,join(DATA,'uploads',filename));}
    const rel=url.pathname==='/'?'index.html':url.pathname.slice(1); const path=normalize(join(PUBLIC,rel)); if(!path.startsWith(PUBLIC))return json(res,403,{error:'Forbidden'});
    const info=await stat(path); if(info.isDirectory())return json(res,404,{error:'Not found'}); res.writeHead(200,{'content-type':types[extname(path)]||'application/octet-stream'});createReadStream(path).pipe(res);
  }catch(error){json(res,error.status||500,{error:error.message||'Server error'});}
});
server.listen(PORT,HOST,()=>console.log(`Local AI Studio (${DEPLOYMENT_MODE}, ${MOCK?'mock':ENV_KEY?'live':'disconnected'}) http://${HOST==='0.0.0.0'?'127.0.0.1':HOST}:${PORT}`));
