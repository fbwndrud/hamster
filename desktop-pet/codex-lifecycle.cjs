const {createHash} = require('node:crypto');
const {constants} = require('node:fs');
const fs = require('node:fs/promises');
const path = require('node:path');

const uuid = '[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}';
const rolloutName = new RegExp(`^rollout-.*-(${uuid})(?:_${uuid})?\\.jsonl$`,'i');
const transcriptName = new RegExp(`^(${uuid})\\.jsonl$`,'i');
const interruptMarker = '[Request interrupted by user';
const tailBytes = 1024 * 1024;
const hash = parts => createHash('sha256').update(JSON.stringify(parts)).digest('hex');

async function rolloutTail(filename) {
  const file = await fs.open(filename,constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await file.stat();
    if (!stat.isFile()) return '';
    const offset = Math.max(0,stat.size-tailBytes);
    const bytes = Buffer.alloc(stat.size-offset);
    const {bytesRead} = await file.read(bytes,0,bytes.length,offset);
    const tail = bytes.toString('utf8',0,bytesRead);
    const start = offset === 0 ? 0 : tail.indexOf('\n')+1;
    return tail.slice(start,tail.lastIndexOf('\n')+1);
  } finally {
    await file.close();
  }
}

async function codexTerminals(home, turns) {
  if (!turns.length) return [];
  const scopes = new Map();
  for (const {id,scope} of turns) {
    if (!scopes.has(scope)) scopes.set(scope,new Set());
    scopes.get(scope).add(id);
  }
  const entries = await fs.readdir(path.join(home,'sessions'),{recursive:true,withFileTypes:true}).catch(() => []);
  const terminals = new Map();
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const session = rolloutName.exec(entry.name)?.[1];
    if (!session) continue;
    const ids = scopes.get(hash(['codex',session]));
    if (!ids) continue;
    const tail = await rolloutTail(path.join(entry.parentPath,entry.name)).catch(() => '');
    for (const line of tail.split('\n')) {
      if (!line.includes('"task_complete"') && !line.includes('"turn_aborted"')) continue;
      let event;
      try { event = JSON.parse(line); } catch { continue; }
      if (event?.type !== 'event_msg') continue;
      const {type,turn_id,root_turn_id,error} = event.payload ?? {};
      if ((type !== 'task_complete' && type !== 'turn_aborted') || typeof turn_id !== 'string' ||
          (root_turn_id != null && root_turn_id !== turn_id)) continue;
      const id = hash([session,turn_id]);
      if (ids.has(id)) terminals.set(id,{id,type:type === 'turn_aborted' || error ? 'interrupted' : 'finished'});
    }
  }
  return [...terminals.values()];
}

// Claude Code sends no hook when the user interrupts a turn, but it writes a marker to the session transcript.
function interruptedAt(line) {
  if (!line.includes(interruptMarker)) return;
  let event;
  try { event = JSON.parse(line); } catch { return; }
  if (event?.type !== 'user' || event.isSidechain === true) return;
  const content = event.message?.content;
  const blocks = typeof content === 'string' ? [{type:'text',text:content}] : Array.isArray(content) ? content : [];
  if (!blocks.some(block => block?.type === 'text' && typeof block.text === 'string' && block.text.startsWith(interruptMarker))) return;
  const at = Date.parse(event.timestamp);
  if (!Number.isFinite(at)) return;
  return {at,prompt:typeof event.promptId === 'string' ? event.promptId : undefined};
}

async function claudeTerminals(home, turns) {
  if (!turns.length) return [];
  const scopes = new Map();
  for (const turn of turns) {
    if (!scopes.has(turn.scope)) scopes.set(turn.scope,[]);
    scopes.get(turn.scope).push(turn);
  }
  const root = path.join(home,'projects');
  const projects = await fs.readdir(root,{withFileTypes:true}).catch(() => []);
  const terminals = new Map();
  for (const project of projects) {
    if (!project.isDirectory()) continue;
    const entries = await fs.readdir(path.join(root,project.name),{withFileTypes:true}).catch(() => []);
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const session = transcriptName.exec(entry.name)?.[1];
      const active = session && scopes.get(hash(['claude',session]));
      if (!active) continue;
      const tail = await rolloutTail(path.join(root,project.name,entry.name)).catch(() => '');
      let latest;
      for (const line of tail.split('\n')) latest = interruptedAt(line) ?? latest;
      if (!latest) continue;
      for (const {id,started} of active) {
        if ((latest.prompt && hash(['claude',session,latest.prompt]) === id) || latest.at >= started) {
          terminals.set(id,{id,type:'interrupted'});
        }
      }
    }
  }
  return [...terminals.values()];
}

module.exports = {codexTerminals,claudeTerminals};
