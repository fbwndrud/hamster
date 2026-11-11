const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createMotionState} = require('../motion-state.cjs');

function setup(options = {}) {
  const clips = [];
  const scheduled = new Map();
  const state = createMotionState(clip => clips.push(clip), {
    ...options,
    schedule: (callback, delay) => {
      const id = Symbol();
      scheduled.set(id, {callback, delay});
      return id;
    },
    cancel: id => scheduled.delete(id),
  });
  const finishClip = () => {
    const [id, {callback, delay}] = scheduled.entries().next().value;
    scheduled.delete(id);
    callback();
    return delay;
  };
  return {state, clips, finishClip};
}

test('short Codex turn gets both animations in order', () => {
  const {state, clips, finishClip} = setup();
  state.event('submitted','one');
  state.event('finished','one');
  assert.equal(finishClip(), 720);
  assert.equal(finishClip(), 960);
  assert.deepEqual(clips,['request','reply','breathe']);
});

test('human work is a short beat and ambient motions wait for quiet', () => {
  let now = 0;
  const {state, clips, finishClip} = setup({clock: () => now, random: () => 0});
  state.tick({human:true, visible:true});
  finishClip();
  state.tick({human:true, visible:true});
  state.tick({human:false, visible:true});
  now += 40000;
  state.tick({human:false, visible:true});
  state.event('submitted','one');
  finishClip();
  assert.deepEqual(clips,['human','breathe','blink','request','work']);
});

test('sustained human input reacts once and input during AI work is not queued', () => {
  let now = 0;
  const {state,clips,finishClip} = setup({clock:() => now});
  const active = {human:true,visible:true};
  state.tick(active);
  finishClip();
  now += 60000;
  state.tick(active);
  assert.deepEqual(clips,['human','breathe']);

  state.tick({...active,human:false});
  state.event('submitted','turn');
  finishClip();
  state.tick(active);
  state.event('finished','turn');
  finishClip();
  now += 60000;
  state.tick(active);
  assert.deepEqual(clips,['human','breathe','request','work','reply','breathe']);

  state.tick({...active,human:false});
  state.tick(active);
  assert.equal(state.clip,'human');
});

test('quiet idle habits rotate through blink, sniff, and a glance', () => {
  let now = 0;
  const {state, clips, finishClip} = setup({clock: () => now, random: () => 0});
  const quiet = {human:false, visible:true};
  for (let i = 0; i < 3; i++) {
    state.tick(quiet);
    now += 40000;
    state.tick(quiet);
    finishClip();
    now += 3000;
  }
  assert.deepEqual(clips,['blink','breathe','sniff','breathe','look','breathe']);
});

test('an earned reward waits for the reply and can replay if work interrupts it', () => {
  let now = 0;
  let available = 'gift';
  const {state, clips, finishClip} = setup({
    clock: () => now,
    nextReward: () => available,
    onReward: () => { available = undefined; },
  });
  const visible = {human:false, visible:true};
  state.event('submitted','one');
  state.tick(visible);
  state.event('finished','one');
  finishClip();
  finishClip();
  now += 3000;
  state.tick({...visible, visible:false});
  state.tick(visible);
  state.event('submitted','two');
  state.event('interrupted','two');
  now += 3000;
  state.tick(visible);
  state.completeReward();
  assert.equal(available, undefined);
  assert.deepEqual(clips,['request','reply','breathe','gift','request','breathe','gift','breathe']);
});

test('a reward timeout leaves the reward available if no renderer acknowledged it', () => {
  let credited = 0;
  const {state, finishClip} = setup({
    nextReward: () => 'snack',
    onReward: () => credited++,
  });
  state.tick({human:false, visible:true});
  finishClip();
  assert.equal(state.completeReward(),false);
  assert.equal(credited,0);
});

