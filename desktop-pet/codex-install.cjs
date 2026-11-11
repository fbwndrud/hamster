const fs = require('node:fs');
const path = require('node:path');

// Grok also runs the Claude and Cursor hook files, so their helpers moved to v3, which skips Grok's calls.
const providers = {
  codex:{file:'hooks.json',events:['UserPromptSubmit','Stop','Interrupt'],timeout:1,version:2},
  claude:{file:'settings.json',events:['UserPromptSubmit','Stop','StopFailure','SessionEnd'],timeout:1,version:3},
  cursor:{file:'hooks.json',events:['beforeSubmitPrompt','stop','sessionEnd'],timeout:1,flat:true,version:3},
  gemini:{file:'settings.json',events:['BeforeAgent','AfterAgent','SessionEnd'],timeout:1000,version:2},
  grok:{file:path.join('hooks','hamster.json'),events:['UserPromptSubmit','Stop','StopFailure','StopCancelled','SessionEnd','Notification'],
    timeout:2,version:3,matchers:{Notification:'idle_prompt'}},
};
const versions = provider => Array.from({length:providers[provider].version},(_,index) => index+1);
const bridge = (directory,provider,version) => path.join(directory,'hamster',`${provider === 'codex' ? 'codex' : 'ai'}-hook-v${version}`);
const shellQuote = value => "'" + value.replaceAll("'","'\\''") + "'";
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hookCommand = (directory,provider,version) => shellQuote(bridge(directory,provider,version)) + (provider === 'codex' ? '' : ' '+provider);
const handlers = (group,flat) => flat ? [group] : group.hooks;

function readConfig(directory, {file,events,flat}) {
  const filename = path.join(directory,file);
  let stat;
  try {
    stat = fs.lstatSync(filename);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return {filename,original:null,document:{hooks:{}}};
  }
  if (!stat.isFile()) throw new Error(file+' must be a regular file');
  const original = fs.readFileSync(filename,'utf8');
  const document = JSON.parse(original);
  if (!isObject(document) || (Object.hasOwn(document,'hooks') && !isObject(document.hooks))) {
    throw new Error('Invalid '+file);
  }
  document.hooks ??= {};
  for (const event of events) {
    if (!Object.hasOwn(document.hooks,event)) continue;
    const groups = document.hooks[event];
    if (!Array.isArray(groups) || groups.some(group => !isObject(group) || (!flat && !Array.isArray(group.hooks)))) {
      throw new Error('Invalid hook definitions: '+event);
    }
  }
  return {filename,original,document,mode:stat.mode & 0o777};
}

function storeConfig(directory, {filename,original,document,mode}) {
  const stage = fs.mkdtempSync(path.join(directory,'.hamster-install-'));
  const temporary = path.join(stage,'hooks.json');
  try {
    fs.writeFileSync(temporary,JSON.stringify(document,null,2)+'\n',{mode:mode ?? 0o600});
    if (original === null) {
      fs.linkSync(temporary,filename);
    } else {
      if (!fs.lstatSync(filename).isFile() || fs.readFileSync(filename,'utf8') !== original) {
        throw new Error('Hook settings changed while saving. Try again.');
      }
      fs.renameSync(temporary,filename);
    }
  } finally {
    fs.rmSync(stage,{recursive:true,force:true});
  }
}

function matches(handler, command) {
  return handler?.command === command && (handler.type === undefined || handler.type === 'command');
}

function hasInstalledCommands(directory, provider, versions) {
  const commands = versions.filter(version => fs.existsSync(bridge(directory,provider,version)))
    .map(version => hookCommand(directory,provider,version));
  if (!commands.length) return false;
  const profile = providers[provider];
  const {document:{hooks}} = readConfig(directory,profile);
  return profile.events.every(event => hooks[event]?.some(group =>
    handlers(group,profile.flat).some(hook => commands.some(command => matches(hook,command)))));
}

function installed(directory, provider = 'codex') {
  return hasInstalledCommands(directory,provider,versions(provider));
}

function bridgeCurrent(directory, provider = 'codex') {
  return hasInstalledCommands(directory,provider,[providers[provider].version]);
}

function installHooks(directory, source, provider = 'codex') {
  const profile = providers[provider];
  const config = readConfig(directory,profile);
  const {hooks} = config.document;
  const destination = bridge(directory,provider,profile.version);
  const command = hookCommand(directory,provider,profile.version);
  fs.mkdirSync(path.dirname(destination),{recursive:true,mode:0o700});
  fs.mkdirSync(path.dirname(config.filename),{recursive:true,mode:0o700});
  const parent = fs.lstatSync(path.dirname(destination));
  if (!parent.isDirectory() || parent.uid !== process.getuid() || (parent.mode & 0o022)) {
    throw new Error('Hamster hook directory must be owned by the current user');
  }
  // The versioned executable remains stable after Codex approves this command.
  if (!fs.existsSync(destination)) {
    fs.copyFileSync(source,destination,fs.constants.COPYFILE_EXCL);
    fs.chmodSync(destination,0o700);
  }
  const helper = fs.lstatSync(destination);
  if (!helper.isFile() || helper.uid !== process.getuid() || (helper.mode & 0o722) !== 0o700) {
    throw new Error('Unexpected Hamster hook executable');
  }

  const older = versions(provider).slice(0,-1).map(version => hookCommand(directory,provider,version));
  let changed = removeHookCommands(hooks,profile,older);
  for (const event of profile.events) {
    hooks[event] ??= [];
    if (hooks[event].some(group => handlers(group,profile.flat).some(hook => matches(hook,command)))) continue;
    const handler = {type:'command',command,timeout:profile.timeout};
    if (provider === 'gemini') handler.name = 'hamster-'+event;
    const matcher = profile.matchers?.[event];
    hooks[event].push(profile.flat ? handler : {...(matcher ? {matcher} : {}),hooks:[handler]});
    changed = true;
  }
  if (profile.flat && config.document.version === undefined) {
    config.document.version = 1;
    changed = true;
  }
  if (changed) storeConfig(directory,config);
}

function removeHookCommands(hooks, profile, commands) {
  let changed = false;
  for (const event of profile.events) {
    if (!hooks[event]) continue;
    const kept = [];
    for (const group of hooks[event]) {
      const original = handlers(group,profile.flat);
      const remaining = original.filter(hook => !commands.some(command => matches(hook,command)));
      if (remaining.length === original.length) kept.push(group);
      else {
        changed = true;
        if (remaining.length) kept.push({...group,hooks:remaining});
      }
    }
    if (kept.length) hooks[event] = kept;
    else delete hooks[event];
  }
  return changed;
}

function removeHooks(directory, provider = 'codex') {
  const profile = providers[provider];
  const config = readConfig(directory,profile);
  const commands = versions(provider).map(version => hookCommand(directory,provider,version));
  if (removeHookCommands(config.document.hooks,profile,commands)) storeConfig(directory,config);
}

module.exports = {installHooks,removeHooks,installed,bridgeCurrent};
