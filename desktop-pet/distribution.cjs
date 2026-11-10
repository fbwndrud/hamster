// Where releases live and who may serve them. The private key stays on the maintainer's Mac; only the public half ships.
const repository = 'fbwndrud/hamster';
const manifestUrl = `https://github.com/${repository}/releases/latest/download/latest.json`;
const feedbackUrl = `https://github.com/${repository}/issues/new/choose`;
const assetUrl = version => `https://github.com/${repository}/releases/download/v${version}/Hamster-${version}.zip`;
const allowedHosts = new Set(['github.com','objects.githubusercontent.com','release-assets.githubusercontent.com']);
// Manifests name the key that signed them. To rotate, ship a build that lists both keys, then sign with the new one.
const publicKeys = [{id:'k1',key:`-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAP/X31asHsq9yBn71YGiKJ+M2J0JW/p4FkEF9C2sPp8k=
-----END PUBLIC KEY-----
`}];

// Only canonical https URLs on the allowed hosts: no credentials, no ports, no whitespace tricks.
function isAllowedUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === 'https:' && allowedHosts.has(url.hostname) && !url.username && !url.password &&
    !url.port && url.href === value;
}

module.exports = {manifestUrl,feedbackUrl,assetUrl,allowedHosts,publicKeys,isAllowedUrl};
