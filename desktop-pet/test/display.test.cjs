const assert = require('node:assert/strict');
const {test} = require('node:test');
const {bottomPosition, readPlacement} = require('../placement.cjs');
require('../assets/outline.js');
require('../assets/rig.js');
require('../assets/clips.js');

test('all three positions preserve the same bottom edge, including an offset display', () => {
  const area = {x:-600,y:30,width:600,height:800};
  assert.deepEqual(bottomPosition(area,168,'left'),[-588,659]);
  assert.deepEqual(bottomPosition(area,168,'center'),[-384,659]);
  assert.deepEqual(bottomPosition(area,168,'right'),[-180,659]);
  assert.equal(readPlacement('free'), 'right');
});

test('registered poses share the idle face width and top without moving the ledge', () => {
  const {clips,rig} = globalThis.Hamster;
  for (const clip of Object.values(clips)) {
    const [sx,sy] = rig.poseScale(clip);
    assert.ok(Math.abs(clip.pose.width*sx - clips.breathe.pose.width) < .01);
    const top = clip.offsetY+clip.pose.top*168/512;
    const baseline = clips.breathe.offsetY+clips.breathe.pose.top*168/512;
    assert.ok(Math.abs(167+(top-167)*sy-baseline) < .01);
  }
});

test('only a bright fringe near a darker outer line is cleared', () => {
  const width = 16;
  const height = 11;
  const data = new Uint8ClampedArray(width*height*4);
  const point = (x,y) => (y*width+x)*4;
  for (let y=0; y<height; y++) {
    for (let x=2; x<=10; x++) {
      const color = x <= 4 ? [164,115,83] : x === 5 ? [88,47,24] : [241,211,180];
      data.set([...color,255],point(x,y));
    }
  }
  data.set([170,120,70,255],point(13,5));
  assert.equal(data[point(2,5)+3],255);
  globalThis.Hamster.cleanOutline({data,width,height});
  for (const x of [2,3,4,13]) assert.equal(data[point(x,5)+3],0);
  assert.deepEqual([...data.subarray(point(5,5),point(5,5)+4)],[88,47,24,255]);
  assert.equal(data[point(6,5)+3],255);
  assert.equal(data[point(10,5)+3],255);
});
