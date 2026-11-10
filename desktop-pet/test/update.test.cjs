const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {test} = require('node:test');
const {findUpdate,updateInProgress} = require('../updater.cjs');

async function writeBundle(bundle) {
  const contents = path.join(bundle,'Contents');
  await fs.mkdir(path.join(contents,'MacOS'),{recursive:true});
  await fs.writeFile(path.join(contents,'Info.plist'),'test fixture');
  await fs.writeFile(path.join(contents,'MacOS','Electron'),'test fixture');
}

test('a manual check finds the newest complete local patch, without downgrading', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'hamster-releases-'));
  t.after(() => fs.rm(root,{recursive:true,force:true}));
  const releases = path.join(root,'updates');
  const installed = path.join(root,'Hamster.app');
  for (const version of ['1.0.2','1.0.9','1.0.10','2.0.0-beta']) {
    await writeBundle(path.join(releases,version,'Hamster.app'));
  }
  await fs.mkdir(path.join(releases,'1.0.99','Hamster.app'),{recursive:true});
  assert.deepEqual(await findUpdate(installed,'1.0.3'),{
    version:'1.0.10',bundle:path.join(releases,'1.0.10','Hamster.app'),
  });
  assert.equal(await findUpdate(installed,'1.0.10'),undefined);
});

test('only the updater-designated launch can enter while the worker owns the handoff', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'hamster-handoff-'));
  t.after(() => fs.rm(root,{recursive:true,force:true}));
  const stage = await fs.mkdtemp(path.join(root,'.hamster-update-'));
  await fs.writeFile(path.join(stage,'handoff'),String(process.pid));
  const app = path.join(root,'Hamster.app');
  assert.equal(updateInProgress(app),true);
  assert.equal(updateInProgress(app,path.join(stage,'ready')),false);
  await fs.unlink(path.join(stage,'handoff'));
  assert.equal(updateInProgress(app),false);
});

test('availability refreshes in the background and clears a removed or unreadable release', async () => {
  const {createUpdateMonitor} = require('../updater.cjs');
  const release = {version:'1.0.7',bundle:'/local/updates/1.0.7/Hamster.app'};
  let available = release;
  let fail = false;
  const changes = [];
  const monitor = createUpdateMonitor(async () => {
    if (fail) throw new Error('unreadable');
    return available;
  },state => changes.push(state));
  assert.deepEqual(monitor.state,{kind:'checking'});
  await monitor.refresh();
  await monitor.refresh();
  assert.deepEqual(changes,[{kind:'available',update:release}]);
  available = undefined;
  await monitor.refresh();
  assert.deepEqual(monitor.state,{kind:'current'});
  fail = true;
  await monitor.refresh();
  assert.deepEqual(monitor.state,{kind:'unavailable'});
  fail = false;
  available = release;
  await monitor.refresh();
  assert.deepEqual(monitor.state,{kind:'available',update:release});
});

test('opening the menu and a periodic refresh share one in-flight update scan', async () => {
  const {createUpdateMonitor} = require('../updater.cjs');
  let resolve, calls = 0;
  const scan = new Promise(done => {resolve = done;});
  const monitor = createUpdateMonitor(() => {calls++; return scan;});
  const first = monitor.refresh();
  assert.equal(monitor.refresh(),first);
  resolve(undefined);
  await first;
  assert.equal(calls,1);
  assert.deepEqual(monitor.state,{kind:'current'});
});

test('skips a release removed during the scan and keeps a complete older candidate', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'hamster-release-race-'));
  t.after(() => fs.rm(root,{recursive:true,force:true}));
  const installed = path.join(root,'Hamster.app');
  const releases = path.join(root,'updates');
  const previous = path.join(releases,'1.0.7','Hamster.app');
  const disappearing = path.join(releases,'1.0.8');
  await writeBundle(previous);
  await writeBundle(path.join(disappearing,'Hamster.app'));
  const lstat = fs.lstat;
  t.mock.method(fs,'lstat',async filename => {
    if (filename === disappearing) await fs.rm(disappearing,{recursive:true,force:true});
    return lstat(filename);
  });
  assert.deepEqual(await findUpdate(installed,'1.0.6'),{version:'1.0.7',bundle:previous});
});
