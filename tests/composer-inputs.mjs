import assert from 'node:assert/strict';
import models from '../catalog.mjs';
import {capabilities,resolveLaunchModel} from '../public/launch-config.js';
import {mediaUploadLimit,mergeMediaFiles,remapMediaFiles} from '../public/composer-inputs.js';

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
console.log('Inline input batch limits, additive upload, isolated replacement, and one-output-per-run model defaults passed.');
