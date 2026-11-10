const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {Readable} = require('node:stream');
const {createHash, generateKeyPairSync} = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {test} = require('node:test');
const {canonical, signManifest, verifyManifest, offeredUpdate, readHighest} = require('../update-manifest.cjs');
const {checkRemote, fetchUpdate} = require('../remote-update.cjs');
const {manifestUrl, assetUrl, isAllowedUrl, publicKeys: shippedKeys} = require('../distribution.cjs');
const {createManifest, ensureSigningKey, verifyBundle, publicPem} = require('../release-mac.cjs');
const {pickUpdate, createUpdateMonitor, findLocalUpdate, matchesArch} = require('../updater.cjs');

const {privateKey, publicKey} = generateKeyPairSync('ed25519');
const publicPemText = publicKey.export({type:'spki',format:'pem'});
const zip = Buffer.from('pretend this is a zip');
const sha256 = data => createHash('sha256').update(data).digest('hex');
const now = Date.parse('2026-11-10T12:00:00.000Z');
const day = 24 * 60 * 60_000;
const keys = [{id:'k1',key:publicPemText}];
const fields = (overrides = {}) => ({
  keyId:'k1',version:'1.0.13',issued:new Date(now).toISOString(),url:assetUrl('1.0.13'),size:zip.length,sha256:sha256(zip),
  notes:'Cuter cheeks',...overrides,
});
const signed = (overrides, key = privateKey) => signManifest(fields(overrides),key);
const verify = (manifest, options = {}) => verifyManifest(JSON.stringify(manifest),{keys,now,...options});
const check = (body, options = {}) => checkRemote('1.0.12',{
  get:network({[manifestUrl]:[200,{},JSON.stringify(body)]}).get,keys,now,...options,
});

// A fake network: each route is a status, headers and body.
function network(routes) {
  const requested = [];
  const get = async url => {
    requested.push(url);
    const route = routes[url];
    if (!route) throw new Error('unexpected request '+url);
    const [statusCode, headers = {}, body = ''] = route;
    return Object.assign(Readable.from([Buffer.from(body)]),{statusCode,headers});
  };
  return {get,requested};
}

test('the signed string is the documented canonical form', () => {
  const manifest = signed();
  assert.equal(canonical(manifest),
    `hamster-update-v2\nk1\n1.0.13\n2026-11-10T12:00:00.000Z\n${sha256(zip)}\n${zip.length}\n${assetUrl('1.0.13')}\n"Cuter cheeks"`);
  assert.deepEqual(Object.keys(manifest),['version','url','size','sha256','keyId','issued','signature','notes']);
  assert.equal(canonical(fields({notes:'a\nb'})).split('\n').length,8,'notes are JSON-encoded, so a newline cannot add a line');
  assert.deepEqual(verify(manifest),manifest);
});

test('a manifest is rejected when its signature, key or any signed field is wrong', () => {
  const manifest = signed();
  const other = generateKeyPairSync('ed25519').privateKey;
  assert.throws(() => verify(signed({},other)),/signature does not match/);
  assert.throws(() => verify({...manifest,signature:Buffer.alloc(64).toString('base64')}),/signature does not match/);
  assert.throws(() => verify({...manifest,signature:'not-base64!'}),/signature is malformed/);
  assert.throws(() => verify({...manifest,signature:undefined}),/signature is malformed/);
  assert.throws(() => verify({...manifest,sha256:sha256('other')}),/signature does not match/);
  assert.throws(() => verify({...manifest,size:manifest.size+1}),/signature does not match/);
  assert.throws(() => verify({...manifest,url:assetUrl('1.0.14')}),/signature does not match/);
  assert.throws(() => verify({...manifest,version:'1.0.14'}),/signature does not match/);
});

test('the key id selects the verifying key; unknown ids and a swapped id are refused', () => {
  const second = generateKeyPairSync('ed25519');
  const both = [...keys,{id:'k2',key:second.publicKey.export({type:'spki',format:'pem'})}];
  assert.equal(verify(signed({keyId:'k2'},second.privateKey),{keys:both}).keyId,'k2');
  assert.equal(verify(signed(),{keys:both}).keyId,'k1','the first key still verifies after a rotation');
  assert.throws(() => verify(signed({keyId:'k3'})),/key id is unknown/);
  assert.throws(() => verify(signed({keyId:'k2'},second.privateKey)),/key id is unknown/, 'k2 is not listed');
  assert.throws(() => verify({...signed(),keyId:'k2'},{keys:both}),/signature does not match/, 'tampered keyId');
  assert.throws(() => verify({...signed({keyId:'k2'},second.privateKey),keyId:'k1'},{keys:both}),/signature does not match/);
  assert.throws(() => verify(signed({keyId:'k1\nk2'})),/key id is malformed/);
  assert.throws(() => verify({...signed(),keyId:undefined}),/key id is malformed/);
  assert.deepEqual(shippedKeys.map(entry => entry.id),['k1']);
});

