const {constants} = require('node:fs');
const fs = require('node:fs/promises');
const path = require('node:path');
const {createHash,randomUUID} = require('node:crypto');
const {isMainThread,parentPort,workerData,Worker} = require('node:worker_threads');

const cacheVersion = 4;
const tokenMarker = Buffer.from('"token_count"');
const eventMarker = Buffer.from('"event_msg"');
const isoTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const unavailable = {state:'unsupported',before:null,after:null,today:null,todayOutput:null,afterOutput:null};
const isCount = value => Number.isSafeInteger(value) && value >= 0;

async function* rollouts(directory, scan, pattern = /^rollout-.+\.jsonl$/) {
  let entries;
  try {
    if (!(await fs.lstat(directory)).isDirectory()) return;
    entries = await fs.readdir(directory,{withFileTypes:true});
  } catch (error) {
    if (error.code !== 'ENOENT') scan.partial = true;
    return;
  }
  for (const entry of entries) {
    const filename = path.join(directory,entry.name);
    if (entry.isDirectory()) yield* rollouts(filename,scan,pattern);
    else if (entry.isFile() && pattern.test(entry.name)) yield filename;
  }
}

function metadata(stat) {
  return {size:stat.size,modifiedAt:stat.mtimeMs,changedAt:stat.ctimeMs,createdAt:stat.birthtimeMs};
}

function unchanged(previous, current) {
  return previous?.size === current.size && previous.modifiedAt === current.modifiedAt &&
    previous.changedAt === current.changedAt && previous.createdAt === current.createdAt;
}

// Sample the committed prefix so a larger replacement does not look like an append.
async function fingerprint(file, offset) {
  const hash = createHash('sha256');
  const length = Math.min(offset,2048);
  if (length) {
    const buffer = Buffer.alloc(length);
    for (const position of new Set([0,Math.floor((offset-length)/2),offset-length])) {
      const {bytesRead} = await file.read(buffer,0,length,position);
      if (bytesRead !== length) throw new Error('Rollout changed while scanning');
      hash.update(buffer);
    }
  }
  return hash.digest('hex');
}

function countLine(line, entry) {
  if (!line.includes(tokenMarker) || !line.includes(eventMarker)) return;
  let event;
  try { event = JSON.parse(line.toString('utf8')); }
  catch { entry.partial = true; entry.total = null; return; }
  if (event?.type !== 'event_msg' || event.payload?.type !== 'token_count') return;
  const info = event.payload.info;
  const total = info?.total_token_usage?.total_tokens;
  const last = info?.last_token_usage?.total_tokens;
  const output = info?.total_token_usage?.output_tokens;
  const lastOutput = info?.last_token_usage?.output_tokens;
  const timestamp = event.timestamp;
  const time = typeof timestamp === 'string' && isoTimestamp.test(timestamp) ? Date.parse(timestamp) : NaN;
  const previousTotal = entry.total;
  const previousOutput = entry.output ?? null;
  entry.total = isCount(total) ? total : null;
  entry.output = isCount(output) ? output : null;
  if (entry.total === null || !Number.isFinite(time)) {
    entry.partial = true;
    return;
  }
  if (previousTotal === null && (!isCount(last) || last > total)) {
    entry.partial = true;
    return;
  }
  const delta = previousTotal === null ? last : total-previousTotal;
  if (delta < 0) entry.partial = true;
  const outputDelta = entry.output === null ? 0 : previousOutput === null ?
    (isCount(lastOutput) ? lastOutput : 0) : entry.output-previousOutput;
  // Repeats and resets cannot add usage when a fork copies them as its first snapshot.
  entry.events.push([time,total,isCount(last) ? last : null,Math.max(0,delta),Number(previousTotal !== null),timestamp,
    Math.max(0,Math.min(outputDelta,Math.max(0,delta)))]);
}

async function scanRollout(filename, stat, previous, count = countLine) {
  const current = metadata(stat);
  if (unchanged(previous,current)) return previous;
  const file = await fs.open(filename,constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await file.stat();
    if (opened.ino !== stat.ino || opened.dev !== stat.dev || opened.size < current.size) {
      throw new Error('Rollout changed while opening');
    }
    const append = previous && current.size > previous.size && current.createdAt === previous.createdAt &&
      await fingerprint(file,previous.offset) === previous.fingerprint;
    const entry = append ? {...previous,...current,events:[...previous.events]} :
      {...current,offset:0,total:null,output:null,events:[],partial:false};

    if (entry.offset < current.size) {
      let fragments = [];
      for await (const chunk of file.createReadStream({start:entry.offset,end:current.size-1,autoClose:false})) {
        let start = 0;
        let end;
        while ((end = chunk.indexOf(10,start)) !== -1) {
          const tail = chunk.subarray(start,end);
          const line = fragments.length ? Buffer.concat([...fragments,tail]) : tail;
          count(line,entry);
          entry.offset += line.length+1;
          fragments = [];
          start = end+1;
        }
        if (start < chunk.length) fragments.push(chunk.subarray(start));
      }
    }

    const end = metadata(await file.stat());
    if (end.size < current.size || (end.size === current.size && !unchanged(end,current))) {
      throw new Error('Rollout changed while scanning');
    }
    entry.fingerprint = await fingerprint(file,entry.offset);
    return entry;
  } finally {
    await file.close();
  }
}

