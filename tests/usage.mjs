import assert from 'node:assert/strict';
import {reportedCredits} from '../provider-usage.mjs';
assert.deepEqual(reportedCredits({task:{creditsConsumed:12}}),{credits:12,field:'task.creditsConsumed'});
assert.deepEqual(reportedCredits({task:{creditsConsumed:'12.5'}}),{credits:12.5,field:'task.creditsConsumed'});
assert.deepEqual(reportedCredits({task:{creditsConsumed:'0'}}),{credits:0,field:'task.creditsConsumed'});
assert.deepEqual(reportedCredits({creditsConsumed:'6'}),{credits:6,field:'creditsConsumed'});
for(const value of [null,undefined,'',false,'Not reported','12 USD',NaN,-1])assert.equal(reportedCredits({task:{creditsConsumed:value}}).credits,null);
assert.equal(reportedCredits({task:{estimatedCredits:10},cost:8}).credits,null,'estimates and unlabeled costs are not actual credits');
console.log('Actual credit fields, numeric-string compatibility, zero cost, and rejection of estimates/missing values passed.');
