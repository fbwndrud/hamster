const {clips, rig, wardrobe, cleanOutline} = globalThis.Hamster;
const pet = document.getElementById('pet');
const canvas = document.getElementById('motion');
const accessories = document.getElementById('accessories');
const neckTrack = document.getElementById('neck-track');
const torsoVisible = document.getElementById('torso-visible');
const foreground = document.getElementById('torso-foreground');
const badge = document.getElementById('work-count');
const wardrobePreview = new URLSearchParams(location.search).has('wardrobe');
// Keep 2× detail even on 1× displays so registered clips share the final downsample.
const pixelSize = 336;
canvas.width = canvas.height = pixelSize;
const context = canvas.getContext('2d');
const sourceFrame = new OffscreenCanvas(512,512).getContext('2d',{willReadFrequently:true});
const decoded = new Map();
let serial = 0;
let active;
let lastFrame = -1;
let frameRequest = 0;
let hiddenAt;
let wrapNeck = false;
let workCount = 0;

function workRate(count) {
  return count >= 3 ? 1.6 : count === 2 ? 1.3 : 1;
}

function showWorkCount() {
  badge.hidden = active?.id !== 'work' || workCount < 2;
  badge.textContent = String(workCount);
  badge.setAttribute('aria-label',`Active AI tasks: ${workCount}`);
}

function workCountChanged(count) {
  workCount = count;
  if (active?.id === 'work') {
    const now = Math.max(active.startedAt,hiddenAt ?? performance.now());
    const speed = workRate(count);
    active.startedAt = now-(now-active.startedAt)*active.speed/speed;
    active.speed = speed;
  }
  showWorkCount();
}

function torsoBounds({data,width}, y) {
  const row = y*width*4+3;
  let left = 0;
  let right = width-1;
  while (left < width && data[row+left*4] < 128) left++;
  while (right >= left && data[row+right*4] < 128) right--;
  return [left,right];
}

async function decode(id) {
  const clip = clips[id];
  const data = new Uint8Array(await window.hamster.gif(id));
  const decoder = new ImageDecoder({data,type:'image/gif'});
  const frames = [];
  try {
    await decoder.tracks.ready;
    if (decoder.tracks.selectedTrack.frameCount !== clip.frames.length) {
      throw new Error('GIF and accessory track have different frame counts');
    }
    for (const [frameIndex,[, ...eyes]] of clip.frames.entries()) {
      const {image} = await decoder.decode({frameIndex});
      try {
        sourceFrame.clearRect(0,0,512,512);
        sourceFrame.drawImage(image,0,0);
        const pixels = sourceFrame.getImageData(0,0,512,512);
        cleanOutline(pixels);
        const neckMatrix = rig.fitNeck(clip,eyes);
        const scarfMatrix = rig.fitScarf(neckMatrix,y => torsoBounds(pixels,y));
        const bitmap = await createImageBitmap(pixels,{resizeWidth:pixelSize,resizeHeight:pixelSize,resizeQuality:'high'});
        frames.push({bitmap,matrix:rig.fit(eyes),neckMatrix,scarfMatrix});
      } finally {
        image.close();
      }
    }
    return frames;
  } catch (error) {
    for (const {bitmap} of frames) bitmap.close();
    throw error;
  } finally {
    decoder.close();
  }
}

function load(id) {
  if (!decoded.has(id)) {
    decoded.set(id,decode(id).catch(error => {
      decoded.delete(id);
      throw error;
    }));
  }
  return decoded.get(id);
}

