globalThis.Hamster = globalThis.Hamster || {};

Hamster.cleanOutline = function ({data,width,height}) {
  const remove = [];
  const stride = width*4;
  const sides = [-4,4,-stride,stride];
  const directions = [...sides,-stride-4,-stride+4,stride-4,stride+4];
  for (let y=1; y<height-1; y++) {
    for (let x=1; x<width-1; x++) {
      const green = (y*width+x)*4+1;
      if (!data[green+2]) continue;
      if (!sides.some(step => data[green+step+2])) {
        remove.push(green+2);
        continue;
      }
      if (data[green] < 62 || x<2 || x>=width-2 || y<2 || y>=height-2) continue;
      for (const step of directions) {
        if (data[green+step+2] && data[green+2*step+2] && data[green+3*step+2]) continue;
        // Keep the brown line and remove the lighter pixels just outside it.
        const ink = [1,2,3].some(depth => {
          const inside = green-depth*step;
          return data[inside+2] && data[inside]<=79 && data[green]-data[inside]>=17;
        });
        if (ink) {
          remove.push(green+2);
          break;
        }
      }
    }
  }
  for (const alpha of remove) data[alpha] = 0;
};