test('issued and notes are signed: changing either breaks the signature', () => {
  const manifest = signed();
  assert.throws(() => verify({...manifest,issued:new Date(now - day).toISOString()}),/signature does not match/);
  assert.throws(() => verify({...manifest,notes:'Free money'}),/signature does not match/);
  assert.throws(() => verify({...manifest,notes:''}),/signature does not match/);
  assert.equal(verify(signed({notes:'x'.repeat(500)})).notes.length,500);
});

test('a manifest older than 90 days or more than a day in the future is refused', () => {
  const issuedAt = offset => signed({issued:new Date(now + offset).toISOString()});
  assert.ok(verify(issuedAt(-90 * day)));
  assert.throws(() => verify(issuedAt(-90 * day - 1)),/too old/);
  assert.ok(verify(issuedAt(day)));
  assert.throws(() => verify(issuedAt(day + 1)),/dated in the future/);
});

test('the issue time must be a strict ISO-8601 UTC timestamp', () => {
  assert.ok(verify(signed({issued:'2026-11-10T12:00:00Z'})), 'seconds precision is fine');
  for (const issued of ['2026-11-10','2026-11-10T12:00:00+00:00','2026-11-10T12:00:00','2026-11-10 12:00:00Z','2026-02-30T12:00:00Z',
    '2026-13-10T12:00:00Z','2026-11-10T25:00:00Z',' 2026-11-10T12:00:00Z','Nov 10 2026',1788000000000,null]) {
    assert.throws(() => verify(signed({issued})),/issue time is malformed/,String(issued));
  }
  assert.throws(() => verify({...signed(),issued:undefined}),/issue time is malformed/);
});

test('a signed manifest below the highest version already accepted is refused, and a new high is remembered', async () => {
  const remembered = [];
  const remember = version => remembered.push(version);
  await assert.rejects(check(signed({version:'1.0.14'}),{highest:'1.0.15',remember}),/older than one already accepted/);
  assert.deepEqual(remembered,[]);
  assert.equal((await check(signed({version:'1.0.15'}),{highest:'1.0.15',remember})).version,'1.0.15');
  assert.deepEqual(remembered,[], 'an equal version is accepted without a new write');
  await check(signed({version:'1.0.20'}),{highest:'1.0.15',remember});
  assert.deepEqual(remembered,['1.0.20']);
  assert.equal(await check(signed({version:'1.0.12'}),{highest:'1.0.9',remember}),undefined, 'not newer than the running app');
  assert.deepEqual(remembered,['1.0.20','1.0.12'], 'still counts as accepted');
  assert.equal(readHighest('1.0.20'),'1.0.20');
  for (const bad of [undefined,null,5,'1.0','1.0.20\n','x']) assert.equal(readHighest(bad),'0.0.0');
});

test('malformed or disallowed fields never reach the signature check', () => {
  const bad = (overrides, pattern) => assert.throws(() => verify({...signed(),...overrides}),pattern);
  bad({version:'1.0'},/version is malformed/);
  bad({version:'1.0.13\n'},/version is malformed/);
  bad({size:'12'},/size is invalid/);
  bad({size:0},/size is invalid/);
  bad({size:601 * 1024 * 1024},/size is invalid/);
  bad({sha256:sha256(zip).toUpperCase()},/checksum is malformed/);
  bad({url:'http://github.com/fbwndrud/hamster/releases/download/v1.0.13/Hamster-1.0.13.zip'},/URL is not allowed/);
  bad({url:'https://evil.example/Hamster.zip'},/URL is not allowed/);
  bad({url:'https://github.com.evil.example/Hamster.zip'},/URL is not allowed/);
  bad({url:'https://user@github.com/fbwndrud/hamster/releases/download/v1.0.13/Hamster-1.0.13.zip'},/URL is not allowed/);
  bad({notes:5},/notes are malformed/);
  bad({notes:'x'.repeat(501)},/notes are malformed/);
  assert.throws(() => verifyManifest('[]',{keys,now}),/malformed/);
  assert.throws(() => verifyManifest('{',{keys,now}),SyntaxError);
});

