const expiryMs = 2 * 60 * 60 * 1000;
const idleClips = ['blink','sniff','look'];
const cadences = {
  quiet: {rest:5000, human:26000, idleMin:65000, idleSpread:50000},
  normal: {rest:3000, human:15000, idleMin:40000, idleSpread:35000},
  lively: {rest:1500, human:9000, idleMin:22000, idleSpread:23000},
};

function readMotionSettings(saved) {
  return {
    cadence:Object.hasOwn(cadences,saved?.cadence) ? saved.cadence : 'normal',
    ai:(saved?.ai ?? saved?.codex) !== false,
    human:saved?.human !== false,
    ambient:saved?.ambient !== false,
    rewards:saved?.rewards !== false,
    interaction:saved?.interaction === true,
  };
}

function createMotionState(publish, {
  schedule = setTimeout,
  cancel = clearTimeout,
  requestMs = 720,
  replyMs = 960,
  clipMs = {human:840, blink:840, sniff:840, look:960, snack:1440, gift:1760, pat:900, highfive:900},
  clock = Date.now,
  random = Math.random,
  nextReward = () => undefined,
  onReward = () => {},
  settings = readMotionSettings(),
} = {}) {
  settings = readMotionSettings(settings);
  const active = new Map();
  const completed = new Set();
  let clip = 'breathe';
  let timer;
  let pendingReply = false;
  let idleAt;
  let humanBeatAt = 0;
  let humanWasActive = false;
  let humanPending = false;
  let restUntil = 0;
  let ambientIndex = 0;
  let nextHighfiveAt = 0;
  let nextGlanceAt = 0;
  let cadence = cadences[settings.cadence];

  function change(next, repeat = false) {
    if (clip === next && !repeat) return;
    clip = next;
    if (next === 'breathe') restUntil = clock() + cadence.rest;
    publish(next);
  }

  function settle() {
    if (pendingReply) {
      pendingReply = false;
      flash('reply', replyMs);
    } else {
      change(settings.ai && active.size ? 'work' : 'breathe');
    }
  }

  function flash(next, ms) {
    if (timer !== undefined) cancel(timer);
    change(next, true);
    timer = schedule(() => {
      timer = undefined;
      if (next === 'reply' && settings.interaction && settings.ai && !active.size && clock() >= nextHighfiveAt) {
        nextHighfiveAt = clock()+5*60_000;
        flash('offer',3500);
      } else settle();
    }, ms);
  }

  function close(id) {
    const turn = active.get(id);
    active.delete(id);
    if (turn.reusable) return;
    completed.add(id);
    if (completed.size > 256) completed.delete(completed.values().next().value);
  }

  function cancelFlash() {
    if (timer !== undefined) cancel(timer);
    timer = undefined;
  }

  function event(type, id, {scope,provider,reusable = false,supersede = false} = {}) {
    if (type === 'sessionEnded') {
      let ended = false;
      for (const [turn,meta] of active) {
        if (meta.scope === id) ended = event('interrupted',turn) || ended;
      }
      return ended;
    }
    if (type === 'submitted') {
      if (!reusable && (active.has(id) || completed.has(id))) return false;
      const alreadyWorking = active.size > 0;
      if (scope && supersede) {
        for (const [turn,meta] of active) {
          if (turn !== id && meta.scope === scope) close(turn);
        }
      }
      active.set(id,{started:clock(),scope,provider,reusable});
      idleAt = undefined;
      if (settings.ai && !alreadyWorking) {
        humanPending = false;
        pendingReply = false;
        flash('request', requestMs);
      } else if (!alreadyWorking && ['pat','highfive','offer'].includes(clip)) {
        cancelFlash();
        settle();
      }
    } else if ((type === 'finished' || type === 'interrupted') && active.has(id)) {
      close(id);
      if (!settings.ai || active.size) return true;
      if (type === 'finished') {
        if (clip === 'request') pendingReply = true;
        else if (clip !== 'reply') flash('reply', replyMs);
      } else if (clip !== 'reply' && !pendingReply) {
        cancelFlash();
        settle();
      }
    } else {
      return false;
    }
    return true;
  }

  function tick({human, visible}) {
    const now = clock();
    const showingAI = settings.ai && (active.size > 0 || clip === 'reply');
    const beganInput = human && !humanWasActive;
    humanWasActive = human;
    if (!human || !visible || showingAI || !settings.human) humanPending = false;
    else if (beganInput && now >= humanBeatAt) humanPending = true;
    if (human || showingAI) idleAt = undefined;
    else idleAt ??= now + cadence.idleMin + random() * cadence.idleSpread;
    if (!visible || clip !== 'breathe' || now < restUntil) return;

    const reward = settings.rewards && nextReward();
    if (reward) {
      flash(reward, clipMs[reward] + 2000);
    } else if (humanPending) {
      humanPending = false;
      humanBeatAt = now + cadence.human;
      flash('human', clipMs.human);
    } else if (settings.ambient && !human && now >= idleAt) {
      const motion = idleClips[ambientIndex++ % idleClips.length];
      idleAt = undefined;
      flash(motion, clipMs[motion]);
    }
  }

  function configure(next) {
    const previous = settings;
    const source = {
      request:'ai', reply:'ai', work:'ai', human:'human',
      blink:'ambient', sniff:'ambient', look:'ambient', snack:'rewards', gift:'rewards',
      pat:'interaction', highfive:'interaction', offer:'interaction',
    }[clip];
    settings = readMotionSettings(next);
    cadence = cadences[settings.cadence];
    if (settings.cadence !== previous.cadence) idleAt = undefined;
    if (!settings.ai) pendingReply = false;
    if ((source && !settings[source]) || (active.size && settings.ai && !previous.ai)) {
      cancelFlash();
      settle();
    }
  }

  function completeReward() {
    if (clip !== 'snack' && clip !== 'gift') return false;
    cancelFlash();
    onReward(clip);
    settle();
    return true;
  }

  function interact(action) {
    if (!settings.interaction || active.size) return false;
    if (action === 'highfive' && clip === 'offer') {
      flash('highfive',clipMs.highfive);
    } else if (action === 'pat' && canPat()) {
      flash('pat',clipMs.pat);
    } else if (action === 'look' && clip === 'breathe' && clock() >= nextGlanceAt) {
      nextGlanceAt = clock()+20_000;
      flash('look',clipMs.look);
    } else return false;
    return true;
  }

  function canPat() {
    return settings.interaction && !active.size && ['breathe','blink','sniff','look','human'].includes(clip);
  }

  function expire(now = clock()) {
    for (const [id, {started}] of active) {
      if (now - started > expiryMs) close(id);
    }
    if (!active.size && clip === 'work' && timer === undefined) settle();
  }

  function dispose() {
    cancelFlash();
  }

  return {event, tick, configure, interact, completeReward, expire, dispose, get clip() {return clip;},
          get canPat() {return canPat();},
          get activeCount() {return active.size;}, get working() {return active.size > 0;},
          activeTurns(provider) {
            return [...active].filter(([,turn]) => turn.scope && turn.provider === provider)
              .map(([id,{scope,started}]) => ({id,scope,started}));
          }};
}

module.exports = {createMotionState, readMotionSettings};
