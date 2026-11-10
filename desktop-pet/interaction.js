const button = document.getElementById('pet-action');
let target, hoverTimer;

window.hamster.onInteraction(next => {
  clearTimeout(hoverTimer);
  target = next;
  button.hidden = !target.action;
  button.dataset.action = target.action ?? '';
  button.setAttribute('aria-label',target.label ?? '');
  button.title = target.label ?? '';
});

button.addEventListener('mouseenter',() => {
  if (target?.action !== 'pat') return;
  const {revision} = target;
  hoverTimer = setTimeout(() => window.hamster.interact(revision,'look'),950);
});
button.addEventListener('mouseleave',() => clearTimeout(hoverTimer));
button.addEventListener('click',() => {
  clearTimeout(hoverTimer);
  if (target?.action) window.hamster.interact(target.revision,target.action);
});
