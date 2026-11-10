const {createPublicKey, sign, verify} = require('node:crypto');
const {compare, versionPattern} = require('./updater.cjs');
const {publicKeys: embeddedKeys, isAllowedUrl} = require('./distribution.cjs');

const maxBytes = 600 * 1024 * 1024;
const maxNotes = 500;
const maxAge = 90 * 24 * 60 * 60_000;
const maxSkew = 24 * 60 * 60_000;
const keyIdPattern = /^[A-Za-z0-9_-]{1,32}$/;
const issuedPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
const canonical = ({keyId, version, issued, sha256, size, url, notes}) =>
  ['hamster-update-v2',keyId,version,issued,sha256,size,url,JSON.stringify(notes)].join('\n');
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function signManifest({keyId, version, issued, url, size, sha256, notes}, privateKey) {
  const signature = sign(null,Buffer.from(canonical({keyId,version,issued,sha256,size,url,notes})),privateKey).toString('base64');
  return {version,url,size,sha256,keyId,issued,signature,notes};
}

// Strict ISO-8601 UTC: the text must survive a round trip through Date, so impossible dates are refused.
function issuedTime(issued) {
  if (typeof issued !== 'string' || !issuedPattern.test(issued)) return NaN;
  const time = Date.parse(issued);
  if (Number.isNaN(time)) return NaN;
  return new Date(time).toISOString().replace('.000Z','Z') === issued.replace('.000Z','Z') ? time : NaN;
}

// Every field is checked before the signature so that the signed string is unambiguous.
function verifyManifest(text, {keys = embeddedKeys, now = Date.now()} = {}) {
  const manifest = JSON.parse(text);
  if (!isObject(manifest)) throw new Error('Update manifest is malformed.');
  const {version, url, size, sha256, keyId, issued, signature, notes} = manifest;
  if (typeof version !== 'string' || !versionPattern.test(version)) throw new Error('Update manifest version is malformed.');
  if (!Number.isSafeInteger(size) || size <= 0 || size > maxBytes) throw new Error('Update manifest size is invalid.');
  if (typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(sha256)) throw new Error('Update manifest checksum is malformed.');
  if (typeof url !== 'string' || !isAllowedUrl(url)) throw new Error('Update manifest URL is not allowed.');
  if (typeof notes !== 'string' || notes.length > maxNotes) throw new Error('Update manifest notes are malformed.');
  if (typeof keyId !== 'string' || !keyIdPattern.test(keyId)) throw new Error('Update manifest key id is malformed.');
  const time = issuedTime(issued);
  if (Number.isNaN(time)) throw new Error('Update manifest issue time is malformed.');
  if (now - time > maxAge) throw new Error('Update manifest is too old.');
  if (time - now > maxSkew) throw new Error('Update manifest is dated in the future.');
  const entry = keys.find(candidate => candidate.id === keyId);
  if (!entry) throw new Error('Update manifest key id is unknown.');
  const raw = typeof signature === 'string' ? Buffer.from(signature,'base64') : Buffer.alloc(0);
  if (raw.length !== 64 || raw.toString('base64') !== signature) throw new Error('Update manifest signature is malformed.');
  if (!verify(null,Buffer.from(canonical({keyId,version,issued,sha256,size,url,notes})),createPublicKey(entry.key),raw)) {
    throw new Error('Update manifest signature does not match.');
  }
  return {version,url,size,sha256,keyId,issued,signature,notes};
}

// The highest version ever accepted is stored in settings; an unreadable value counts as none.
const readHighest = value => typeof value === 'string' && versionPattern.test(value) ? value : '0.0.0';

// A manifest that is not newer than the running app offers nothing.
function offeredUpdate(manifest, current) {
  if (compare(manifest.version,current) <= 0) return;
  const {version, url, size, sha256, notes} = manifest;
  return {version,remote:{url,size,sha256,notes}};
}

module.exports = {canonical,signManifest,verifyManifest,offeredUpdate,readHighest,maxBytes,maxNotes,maxAge,maxSkew};
