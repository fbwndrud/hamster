const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {test} = require('node:test');
const {scanToolUsage} = require('../tool-usage.cjs');

const cutoff = Date.parse('2026-11-11T12:00:00Z');
const at = seconds => new Date(cutoff+seconds*1000).toISOString();

async function fixture(t, provider) {
  const home = await fs.mkdtemp(path.join(os.tmpdir(),`hamster-${provider}-usage-`));
  t.after(() => fs.rm(home,{recursive:true,force:true}));
  const cachePath = path.join(home,'data','usage.json');
  return {home,cachePath,scan:(since = cutoff,dayStart = Infinity) => scanToolUsage(provider,{home,cachePath,since,dayStart})};
}

const claude = (seconds, id, {input = 2, created = 0, read = 0, output}) => JSON.stringify({
  type:'assistant',timestamp:at(seconds),message:{id,role:'assistant',content:[{type:'text',text:'private answer'}],
    usage:{input_tokens:input,cache_creation_input_tokens:created,cache_read_input_tokens:read,output_tokens:output}},
})+'\n';

test('Claude Code counts each response once across content blocks, resumed copies and subagents', async t => {
  const {home,cachePath,scan} = await fixture(t,'claude');
  const project = path.join(home,'projects','-Users-me-app');
  await fs.mkdir(path.join(project,'session-a','subagents'),{recursive:true});
  const first = claude(-10,'msg_1',{input:5,created:100,read:1000,output:20});
  const second = claude(10,'msg_2',{input:1,read:2000,output:40});
  const user = JSON.stringify({type:'user',message:{content:'private prompt with "usage" and "assistant"'}})+'\n';
  await fs.writeFile(path.join(project,'session-a.jsonl'),user+first+first+second+second+second);
  // A resumed session copies earlier responses into a new file.
  await fs.writeFile(path.join(project,'session-b.jsonl'),first+second);
  await fs.writeFile(path.join(project,'session-a','subagents','agent-1.jsonl'),claude(20,'msg_3',{output:7}));
  assert.deepEqual(await scan(cutoff,cutoff+15_000),
    {state:'ready',before:1125,after:2050,today:9,todayOutput:7,afterOutput:47});
  assert.equal((await fs.readFile(cachePath,'utf8')).includes('private'),false);
  await fs.appendFile(path.join(project,'session-a.jsonl'),claude(30,'msg_4',{output:1}));
  assert.equal((await scan()).after,2053);
});

test('a malformed Claude Code usage line is reported instead of counted as zero', async t => {
  const {home,scan} = await fixture(t,'claude');
  const project = path.join(home,'projects','p');
  await fs.mkdir(project,{recursive:true});
  await fs.writeFile(path.join(project,'s.jsonl'),claude(0,'msg_1',{output:'many'})+claude(1,'msg_2',{output:3}));
  assert.deepEqual(await scan(),{state:'ready',before:null,after:5,today:null,todayOutput:null,afterOutput:3,partial:true});
});

const gemini = (seconds, id, total, output, thoughts = 0) =>
  ({id,timestamp:at(seconds),type:'gemini',content:'private answer',tokens:{input:total-output-thoughts,output,cached:0,thoughts,total}});

test('Gemini CLI counts rewritten and rewound messages once, in JSONL and legacy JSON sessions', async t => {
  const {home,scan} = await fixture(t,'gemini');
  const chats = path.join(home,'tmp','project-hash','chats');
  await fs.mkdir(path.join(chats,'parent-session'),{recursive:true});
  const lines = [
    {sessionId:'s1',projectHash:'p',startTime:at(-30),messages:[]},
    {id:'u1',timestamp:at(-20),type:'user',content:'private prompt "tokens"'},
    gemini(-10,'g1',100,10,5),
    {...gemini(-10,'g1',100,10,5),toolCalls:[{id:'t1'}]},
    {$patch:{id:'g1',content:'edited'}},
    gemini(10,'g2',300,30),
    {$rewindTo:'g2'},
    {$set:{messages:[gemini(-10,'g1',100,10,5)]}},
  ];
  await fs.writeFile(path.join(chats,'session-2026-11-11T12-00-abcd1234.jsonl'),lines.map(line => JSON.stringify(line)).join('\n')+'\n');
  await fs.writeFile(path.join(chats,'parent-session','child.jsonl'),JSON.stringify(gemini(20,'g3',50,5))+'\n');
  await fs.writeFile(path.join(chats,'session-old.json'),JSON.stringify({sessionId:'s0',messages:[gemini(-40,'g0',70,7)]},null,2));
  // Files outside chats are not conversations.
  await fs.writeFile(path.join(home,'tmp','project-hash','logs.jsonl'),JSON.stringify(gemini(0,'gx',999,9))+'\n');
  assert.deepEqual(await scan(),{state:'ready',before:170,after:350,today:null,todayOutput:null,afterOutput:35});
});

test('Grok counts each turn in usage.json once and reads a rewritten file again', async t => {
  const {home,scan} = await fixture(t,'grok');
  const session = path.join(home,'sessions','%2FUsers%2Fme','session-1');
  await fs.mkdir(session,{recursive:true});
  const turn = (number, seconds, total, output) => ({turnNumber:number,endedAt:at(seconds),inputTokens:total-output,
    outputTokens:output,cachedReadTokens:0,reasoningTokens:0,totalTokens:total});
  const usage = turns => fs.writeFile(path.join(session,'usage.json'),JSON.stringify({sessionId:'s1',session:{},turns}));
  await usage([turn(1,-10,1000,50)]);
  assert.deepEqual(await scan(),{state:'ready',before:1000,after:null,today:null,todayOutput:null,afterOutput:null});
  await usage([turn(1,-10,1000,50),turn(2,10,4000,70)]);
  assert.deepEqual(await scan(cutoff,cutoff),{state:'ready',before:1000,after:4000,today:4000,todayOutput:70,afterOutput:70});
  await fs.writeFile(path.join(session,'usage.json'),'{"sessionId":"s1","turns":"changed format"}');
  assert.deepEqual(await scan(),{state:'unsupported',before:null,after:null,today:null,todayOutput:null,afterOutput:null,partial:true});
});
