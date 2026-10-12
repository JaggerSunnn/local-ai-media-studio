import {historyEntries,filterHistory,sourceLabels,relativeTime,mediaUrl} from './history-model.js';
import {resolveLaunchModel} from './launch-config.js';
import {bindHoverPreview} from './media-preview.js';
const $=selector=>document.querySelector(selector);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statuses={succeeded:'Completed',failed:'Failed',processing:'Generating',queued:'Queued',unknown:'Status unknown','queued-local':'Pending submission'};
let entries=[],visible=[],limit=24,models=[],previews=[],loading=false,loadError=null;
const clock=()=>document.querySelectorAll('[data-relative-time]').forEach(node=>node.textContent=relativeTime(node.dataset.relativeTime));
function preview(entry,detail=false){
  const {task,output}=entry;const url=mediaUrl(output);
  if(task.status!=='succeeded'||!url)return `<div class="history-state ${task.status==='failed'?'failed':''}"><span>${task.status==='failed'?'!':'◷'}</span><strong>${escape(statuses[task.status]||task.status)}</strong><small>${escape(task.error||(task.status==='succeeded'?'No media output is available yet.':'Your result will appear when the task finishes.'))}</small></div>`;
  if(output.kind==='image')return `<img src="${escape(url)}" alt="${escape(entry.modelLabel)} result" ${detail?'':'loading="lazy"'}>`;
  if(output.kind==='video')return `<video src="${escape(url)}" controls muted playsinline preload="metadata"></video>`;
  if(output.kind==='audio')return `${detail?'':'<span class="audio-art" aria-hidden="true">♫</span>'}<audio src="${escape(url)}" controls muted preload="metadata"></audio>`;
  return '<div class="history-state"><span>✓</span><strong>Result available</strong><small>This task returned structured data.</small></div>';
}
function render(){
  previews.forEach(preview=>preview.dispose());previews=[];
  const sources=[...$('#sourcePicker').querySelectorAll('input:checked')].map(input=>input.value);
  $('#sourceCount').textContent=sources.length;
  visible=filterHistory(entries,{sources,status:$('#statusFilter').value,query:$('#historySearch').value});
  $('#historyCount').textContent=loadError?'History unavailable':`${visible.length} ${visible.length===1?'result':'results'}`;
  $('#historyEmpty').hidden=visible.length>0;
  $('#emptyTitle').textContent=loadError?'Could not load history':entries.length?'No matching history':'No recent history yet';
  $('#emptyDescription').textContent=loadError?'Check the local service and try Refresh.':entries.length?'Try another source, status, or search.':'Your generated results will appear here.';
  const showPreview=$('#showPreview').checked;
  $('#historyGrid').innerHTML=visible.slice(0,limit).map((entry,index)=>`<article class="history-card ${showPreview?'':'no-preview'}"><div class="history-media" data-detail="${index}" tabindex="0" role="button" aria-label="View ${escape(entry.modelLabel)} result">${preview(entry)}${entry.output?`<span class="media-kind">${escape(entry.output.kind)}</span>${entry.output.kind==='video'?'<span class="media-duration" data-duration></span>':''}`:''}</div><div class="history-info"><p class="history-prompt" title="${escape(entry.prompt)}">${escape(entry.prompt||'No prompt required')}</p><div class="history-meta"><span class="history-model" title="${escape(entry.modelLabel)}">${escape(entry.modelLabel)}</span><span>·</span><time datetime="${escape(entry.time)}" data-relative-time="${escape(entry.time)}" title="${escape(new Date(entry.time).toLocaleString('en-US'))}">${escape(relativeTime(entry.time))}</time></div><div class="history-footer"><span class="source-tag ${entry.source}">${sourceLabels[entry.source]}</span><div class="history-card-actions"><button type="button" data-open="${index}" aria-label="View details" title="View details">↗</button>${entry.prompt?`<button type="button" data-copy="${index}" aria-label="Copy prompt" title="Copy prompt">⧉</button>`:''}${mediaUrl(entry.output)&&entry.task.status==='succeeded'?`<a href="${escape(mediaUrl(entry.output))}" download aria-label="Download result" title="Download result">↓</a>`:''}</div></div></div></article>`).join('');
  $('#loadMore').hidden=visible.length<=limit;
  $('#historyGrid').querySelectorAll('[data-detail]').forEach(node=>{node.addEventListener('click',event=>{if(!event.target.closest('video,audio'))openDetail(Number(node.dataset.detail))});node.addEventListener('keydown',event=>{if(event.target===node&&['Enter',' '].includes(event.key)){event.preventDefault();openDetail(Number(node.dataset.detail))}})});
  $('#historyGrid').querySelectorAll('[data-open]').forEach(button=>button.addEventListener('click',()=>openDetail(Number(button.dataset.open))));
  $('#historyGrid').querySelectorAll('[data-copy]').forEach(button=>button.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(visible[Number(button.dataset.copy)].prompt);toast('Prompt copied')}catch{toast('Open the result details to select and copy the prompt.')}}));
  if(showPreview)$('#historyGrid').querySelectorAll('video,audio').forEach(media=>{
    previews.push(bindHoverPreview(media.closest('.history-media'),media,{}));
    if(media.tagName==='VIDEO')media.addEventListener('loadedmetadata',()=>{const duration=media.parentElement.querySelector('[data-duration]');if(duration&&Number.isFinite(media.duration))duration.textContent=`${Math.floor(media.duration/60)}:${String(Math.floor(media.duration%60)).padStart(2,'0')}`},{once:true});
  });
}
function openDetail(index){
  const entry=visible[index];if(!entry)return;
  const info={Prompt:entry.prompt||'No prompt required',Model:entry.modelLabel,Source:sourceLabels[entry.source],Status:statuses[entry.task.status]||entry.task.status,Created:new Date(entry.task.createdAt).toLocaleString('en-US'),'Task ID':entry.task.providerTaskId||entry.task.id};
  $('#historyDetailContent').innerHTML=`<div class="history-detail-layout"><div class="history-detail-media" style="position:relative">${preview(entry,true)}</div><div class="history-detail-info"><h2>${escape(entry.modelLabel)}</h2><dl>${Object.entries(info).map(([key,value])=>`<div><dt>${key}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>${mediaUrl(entry.output)&&entry.task.status==='succeeded'?`<a href="${escape(mediaUrl(entry.output))}" download>Download result</a>`:''}</div></div>`;
  $('#historyDetail').showModal();
}
function toast(message){$('#historyToast').textContent=message;$('#historyToast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#historyToast').hidden=true,2400)}
async function load(){
  if(loading)return;loading=true;$('#refreshHistory').disabled=true;$('#historyGrid').setAttribute('aria-busy','true');loadError=null;
  try{
    const [history,catalog]=await Promise.all([fetch('/api/history'),models.length?null:fetch('/api/models')]);
    if(!history.ok)throw new Error('History unavailable');
    if(catalog){if(!catalog.ok)throw new Error('Models unavailable');models=(await catalog.json()).models;}
    const tasks=(await history.json()).tasks;
    const pending=tasks.filter(task=>['queued','processing','unknown'].includes(task.status)).slice(0,10);
    await Promise.allSettled(pending.map(async task=>{const response=await fetch(`/api/tasks/${encodeURIComponent(task.id)}`);if(response.ok)Object.assign(task,(await response.json()).task)}));
    entries=historyEntries(tasks).map(entry=>({...entry,modelLabel:resolveLaunchModel(models.find(model=>model.id===entry.task.modelId),entry.task.meta?.operation)?.label||entry.task.modelId}));
  }catch(error){loadError=error.message;toast('Could not refresh history. Check the local service.');}
  finally{loading=false;$('#refreshHistory').disabled=false;$('#historyGrid').setAttribute('aria-busy','false');render();}
}
$('#showPreview').addEventListener('change',render);
for(const control of [$('#statusFilter'),...$('#sourcePicker').querySelectorAll('input')])control.addEventListener('change',()=>{limit=24;render()});
$('#historySearch').addEventListener('input',()=>{limit=24;render()});
$('#refreshHistory').addEventListener('click',load);$('#loadMore').addEventListener('click',()=>{limit+=24;render()});
for(const view of ['grid','list'])$(`#${view}View`).addEventListener('click',()=>{$('#historyGrid').classList.toggle('list',view==='list');for(const other of ['grid','list']){const button=$(`#${other}View`);button.classList.toggle('active',other===view);button.setAttribute('aria-pressed',String(other===view))}});
document.addEventListener('pointerdown',event=>{if(!$('#sourcePicker').contains(event.target))$('#sourcePicker').open=false});
document.addEventListener('keydown',event=>{if(event.key==='Escape')$('#sourcePicker').open=false});
$('#closeHistoryDetail').addEventListener('click',()=>$('#historyDetail').close());
$('#historyDetail').addEventListener('close',()=>$('#historyDetailContent').querySelectorAll('video,audio').forEach(media=>media.pause()));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
setInterval(clock,60000);setInterval(()=>{if(!document.hidden&&entries.some(entry=>!['succeeded','failed'].includes(entry.task.status)))load()},5000);
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
load();
