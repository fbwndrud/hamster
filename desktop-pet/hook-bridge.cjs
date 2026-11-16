// Node port of codex-hook.swift for Windows. The AI tool runs it as a hook command with the provider as argv[2],
// it reads the hook JSON from stdin, forwards only hashed identifiers to the pet, and always exits 0.
const {createHash} = require('node:crypto');
const net = require('node:net');
const os = require('node:os');

const events = {
  codex:{UserPromptSubmit:'submitted',Stop:'finished',Interrupt:'interrupted'},
  claude:{UserPromptSubmit:'submitted',Stop:'finished',StopFailure:'interrupted',SessionEnd:'sessionEnded'},
  cursor:{beforeSubmitPrompt:'submitted',stop:'finished',sessionEnd:'sessionEnded'},
  gemini:{BeforeAgent:'submitted',AfterAgent:'finished',SessionEnd:'sessionEnded'},
  grok:{UserPromptSubmit:'submitted',Stop:'finished',StopFailure:'interrupted',StopCancelled:'interrupted',
    SessionEnd:'sessionEnded',Notification:'sessionEnded'},
};
const turnFields = {codex:'turn_id',claude:'prompt_id',cursor:'generation_id',gemini:'prompt_id',grok:'promptId'};
const maxInput = 4_000_000;
// Swift's JSONSerialization writes "/" as "\/"; matching it keeps hashes identical to codex-hook.swift.
const hash = parts => createHash('sha256').update(JSON.stringify(parts).replaceAll('/','\\/')).digest('hex');
const has = (object, key) => Object.hasOwn(object,key);

// The app computes the same endpoint (platform.cjs). Windows uses a per-user named pipe, macOS the private socket.
function eventEndpoint({windows = process.platform === 'win32',username = os.userInfo().username,
    uid = process.getuid?.()} = {}) {
  if (windows) {
    const user = createHash('sha256').update(username.toLowerCase()).digest('hex').slice(0,16);
    return '\\\\.\\pipe\\codex-hamster-' + user;
  }
  return `/private/tmp/codex-hamster-${uid}/events.sock`;
}

// Same decisions as forward() in codex-hook.swift; `undefined` means this hook call is not reported.
function signalFor(provider, event) {
  const name = event?.hook_event_name;
  if (typeof name !== 'string') return;
  let signal = events[provider]?.[name];
  if (!signal) return;
  // Grok also runs the Claude and Cursor hook files; its own hook file reports for it.
  if ((provider === 'claude' || provider === 'cursor') && has(event,'hookEventName')) return;
  if (provider === 'grok') {
    if (has(event,'subagentType')) return;
    if (name === 'Stop' && event.reason !== 'end_turn') return;
    const notification = has(event,'notificationType') ? event.notificationType : event.notification_type;
    if (name === 'Notification' && notification !== 'idle_prompt') return;
  }
  const sessionField = provider === 'cursor' ? 'conversation_id' : provider === 'grok' ? 'sessionId' : 'session_id';
  const session = has(event,sessionField) ? event[sessionField] : event.session_id;
  if (typeof session !== 'string' || !session) return;
  const field = turnFields[provider];
  const turn = typeof event[field] === 'string' && event[field] ? event[field] : undefined;
  if (provider === 'cursor' && name === 'stop' && event.status !== 'completed') signal = 'interrupted';

  const scope = hash([provider,session]);
  const id = hash(provider === 'codex' ? [session,turn ?? session] : [provider,session,turn ?? session]);
  const message = {provider,type:signal,id:signal === 'sessionEnded' ? scope : id,scope};
  if (turn === undefined) message.reusable = true;
  if (signal === 'submitted' && (provider === 'claude' || provider === 'gemini' || provider === 'grok')) {
    message.supersede = true;
  }
  return message;
}

function send(endpoint, payload, timeoutMs = 300) {
  return new Promise(resolve => {
    const socket = net.connect(endpoint);
    socket.setTimeout(timeoutMs,() => {socket.destroy(); resolve();});
    socket.on('error',() => resolve());
    socket.on('close',() => resolve());
    socket.on('connect',() => socket.end(payload));
  });
}

function readInput(stream = process.stdin, limitMs = 1500) {
  return new Promise(resolve => {
    const chunks = [];
    let length = 0;
    const finish = () => {clearTimeout(timer); resolve(length > maxInput ? undefined : Buffer.concat(chunks));};
    const timer = setTimeout(finish,limitMs);
    stream.on('data',chunk => {
      chunks.push(chunk);
      length += chunk.length;
      if (length > maxInput) finish();
    });
    stream.on('end',finish);
    stream.on('error',finish);
  });
}

async function run({provider = 'codex',input,endpoint = eventEndpoint(),deliver = send} = {}) {
  let output = provider === 'cursor' ? '{"continue":true}' : '{}';
  let event;
  try {
    event = input ? JSON.parse(input.toString('utf8')) : undefined;
  } catch {
    event = undefined;
  }
  const message = event && typeof event === 'object' ? signalFor(provider,event) : undefined;
  if (provider === 'cursor' && event?.hook_event_name !== 'beforeSubmitPrompt') output = '{}';
  if (message) await deliver(endpoint,JSON.stringify(message)+'\n');
  return output;
}

if (require.main === module) {
  (async () => {
    let output = '{}';
    try {
      const provider = process.argv[2] ?? 'codex';
      output = await run({provider,input:await readInput()});
    } catch {
      // A hook must never disturb the AI tool.
    }
    process.stdout.write(output+'\n',() => process.exit(0));
  })();
}

module.exports = {eventEndpoint,signalFor,send,run};
