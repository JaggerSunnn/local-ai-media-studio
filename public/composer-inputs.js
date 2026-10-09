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

export function referenceKind(file){
  const type=String(file.type||'').toLowerCase().split('/')[0];
  if(['image','video','audio'].includes(type))return type;
  const extension=String(file.name||'').split('.').pop().toLowerCase();
  if(['png','jpg','jpeg','webp','gif','avif','heic','heif','bmp','tif','tiff'].includes(extension))return 'image';
  if(['mp4','webm','mov','m4v','mkv','avi'].includes(extension))return 'video';
  if(['mp3','wav','m4a','aac','flac','ogg','opus','aiff'].includes(extension))return 'audio';
  throw new Error('Choose an image, video, or audio file');
}

export function mergeReferenceFiles(fields,assets,files,{replaceField,replaceIndex}={}){
  const next=Object.fromEntries(fields.map(field=>[field.id,[...(assets[field.id]||[])]]));
  if(replaceField!==undefined){
    if(files.length!==1||!Number.isInteger(replaceIndex)||!next[replaceField]?.[replaceIndex])throw new Error('Choose one file to replace this reference');
    next[replaceField].splice(replaceIndex,1);
  }
  const uploads=files.map(file=>{
    const type=referenceKind(file);const field=fields.find(item=>item.type===type);
    if(!field)throw new Error(`This model does not accept ${type} references`);
    if(replaceField===field.id)next[field.id].splice(replaceIndex,0,file);else next[field.id].push(file);
    if(next[field.id].length>mediaUploadLimit(fields,field))throw new Error(`This model accepts up to ${mediaUploadLimit(fields,field)} ${type} references`);
    return {file,field,type};
  });
  return {assets:next,uploads};
}

export function renderMediaInputs({root,fields,assets,onUpload,onRemove,busy=false,unified=false}){
  root.hidden=!fields.length;root.setAttribute('aria-busy',String(busy));
  const displayFields=unified?[{id:'__references',label:'References',multiple:true,type:'media',max:fields.reduce((sum,field)=>sum+mediaUploadLimit(fields,field),0)}]:fields;
  root.innerHTML=displayFields.map(field=>{
    const files=unified?fields.flatMap(source=>(assets[source.id]||[]).map((file,index)=>({...file,sourceField:source.id,sourceIndex:index}))):assets[field.id]||[];const limit=mediaUploadLimit(fields,field);
    const upload=(replaceIndex,replaceField)=>`<input type="file" data-asset="${escape(field.id)}" ${replaceIndex===undefined?'':`data-replace-index="${replaceIndex}"`} ${replaceField?`data-replace-field="${escape(replaceField)}"`:''} aria-label="${replaceIndex===undefined?'Upload':'Replace'} ${escape(field.label)}" accept="${unified?'image/*,video/*,audio/*':`${field.type}/*`}" ${replaceIndex===undefined&&limit>1?'multiple':''}>`;
    const previews=files.map((file,index)=>{
      const url=escape(file.previewUrl||'');
      const kind=file.type||field.type;
      const media=kind==='image'?`<img src="${url}" alt="${escape(file.name)}">`:kind==='video'?`<video src="${url}" controls playsinline preload="metadata"></video>`:`<span class="input-audio-icon" aria-hidden="true">♫</span><audio src="${url}" controls preload="metadata"></audio>`;
      return `<div class="input-preview-card"><div class="input-preview-media">${media}<button type="button" data-remove-input="${escape(file.sourceField||field.id)}" data-index="${file.sourceIndex??index}" aria-label="Remove ${escape(file.name)}" title="Remove">×</button><label class="input-replace" title="Replace ${escape(file.name)}">Replace${upload(file.sourceIndex??index,file.sourceField)}</label></div><span class="input-caption" title="${escape(field.label)} · ${escape(file.name)}">${escape(file.name)}</span></div>`;
    }).join('');
    return `<div class="input-media-field" data-input-field="${escape(field.id)}"><span class="input-field-label" title="${escape(field.label)}">${escape(field.label)}${field.required?' *':''}</span><div class="input-field-cards">${previews}${files.length<limit?`<label class="input-upload-card"><span aria-hidden="true">＋</span><strong>${files.length?'Add more':unified?'Add media':`Upload ${field.type}`}</strong><small>${unified?'Image · Video · Audio':files.length?`${files.length} / ${limit} files`:field.required?'Required':'Optional'}</small>${upload()}</label>`:''}</div></div>`;
  }).join('');
  root.querySelectorAll('input,button').forEach(control=>control.disabled=busy);
  root.querySelectorAll('[data-asset]').forEach(input=>input.addEventListener('change',()=>onUpload(input)));
  root.querySelectorAll('[data-remove-input]').forEach(button=>button.addEventListener('click',()=>onRemove(button.dataset.removeInput,Number(button.dataset.index))));
}
