globalThis.Hamster = globalThis.Hamster || {};

Hamster.rig = {
  poseScale(clip) {
    const idle = Hamster.clips.breathe;
    const height = motion => 167-motion.offsetY-motion.pose.top*168/512;
    return [idle.pose.width/clip.pose.width,height(idle)/height(clip)];
  },

  // The existing accessory art uses eyes at (86, 99) and (152, 99).
  fit([lx,ly,rx,ry]) {
    const a = (rx-lx)/66;
    const b = (ry-ly)/66;
    return [a,b,-b,a,lx-a*86+b*99,ly-b*86-a*99];
  },

  fitNeck(clip, [lx,ly,rx,ry]) {
    const [,restLX,restLY,restRX,restRY] = clip.frames[0];
    const scale = Math.max(1.5,Math.min(1.85,(restRX-restLX)/88));
    const tilt = Math.max(-.1,Math.min(.1,(ry-ly)/180));
    const centerX = (lx+rx)/2;
    const centerY = (151-clip.offsetY)*512/168 + ((ly+ry)-(restLY+restRY))*.11;
    return [scale,tilt,-tilt,scale,centerX-scale*120+tilt*154,centerY-tilt*120-scale*154];
  },

  fitScarf(neck, sampleRow) {
    const [,tilt,,height,,offsetY] = neck;
    const top = tilt*120 + height*144 + offsetY;
    const [left,right] = sampleRow(Math.round(top));
    if (right-left < 220) return neck;
    const width = (right-left-8)/220;
    return [width,0,0,height,left+4-width*10,top-height*144];
  },

  frameAt(clip, elapsed) {
    let position = Math.max(0,elapsed) % clip.ms;
    for (const [index,[duration]] of clip.frames.entries()) {
      if (position < duration) return index;
      position -= duration;
    }
    return clip.frames.length - 1;
  },
};
