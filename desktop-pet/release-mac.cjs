// Checks the packaged bundle, then signs the release manifest. Run through release-mac.sh after package-mac.sh; it never uploads anything.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createHash, createPrivateKey, createPublicKey, generateKeyPairSync} = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {assetUrl, publicKeys: embeddedKeys} = require('./distribution.cjs');
const {signManifest, verifyManifest} = require('./update-manifest.cjs');
const {appId, matchesArch} = require('./updater.cjs');

const keyPath = path.join(os.homedir(),'.config','hamster','update-signing-ed25519.pem');
const publicPem = key => createPublicKey(key).export({type:'spki',format:'pem'});

// The private key is created once, readable only by its owner, and never printed.
function ensureSigningKey(file = keyPath) {
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  try {
    const {privateKey} = generateKeyPairSync('ed25519');
    fs.writeFileSync(file,privateKey.export({type:'pkcs8',format:'pem'}),{flag:'wx',mode:0o600});
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  if (fs.statSync(file).mode & 0o077) throw new Error('The signing key must be readable only by its owner.');
  return createPrivateKey(fs.readFileSync(file));
}

function createManifest({version, zip, notes = '', privateKey, keys = embeddedKeys, now = Date.now()}) {
  const pem = publicPem(privateKey);
  const entry = keys.find(candidate => candidate.key === pem);
  if (!entry) throw new Error('The signing key does not match distribution.cjs.');
  const data = fs.readFileSync(zip);
  const manifest = signManifest({
    keyId:entry.id,version,issued:new Date(now).toISOString(),url:assetUrl(version),size:data.length,
    sha256:createHash('sha256').update(data).digest('hex'),notes,
  },privateKey);
  // Refuse to publish a manifest that the shipped app would reject.
  return verifyManifest(JSON.stringify(manifest),{keys,now});
}

const execute = (command, args) => execFileSync(command,args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});

// The bundle must be intact (codesign here is an integrity check only, not proof of who built it) and match what the manifest will claim.
function verifyBundle(bundle, version, exec = execute) {
  const plist = path.join(bundle,'Contents','Info.plist');
  const read = key => exec('/usr/libexec/PlistBuddy',['-c','Print '+key,plist]).trim();
  exec('/usr/bin/codesign',['--verify','--deep','--strict','-R=identifier "'+appId+'"',bundle]);
  if (read('CFBundleShortVersionString') !== version) throw new Error('Bundle version does not match package.json.');
  if (read('CFBundleIdentifier') !== appId) throw new Error('Bundle identifier is not '+appId+'.');
  if (!matchesArch(exec('/usr/bin/file',['-b',path.join(bundle,'Contents','MacOS','Electron')]))) {
    throw new Error('Bundle executable is for a different Mac architecture.');
  }
}

// Usage: release-mac.cjs --verify <bundle> | release-mac.cjs <release folder> [notes]
function main([directory, argument = '']) {
  const {version} = require('./package.json');
  if (directory === '--verify') return verifyBundle(argument,version);
  const notes = argument;
  const zip = path.join(directory,`Hamster-${version}.zip`);
  const privateKey = ensureSigningKey();
  const manifest = createManifest({version,zip,notes,privateKey});
  fs.writeFileSync(path.join(directory,`Hamster-${version}.zip.sha256`),`${manifest.sha256}  Hamster-${version}.zip\n`);
  fs.writeFileSync(path.join(directory,'latest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(path.join(directory,'latest.json'));
}

if (require.main === module) main(process.argv.slice(2));
module.exports = {ensureSigningKey,createManifest,verifyBundle,publicPem,keyPath};
