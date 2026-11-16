// Builds an unsigned Windows folder build of Hamster. Usage: node package-win.cjs [x64|arm64]
// Needs the win32 Electron zip. It comes from the @electron/get cache or, when missing, from the Electron GitHub release.
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {createHash} = require('node:crypto');
const {downloadArtifact} = require('@electron/get');
const {version} = require('./package.json');
const electronVersion = require('electron/package.json').version;

const architecture = process.argv[2] ?? 'x64';
if (!['x64','arm64'].includes(architecture) || process.argv.length > 3) {
  console.error('Usage: node package-win.cjs [x64|arm64]');
  process.exit(1);
}
const files = ['package.json','main.cjs','platform.cjs','hook-bridge.cjs','motion-state.cjs','progress.cjs','localization.cjs',
  'placement.cjs','codex-install.cjs','codex-usage.cjs','tool-usage.cjs','codex-lifecycle.cjs','menu-template.cjs',
  'connection-status.cjs','updater.cjs','distribution.cjs','update-manifest.cjs','remote-update.cjs','diagnostics.cjs',
  'preload.cjs','overlay.html','overlay.css','overlay.js','interaction.html','interaction.js','wardrobe.cjs','wardrobe.css',
  'wardrobe-ui.js'];

(async () => {
  const output = path.resolve(__dirname,'..','output','desktop-win',`${version}-${architecture}`);
  if (fs.existsSync(output)) {
    console.error(`Hamster ${version} (${architecture}) has already been built. Increment the patch version first.`);
    process.exit(1);
  }
  const zip = await downloadArtifact({version:electronVersion,artifactName:'electron',platform:'win32',arch:architecture});
  fs.mkdirSync(path.dirname(output),{recursive:true});
  const stage = fs.mkdtempSync(path.join(path.dirname(output),'.hamster-build-'));
  try {
    const app = path.join(stage,'Hamster');
    fs.mkdirSync(app,{recursive:true});
    // bsdtar reads zip archives on macOS and on Windows 10 and later.
    execFileSync('tar',['-xf',zip,'-C',app]);
    fs.renameSync(path.join(app,'electron.exe'),path.join(app,'Hamster.exe'));
    fs.rmSync(path.join(app,'resources','default_app.asar'),{force:true});
    const resources = path.join(app,'resources','app');
    fs.mkdirSync(resources,{recursive:true});
    for (const file of files) fs.copyFileSync(path.join(__dirname,file),path.join(resources,file));
    fs.cpSync(path.join(__dirname,'assets'),path.join(resources,'assets'),{recursive:true});
    fs.renameSync(stage,output);
    // The release zip holds one Hamster folder; bsdtar writes zip archives on macOS and Windows 10 and later.
    const releases = path.resolve(__dirname,'..','output','desktop-win','releases',version);
    fs.mkdirSync(releases,{recursive:true});
    const name = `Hamster-${version}-win-${architecture}.zip`;
    const archive = path.join(releases,name);
    fs.rmSync(archive,{force:true});
    execFileSync('tar',['-c','--format','zip','-f',archive,'-C',output,'Hamster']);
    const sha256 = createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
    fs.writeFileSync(archive+'.sha256',`${sha256}  ${name}\n`);
    console.log(path.join(output,'Hamster','Hamster.exe'));
    console.log(archive);
  } finally {
    fs.rmSync(stage,{recursive:true,force:true});
  }
})().catch(error => {
  console.error(error.message);
  process.exit(1);
});
