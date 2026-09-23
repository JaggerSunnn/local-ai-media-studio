import assert from 'node:assert/strict';
import models from '../catalog.mjs';

assert.equal(models.length, 42, 'the public API catalog must retain all 42 mapped entries');
assert.equal(new Set(models.map(model => model.id)).size, models.length, 'model IDs must be unique');

for (const model of models) {
  assert.match(model.id, /^[a-z0-9-]+$/, `${model.id}: stable ID format`);
  assert.ok(model.label && model.group && model.short, `${model.id}: user-facing metadata`);
  assert.ok(['image', 'video', 'audio', 'data'].includes(model.outputKind), `${model.id}: output kind`);
  assert.ok(model.endpoint === null || model.endpoint.startsWith('/api/'), `${model.id}: provider endpoint`);
  assert.ok(Array.isArray(model.inputs) && Array.isArray(model.options), `${model.id}: declarative fields`);
  assert.ok(model.contentProfiles.includes('standard'), `${model.id}: safe default content profile`);
  for (const option of model.options) {
    if (option.type === 'select') {
      assert.ok(option.values.length, `${model.id}/${option.id}: select values`);
      assert.ok(option.values.map(String).includes(String(option.value)), `${model.id}/${option.id}: default is supported`);
    }
  }
}

console.log(`Catalog validation passed for ${models.length} model entries.`);
