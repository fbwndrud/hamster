const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const {spawn} = require('node:child_process');
const test = require('node:test');
const {eventEndpoint,signalFor,run} = require('../hook-bridge.cjs');

const sha = parts => createHash('sha256').update(JSON.stringify(parts)).digest('hex');

test('endpoint is a per-user named pipe on Windows and the private socket on macOS', () => {
  const pipe = eventEndpoint({windows:true,username:'Alice'});
  assert.match(pipe,/^\\\\\.\\pipe\\codex-hamster-[0-9a-f]{16}$/);
  assert.equal(pipe,eventEndpoint({windows:true,username:'ALICE'}));
  assert.notEqual(pipe,eventEndpoint({windows:true,username:'bob'}));
  assert.equal(eventEndpoint({windows:false,uid:501}),'/private/tmp/codex-hamster-501/events.sock');
});

test('codex messages hash session and turn like the Swift bridge', () => {
  const message = signalFor('codex',{hook_event_name:'UserPromptSubmit',session_id:'s1',turn_id:'t1',prompt:'secret'});
  assert.deepEqual(message,{provider:'codex',type:'submitted',id:sha(['s1','t1']),scope:sha(['codex','s1'])});
  assert.equal(JSON.stringify(message).includes('secret'),false);
});

test('hashes match the Swift bridge for ids with slashes (value captured from codex-hook.swift)', () => {
  const message = signalFor('claude',{hook_event_name:'UserPromptSubmit',session_id:'a/b',prompt_id:'p1'});
  assert.equal(message.scope,'5ca6ea53c682b8f958ea2dd49b37f3af4c8ec6d9d8bc1a53181dddd58691663d');
  assert.equal(message.id,'77933c097f0c10428042b02d5a9cf3b069ff07ecf17cff96d9ca28a3b53e6a53');
});

test('missing turn ids make a reusable message and claude submissions supersede', () => {
  const message = signalFor('claude',{hook_event_name:'UserPromptSubmit',session_id:'s1'});
  assert.deepEqual(message,{provider:'claude',type:'submitted',id:sha(['claude','s1','s1']),
    scope:sha(['claude','s1']),reusable:true,supersede:true});
});

test('session end reports the scope as its id', () => {
  const message = signalFor('gemini',{hook_event_name:'SessionEnd',session_id:'s1',prompt_id:'p1'});
  assert.equal(message.type,'sessionEnded');
  assert.equal(message.id,message.scope);
});

test('cursor uses conversation and generation ids and non-completed stops interrupt', () => {
  const message = signalFor('cursor',{hook_event_name:'stop',conversation_id:'c1',generation_id:'g1',status:'aborted'});
  assert.equal(message.type,'interrupted');
  assert.equal(message.id,sha(['cursor','c1','g1']));
  assert.equal(signalFor('cursor',{hook_event_name:'stop',conversation_id:'c1',status:'completed'}).type,'finished');
});

test('grok filters subagents, secondary stops, and non-idle notifications', () => {
  const base = {session_id:'ignored',sessionId:'g1',promptId:'p1'};
  assert.equal(signalFor('grok',{...base,hook_event_name:'Stop',reason:'end_turn',subagentType:'x'}),undefined);
  assert.equal(signalFor('grok',{...base,hook_event_name:'Stop',reason:'session_end'}),undefined);
  assert.equal(signalFor('grok',{...base,hook_event_name:'Stop',reason:'end_turn'}).type,'finished');
  assert.equal(signalFor('grok',{...base,hook_event_name:'Notification',notificationType:'other'}),undefined);
  assert.equal(signalFor('grok',{...base,hook_event_name:'Notification',notification_type:'idle_prompt'}).type,'sessionEnded');
});

test('claude and cursor helpers ignore events that Grok also runs', () => {
  assert.equal(signalFor('claude',{hook_event_name:'Stop',session_id:'s1',hookEventName:'Stop'}),undefined);
  assert.equal(signalFor('cursor',{hook_event_name:'stop',conversation_id:'c1',hookEventName:'stop'}),undefined);
});

test('unknown events, missing sessions and wrong types are not reported', () => {
  assert.equal(signalFor('codex',{hook_event_name:'PreToolUse',session_id:'s1'}),undefined);
  assert.equal(signalFor('codex',{hook_event_name:'Stop'}),undefined);
  assert.equal(signalFor('codex',{hook_event_name:'Stop',session_id:''}),undefined);
  assert.equal(signalFor('codex',{hook_event_name:'Stop',session_id:5}),undefined);
  assert.equal(signalFor('codex',{session_id:'s1'}),undefined);
  assert.equal(signalFor('nobody',{hook_event_name:'Stop',session_id:'s1'}),undefined);
});

test('run delivers one line and returns the tool-specific output', async () => {
  const sent = [];
  const deliver = async (endpoint,payload) => sent.push({endpoint,payload});
  const input = Buffer.from(JSON.stringify({hook_event_name:'beforeSubmitPrompt',conversation_id:'c1'}));
  assert.equal(await run({provider:'cursor',input,endpoint:'E',deliver}),'{"continue":true}');
  assert.equal(sent.length,1);
  assert.equal(sent[0].endpoint,'E');
  assert.equal(sent[0].payload.endsWith('\n'),true);
  assert.equal(JSON.parse(sent[0].payload).provider,'cursor');

  const stop = Buffer.from(JSON.stringify({hook_event_name:'stop',conversation_id:'c1',status:'completed'}));
  assert.equal(await run({provider:'cursor',input:stop,deliver}),'{}');
  assert.equal(await run({provider:'codex',input:Buffer.from('not json'),deliver}),'{}');
  assert.equal(await run({provider:'codex',deliver}),'{}');
  assert.equal(sent.length,2);
});

test('the CLI sends to the pipe or socket and exits 0 even with nobody listening', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'hamster-bridge-'));
  const socketPath = path.join(directory,'events.sock');
  const received = [];
  const server = net.createServer(connection => {
    let text = '';
    connection.on('data',chunk => text += chunk);
    connection.on('end',() => received.push(text));
  });
  try {
    await new Promise(resolve => server.listen(socketPath,resolve));
    const script = `process.argv[1]='x';const b=require(${JSON.stringify(path.join(__dirname,'..','hook-bridge.cjs'))});` +
      `let d='';process.stdin.on('data',c=>d+=c).on('end',async()=>{process.stdout.write(await b.run({provider:'codex',` +
      `input:Buffer.from(d),endpoint:${JSON.stringify(socketPath)}})+'\\n')})`;
    const child = spawn(process.execPath,['-e',script]);
    let output = '';
    child.stdout.on('data',chunk => output += chunk);
    child.stdin.end(JSON.stringify({hook_event_name:'Stop',session_id:'s1',turn_id:'t1'}));
    await new Promise(resolve => child.on('close',resolve));
    await new Promise(resolve => setTimeout(resolve,100));
    assert.equal(output,'{}\n');
    assert.equal(JSON.parse(received[0]).type,'finished');

    // Never use the default endpoint here: on a developer Mac it is the running pet's socket.
    const missing = path.join(directory,'missing.sock');
    assert.equal(await run({provider:'codex',endpoint:missing,
      input:Buffer.from(JSON.stringify({hook_event_name:'Stop',session_id:'s1'}))}),'{}');
    const pipeless = await Promise.race([
      require('../hook-bridge.cjs').send(missing,'x\n'),
      new Promise(resolve => setTimeout(() => resolve('hung'),1000)),
    ]);
    assert.equal(pipeless,undefined);
  } finally {
    server.close();
    fs.rmSync(directory,{recursive:true,force:true});
  }
});