async function show({id,revision,still = false,frame = 0}) {
  if (!Object.hasOwn(clips,id)) return;
  const request = ++serial;
  try {
    const frames = await load(id);
    if (request !== serial) return;
    const clip = clips[id];
    active = {id,clip,frames,revision,request,still,frame,startedAt:performance.now(),
              loop:id === 'breathe' || id === 'work',speed:id === 'work' ? workRate(workCount) : 1};
    canvas.dataset.clip = id;
    const [scaleX,scaleY] = rig.poseScale(clip);
    pet.style.transformOrigin = `50% ${167-clip.offsetY}px`;
    pet.style.transform = `translateY(${clip.offsetY}px) scale(${scaleX},${scaleY})`;
    torsoVisible.setAttribute('height',(159-clip.offsetY)*512/168);
    lastFrame = -1;
    showWorkCount();
    updateFrame();
    requestAnimationFrame(() => {
      if (request === serial && !wardrobePreview) window.hamster.painted(revision);
    });
    if (request === 1 && !wardrobePreview) {
      for (const next of ['human','request','work','reply']) load(next).catch(console.error);
    }
  } catch (error) {
    console.error('Hamster GIF:',id,error);
  }
}

function outfitChanged(outfit) {
  for (const slot of Object.keys(wardrobe.slots)) {
    const layer = document.getElementById(slot);
    const item = wardrobe.items.find(choice => choice.slot === slot && choice.id === outfit[slot]);
    if (slot === 'neck') wrapNeck = item?.fit === 'scarf';
    if (item) {
      layer.setAttribute('href',item.src);
      layer.removeAttribute('display');
    } else {
      layer.removeAttribute('href');
      layer.setAttribute('display','none');
    }
  }
  if (active && lastFrame >= 0) fitNeckLayer(active.frames[lastFrame]);
}

function fitNeckLayer({neckMatrix,scarfMatrix}) {
  const matrix = wrapNeck ? scarfMatrix : neckMatrix;
  neckTrack.setAttribute('transform',`matrix(${matrix.join(' ')})`);
}

function draw(now) {
  frameRequest = 0;
  if (!active || document.hidden) return;
  const {id,clip,frames,startedAt,loop,revision,request,speed} = active;
  const elapsed = active.still ? 0 : (now - startedAt) * speed;
  const index = active.still ? active.frame : rig.frameAt(clip,loop ? elapsed : Math.min(elapsed,clip.ms-1));
  if (index !== lastFrame) {
    const frame = frames[index];
    const {bitmap,matrix} = frame;
    context.clearRect(0,0,pixelSize,pixelSize);
    context.drawImage(bitmap,0,0);
    accessories.setAttribute('transform',`matrix(${matrix.join(' ')})`);
    fitNeckLayer(frame);
    foreground.setAttribute('d',globalThis.Hamster.rewardOcclusion?.[id]?.[index] ?? '');
    lastFrame = index;
  }
  if (active.still) return;
  if (loop || elapsed < clip.ms) {
    frameRequest = requestAnimationFrame(draw);
  } else if (!wardrobePreview && request === serial && (id === 'snack' || id === 'gift')) {
    window.hamster.rewardPlayed(revision);
  }
}

function updateFrame() {
  cancelAnimationFrame(frameRequest);
  draw(performance.now());
}

window.hamster.onClip(show);
window.hamster.onOutfit(outfitChanged);
window.hamster.onWorkCount(workCountChanged);
if (!wardrobePreview) {
  const giftReceived = document.getElementById('gift-received');
  let toastTimer;
  window.hamster.onInteraction(target => {
    if (target.action === 'pat') {
      for (const clip of ['pat','highfive']) load(clip).catch(console.error);
    }
  });
  window.hamster.onGiftReceived(label => {
    clearTimeout(toastTimer);
    giftReceived.textContent = label;
    giftReceived.hidden = false;
    toastTimer = setTimeout(() => {giftReceived.hidden = true;},3500);
  });
}
document.addEventListener('visibilitychange',() => {
  const now = performance.now();
  if (document.hidden) hiddenAt = now;
  else if (hiddenAt !== undefined) {
    if (active) active.startedAt += now - Math.max(hiddenAt,active.startedAt);
    hiddenAt = undefined;
  }
  updateFrame();
});
