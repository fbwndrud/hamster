const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {test} = require('node:test');

require('../assets/wardrobe.js');
require('../assets/clips.js');

const root = path.join(__dirname,'..');
const {clips,wardrobe} = globalThis.Hamster;
const viewportSize = 168;
const spriteSize = 512;
const referenceEyes = [[86,99],[152,99]];

function skipBlocks(gif, offset) {
  while (offset < gif.length) {
    const length = gif[offset++];
    if (length === 0) return offset;
    offset += length;
  }
  assert.fail('Unterminated GIF data blocks');
}

function colorTableLength(flags) {
  return flags & 0x80 ? 3 * (2 << (flags & 7)) : 0;
}

function gifFrameDurations(name) {
  const gif = fs.readFileSync(path.join(root,'assets',name+'.gif'));
  assert.match(gif.toString('ascii',0,6), /^GIF8[79]a$/);
  assert.equal(gif.readUInt16LE(6),spriteSize);
  assert.equal(gif.readUInt16LE(8),spriteSize);
  const durations = [];
  let duration;
  let offset = 13 + colorTableLength(gif[10]);
  while (offset < gif.length) {
    const marker = gif[offset++];
    if (marker === 0x3b) return durations;
    if (marker === 0x21) {
      const label = gif[offset++];
      if (label === 0xf9) {
        assert.equal(gif[offset],4);
        duration = 10 * gif.readUInt16LE(offset + 2);
      }
      offset = skipBlocks(gif,offset);
      continue;
    }
    assert.equal(marker,0x2c,`Unexpected GIF block in ${name}`);
    offset += 10 + colorTableLength(gif[offset + 8]); // Descriptor, local palette, and LZW code size.
    offset = skipBlocks(gif,offset);
    assert.ok(duration > 0,`Missing GIF frame delay in ${name}`);
    durations.push(duration);
    duration = undefined;
  }
  assert.fail(`Missing GIF trailer in ${name}`);
}

function project([a,b,c,d,e,f],[x,y]) {
  return [a*x+c*y+e,b*x+d*y+f];
}

function distance([x1,y1],[x2,y2]) {
  return Math.hypot(x1-x2,y1-y2);
}

test('every wardrobe item is a unique, slot-compatible SVG and every preset resolves', () => {
  const items = new Map();
  for (const item of wardrobe.items) {
    const key = `${item.slot}/${item.id}`;
    assert.ok(Object.hasOwn(wardrobe.slots,item.slot),key);
    assert.ok(!items.has(key),`Duplicate item ${key}`);
    assert.equal(item.src,`assets/accessories/${item.slot}-${item.id}.svg`);
    const svg = fs.readFileSync(path.join(root,item.src),'utf8');
    assert.ok(svg.includes(`viewBox="${wardrobe.viewBox}"`),`Mismatched wardrobe rig for ${key}`);
    items.set(key,item);
  }
  for (const slot of Object.keys(wardrobe.slots)) {
    assert.ok(wardrobe.items.some(item => item.slot === slot),`Missing items for ${slot}`);
  }
  for (const preset of wardrobe.presets) {
    for (const [slot,id] of Object.entries(preset.items)) {
      assert.ok(items.has(`${slot}/${id}`),`Unknown accessory in preset ${preset.id}`);
    }
  }
});

test('the rig uses the actual GIF frame boundaries and repeats at the clip duration', () => {
  require('../assets/rig.js');
  const {frameAt} = globalThis.Hamster.rig;
  for (const [id,clip] of Object.entries(clips)) {
    const durations = gifFrameDurations(id);
    assert.deepEqual(clip.frames.map(frame => frame[0]),durations,id);
    let elapsed = 0;
    for (const [index,duration] of durations.entries()) {
      assert.equal(frameAt(clip,elapsed),index,`${id} frame ${index} start`);
      assert.equal(frameAt(clip,elapsed + duration - 1),index,`${id} frame ${index} end`);
      elapsed += duration;
    }
    assert.equal(clip.ms,elapsed,id);
    assert.equal(frameAt(clip,elapsed),0,`${id} loop boundary`);
  }
});