test('only a newer version is offered', () => {
  const manifest = verify(signed());
  assert.deepEqual(offeredUpdate(manifest,'1.0.12'),{
    version:'1.0.13',remote:{url:assetUrl('1.0.13'),size:zip.length,sha256:sha256(zip),notes:'Cuter cheeks'},
  });
  assert.equal(offeredUpdate(manifest,'1.0.13'),undefined);
  assert.equal(offeredUpdate(manifest,'1.0.20'),undefined);
  assert.ok(offeredUpdate(manifest,'1.0.9'),'compares numerically, not as text');
});

test('hosts and URLs outside the release servers are refused', () => {
  for (const url of [manifestUrl,'https://objects.githubusercontent.com/a/b','https://release-assets.githubusercontent.com/a?x=1']) {
    assert.equal(isAllowedUrl(url),true,url);
  }
  for (const url of ['http://github.com/a','https://example.com/a','https://github.com:8443/a','https://api.github.com/a',
    'https://raw.githubusercontent.com/a','file:///etc/passwd','not a url']) assert.equal(isAllowedUrl(url),false,url);
});

test('the launch check fetches the manifest through allowed redirects and offers a newer signed release', async () => {
  const body = JSON.stringify(signed());
  const hop = 'https://github.com/fbwndrud/hamster/releases/download/v1.0.13/latest.json';
  const cdn = 'https://release-assets.githubusercontent.com/latest.json?sig=1';
  const net = network({[manifestUrl]:[302,{location:hop}],[hop]:[302,{location:cdn}],[cdn]:[200,{},body]});
  const update = await checkRemote('1.0.12',{get:net.get,keys,now});
  assert.equal(update.version,'1.0.13');
  assert.deepEqual(net.requested,[manifestUrl,hop,cdn]);
  assert.equal(await checkRemote('1.0.13',{get:net.get,keys,now}),undefined);
});

test('a redirect to a disallowed host or a plain http hop is never requested', async () => {
  for (const location of ['https://evil.example/latest.json','http://github.com/latest.json','https://github.com@evil.example/x']) {
    const net = network({[manifestUrl]:[302,{location}]});
    await assert.rejects(checkRemote('1.0.12',{get:net.get,keys,now}),/host is not allowed/);
    assert.deepEqual(net.requested,[manifestUrl]);
  }
  const loop = network({[manifestUrl]:[302,{location:manifestUrl}]});
  await assert.rejects(checkRemote('1.0.12',{get:loop.get,keys,now}),/Too many redirects/);
});

test('the manifest check rejects bad signatures, error pages and oversized bodies', async () => {
  const route = answer => checkRemote('1.0.12',{get:network({[manifestUrl]:answer}).get,keys,now});
  await assert.rejects(route([200,{},JSON.stringify({...signed(),sha256:sha256('x')})]),/signature does not match/);
  await assert.rejects(route([404]),/answered 404/);
  await assert.rejects(route([200,{},' '.repeat(20 * 1024)]),/larger than expected/);
  await assert.rejects(route([200,{'content-length':'999999'},'{}']),/larger than expected/);
});

// Installing: the download, checksum, extraction and bundle checks run before launchUpdate sees anything.
async function install(t, {body = zip, headers = {}, update = verify(signed()), info = {version:'1.0.13',identifier:'local.codex.hamster'}} = {}) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(),'hamster-test-'));
  t.after(() => fs.rm(tmp,{recursive:true,force:true}));
  const offered = offeredUpdate(update,'1.0.12');
  const net = network({[offered.remote.url]:[200,headers,body]});
  const extracted = [];
  return {tmp,extracted,run:() => fetchUpdate(offered,{
    get:net.get,tmp,inspect:async () => info,quarantined:async () => false,
    extract:async (file, destination) => {
      extracted.push(await fs.readFile(file));
      await fs.mkdir(path.join(destination,'Hamster.app'));
    },
  })};
}

test('a verified download is extracted into a private staging folder and cleaned up on request', async t => {
  const job = await install(t);
  const result = await job.run();
  assert.equal(result.version,'1.0.13');
  assert.equal(path.basename(result.bundle),'Hamster.app');
  assert.equal((await fs.stat(path.dirname(path.dirname(result.bundle)))).mode & 0o777,0o700);
  assert.deepEqual(job.extracted,[zip]);
  assert.equal(result.quarantined,false);
  await result.cleanup();
  assert.deepEqual(await fs.readdir(job.tmp),[]);
});

