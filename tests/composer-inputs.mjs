import assert from 'node:assert/strict';
import models from '../catalog.mjs';
import {capabilities,resolveLaunchModel,settingsModelFor,updateModelSelection} from '../public/launch-config.js';
import {mediaUploadLimit,mergeMediaFiles,remapMediaFiles,mergeReferenceFiles,referenceKind} from '../public/composer-inputs.js';

const fields=[{id:'first',type:'image'},{id:'last',type:'image'},{id:'references',type:'image',multiple:true,max:4}];
assert.equal(mediaUploadLimit(fields,fields[0]),10,'first single-file slot supports batch variants');
assert.equal(mediaUploadLimit(fields,fields[1]),1,'the last frame remains a single shared input');
assert.equal(mediaUploadLimit(fields,fields[2]),4,'reference collections respect their model limit');
const first={id:'first'},second={id:'second'},replacement={id:'replacement'};
const existing=[first,second];
assert.deepEqual(mergeMediaFiles(existing,[replacement],{limit:4}),[first,second,replacement],'adding files retains previous uploads');
assert.deepEqual(mergeMediaFiles(existing,[replacement],{limit:4,replaceIndex:0}),[replacement,second],'replace only changes the selected file');
assert.deepEqual(existing,[first,second],'merge does not mutate existing inputs');
assert.throws(()=>mergeMediaFiles(existing,[replacement],{limit:2}),/up to 2/,'total files, not only new files, are limited');
assert.throws(()=>mergeMediaFiles(existing,[first,second],{limit:4,replaceIndex:0}),/one file/);
assert.throws(()=>mergeMediaFiles(existing,[replacement],{limit:4,replaceIndex:3}),/one file/);
assert.deepEqual(remapMediaFiles(fields,[{id:'imageUrl',type:'image'},{id:'endImageUrl',type:'image'}],{first:[first],last:[second]}),{imageUrl:[first],endImageUrl:[second]},'switching model IDs preserves first/last frame order');
assert.deepEqual(remapMediaFiles([{id:'image',type:'image'}],[{id:'images',type:'image',multiple:true},{id:'face',type:'image'}],{image:[first]}),{images:[first]},'switching to a reference collection preserves inputs without inventing a swap face');
let countControls=0;
for(const category of Object.values(capabilities))for(const operation of category.operations)for(const id of operation.models){
  const model=resolveLaunchModel(models.find(model=>model.id===id),operation.id);
  for(const option of model.options.filter(option=>['n','num'].includes(option.id))){
    assert.equal(option.value,1,`${id} requests one output per run`);
    assert.equal(option.hidden,true,`${id} hides the duplicate quantity control`);countControls++;
  }
}
assert.ok(countControls>0);
const editingIds=['image-enhance','image-remove-bg','image-colorize','image-outpainting'];
for(const first of [...editingIds,'image-swap-face'])for(const next of [...editingIds,'image-swap-face']){
  const selection=updateModelSelection('image-editing',new Set([first]),first,next,true);
  assert.deepEqual([...selection.selectedIds],[next],'editing tools replace the previous selection');
  assert.equal(selection.primaryId,next,'inputs and settings follow the selected editing tool');
}
const multi=updateModelSelection('text-to-video',new Set(['one']),'one','two',true);
assert.deepEqual([...multi.selectedIds],['one','two'],'other tasks retain multiple model selection');
assert.equal(multi.primaryId,'one');
assert.equal(updateModelSelection('text-to-video',multi.selectedIds,multi.primaryId,'one',false).primaryId,'two');
for(const id of [...editingIds,'image-swap-face']){
  const model=resolveLaunchModel(models.find(model=>model.id===id),'image-editing');
  assert.equal(model.inputs[0].label,'Source image','all editing tools share the left source-image slot');
  if(id==='image-swap-face'){
    assert.equal(model.inputs[1].label,'Target image');
    assert.equal(model.inputs[0].id,'image');assert.equal(model.inputs[0].api,'url');
    assert.equal(model.inputs[1].id,'face');assert.equal(model.inputs[1].api,'faceImgUrl','labels do not swap the provider request fields');
  }
}
const permutations=items=>items.length?items.flatMap((item,index)=>permutations(items.filter((_,i)=>i!==index)).map(rest=>[item,...rest])):[[]];
for(let mask=1;mask<16;mask++){
  const ids=editingIds.filter((_,index)=>mask&(1<<index));
  for(const order of permutations(ids)){
    const selected=order.map(id=>resolveLaunchModel(models.find(model=>model.id===id),'image-editing'));
    const expected=ids.includes('image-outpainting')?'image-outpainting':selected[0].id;
    assert.equal(settingsModelFor('image-editing',selected,selected[0]).id,expected,'outpainting owns settings regardless of selection size/order');
    assert.equal(settingsModelFor('text-to-image',selected,selected[0]),selected[0],'other tasks retain the primary-model settings policy');
  }
}
const referenceFields=[{id:'images',type:'image',multiple:true,max:9},{id:'videos',type:'video',multiple:true,max:3},{id:'audios',type:'audio',multiple:true,max:3}];
const image={name:'photo.png',type:'image/png'},video={name:'clip.mp4',type:'video/mp4'},audio={name:'voice.wav',type:'audio/wav'};
const mixed=mergeReferenceFiles(referenceFields,{},[image,video,audio]);
assert.deepEqual(mixed.assets,{images:[image],videos:[video],audios:[audio]},'mixed uploads route into the provider image/video/audio fields');
assert.equal(referenceKind({name:'VOICE.MP3',type:''}),'audio','extension fallback supports files without a MIME type');
assert.equal(referenceKind({name:'clip.mov',type:'application/octet-stream'}),'video');
assert.throws(()=>referenceKind({name:'document.pdf',type:'application/pdf'}),/image, video, or audio/);
const swapped=mergeReferenceFiles(referenceFields,mixed.assets,[video],{replaceField:'images',replaceIndex:0});
assert.deepEqual(swapped.assets,{images:[],videos:[video,video],audios:[audio]},'cross-type replacement removes the old field and routes the new file');
assert.deepEqual(mixed.assets.images,[image],'cross-type replacement leaves the source collection unchanged');
assert.throws(()=>mergeReferenceFiles(referenceFields,{audios:[audio,audio,audio]},[audio]),/up to 3 audio/,'unified input enforces per-type model limits before upload');
assert.throws(()=>mergeReferenceFiles(referenceFields,mixed.assets,[image,video],{replaceField:'images',replaceIndex:0}),/one file/);
console.log('Inline inputs, one-output defaults, mixed-media reference routing, cross-type replacement, and model limits passed.');
