const {test} = require('node:test');
const assert = require('node:assert/strict');
const {sampleWork, nextReward, readProgress} = require('../progress.cjs');

test('user work and Codex overlap count once, and wake-up gaps are skipped', () => {
  assert.equal(sampleWork({elapsed:1000, idle:1, ai:true}), 1000);
  assert.equal(sampleWork({elapsed:1000, idle:1, ai:false}), 1000);
  assert.equal(sampleWork({elapsed:1000, idle:50, ai:true}), 1000);
  assert.equal(sampleWork({elapsed:1000, idle:50, ai:false}), 0);
  assert.equal(sampleWork({elapsed:1000, idle:1, ai:true, suspended:true}), 0);
  assert.equal(sampleWork({elapsed:60000, idle:1, ai:true}), 0);
});

test('an earned reward survives a restart and every fourth reward is a gift', () => {
  assert.equal(nextReward(readProgress({workMs:299999})), undefined);
  assert.equal(nextReward(readProgress({workMs:300000})), 'snack');
  assert.equal(nextReward(readProgress({workMs:1200000, shown:3})), 'gift');
  assert.equal(nextReward(readProgress({workMs:1200000, shown:4})), undefined);
});
