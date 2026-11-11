const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {test} = require('node:test');
const {createUsageReader,scanCodexUsage} = require('../codex-usage.cjs');

// The original split; output and today are checked separately below.
const split = ({state,before,after,partial}) => ({state,before,after,...(partial ? {partial} : {})});

const cutoff = Date.parse('2026-11-08T12:00:00Z');
function token(seconds,total,last,output,lastOutput) {
  return JSON.stringify({timestamp:new Date(cutoff+seconds*1000).toISOString(),type:'event_msg',payload:{
    type:'token_count',info:{total_token_usage:{total_tokens:total,output_tokens:output},
      last_token_usage:{total_tokens:last,output_tokens:lastOutput}},
  }})+'\n';
}

async function fixture(t) {
  const home = await fs.mkdtemp(path.join(os.tmpdir(),'hamster-usage-'));
  t.after(() => fs.rm(home,{recursive:true,force:true}));
  const sessions = path.join(home,'sessions','2026','11','08');
  const archive = path.join(home,'archived_sessions');
  const cachePath = path.join(home,'data','usage.json');
  await Promise.all([fs.mkdir(sessions,{recursive:true}),fs.mkdir(archive)]);
  return {home,sessions,archive,cachePath,scan:since => scanCodexUsage({home,cachePath,since:since ?? cutoff}).then(split),
    full:(since,dayStart) => scanCodexUsage({home,cachePath,since,dayStart})};
}

test('counts incremental usage once across archived copies and forks at the exact cutoff', async t => {
  const {sessions,archive,scan} = await fixture(t);
  const first = token(-2,120,20);
  const second = token(0,155,35);
  const repeated = token(1,155,35);
  await fs.writeFile(path.join(sessions,'rollout-original.jsonl'),first+second+repeated);
  await fs.writeFile(path.join(archive,'rollout-copy.jsonl'),first+second+repeated);
  await fs.writeFile(path.join(sessions,'rollout-fork.jsonl'),second+token(2,200,45));
  await fs.writeFile(path.join(sessions,'other.jsonl'),token(3,9999,9999));
  assert.deepEqual(await scan(),{state:'ready',before:20,after:80});
  assert.deepEqual(await scan(cutoff+3000),{state:'ready',before:100,after:null});
});

test('does not count a copied repeated snapshot as a fork’s first usage', async t => {
  const {sessions,scan} = await fixture(t);
  const repeated = token(0,100,100);
  await fs.writeFile(path.join(sessions,'rollout-source.jsonl'),token(-1,100,100)+repeated);
  await fs.writeFile(path.join(sessions,'rollout-fork.jsonl'),repeated+token(1,120,20));
  assert.deepEqual(await scan(),{state:'ready',before:100,after:20});
});

test('preserves distinct events with identical totals within one millisecond', async t => {
  const {sessions,scan} = await fixture(t);
  const first = token(0,10,10).replace('.000Z','.000000001Z');
  const second = token(0,10,10).replace('.000Z','.000000002Z');
  await fs.writeFile(path.join(sessions,'rollout-one.jsonl'),first);
  await fs.writeFile(path.join(sessions,'rollout-two.jsonl'),second);
  assert.deepEqual(await scan(),{state:'ready',before:null,after:20});
});

test('skips reset and unknown token schema without inventing counts for gaps', async t => {
  const {sessions,scan} = await fixture(t);
  const reset = token(-1,10,10);
  await fs.writeFile(path.join(sessions,'rollout-schema.jsonl'),
    token(-3,400,undefined)+token(-2,450,50)+reset+token(0,25,15)+
    token(1,undefined,100)+token(2,105,20));
  await fs.writeFile(path.join(sessions,'rollout-reset-copy.jsonl'),reset);
  assert.deepEqual(await scan(),{state:'ready',before:50,after:35,partial:true});
});

test('keeps an empty time bucket unknown and reports unavailable data', async t => {
  const {sessions,scan} = await fixture(t);
  assert.deepEqual(await scan(),{state:'unsupported',before:null,after:null});
  await fs.writeFile(path.join(sessions,'rollout-one.jsonl'),token(0,15,15));
  assert.deepEqual(await scan(),{state:'ready',before:null,after:15});
});

test('resumes completed lines and invalidates a rewritten or truncated rollout', async t => {
  const {sessions,cachePath,scan} = await fixture(t);
  const filename = path.join(sessions,'rollout-appended.jsonl');
  const privateLine = '{"type":"response_item","payload":{"text":"private prompt"}}\n';
  const second = token(0,300,200);
  const split = Math.floor(second.length/2);
  await fs.writeFile(filename,privateLine+token(-1,100,100)+second.slice(0,split));
  assert.deepEqual(await scan(),{state:'ready',before:100,after:null});
  assert.equal((await fs.readFile(cachePath,'utf8')).includes('private prompt'),false);
  await fs.appendFile(filename,second.slice(split));
  assert.deepEqual(await scan(),{state:'ready',before:100,after:200});
  assert.deepEqual(await scan(),{state:'ready',before:100,after:200});

  // A same-inode rewrite can be larger than the previous contents.
  await fs.writeFile(filename,privateLine+token(1,33,33)+privateLine.repeat(10));
  assert.deepEqual(await scan(),{state:'ready',before:null,after:33});
  await fs.writeFile(filename,token(2,44,44));
  assert.deepEqual(await scan(),{state:'ready',before:null,after:44});
});

test('ignores non-schema timestamps and caches no arbitrary strings from them', async t => {
  const {sessions,cachePath,scan} = await fixture(t);
  const event = token(0,15,15).replace('2026-11-08T12:00:00.000Z','2026-11-08 12:00:00Z (private prompt)');
  await fs.writeFile(path.join(sessions,'rollout-malformed.jsonl'),event);
  assert.deepEqual(await scan(),{state:'unsupported',before:null,after:null,partial:true});
  assert.equal((await fs.readFile(cachePath,'utf8')).includes('private prompt'),false);
});

test('refresh runs in a worker and only publishes the newest requested split', async t => {
  const {home,sessions,cachePath} = await fixture(t);
  await fs.writeFile(path.join(sessions,'rollout-worker.jsonl'),token(-1,10,10)+token(0,30,20));
  const states = [];
  const usage = createUsageReader({home,cachePath,onChange:state => {
    states.push(state);
    if (state.state !== 'loading') finish(state);
  }});
  t.after(() => usage.dispose());
  let finish;
  const result = new Promise(resolve => {finish = resolve;});
  usage.refresh(cutoff);
  usage.refresh(cutoff);
  usage.refresh(cutoff+1000);
  assert.deepEqual(split(await result),{state:'ready',before:30,after:null});
  assert.deepEqual(states.map(state => state.state),['loading','ready']);
});

test('splits output and today from the same deduplicated Codex events', async t => {
  const {sessions,full} = await fixture(t);
  await fs.writeFile(path.join(sessions,'rollout-output.jsonl'),
    token(-60,100,100,10,10)+token(0,160,60,25,15)+token(60,200,40,30,5));
  assert.deepEqual(await full(cutoff,cutoff+30_000),
    {state:'ready',before:100,after:100,today:40,todayOutput:5,afterOutput:20});
});
