const {constants} = require('node:fs');
const fs = require('node:fs/promises');
const path = require('node:path');
const {summarize,unavailable,isCount,isoTimestamp,rollouts,scanRollout,metadata,unchanged,readCache,writeCache,validEntry} =
  require('./codex-usage.cjs');

// Records are [time, key, total, output]. A key is one model response, so copies and rewrites count once.
const usageMarker = Buffer.from('"usage"');
const assistantMarker = Buffer.from('"assistant"');
const tokensMarker = Buffer.from('"tokens"');
const parseTime = value => typeof value === 'string' && isoTimestamp.test(value) ? Date.parse(value) : NaN;

function push(entry, record) {
  const last = entry.events.at(-1);
  // Claude Code writes one line per content block, all carrying the same response usage.
  if (last?.[1] === record[1]) {
    if (record[2] >= last[2]) entry.events[entry.events.length-1] = record;
  } else entry.events.push(record);
}

function parse(line, entry) {
  try {
    return JSON.parse(line.toString('utf8'));
  } catch {
    entry.partial = true;
  }
}

function claudeLine(line, entry) {
  if (!line.includes(usageMarker) || !line.includes(assistantMarker)) return;
  const record = parse(line,entry);
  if (record?.type !== 'assistant') return;
  const {id,usage} = record.message ?? {};
  if (typeof id !== 'string' || !usage) return;
  const input = [usage.input_tokens,usage.cache_creation_input_tokens ?? 0,usage.cache_read_input_tokens ?? 0];
  const time = parseTime(record.timestamp);
  if (!input.every(isCount) || !isCount(usage.output_tokens) || !Number.isFinite(time)) {
    entry.partial = true;
    return;
  }
  push(entry,[time,id,input.reduce((sum,count) => sum+count,0)+usage.output_tokens,usage.output_tokens]);
}

function geminiMessage(message, entry) {
  if (message?.type !== 'gemini' || !message.tokens) return;
  const {total,output = 0,thoughts = 0} = message.tokens;
  const time = parseTime(message.timestamp);
  if (typeof message.id !== 'string' || !isCount(total) || !isCount(output) || !isCount(thoughts) || !Number.isFinite(time)) {
    entry.partial = true;
    return;
  }
  push(entry,[time,message.id,total,output+thoughts]);
}

// Gemini CLI appends whole message records again as they change; rewinds still spent their tokens.
function geminiRecord(record, entry) {
  geminiMessage(record,entry);
  for (const messages of [record?.messages,record?.$set?.messages]) {
    if (Array.isArray(messages)) for (const message of messages) geminiMessage(message,entry);
  }
}

function geminiLine(line, entry) {
  if (!line.includes(tokensMarker)) return;
  const record = parse(line,entry);
  if (record) geminiRecord(record,entry);
}

function grokUsage(document, entry) {
  const turns = document?.turns;
  if (typeof document?.sessionId !== 'string' || !Array.isArray(turns)) {
    entry.partial = true;
    return;
  }
  for (const turn of turns) {
    const time = parseTime(turn?.endedAt);
    if (!isCount(turn?.turnNumber) || !isCount(turn.totalTokens) || !isCount(turn.outputTokens) || !Number.isFinite(time)) {
      entry.partial = true;
      continue;
    }
    push(entry,[time,`${document.sessionId}:${turn.turnNumber}`,turn.totalTokens,turn.outputTokens]);
  }
}

// Small files that are rewritten in place are read whole whenever they change.
async function scanDocument(filename, stat, previous, extract) {
  const current = metadata(stat);
  if (unchanged(previous,current)) return previous;
  const file = await fs.open(filename,constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await file.stat();
    if (opened.ino !== stat.ino || opened.dev !== stat.dev) throw new Error('Record changed while opening');
    const entry = {...metadata(opened),offset:opened.size,total:null,fingerprint:'',events:[],partial:false};
    const document = parse(await file.readFile(),entry);
    if (document !== undefined) extract(document,entry);
    return entry;
  } finally {
    await file.close();
  }
}

const sources = {
  claude:home => [{directory:path.join(home,'projects'),pattern:/\.jsonl$/,read:(file,stat,old) => scanRollout(file,stat,old,claudeLine)}],
  gemini:home => [
    {directory:path.join(home,'tmp'),pattern:/\.jsonl$/,inChats:true,read:(file,stat,old) => scanRollout(file,stat,old,geminiLine)},
    {directory:path.join(home,'tmp'),pattern:/^session-.+\.json$/,inChats:true,
     read:(file,stat,old) => scanDocument(file,stat,old,geminiRecord)},
  ],
  grok:home => [{directory:path.join(home,'sessions'),pattern:/^usage\.json$/,read:(file,stat,old) => scanDocument(file,stat,old,grokUsage)}],
};

async function scanToolUsage(provider, {home,cachePath,since,dayStart = Infinity}) {
  if (!Number.isFinite(since)) return unavailable;
  const previous = await readCache(cachePath);
  const files = Object.create(null);
  const unique = new Map();
  const scan = {partial:false};
  let updated = false;
  for (const {directory,pattern,inChats,read} of sources[provider](home)) {
    for await (const filename of rollouts(directory,scan,pattern)) {
      if (inChats && !path.relative(directory,filename).split(path.sep).includes('chats')) continue;
      try {
        const stat = await fs.lstat(filename);
        if (!stat.isFile()) continue;
        const key = `${stat.dev}:${stat.ino}`;
        if (Object.hasOwn(files,key)) continue;
        const old = validEntry(previous[key]) ? previous[key] : undefined;
        const file = await read(filename,stat,old);
        files[key] = file;
        updated ||= file !== old;
        scan.partial ||= file.partial;
        for (const record of file.events) {
          if (!Array.isArray(record)) continue;
          const [time,id,total,output] = record;
          if (!Number.isFinite(time) || typeof id !== 'string' || !isCount(total) || !isCount(output)) continue;
          const existing = unique.get(id);
          if (!existing || total > existing[1]) unique.set(id,[time,total,output]);
        }
      } catch {
        scan.partial = true;
      }
    }
  }
  if (updated || Object.keys(files).length !== Object.keys(previous).length) await writeCache(cachePath,files);
  return summarize(unique.values(),since,dayStart,scan.partial);
}

const scanners = Object.fromEntries(Object.keys(sources).map(provider =>
  [provider,options => scanToolUsage(provider,options)]));

module.exports = {scanners,scanToolUsage};
