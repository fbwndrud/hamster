const {constants} = require('node:fs');
const fs = require('node:fs/promises');
const path = require('node:path');
const {createHash,randomUUID} = require('node:crypto');
const {isMainThread,parentPort,workerData,Worker} = require('node:worker_threads');

const cacheVersion = 3;
const tokenMarker = Buffer.from('"token_count"');
const eventMarker = Buffer.from('"event_msg"');
const isoTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const unavailable = {state:'unsupported',before:null,after:null};
const isCount = value => Number.isSafeInteger(value) && value >= 0;

async function* rollouts(directory, scan) {
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
    if (entry.isDirectory()) yield* rollouts(filename,scan);
    else if (entry.isFile() && /^rollout-.+\.jsonl$/.test(entry.name)) yield filename;
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
  const timestamp = event.timestamp;
  const time = typeof timestamp === 'string' && isoTimestamp.test(timestamp) ? Date.parse(timestamp) : NaN;
  const previousTotal = entry.total;
  entry.total = isCount(total) ? total : null;
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
  // Repeats and resets cannot add usage when a fork copies them as its first snapshot.
  entry.events.push([time,total,isCount(last) ? last : null,Math.max(0,delta),Number(previousTotal !== null),timestamp]);
}

async function scanRollout(filename, stat, previous) {
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
      {...current,offset:0,total:null,events:[],partial:false};

    if (entry.offset < current.size) {
      let fragments = [];
      for await (const chunk of file.createReadStream({start:entry.offset,end:current.size-1,autoClose:false})) {
        let start = 0;
        let end;
        while ((end = chunk.indexOf(10,start)) !== -1) {
          const tail = chunk.subarray(start,end);
          const line = fragments.length ? Buffer.concat([...fragments,tail]) : tail;
          countLine(line,entry);
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

async function scanCodexUsage({home,cachePath,since}) {
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
  let before = null;
  let after = null;
  for (const [time,,,delta] of unique.values()) {
    if (delta === 0) continue;
    if (time < since) before = (before ?? 0)+delta;
    else after = (after ?? 0)+delta;
  }
  const state = before === null && after === null ? 'unsupported' : 'ready';
  return {state,before,after,...(scan.partial ? {partial:true} : {})};
}

function createCodexUsage({home,cachePath,onChange}) {
  let worker, active, queued;
  let started = false;
  let disposed = false;

  function refresh(since) {
    if (disposed || !Number.isFinite(since)) return;
    if (active !== undefined) {
      queued = since === active ? undefined : since;
      return;
    }
    if (!started) {
      started = true;
      onChange({state:'loading',before:null,after:null});
    }
    if (!worker) {
      try {
        const nextWorker = new Worker(__filename,{workerData:{home,cachePath}});
        worker = nextWorker;
        worker.on('message',result => {
          if (worker !== nextWorker) return;
          active = undefined;
          if (queued !== undefined) {
            const since = queued;
            queued = undefined;
            refresh(since);
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
    active = since;
    worker.postMessage(since);
  }

  return {refresh,dispose() {
    disposed = true;
    const running = worker;
    worker = undefined;
    if (running) void running.terminate();
  }};
}

if (!isMainThread) {
  parentPort.on('message',async since => {
    const result = await scanCodexUsage({...workerData,since}).catch(() => unavailable);
    parentPort.postMessage(result);
  });
}

module.exports = {createCodexUsage,scanCodexUsage};