test('a download that is too large, the wrong size or the wrong checksum is discarded', async t => {
  for (const body of [Buffer.concat([zip,Buffer.from('extra')]),zip.subarray(1),Buffer.from('x'.repeat(zip.length))]) {
    const job = await install(t,{body});
    await assert.rejects(job.run(),/larger than expected|does not match its manifest/);
    assert.deepEqual(job.extracted,[]);
    assert.deepEqual(await fs.readdir(job.tmp),[]);
  }
  const advertised = await install(t,{headers:{'content-length':String(zip.length+1)}});
  await assert.rejects(advertised.run(),/larger than expected/);
});

test('a bundle with another version or identifier is discarded', async t => {
  for (const info of [{version:'1.0.14',identifier:'local.codex.hamster'},{version:'1.0.13',identifier:'com.example.other'}]) {
    const job = await install(t,{info});
    await assert.rejects(job.run(),/does not match its manifest/);
    assert.deepEqual(await fs.readdir(job.tmp),[]);
  }
});

test('the install download cannot be redirected off the release hosts', async t => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(),'hamster-test-'));
  t.after(() => fs.rm(tmp,{recursive:true,force:true}));
  const offered = offeredUpdate(verify(signed()),'1.0.12');
  const net = network({[offered.remote.url]:[302,{location:'https://evil.example/Hamster.zip'}]});
  await assert.rejects(fetchUpdate(offered,{get:net.get,tmp}),/host is not allowed/);
  assert.deepEqual(await fs.readdir(tmp),[]);
});

test('a remote update wins a tie; a strictly newer local build still wins, and a broken local folder is ignored with a remote offer', async () => {
  const local = {version:'1.0.13',bundle:'/local'};
  const remote = offeredUpdate(verify(signed()),'1.0.12');
  assert.equal(await pickUpdate(async () => local,remote),remote);
  assert.equal(await pickUpdate(async () => ({version:'1.0.14',bundle:'/newer'}),remote).then(update => update.bundle),'/newer');
  assert.equal(await pickUpdate(async () => ({version:'1.0.12',bundle:'/old'}),remote),remote);
  assert.equal(await pickUpdate(async () => undefined,remote),remote);
  assert.equal(await pickUpdate(async () => local,undefined),local);
  assert.equal(await pickUpdate(async () => undefined,undefined),undefined);
  assert.equal(await pickUpdate(async () => {throw new Error('bad folder');},remote),remote);
  await assert.rejects(pickUpdate(async () => {throw new Error('bad folder');},undefined),/bad folder/);
  const changes = [];
  let current = remote;
  const monitor = createUpdateMonitor(async () => current,state => changes.push(state));
  await monitor.refresh();
  current = {...remote,remote:{...remote.remote,sha256:sha256('new')}};
  await monitor.refresh();
  assert.equal(changes.length,2);
});

test('the local updates folder is scanned only while the marker file exists', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'hamster-local-'));
  t.after(() => fs.rm(root,{recursive:true,force:true}));
  const installed = path.join(root,'Hamster.app');
  const contents = path.join(root,'updates','1.0.13','Hamster.app','Contents');
  await fs.mkdir(path.join(contents,'MacOS'),{recursive:true,mode:0o755});
  for (const directory of [path.join(root,'updates'),path.join(root,'updates','1.0.13'),path.join(root,'updates','1.0.13','Hamster.app')]) {
    await fs.chmod(directory,0o755);
  }
  await fs.writeFile(path.join(contents,'Info.plist'),'');
  await fs.writeFile(path.join(contents,'MacOS','Electron'),'');
  const marker = path.join(root,'data','local-updates');
  const find = () => findLocalUpdate(installed,'1.0.12',marker);
  assert.equal(await find(),undefined,'off without the marker, even though a newer build is sitting there');
  await fs.mkdir(path.dirname(marker));
  assert.equal(await find(),undefined,'a data folder alone does not enable it');
  await fs.writeFile(marker,'');
  assert.equal((await find()).version,'1.0.13');
  await fs.rm(marker);
  assert.equal(await find(),undefined,'removing the marker turns it off again');
  await fs.mkdir(marker);
  assert.equal(await find(),undefined,'a directory or link is not a marker');
  await fs.rmdir(marker);
  await fs.symlink(path.join(root,'updates'),marker);
  assert.equal(await find(),undefined);
});

