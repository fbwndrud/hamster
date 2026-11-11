const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {test} = require('node:test');
const {installHooks, removeHooks, installed, bridgeCurrent} = require('../codex-install.cjs');

test('user hooks can be installed twice and removed without touching other commands', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "hamster user's codex-"));
  t.after(() => fs.rmSync(directory,{recursive:true,force:true}));
  const config = path.join(directory,'hooks.json');
  const source = path.join(directory,'fixture');
  fs.writeFileSync(source,'mock executable');
  const initial = {description:'Personal',hooks:{
    Stop:[{hooks:[{type:'command',command:'echo existing'}]}],
    SessionStart:[{hooks:[{type:'command',command:'echo startup'}]}],
  }};
  fs.writeFileSync(config,JSON.stringify(initial),{mode:0o600});
  installHooks(directory,source);
  const contents = fs.readFileSync(config,'utf8');
  const loaded = JSON.parse(contents);
  const command = loaded.hooks.UserPromptSubmit[0].hooks[0].command;
  assert.ok(command.includes("'\\''"));
  assert.equal(loaded.hooks.Stop[1].hooks[0].command,command);
  assert.equal(loaded.hooks.Interrupt[0].hooks[0].command,command);
  assert.equal(fs.statSync(path.join(directory,'hamster','codex-hook-v2')).mode & 0o777,0o700);
  assert.equal(installed(directory),true);
  assert.equal(bridgeCurrent(directory),true);
  installHooks(directory,source);
  assert.equal(fs.readFileSync(config,'utf8'),contents);
  removeHooks(directory);
  assert.equal(installed(directory),false);
  assert.deepEqual(JSON.parse(fs.readFileSync(config,'utf8')),initial);
});

test('installation refuses malformed existing hook config', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'hamster-codex-invalid-'));
  t.after(() => fs.rmSync(directory,{recursive:true,force:true}));
  const config = path.join(directory,'hooks.json');
  fs.writeFileSync(config,'invalid config');
  assert.throws(() => installHooks(directory,'unused'));
  assert.equal(fs.readFileSync(config,'utf8'),'invalid config');
});

test('provider installers preserve settings and write their native hook schemas', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'hamster-providers-'));
  t.after(() => fs.rmSync(root,{recursive:true,force:true}));
  const source = path.join(root,'fixture');
  fs.writeFileSync(source,'mock executable');
  for (const [provider,file,event,timeout,version] of [
    ['claude','settings.json','UserPromptSubmit',1,3],
    ['cursor','hooks.json','beforeSubmitPrompt',1,3],
    ['gemini','settings.json','BeforeAgent',1000,2],
  ]) {
    const directory = path.join(root,provider);
    fs.mkdirSync(directory);
    const config = path.join(directory,file);
    const original = provider === 'cursor' ? {version:1,hooks:{}} : {theme:'dark',hooks:{}};
    fs.writeFileSync(config,JSON.stringify(original));
    installHooks(directory,source,provider);
    const document = JSON.parse(fs.readFileSync(config,'utf8'));
    const entry = document.hooks[event][0];
    const hook = provider === 'cursor' ? entry : entry.hooks[0];
    assert.ok(hook.command.endsWith(`/ai-hook-v${version}' ${provider}`));
    assert.equal(hook.timeout,timeout);
    removeHooks(directory,provider);
    assert.deepEqual(JSON.parse(fs.readFileSync(config,'utf8')),original);
  }
});

