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

module.exports = {rewardInterval, humanIdleLimit, sampleWork, nextReward, readProgress};
