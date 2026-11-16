const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const platformModule = require('../platform.cjs');
const {installHooks,removeHooks,installed,bridgeCurrent} = require('../codex-install.cjs');

// The Windows branches are plain flag checks, so they run on any host.
async function asWindows(run) {
  const before = platformModule.platform.windows;
  platformModule.platform.windows = true;
  try {
    return await run();
  } finally {
    platformModule.platform.windows = before;
  }
}

const temporary = () => fs.mkdtempSync(path.join(os.tmpdir(),'hamster-win-'));

test('Windows skips POSIX owner and mode checks', () => asWindows(() => {
  const stat = {uid:12345,mode:0o777};
  assert.equal(platformModule.ownedByCurrentUser(stat),true);
  assert.equal(platformModule.isPrivate(stat),true);
  assert.equal(platformModule.notWritableByOthers(stat),true);
  assert.equal(platformModule.isPrivateExecutable(stat),true);
}));

test('POSIX checks still reject loose permissions', () => {
  if (platformModule.platform.windows) return;
  assert.equal(platformModule.isPrivate({mode:0o755}),false);
  assert.equal(platformModule.notWritableByOthers({mode:0o775}),false);
  assert.equal(platformModule.isPrivateExecutable({mode:0o770}),false);
  assert.equal(platformModule.ownedByCurrentUser({uid:process.getuid()+1}),false);
});

test('Windows runtime directory lives under LOCALAPPDATA and the endpoint is a named pipe', () => asWindows(() => {
  const saved = process.env.LOCALAPPDATA;
  process.env.LOCALAPPDATA = 'C:\\Users\\Kim\\AppData\\Local';
  try {
    assert.equal(platformModule.runtimeDirectory(),path.join('C:\\Users\\Kim\\AppData\\Local','Hamster','run'));
  } finally {
    if (saved === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = saved;
  }
  assert.match(platformModule.endpoint(),/^\\\\\.\\pipe\\codex-hamster-[0-9a-f]{16}$/);
}));

test('Windows install writes a .cmd wrapper that runs the app executable as Node', () => asWindows(() => {
  const directory = temporary();
  const source = path.join(directory,'hook-bridge.cjs');
  fs.writeFileSync(source,'// bridge v1\n');
  const runtime = 'C:\\Program Files\\Hamster\\Hamster 100%.exe';
  try {
    installHooks(directory,source,'claude',runtime);
    const wrapper = path.join(directory,'hamster','ai-hook-v3.cmd');
    const text = fs.readFileSync(wrapper,'utf8');
    assert.match(text,/^@echo off\r\nset ELECTRON_RUN_AS_NODE=1\r\n/);
    assert.ok(text.includes('"C:\\Program Files\\Hamster\\Hamster 100%%.exe"'));
    assert.ok(text.includes(path.join(directory,'hamster','ai-hook-v3.cjs')));
    assert.ok(text.trimEnd().endsWith('%*'));
    assert.equal(fs.readFileSync(path.join(directory,'hamster','ai-hook-v3.cjs'),'utf8'),'// bridge v1\n');

    const {hooks} = JSON.parse(fs.readFileSync(path.join(directory,'settings.json'),'utf8'));
    const command = hooks.UserPromptSubmit[0].hooks[0].command;
    assert.equal(command,`"${wrapper}" claude`);
    assert.equal(hooks.UserPromptSubmit[0].hooks[0].timeout,3);
    assert.equal(installed(directory,'claude'),true);
    assert.equal(bridgeCurrent(directory,'claude'),true);

    removeHooks(directory,'claude');
    assert.equal(installed(directory,'claude'),false);
  } finally {
    fs.rmSync(directory,{recursive:true,force:true});
  }
}));

test('Windows reinstall repairs the wrapper when the executable moved and keeps one hook entry', () => asWindows(() => {
  const directory = temporary();
  const source = path.join(directory,'hook-bridge.cjs');
  fs.writeFileSync(source,'// bridge\n');
  try {
    installHooks(directory,source,'codex','C:\\Old\\Hamster.exe');
    installHooks(directory,source,'codex','C:\\New\\Hamster.exe');
    const wrapper = fs.readFileSync(path.join(directory,'hamster','codex-hook-v2.cmd'),'utf8');
    assert.ok(wrapper.includes('C:\\New\\Hamster.exe'));
    assert.equal(wrapper.includes('C:\\Old'),false);
    const {hooks} = JSON.parse(fs.readFileSync(path.join(directory,'hooks.json'),'utf8'));
    assert.equal(hooks.Stop.length,1);
  } finally {
    fs.rmSync(directory,{recursive:true,force:true});
  }
}));
