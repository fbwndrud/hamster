const fs = require('node:fs/promises');
const {createWriteStream} = require('node:fs');
const https = require('node:https');
const os = require('node:os');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {execFile} = require('node:child_process');
const {once} = require('node:events');
const {promisify} = require('node:util');
const {appId, compare} = require('./updater.cjs');
const {manifestUrl, isAllowedUrl} = require('./distribution.cjs');
const {verifyManifest, offeredUpdate} = require('./update-manifest.cjs');

const run = promisify(execFile);
const manifestLimit = 16 * 1024;
const redirects = new Set([301,302,303,307,308]);

function httpsGet(url, signal) {
  return new Promise((resolve, reject) => {
    https.get(url,{signal,timeout:30_000,headers:{'user-agent':'Hamster-Updater'}},resolve)
      .on('timeout',function () {this.destroy(new Error('Update server timed out.'));})
      .on('error',reject);
  });
}

// Every hop, including the first, must stay on https and an allowed host.
async function open(url, get, timeout) {
  const signal = AbortSignal.timeout(timeout);
  for (let hop = 0; hop < 5; hop++) {
    if (!isAllowedUrl(url)) throw new Error('Update host is not allowed.');
    const response = await get(url,signal);
    if (redirects.has(response.statusCode) && response.headers.location) {
      response.destroy();
      url = new URL(response.headers.location,url).href;
    } else if (response.statusCode === 200) {
      return response;
    } else {
      response.destroy();
      throw new Error('Update server answered '+response.statusCode+'.');
    }
  }
  throw new Error('Too many redirects.');
}

function checkLength(response, limit) {
  if (Number(response.headers['content-length']) > limit) {
    response.destroy();
    throw new Error('Update download is larger than expected.');
  }
}

async function readLimited(response, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of response) {
    size += chunk.length;
    if (size > limit) {
      response.destroy();
      throw new Error('Update download is larger than expected.');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function saveLimited(response, limit, file) {
  const hash = createHash('sha256');
  const out = createWriteStream(file,{flags:'wx',mode:0o600});
  let size = 0;
  try {
    for await (const chunk of response) {
      size += chunk.length;
      if (size > limit) throw new Error('Update download is larger than expected.');
      hash.update(chunk);
      if (!out.write(chunk)) await once(out,'drain');
    }
    out.end();
    await once(out,'finish');
  } catch (error) {
    response.destroy();
    out.destroy();
    throw error;
  }
  return {size,sha256:hash.digest('hex')};
}

// `highest` is the newest manifest version this app ever accepted; `remember` stores a new high. Rollbacks to older signed manifests are refused.
async function checkRemote(current, {get = httpsGet, keys, now, highest = '0.0.0', remember = () => {}} = {}) {
  const response = await open(manifestUrl,get,20_000);
  checkLength(response,manifestLimit);
  const text = (await readLimited(response,manifestLimit)).toString('utf8');
  const manifest = verifyManifest(text,{keys,now});
  const order = compare(manifest.version,highest);
  if (order < 0) throw new Error('Update manifest is older than one already accepted.');
  if (order > 0) remember(manifest.version);
  return offeredUpdate(manifest,current);
}

async function inspectBundle(bundle) {
  const plist = path.join(bundle,'Contents','Info.plist');
  const read = key => run('/usr/libexec/PlistBuddy',['-c','Print '+key,plist]).then(({stdout}) => stdout.trim());
  const [version, identifier] = await Promise.all([read('CFBundleShortVersionString'),read('CFBundleIdentifier')]);
  return {version,identifier};
}

async function hasQuarantine(bundle) {
  const {stdout} = await run('/usr/bin/xattr',['-r',bundle],{maxBuffer:16 * 1024 * 1024});
  return stdout.includes('com.apple.quarantine');
}

const extractZip = (zip, destination) => run('/usr/bin/ditto',['-x','-k',zip,destination]);

// Runs only after the user clicks Install. The bundle it returns still goes through launchUpdate's own checks.
async function fetchUpdate({version, remote}, {get = httpsGet, tmp = os.tmpdir(), extract = extractZip,
  inspect = inspectBundle, quarantined = hasQuarantine} = {}) {
  const stage = await fs.mkdtemp(path.join(tmp,'hamster-download-'));
  const cleanup = () => fs.rm(stage,{recursive:true,force:true});
  try {
    const response = await open(remote.url,get,15 * 60_000);
    checkLength(response,remote.size);
    const zip = path.join(stage,'Hamster.zip');
    const saved = await saveLimited(response,remote.size,zip);
    if (saved.size !== remote.size || saved.sha256 !== remote.sha256) throw new Error('Downloaded update does not match its manifest.');
    const extracted = path.join(stage,'extracted');
    await fs.mkdir(extracted,{mode:0o700});
    await extract(zip,extracted);
    const bundle = path.join(extracted,'Hamster.app');
    if (!(await fs.lstat(bundle)).isDirectory()) throw new Error('Downloaded update has no Hamster.app.');
    const info = await inspect(bundle);
    if (info.version !== version || info.identifier !== appId) throw new Error('Downloaded app does not match its manifest.');
    return {version,bundle,quarantined:await quarantined(bundle),cleanup};
  } catch (error) {
    await cleanup();
    throw error;
  }
}

module.exports = {checkRemote,fetchUpdate};
