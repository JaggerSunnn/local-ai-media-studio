const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function mediaUploadLimit(fields,field){
  return field.multiple?field.max||10:field.id===fields.find(item=>!item.multiple)?.id?10:1;
}

export function remapMediaFiles(previousFields,nextFields,assets){
  const result={};const special=new Set(['face','vocalAudio']);
  for(const field of nextFields){
    if(assets[field.id]?.length){result[field.id]=assets[field.id];continue;}
    if(special.has(field.id))continue;
    const peers=nextFields.filter(item=>item.type===field.type&&!special.has(item.id));
    const source=previousFields.filter(item=>item.type===field.type&&!special.has(item.id))[peers.indexOf(field)];
    if(source&&assets[source.id]?.length)result[field.id]=assets[source.id];
  }
  return result;
}

export function mergeMediaFiles(existing,uploaded,{limit,replaceIndex}={}){
  const files=[...existing];
  if(replaceIndex!==undefined){
    if(uploaded.length!==1||!Number.isInteger(replaceIndex)||replaceIndex<0||replaceIndex>=files.length)throw new Error('Choose one file to replace this input');
    files[replaceIndex]=uploaded[0];
  }else files.push(...uploaded);
  if(files.length>limit)throw new Error(`Select up to ${limit} files for this input`);
  return files;
}

export function renderMediaInputs({root,fields,assets,onUpload,onRemove,busy=false}){
  root.hidden=!fields.length;root.setAttribute('aria-busy',String(busy));
  root.innerHTML=fields.map(field=>{
    const files=assets[field.id]||[];const limit=mediaUploadLimit(fields,field);
    const upload=(replaceIndex)=>`<input type="file" data-asset="${escape(field.id)}" ${replaceIndex===undefined?'':`data-replace-index="${replaceIndex}"`} aria-label="${replaceIndex===undefined?'Upload':'Replace'} ${escape(field.label)}" accept="${field.type}/*" ${replaceIndex===undefined&&limit>1?'multiple':''}>`;
    const previews=files.map((file,index)=>{
      const url=escape(file.previewUrl||'');
      const media=field.type==='image'?`<img src="${url}" alt="${escape(file.name)}">`:field.type==='video'?`<video src="${url}" controls playsinline preload="metadata"></video>`:`<span class="input-audio-icon" aria-hidden="true">♫</span><audio src="${url}" controls preload="metadata"></audio>`;
      return `<div class="input-preview-card"><div class="input-preview-media">${media}<button type="button" data-remove-input="${escape(field.id)}" data-index="${index}" aria-label="Remove ${escape(file.name)}" title="Remove">×</button><label class="input-replace" title="Replace ${escape(file.name)}">Replace${upload(index)}</label></div><span class="input-caption" title="${escape(field.label)} · ${escape(file.name)}">${escape(file.name)}</span></div>`;
    }).join('');
    return `<div class="input-media-field" data-input-field="${escape(field.id)}"><span class="input-field-label" title="${escape(field.label)}">${escape(field.label)}${field.required?' *':''}</span><div class="input-field-cards">${previews}${files.length<limit?`<label class="input-upload-card"><span aria-hidden="true">＋</span><strong>${files.length?'Add more':`Upload ${field.type}`}</strong><small>${files.length?`${files.length} / ${limit} files`:field.required?'Required':'Optional'}</small>${upload()}</label>`:''}</div></div>`;
  }).join('');
  root.querySelectorAll('input,button').forEach(control=>control.disabled=busy);
  root.querySelectorAll('[data-asset]').forEach(input=>input.addEventListener('change',()=>onUpload(input)));
  root.querySelectorAll('[data-remove-input]').forEach(button=>button.addEventListener('click',()=>onRemove(button.dataset.removeInput,Number(button.dataset.index))));
}
