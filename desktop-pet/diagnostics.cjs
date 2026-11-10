// Plain text for bug reports. It carries versions, connection states and error codes only, never work content or paths.
// A home folder becomes ~ before the remaining odd characters (including /) are replaced.
const clean = (value, limit = 48) => String(value ?? '').replace(/\/Users\/[^/\s]+/g,'~').replace(/[^\w .:~-]/g,'?').slice(0,limit);

// Remembers the last few error codes from the app's console.error sites.
function createErrorLog(limit = 10, now = Date.now) {
  const entries = [];
  return {
    note(scope, code) {
      entries.push({at:new Date(now()).toISOString(),scope:clean(scope),code:clean(code)});
      if (entries.length > limit) entries.shift();
    },
    list: () => entries.map(entry => ({...entry})),
  };
}

function describeUpdate({kind, update}) {
  if (!update) return clean(kind);
  return `${clean(kind)} ${clean(update.version)} (${update.remote ? 'remote' : 'local'})`;
}

function diagnosticsText({version, macos, arch, providers, update, errors}) {
  return [
    `Hamster ${clean(version)}`,
    `macOS ${clean(macos)} ${clean(arch)}`,
    'AI connections:',
    ...providers.map(provider => `  ${clean(provider.id)}: ${clean(provider.state)}`),
    `Update: ${describeUpdate(update)}`,
    'Recent errors:',
    ...(errors.length ? errors.map(entry => `  ${clean(entry.at)} ${clean(entry.scope)}: ${clean(entry.code)}`) : ['  none']),
  ].join('\n');
}

module.exports = {createErrorLog,diagnosticsText};