for (const [provider, file, events, version] of [
  ['codex','hooks.json',['UserPromptSubmit','Stop','Interrupt'],2],
  ['cursor','hooks.json',['beforeSubmitPrompt','stop','sessionEnd'],3],
]) {
  test(`${provider} migration preserves the trusted executable and other hooks`, t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(),'hamster-migrate-'));
    t.after(() => fs.rmSync(directory,{recursive:true,force:true}));
    const config = path.join(directory,file);
    const source = path.join(directory,'fixture');
    const flat = provider === 'cursor';
    const base = path.join(directory,'hamster',flat ? 'ai-hook' : 'codex-hook');
    const legacy = base+'-v1';
    const current = base+'-v'+version;
    const argument = flat ? ' cursor' : '';
    const command = `'${legacy}'${argument}`;
    const personal = {type:'command',command:'echo personal'};
    const oldHook = {type:'command',command};
    const mixed = flat ? [personal,oldHook] : [{matcher:'*',hooks:[personal,oldHook]}];
    const oldOnly = flat ? [oldHook] : [{hooks:[oldHook]}];
    const untouched = flat ? [personal] : [{matcher:'*',hooks:[personal]}];
    const unrelated = flat ? [oldHook] : [{hooks:[oldHook]}];
    const settings = flat ? {version:1} : {description:'Personal'};
    fs.mkdirSync(path.dirname(base),{mode:0o700});
    fs.writeFileSync(legacy,'trusted v1',{mode:0o700});
    fs.writeFileSync(source,'updated v2');
    fs.writeFileSync(config,JSON.stringify({...settings,hooks:{
      [events[0]]:mixed,[events[1]]:oldOnly,[events[2]]:oldOnly,unmanaged:unrelated,
    }}));

    assert.equal(installed(directory,provider),true);
    assert.equal(bridgeCurrent(directory,provider),false);
    installHooks(directory,source,provider);

    assert.equal(fs.readFileSync(legacy,'utf8'),'trusted v1');
    assert.equal(fs.readFileSync(current,'utf8'),'updated v2');
    const contents = fs.readFileSync(config,'utf8');
    const {hooks} = JSON.parse(contents);
    assert.deepEqual(hooks[events[0]].slice(0,-1),untouched);
    assert.deepEqual(hooks.unmanaged,unrelated);
    for (const event of events) {
      const entries = flat ? hooks[event] : hooks[event].flatMap(group => group.hooks);
      assert.equal(entries.some(hook => hook.command === command),false);
      assert.equal(entries.filter(hook => hook.command === `'${current}'${argument}`).length,1);
    }
    assert.equal(installed(directory,provider),true);
    assert.equal(bridgeCurrent(directory,provider),true);
    installHooks(directory,source,provider);
    assert.equal(fs.readFileSync(config,'utf8'),contents);

    hooks[events[1]].push(...oldOnly);
    fs.writeFileSync(config,JSON.stringify({...settings,hooks}));
    removeHooks(directory,provider);
    assert.deepEqual(JSON.parse(fs.readFileSync(config,'utf8')),
      {...settings,hooks:{[events[0]]:untouched,unmanaged:unrelated}});
  });
}

test('Grok gets its own hook file with the idle backstop, and removal keeps the file valid', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'hamster-grok-'));
  t.after(() => fs.rmSync(directory,{recursive:true,force:true}));
  const source = path.join(directory,'fixture');
  fs.writeFileSync(source,'mock executable');
  installHooks(directory,source,'grok');
  const config = path.join(directory,'hooks','hamster.json');
  const {hooks} = JSON.parse(fs.readFileSync(config,'utf8'));
  assert.deepEqual(Object.keys(hooks),['UserPromptSubmit','Stop','StopFailure','StopCancelled','SessionEnd','Notification']);
  assert.equal(hooks.Notification[0].matcher,'idle_prompt');
  assert.equal(hooks.Stop[0].matcher,undefined);
  assert.ok(hooks.Stop[0].hooks[0].command.endsWith("/hamster/ai-hook-v3' grok"));
  assert.equal(installed(directory,'grok'),true);
  assert.equal(bridgeCurrent(directory,'grok'),true);
  removeHooks(directory,'grok');
  assert.deepEqual(JSON.parse(fs.readFileSync(config,'utf8')),{hooks:{}});
  assert.equal(installed(directory,'grok'),false);
});

test('a Claude v2 hook still counts as installed but asks for the v3 update', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'hamster-claude-v2-'));
  t.after(() => fs.rmSync(directory,{recursive:true,force:true}));
  const helper = path.join(directory,'hamster','ai-hook-v2');
  fs.mkdirSync(path.dirname(helper),{mode:0o700});
  fs.writeFileSync(helper,'trusted v2',{mode:0o700});
  const hook = {type:'command',command:`'${helper}' claude`};
  const events = ['UserPromptSubmit','Stop','StopFailure','SessionEnd'];
  fs.writeFileSync(path.join(directory,'settings.json'),JSON.stringify({hooks:Object.fromEntries(events.map(event => [event,[{hooks:[hook]}]]))}));
  assert.equal(installed(directory,'claude'),true);
  assert.equal(bridgeCurrent(directory,'claude'),false);
  const source = path.join(directory,'fixture');
  fs.writeFileSync(source,'v3');
  installHooks(directory,source,'claude');
  const {hooks} = JSON.parse(fs.readFileSync(path.join(directory,'settings.json'),'utf8'));
  for (const event of events) assert.deepEqual(hooks[event].map(group => group.hooks[0].command),[`'${path.join(directory,'hamster','ai-hook-v3')}' claude`]);
  assert.equal(bridgeCurrent(directory,'claude'),true);
});