test('head accessories follow eye landmarks and stay within the overlay', () => {
  require('../assets/rig.js');
  const {fit,poseScale} = globalThis.Hamster.rig;
  const outfitEdges = [
    [116,4.75], // Knit pom-pom top.
    [37.75,96], [202.25,96], // Headphone outer edges.
  ];
  const screenScale = viewportSize/spriteSize;
  for (const [id,clip] of Object.entries(clips)) {
    const [scaleX,scaleY] = poseScale(clip);
    const fits = clip.frames.map(([,lx,ly,rx,ry],index) => {
      const label = `${id} frame ${index}`;
      const matrix = fit([lx,ly,rx,ry]);
      assert.ok(matrix.length === 6 && matrix.every(Number.isFinite),label);
      assert.ok(matrix[0] > 0,label);
      assert.ok(distance(project(matrix,referenceEyes[0]),[lx,ly]) < 1,label);
      assert.ok(distance(project(matrix,referenceEyes[1]),[rx,ry]) < 1,label);
      for (const edge of outfitEdges) {
        const [rawX,rawY] = project(matrix,edge);
        const x = 84 + (rawX*screenScale-84)*scaleX;
        const y = 167 + (rawY*screenScale+clip.offsetY-167)*scaleY;
        assert.ok(x >= 0 && x < viewportSize && y >= 0 && y < viewportSize,label);
      }
      return matrix;
    });
    for (const [index,current] of fits.entries()) {
      const next = fits[(index+1) % fits.length];
      // The deliberate reply tilt moves the end of a tall hat more than a normal bounce.
      const limit = id === 'reply' ? 13 : 6;
      for (const edge of outfitEdges) {
        const jump = distance(project(current,edge),project(next,edge)) * screenScale;
        assert.ok(jump < limit,`${id} frame ${index} has a ${jump.toFixed(1)}px outfit jump`);
      }
    }
  }
});

test('neckwear stays at the ledge and each GIF frame has its own foreground coverage', () => {
  require('../assets/rig.js');
  require('../assets/reward-occlusion.js');
  const {rig,rewardOcclusion} = globalThis.Hamster;
  for (const [id,clip] of Object.entries(clips)) {
    const masks = rewardOcclusion[id];
    assert.equal(masks?.length,clip.frames.length,`${id} mask count`);
    for (const [index,[,lx,ly,rx,ry]] of clip.frames.entries()) {
      const label = `${id} frame ${index}`;
      const neckFit = rig.fitNeck(clip,[lx,ly,rx,ry]);
      const [x,y] = project(neckFit,[120,154]);
      assert.ok(Math.abs(x - (lx+rx)/2) < 1,`${label} neck horizontal alignment`);
      const screenY = y * viewportSize / spriteSize + clip.offsetY;
      assert.ok(screenY >= 146 && screenY <= 155,`${label} neck height`);
      for (const edge of [[51,151],[198,172.25],[122,179.25]]) {
        const [rawX,rawY] = project(neckFit,edge);
        assert.ok(rawX >= 0 && rawX < spriteSize && rawY >= 0 && rawY < spriteSize,label);
      }
      assert.match(masks[index],/^[MAHLCQVZmahclqvz0-9 .-]+$/,label);
      assert.ok((masks[index].match(/M/g) ?? []).length >= 2,`${label} must cover both paws`);
    }
  }
  for (const id of ['request','work','snack','gift','highfive']) {
    assert.ok(new Set(rewardOcclusion[id]).size >= 4,`${id} coverage must move with the foreground`);
  }
  assert.ok((rewardOcclusion.snack[6].match(/M/g) ?? []).length >= 3,'seed has foreground coverage');
  assert.ok((rewardOcclusion.gift[6].match(/M/g) ?? []).length >= 6,'box and ribbon have foreground coverage');
});

test('wide scarves reach both sides of the torso at each pose', () => {
  require('../assets/rig.js');
  const {rig} = globalThis.Hamster;
  const scarves = wardrobe.items.filter(item => item.fit === 'scarf').map(item => item.id);
  assert.deepEqual(scarves,['rust','dots','blue','constellation-wrap']);
  for (const clip of Object.values(clips)) {
    for (const [, ...eyes] of clip.frames) {
      const neck = rig.fitNeck(clip,eyes);
      const wrap = rig.fitScarf(neck,row => {
        assert.ok(row >= 370 && row <= 441);
        return [65,450];
      });
      assert.ok(distance(project(wrap,[10,144]),[69,project(neck,[120,144])[1]]) < 1);
      assert.ok(distance(project(wrap,[230,144]),[446,project(neck,[120,144])[1]]) < 1);
    }
  }
});
