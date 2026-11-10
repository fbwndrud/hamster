const fs = require('node:fs/promises');
const sync = require('node:fs');
const path = require('node:path');
const {execFile,spawn} = require('node:child_process');
const {once} = require('node:events');
const {promisify} = require('node:util');

const run = promisify(execFile);
const versionPattern = /^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$/;
const appId = 'local.codex.hamster';

function compare(left, right) {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  return a[0]-b[0] || a[1]-b[1] || a[2]-b[2];
}

const matchesArch = (description, arch = process.arch) => description.includes(arch === 'arm64' ? 'arm64' : 'x86_64');

async function localDirectory(directory) {
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.uid !== process.getuid() || (stat.mode & 0o022)) {
    throw new Error('The update folder must be a local directory writable only by its owner.');
  }
}

async function findUpdate(installed, current) {
  if (!versionPattern.test(current)) throw new Error('Invalid installed version.');
  const root = path.join(path.dirname(installed),'updates');
  let entries;
  try {
    await localDirectory(root);
    entries = await fs.readdir(root,{withFileTypes:true});
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  const versions = entries.filter(entry => entry.isDirectory() && versionPattern.test(entry.name) && compare(entry.name,current)>0)
    .map(entry => entry.name).sort((a,b) => compare(b,a));
  for (const version of versions) {
    const directory = path.join(root,version);
    const bundle = path.join(directory,'Hamster.app');
    try {
      await localDirectory(directory);
      await localDirectory(bundle);
      const contents = path.join(bundle,'Contents');
      const [plist,executable] = await Promise.all([
        fs.lstat(path.join(contents,'Info.plist')),
        fs.lstat(path.join(contents,'MacOS','Electron')),
      ]);
      if (plist.isFile() && executable.isFile()) return {version,bundle};
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

// Scanning the updates folder is opt-in: those bundles are not checked against any release key, so only a marker file
// in the app's private data directory (made by the maintainer) turns it on.
async function localUpdatesEnabled(marker) {
  try {
    const stat = await fs.lstat(marker);
    return stat.isFile() && stat.uid === process.getuid();
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return false;
    throw error;
  }
}

async function findLocalUpdate(installed, current, marker) {
  if (await localUpdatesEnabled(marker)) return findUpdate(installed,current);
}

// A signed remote update wins a tie; a local build only wins when it is strictly newer.
// A broken local folder only matters without a remote offer.
async function pickUpdate(findLocal, remote) {
  let local;
  try {
    local = await findLocal();
  } catch (error) {
    if (!remote) throw error;
  }
  return local && (!remote || compare(local.version,remote.version) > 0) ? local : remote;
}

function createUpdateMonitor(find, onChange = () => {}) {
  let state = {kind:'checking'};
  let pending;
  function publish(next) {
    if (state.kind !== next.kind || state.update?.version !== next.update?.version ||
        state.update?.bundle !== next.update?.bundle || state.update?.remote?.sha256 !== next.update?.remote?.sha256) {
      state = next;
      onChange(state);
    }
    return state;
  }
  function refresh() {
    if (pending) return pending;
    pending = Promise.resolve().then(find).then(
      update => publish(update ? {kind:'available',update} : {kind:'current'}),
      () => publish({kind:'unavailable'}),
    ).finally(() => {pending = undefined;});
    return pending;
  }
  return {refresh,get state() {return state;}};
}

async function launchUpdate(installed, update, helper) {
  const stage = await fs.mkdtemp(path.join(path.dirname(installed),'.hamster-update-'));
  const stagedApp = path.join(stage,'Hamster.app');
  const worker = path.join(stage,'update-mac');
  let child;
  try {
    await run('/usr/bin/ditto',[update.bundle,stagedApp]);
    const plist = path.join(stagedApp,'Contents','Info.plist');
    const executable = path.join(stagedApp,'Contents','MacOS','Electron');
    const [version,arch] = await Promise.all([
      run('/usr/libexec/PlistBuddy',['-c','Print CFBundleShortVersionString',plist]),
      run('/usr/bin/file',['-b',executable]),
      run('/usr/bin/codesign',['--verify','--deep','--strict','-R=identifier "'+appId+'"',stagedApp]),
    ]);
    if (version.stdout.trim() !== update.version) throw new Error('Update bundle version does not match its release folder.');
    if (!matchesArch(arch.stdout)) {
      throw new Error('Update bundle is for a different Mac architecture.');
    }
    await fs.copyFile(helper,worker);
    await fs.chmod(worker,0o700);
    child = spawn(worker,[String(process.pid),installed],{detached:true,stdio:'ignore'});
    await once(child,'spawn');
    await fs.writeFile(path.join(stage,'handoff'),String(child.pid),{flag:'wx',mode:0o600});
    child.unref();
  } catch (error) {
    if (child?.pid) child.kill();
    await fs.rm(stage,{recursive:true,force:true});
    throw error;
  }
}

function updateInProgress(installed, ready) {
  const parent = path.dirname(installed);
  return sync.readdirSync(parent,{withFileTypes:true}).some(entry => {
    if (!entry.isDirectory() || !entry.name.startsWith('.hamster-update-')) return false;
    const stage = path.join(parent,entry.name);
    if (ready === path.join(stage,'ready')) return false;
    try {
      const stat = sync.lstatSync(stage);
      if (stat.uid !== process.getuid() || (stat.mode & 0o077)) return false;
      const pid = Number(sync.readFileSync(path.join(stage,'handoff'),'utf8'));
      if (!Number.isSafeInteger(pid) || pid <= 1 || pid > 0x7fffffff) return false;
      return process.kill(pid,0);
    } catch {
      return false;
    }
  });
}

module.exports = {findUpdate,findLocalUpdate,localUpdatesEnabled,matchesArch,pickUpdate,createUpdateMonitor,launchUpdate,updateInProgress,compare,versionPattern,appId};