async function readCache(cachePath) {
  try {
    const cache = JSON.parse(await fs.readFile(cachePath,'utf8'));
    if (cache?.version === cacheVersion && cache.files && typeof cache.files === 'object') return cache.files;
  } catch {
    // A missing or incomplete cache can be rebuilt from the rollouts.
  }
  return {};
}

function validEntry(entry) {
  return entry && isCount(entry.offset) && isCount(entry.size) && entry.offset <= entry.size &&
    typeof entry.fingerprint === 'string' && Array.isArray(entry.events) &&
    (entry.total === null || isCount(entry.total));
}

async function writeCache(cachePath, files) {
  const temporary = cachePath+'.'+randomUUID();
  try {
    await fs.mkdir(path.dirname(cachePath),{recursive:true});
    await fs.writeFile(temporary,JSON.stringify({version:cacheVersion,files}),{mode:0o600,flag:'wx'});
    await fs.rename(temporary,cachePath);
  } catch {
    // The computed usage is still usable if the cache cannot be persisted.
    await fs.rm(temporary,{force:true}).catch(() => {});
  }
}

// Splits deduplicated [time, total, output] records around the tracking start and today's local midnight.
function summarize(records, since, dayStart, partial) {
  let before = null;
  let after = null;
  let afterOutput = null;
  let today = null;
  let todayOutput = null;
  for (const [time,total,output] of records) {
    if (!total) continue;
    if (time < since) before = (before ?? 0)+total;
    else {
      after = (after ?? 0)+total;
      afterOutput = (afterOutput ?? 0)+output;
    }
    if (time >= dayStart) {
      today = (today ?? 0)+total;
      todayOutput = (todayOutput ?? 0)+output;
    }
  }
  const state = before === null && after === null ? 'unsupported' : 'ready';
  return {state,before,after,today,todayOutput,afterOutput,...(partial ? {partial:true} : {})};
}

async function scanCodexUsage({home,cachePath,since,dayStart = Infinity}) {
  if (!Number.isFinite(since)) return unavailable;
  const previous = await readCache(cachePath);
  const files = Object.create(null);
  const unique = new Map();
  const scan = {partial:false};
  let updated = false;
  for (const directory of ['sessions','archived_sessions']) {
    for await (const filename of rollouts(path.join(home,directory),scan)) {
      try {
        const stat = await fs.lstat(filename);
        if (!stat.isFile()) continue;
        const key = `${stat.dev}:${stat.ino}`;
        if (Object.hasOwn(files,key)) continue;
        const old = validEntry(previous[key]) ? previous[key] : undefined;
        const file = await scanRollout(filename,stat,old);
        files[key] = file;
        updated ||= file !== old;
        scan.partial ||= file.partial;
        for (const record of file.events) {
          if (!Array.isArray(record)) continue;
          const [time,total,last,delta,confidence,timestamp] = record;
          if (!Number.isFinite(time) || !isCount(total) || !isCount(delta) || typeof timestamp !== 'string') continue;
          const eventKey = `${timestamp}:${total}:${last}`;
          const existing = unique.get(eventKey);
          if (!existing || confidence > existing[4] || (confidence === existing[4] && delta < existing[3])) {
            unique.set(eventKey,record);
          }
        }
      } catch {
        scan.partial = true;
      }
    }
  }
  if (updated || Object.keys(files).length !== Object.keys(previous).length) await writeCache(cachePath,files);
  const records = [...unique.values()].map(([time,,,delta,,,output]) => [time,delta,isCount(output) ? output : 0]);
  return summarize(records,since,dayStart,scan.partial);
}

const scanners = {codex:scanCodexUsage};
const scannerFor = provider => scanners[provider] ?? require('./tool-usage.cjs').scanners[provider];

// Each provider scans its local records in its own worker; a request is {since, dayStart}.
function createUsageReader({provider = 'codex',home,cachePath,onChange}) {
  let worker, active, queued;
  let started = false;
  let disposed = false;

  function refresh(since, dayStart = Infinity) {
    if (disposed || !Number.isFinite(since)) return;
    const request = {since,dayStart};
    // A request during a scan runs once more afterwards, since the records may have changed meanwhile.
    if (active !== undefined) {
      queued = request;
      return;
    }
    if (!started) {
      started = true;
      onChange({...unavailable,state:'loading'});
    }
    if (!worker) {
      try {
        const nextWorker = new Worker(__filename,{workerData:{provider,home,cachePath}});
        worker = nextWorker;
        worker.on('message',result => {
          if (worker !== nextWorker) return;
          active = undefined;
          if (queued !== undefined) {
            const next = queued;
            queued = undefined;
            refresh(next.since,next.dayStart);
          } else onChange(result);
        });
        const failed = () => {
          if (worker !== nextWorker) return;
          worker = active = queued = undefined;
          onChange(unavailable);
        };
        worker.on('error',failed);
        worker.on('exit',failed);
      } catch {
        onChange(unavailable);
        return;
      }
    }
    active = request;
    worker.postMessage(request);
  }

  return {refresh,dispose() {
    disposed = true;
    const running = worker;
    worker = undefined;
    if (running) void running.terminate();
  }};
}

if (!isMainThread) {
  const {provider,...options} = workerData;
  parentPort.on('message',async ({since,dayStart}) => {
    const result = await Promise.resolve().then(() => scannerFor(provider)({...options,since,dayStart}))
      .catch(() => unavailable);
    parentPort.postMessage(result);
  });
}

module.exports = {createUsageReader,scanCodexUsage,summarize,unavailable,isCount,isoTimestamp,
  rollouts,scanRollout,metadata,unchanged,readCache,writeCache,validEntry};
