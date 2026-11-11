const rewardInterval = 5 * 60 * 1000;
const humanIdleLimit = 8;

function sampleWork({elapsed, idle, ai, suspended}) {
  if (suspended || elapsed <= 0 || elapsed > 3000) return 0;
  return ai || idle < humanIdleLimit ? Math.floor(elapsed) : 0;
}

function readProgress(saved) {
  const workMs = Number.isSafeInteger(saved?.workMs) ? Math.max(0, saved.workMs) : 0;
  const shown = Number.isSafeInteger(saved?.shown)
    ? Math.max(0, Math.min(saved.shown, Math.floor(workMs / rewardInterval))) : 0;
  return {workMs, shown};
}

function nextReward({workMs, shown}) {
  if (workMs >= (shown + 1) * rewardInterval) {
    return (shown + 1) % 4 === 0 ? 'gift' : 'snack';
  }
}

const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;

// Each tool keeps its own clock: overlapping sessions of one tool count once, two tools working together both count.
function readToolTime(saved, providers) {
  return Object.fromEntries(providers.map(provider => {
    const entry = saved?.[provider];
    return [provider,{totalMs:count(entry?.totalMs),day:typeof entry?.day === 'string' ? entry.day : '',todayMs:count(entry?.todayMs)}];
  }));
}

function addToolTime(times, providers, elapsed, day) {
  if (elapsed <= 0 || elapsed > 3000) return false;
  const worked = Math.floor(elapsed);
  let changed = false;
  for (const provider of providers) {
    if (typeof provider !== 'string' || !Object.hasOwn(times,provider)) continue;
    const entry = times[provider];
    if (entry.day !== day) Object.assign(entry,{day,todayMs:0});
    entry.totalMs += worked;
    entry.todayMs += worked;
    changed = true;
  }
  return changed;
}

const todayMs = (entry, day) => entry?.day === day ? entry.todayMs : 0;

module.exports = {rewardInterval, humanIdleLimit, sampleWork, nextReward, readProgress, readToolTime, addToolTime, todayMs};