test('the release script signs a manifest that the shipped key accepts, and refuses a mismatched key', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'hamster-release-'));
  t.after(() => fs.rm(dir,{recursive:true,force:true}));
  const file = path.join(dir,'key','update-signing.pem');
  const key = ensureSigningKey(file);
  assert.equal((await fs.stat(file)).mode & 0o777,0o600);
  assert.equal(publicPem(ensureSigningKey(file)),publicPem(key),'an existing key is reused');
  const archive = path.join(dir,'Hamster-1.0.13.zip');
  await fs.writeFile(archive,zip);
  const own = [{id:'r7',key:publicPem(key)}];
  const manifest = createManifest({version:'1.0.13',zip:archive,notes:'n',privateKey:key,keys:own,now});
  assert.equal(manifest.keyId,'r7');
  assert.equal(manifest.issued,'2026-11-10T12:00:00.000Z');
  assert.equal(manifest.url,'https://github.com/fbwndrud/hamster/releases/download/v1.0.13/Hamster-1.0.13.zip');
  assert.equal(manifest.sha256,sha256(zip));
  assert.equal(manifest.size,zip.length);
  assert.throws(() => createManifest({version:'1.0.13',zip:archive,privateKey:key}),/does not match distribution/,
    'the shipped keys reject a manifest from any other key');
  assert.throws(() => createManifest({version:'1.0.13',zip:archive,notes:'x'.repeat(501),privateKey:key,keys:own,now}),/notes are malformed/);
  for (const entry of shippedKeys) assert.match(entry.key,/BEGIN PUBLIC KEY/);
  await fs.chmod(file,0o644);
  assert.throws(() => ensureSigningKey(file),/readable only by its owner/);
});

test('the release script verifies the bundle before signing and aborts on any mismatch', () => {
  const arch = process.arch === 'arm64' ? 'arm64' : 'x86_64';
  const other = process.arch === 'arm64' ? 'x86_64' : 'arm64';
  const answers = ({version = '1.0.13', identifier = 'local.codex.hamster', file = `Mach-O 64-bit executable ${arch}`, codesign = true} = {}) => {
    const calls = [];
    const exec = (command, args) => {
      calls.push([command,...args]);
      if (command.endsWith('codesign')) {
        if (!codesign) throw new Error('codesign failed');
        return '';
      }
      if (command.endsWith('file')) return file+'\n';
      return (args[1].includes('Short') ? version : identifier)+'\n';
    };
    return {calls,exec};
  };
  const ok = answers();
  verifyBundle('/b/Hamster.app','1.0.13',ok.exec);
  assert.deepEqual(ok.calls[0],['/usr/bin/codesign','--verify','--deep','--strict','-R=identifier "local.codex.hamster"','/b/Hamster.app']);
  assert.ok(ok.calls.some(call => call[0].endsWith('file') && call[2] === '/b/Hamster.app/Contents/MacOS/Electron'));
  const fails = (overrides, pattern) => assert.throws(() => verifyBundle('/b/Hamster.app','1.0.13',answers(overrides).exec),pattern);
  fails({codesign:false},/codesign failed/);
  fails({version:'1.0.12'},/version does not match package.json/);
  fails({identifier:'com.example.other'},/identifier is not local.codex.hamster/);
  fails({file:`Mach-O 64-bit executable ${other}`},/different Mac architecture/);
  assert.equal(matchesArch('Mach-O 64-bit executable arm64','arm64'),true);
  assert.equal(matchesArch('Mach-O 64-bit executable x86_64','arm64'),false);
  assert.equal(matchesArch('Mach-O 64-bit executable x86_64','x64'),true);
});

test('release-mac.sh runs the bundle check before it zips or signs, and the check exits non-zero on a bad bundle', async t => {
  const script = await fs.readFile(path.join(__dirname,'..','release-mac.sh'),'utf8');
  const verifyAt = script.indexOf('node release-mac.cjs --verify "$bundle"');
  assert.ok(verifyAt > 0);
  assert.ok(verifyAt < script.indexOf('mkdir -p "$release"') && verifyAt < script.indexOf('ditto -c -k'));
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'hamster-bundle-'));
  t.after(() => fs.rm(dir,{recursive:true,force:true}));
  assert.throws(() => execFileSync(process.execPath,[path.join(__dirname,'..','release-mac.cjs'),'--verify',dir],{stdio:'pipe'}));
});