test('quiet mode spaces decorative clips and disabled reactions leave work tracked', () => {
  let now = 0;
  const {state, clips, finishClip} = setup({
    clock: () => now, random: () => 0, nextReward: () => 'snack',
  });
  const visible = {human:false, visible:true};
  state.configure({cadence:'quiet', rewards:false, human:false, codex:false});
  state.event('submitted','one');
  assert.equal(state.working, true);
  state.event('finished','one');
  state.tick({...visible, human:true});
  state.tick(visible);
  now += 64000;
  state.tick(visible);
  assert.deepEqual(clips,[]);
  now += 1000;
  state.tick(visible);
  finishClip();
  state.configure({cadence:'quiet', rewards:true});
  state.tick(visible);
  assert.deepEqual(clips,['blink','breathe']);
  now += 5000;
  state.tick(visible);
  assert.deepEqual(clips,['blink','breathe','snack']);
});

test('overlapping turns share one start and reply only when the last one finishes', () => {
  const {state, clips, finishClip} = setup();
  state.event('submitted','one');
  state.event('submitted','two');
  assert.equal(state.activeCount,2);
  finishClip();
  state.event('finished','one');
  assert.equal(state.activeCount,1);
  assert.deepEqual(clips,['request','work']);
  state.event('finished','two');
  finishClip();
  assert.equal(state.activeCount,0);
  assert.deepEqual(clips,['request','work','reply','breathe']);
});

test('duplicate and unmatched terminal events cannot replay a reply', () => {
  const {state, clips, finishClip} = setup();
  state.event('finished','unknown');
  state.event('submitted','one');
  state.event('submitted','one');
  finishClip();
  state.event('finished','one');
  state.event('finished','one');
  state.event('submitted','one');
  finishClip();
  assert.deepEqual(clips,['request','work','reply','breathe']);
});
test('a provider with session-only identifiers can run successive turns', () => {
  const {state,finishClip} = setup();
  assert.equal(state.event('submitted','session',{reusable:true,scope:'session'}),true);
  assert.equal(state.event('finished','session'),true);
  finishClip();
  finishClip();
  assert.equal(state.event('submitted','session',{reusable:true,scope:'session'}),true);
  assert.equal(state.event('sessionEnded','session'),true);
  assert.equal(state.clip,'breathe');
});

test('a new prompt replaces an interrupted turn only in its own tool session', () => {
  const {state} = setup();
  state.event('submitted','old',{scope:'claude'});
  state.event('submitted','unrelated',{scope:'cursor'});
  state.event('submitted','new',{scope:'claude',supersede:true});
  assert.equal(state.event('finished','old'),false);
  state.event('sessionEnded','claude');
  assert.equal(state.working,true);
  state.event('sessionEnded','cursor');
  assert.equal(state.working,false);
});

test('opt-in touch plays once and yields to AI work', () => {
  const {state,clips} = setup();
  assert.equal(state.interact('pat'),false);
  state.configure({interaction:true});
  assert.equal(state.interact('pat'),true);
  assert.equal(state.interact('pat'),false);
  state.event('submitted','turn');
  assert.equal(state.interact('pat'),false);
  assert.deepEqual(clips,['pat','request']);
});

test('only the last completed task can offer a high five, with a cooldown', () => {
  const {state,clips,finishClip} = setup({settings:{interaction:true}});
  state.event('submitted','one');
  state.event('submitted','two');
  finishClip();
  state.event('finished','one');
  assert.equal(state.interact('highfive'),false);
  state.event('finished','two');
  finishClip();
  assert.equal(state.clip,'offer');
  assert.equal(state.interact('highfive'),true);
  assert.equal(state.interact('highfive'),false);
  finishClip();
  state.event('submitted','three');
  state.event('finished','three');
  finishClip();
  finishClip();
  assert.deepEqual(clips,['request','work','reply','offer','highfive','breathe','request','reply','breathe']);
});

test('working providers name each tool with an open turn once', () => {
  const {state} = setup();
  state.event('submitted','a',{scope:'s1',provider:'claude'});
  state.event('submitted','b',{scope:'s2',provider:'claude'});
  state.event('submitted','c',{scope:'s3',provider:'grok'});
  assert.deepEqual([...state.workingProviders].sort(),['claude','grok']);
  state.event('finished','c');
  state.event('sessionEnded','s1');
  assert.deepEqual([...state.workingProviders],['claude']);
  state.event('finished','b');
  assert.equal(state.workingProviders.size,0);
});
