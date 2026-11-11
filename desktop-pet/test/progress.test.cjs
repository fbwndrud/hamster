const {test} = require('node:test');
const assert = require('node:assert/strict');
const {sampleWork, nextReward, readProgress, readToolTime, addToolTime, todayMs} = require('../progress.cjs');

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

test('each tool keeps its own time together, resets today at midnight and ignores wake-up gaps', () => {
  const times = readToolTime({claude:{totalMs:5000,day:'2026-11-10',todayMs:5000},grok:{totalMs:-1}},['claude','grok','cursor']);
  assert.deepEqual(times.grok,{totalMs:0,day:'',todayMs:0});
  assert.equal(addToolTime(times,new Set(['claude','grok']),1000,'2026-11-11'),true);
  assert.equal(addToolTime(times,new Set(['claude']),60000,'2026-11-11'),false);
  assert.equal(addToolTime(times,new Set(['unknown']),1000,'2026-11-11'),false);
  assert.deepEqual(times.claude,{totalMs:6000,day:'2026-11-11',todayMs:1000});
  assert.equal(todayMs(times.grok,'2026-11-11'),1000);
  assert.equal(todayMs(times.grok,'2026-11-12'),0);
  assert.equal(todayMs(times.cursor,'2026-11-11'),0);
});

test('tool time ignores names that are not plain tools', () => {
  const times = readToolTime({},['claude']);
  assert.equal(addToolTime(times,new Set(['__proto__','toString',{toString:1}]),1000,'2026-11-11'),false);
  assert.equal(({}).totalMs,undefined);
});
