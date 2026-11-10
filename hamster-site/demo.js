const pet = document.querySelector('[data-pet]');
const steps = [...document.querySelectorAll('[data-step]')];
const modeButtons = [...document.querySelectorAll('[data-mode]')];
const panels = [...document.querySelectorAll('[data-demo-panel]')];
const play = document.querySelector('[data-play]');
const playLabel = play.querySelector('[data-play-icon]');
const pauseLabel = play.querySelector('[data-pause-icon]');
const live = document.querySelector('[data-live]');
const idleStatus = live.textContent;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let activePanel = panels[0];
let selected;
let playing = false;
let timer;
let run = 0;

function setPlayback(active) {
  playing = active;
  playLabel.hidden = active;
  pauseLabel.hidden = !active;
}

function show(step) {
  selected = step;
  const clip = step?.dataset.clipName ?? 'idle';
  pet.dataset.clip = clip;
  pet.src = '/assets/' + clip + '.png';
  live.textContent = step?.dataset.status ?? idleStatus;
  steps.forEach(button => button.setAttribute('aria-pressed', String(button === step)));
}

function stop() {
  run++;
  clearTimeout(timer);
  setPlayback(false);
  if (selected) pet.src = '/assets/' + selected.dataset.clipName + '.png';
}

async function playStep(step, advance) {
  const currentRun = ++run;
  show(step);
  const animation = new Image();
  animation.src = '/assets/' + step.dataset.clipName + '.gif';
  try {
    await animation.decode();
  } catch {
    // The selected step stays visible as a poster when its animation fails.
  }
  if (currentRun !== run) return;
  if (animation.naturalWidth > 0) pet.src = animation.src;
  timer = setTimeout(() => {
    if (advance && step.nextElementSibling) playStep(step.nextElementSibling, true);
    else stop();
  }, Number(step.dataset.duration));
}

function updateMotion() {
  if (reducedMotion.matches) stop();
  play.hidden = reducedMotion.matches;
}

play.addEventListener('click', () => {
  if (playing) stop();
  else if (!reducedMotion.matches) {
    clearTimeout(timer);
    setPlayback(true);
    playStep(activePanel.firstElementChild, true);
  }
});
steps.forEach(step => {
  step.disabled = false;
  step.addEventListener('click', () => {
    clearTimeout(timer);
    if (reducedMotion.matches) {
      stop();
      show(step);
      return;
    }
    setPlayback(true);
    playStep(step, false);
  });
});
modeButtons.forEach((button, index) => {
  button.addEventListener('click', () => {
    const panel = panels[index];
    if (activePanel === panel) return;
    stop();
    show();
    activePanel.hidden = true;
    activePanel = panel;
    activePanel.hidden = false;
    modeButtons.forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
  });
});
document.querySelector('[data-modes]').hidden = false;
reducedMotion.addEventListener('change', updateMotion);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && playing) stop();
});
updateMotion();

const outfits = [...document.querySelectorAll('[data-outfit]')];
const wardrobe = document.querySelector('[data-look]');
const hat = document.querySelector('[data-hat]');
const face = document.querySelector('[data-face]');
const caption = document.querySelector('[data-look-caption]');

function fitAccessory(layer, file) {
  if (file) layer.setAttribute('href', '/assets/' + file);
  else layer.removeAttribute('href');
}

outfits.forEach(outfit => {
  outfit.disabled = false;
  outfit.addEventListener('click', () => {
    wardrobe.dataset.look = outfit.dataset.outfit;
    fitAccessory(hat, outfit.dataset.hatFile);
    fitAccessory(face, outfit.dataset.faceFile);
    outfits.forEach(button => button.setAttribute('aria-pressed', String(button === outfit)));
    caption.textContent = outfit.textContent;
  });
});
