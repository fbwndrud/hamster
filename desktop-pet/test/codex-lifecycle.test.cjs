const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {createMotionState} = require('../motion-state.cjs');
const {codexTerminals,claudeTerminals} = require('../codex-lifecycle.cjs');

test('a failed scheduled Codex turn without a Stop hook no longer stays active', async t => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(),'hamster-lifecycle-'));
  t.after(() => fs.rm(home,{recursive:true,force:true}));
  const session = '0198111e-3453-7c83-a527-000000000001';
  const other = '0198111e-3453-7c83-a527-000000000002';
  const directory = path.join(home,'sessions','2026','11','07');
  await fs.mkdir(directory,{recursive:true});
  const hash = parts => createHash('sha256').update(JSON.stringify(parts)).digest('hex');
  const scope = hash(['codex',session]);
  const failed = hash([session,'failed-turn']);
  const running = hash([session,'running-turn']);
  const otherTurn = hash([other,'failed-turn']);
  const state = createMotionState(() => {});
  t.after(state.dispose);
  state.event('submitted',failed,{scope,provider:'codex'});
  state.event('submitted',running,{scope,provider:'codex'});
  state.event('submitted',otherTurn,{scope:hash(['codex',other]),provider:'codex'});
  const line = (type,turn_id,extra = {}) => JSON.stringify({
    type:'event_msg',payload:{type,turn_id,...extra},
  });
  const filename = path.join(directory,'rollout-2026-11-07T00-00-00-'+session+'_'+other+'.jsonl');
  await fs.writeFile(filename,[
    line('task_complete','failed-turn',{error:{}}),
    line('task_complete','running-turn',{root_turn_id:'different-root'}),
    line('task_complete','running-turn'),
  ].join('\n'));
  for (const {type,id} of await codexTerminals(home,state.activeTurns('codex'))) state.event(type,id);
  assert.equal(state.activeCount,2);
  assert.deepEqual(state.activeTurns('codex').map(turn => turn.id),[running,otherTurn]);
  await fs.appendFile(filename,'\n');
  assert.deepEqual(await codexTerminals(home,state.activeTurns('codex')),[{id:running,type:'finished'}]);
});

test('an interrupted Claude Code turn leaves work from its transcript marker', async t => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(),'hamster-claude-lifecycle-'));
  t.after(() => fs.rm(home,{recursive:true,force:true}));
  const session = '71f156a1-f997-4bde-a92b-000000000001';
  const quiet = '71f156a1-f997-4bde-a92b-000000000002';
  const directory = path.join(home,'projects','-Users-me-project');
  await fs.mkdir(path.join(directory,session,'subagents'),{recursive:true});
  const hash = parts => createHash('sha256').update(JSON.stringify(parts)).digest('hex');
  let now = Date.parse('2026-11-10T03:00:00.000Z');
  const state = createMotionState(() => {},{clock:() => now});
  t.after(state.dispose);
  const interrupted = hash(['claude',session,'prompt-1']);
  const waiting = hash(['claude',quiet,'prompt-1']);
  state.event('submitted',interrupted,{scope:hash(['claude',session]),provider:'claude',supersede:true});
  state.event('submitted',waiting,{scope:hash(['claude',quiet]),provider:'claude',supersede:true});
  const line = (record) => JSON.stringify({sessionId:session,timestamp:'2026-11-10T03:00:05.000Z',...record});
  const marker = (text,extra = {}) => line({type:'user',isSidechain:false,promptId:'prompt-1',
    message:{role:'user',content:[{type:'text',text}]},...extra});
  const filename = path.join(directory,session+'.jsonl');
  await fs.writeFile(filename,[
    line({type:'user',promptId:'prompt-1',message:{role:'user',content:'quote [Request interrupted by user]'}}),
    marker('[Request interrupted by user]',{isSidechain:true}),
  ].join('\n')+'\n');
  await fs.writeFile(path.join(directory,session,'subagents','agent-1.jsonl'),marker('[Request interrupted by user]')+'\n');
  await fs.writeFile(path.join(directory,quiet+'.jsonl'),
    line({type:'assistant',message:{role:'assistant',content:[{type:'text',text:'[Request interrupted by user]'}]}})+'\n');
  assert.deepEqual(await claudeTerminals(home,state.activeTurns('claude')),[]);

  await fs.appendFile(filename,marker('[Request interrupted by user for tool use]')+'\n');
  for (const {type,id} of await claudeTerminals(home,state.activeTurns('claude'))) state.event(type,id);
  assert.deepEqual(state.activeTurns('claude').map(turn => turn.id),[waiting]);
  assert.equal(state.working,true);
  assert.deepEqual(await codexTerminals(home,state.activeTurns('codex')),[]);
});

test('an old Claude Code interrupt does not end the next prompt in that session', async t => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(),'hamster-claude-lifecycle-'));
  t.after(() => fs.rm(home,{recursive:true,force:true}));
  const session = '71f156a1-f997-4bde-a92b-000000000003';
  const directory = path.join(home,'projects','-Users-me-project');
  await fs.mkdir(directory,{recursive:true});
  const hash = parts => createHash('sha256').update(JSON.stringify(parts)).digest('hex');
  const scope = hash(['claude',session]);
  let now = Date.parse('2026-11-10T03:00:00.000Z');
  const state = createMotionState(() => {},{clock:() => now});
  t.after(state.dispose);
  const marker = (promptId,timestamp) => JSON.stringify({type:'user',isSidechain:false,promptId,timestamp,
    sessionId:session,message:{role:'user',content:[{type:'text',text:'[Request interrupted by user]'}]}});
  const filename = path.join(directory,session+'.jsonl');
  await fs.writeFile(filename,marker('prompt-1','2026-11-10T03:00:05.000Z')+'\n');

  now = Date.parse('2026-11-10T03:00:10.000Z');
  const next = hash(['claude',session,'prompt-2']);
  state.event('submitted',next,{scope,provider:'claude',supersede:true});
  assert.deepEqual(await claudeTerminals(home,state.activeTurns('claude')),[]);

  // A turn without a prompt ID still ends when the marker is newer than its start.
  const reusable = hash(['claude',session,session]);
  state.event('submitted',reusable,{scope,provider:'claude',reusable:true,supersede:true});
  await fs.appendFile(filename,marker('prompt-3','2026-11-10T03:00:12.000Z')+'\n');
  assert.deepEqual(await claudeTerminals(home,state.activeTurns('claude')),[{id:reusable,type:'interrupted'}]);
});
