import '../desktop-pet/assets/clips.js';
import '../desktop-pet/assets/rig.js';

const { clips: appClips, rig } = globalThis.Hamster;
export const clips = [
  ['idle', 'breathe', 0],
  ['request', 'request', 6],
  ['work', 'work', 5],
  ['reply', 'reply', 3],
  ['pat', 'pat', 4],
  ['highfive', 'highfive', 4],
  ['gift', 'gift', 8],
];

export const outfits = [
  { color: 'cream', hat: '', face: '' },
  { color: 'green', hat: 'hat-knit.svg', face: 'face-round.svg' },
  { color: 'yellow', hat: 'hat-rain.svg', face: '' },
  { color: 'purple', hat: 'hat-nightcap.svg', face: '' },
  { color: 'peach', hat: '', face: 'face-first-gift.svg' },
];

const motionLengths = { request: 2, work: 4, reply: 2 };

function motionSteps(steps, offset) {
  return steps.map(([title, reaction, status], index) => {
    const [name, source] = clips[offset + index + 1];
    const duration = appClips[source].ms * (motionLengths[name] ?? 1);
    return `<button class="step" data-step data-clip-name="${name}" data-duration="${duration}" data-status="${status}" type="button" aria-pressed="false" disabled>
      <span class="step-copy"><strong>${title}</strong><span>${reaction}</span></span>
    </button>`;
  }).join('');
}

const accessoryFit = 'matrix(' + rig.fit(appClips.breathe.frames[0].slice(1)).join(' ') + ')';

const icon = (paths, size = 18) => `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const arrow = icon('<path d="M12 5v14m-5-5 5 5 5-5"/>');
const playIcon = icon('<path d="m9 5 11 7-11 7z" fill="currentColor" stroke="none"/>');
const pauseIcon = icon('<path d="M9 5v14m6-14v14" stroke-width="3"/>');
const logo = '<span class="brand"><span class="brand-mark"><img src="/assets/hamster-icon.png" alt="" width="96" height="96"></span>Hamster</span>';

export const links = {
  releases: 'https://github.com/fbwndrud/hamster/releases/latest',
  source: 'https://github.com/fbwndrud/hamster',
  issues: 'https://github.com/fbwndrud/hamster/issues',
  support: 'https://ko-fi.com/junelyoo',
  apple: 'https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unknown-developer-mh40616/mac',
};

export const paths = {
  home: { ko: '/', en: '/en/' },
  install: { ko: '/install/', en: '/en/install/' },
};

// Exact files and hook events from desktop-pet/codex-install.cjs and main.cjs.
export const hookTable = [
  ['Codex', '~/.codex/hooks.json', ['UserPromptSubmit', 'Stop', 'Interrupt']],
  ['Claude Code', '~/.claude/settings.json', ['UserPromptSubmit', 'Stop', 'StopFailure', 'SessionEnd']],
  ['Cursor Agent', '~/.cursor/hooks.json', ['beforeSubmitPrompt', 'stop', 'sessionEnd']],
  ['Gemini CLI', '~/.gemini/settings.json', ['BeforeAgent', 'AfterAgent', 'SessionEnd']],
  ['Grok', '~/.grok/hooks/hamster.json', ['UserPromptSubmit', 'Stop', 'StopFailure', 'StopCancelled', 'SessionEnd', 'Notification']],
];

const download = icon('<path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/>');

function head(language, t, page, key) {
  const pair = paths[key];
  return `<!doctype html>
<html lang="${language}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${t.description}">
  <meta name="theme-color" content="#f8f5ed">
  <meta property="og:title" content="${t.title}">
  <meta property="og:description" content="${t.description}">
  <title>${t.title}</title>
  <link rel="icon" href="/assets/hamster-icon.png" type="image/png">
  <link rel="alternate" hreflang="ko" href="${pair.ko}">
  <link rel="alternate" hreflang="en" href="${pair.en}">
  <link rel="stylesheet" href="/styles.css">${page === 'home' ? `
  <script src="/demo.js" defer></script>` : ''}
</head>
<body>`;
}

function header(language, t, key) {
  const en = language === 'en';
  const prefix = key === 'home' ? '' : paths.home[language];
  const other = paths[key][en ? 'ko' : 'en'];
  return `  <a class="skip" href="#main">${t.skip}</a>
  <header class="top">
    <div class="shell top-inner">
      <a class="brand-link" href="${paths.home[language]}">${logo}</a>
      <nav class="navigation" aria-label="${en ? 'Main navigation' : '주 메뉴'}">
        <a href="${prefix}#demo">${t.nav[0]}</a>
        <a href="${prefix}#wardrobe">${t.nav[1]}</a>
        <a href="${prefix}#download">${t.nav[2]}</a>
      </nav>
      <a class="language" href="${other}" lang="${en ? 'ko' : 'en'}" hreflang="${en ? 'ko' : 'en'}">${en ? '한국어' : 'English'}</a>
    </div>
  </header>`;
}

function footer(language, t, key) {
  const en = language === 'en';
  const other = paths[key][en ? 'ko' : 'en'];
  return `  <footer class="shell footer">
    <a class="brand-link" href="${paths.home[language]}">${logo}</a>
    <p>${t.footer}</p>
    <a class="language" href="${other}" lang="${en ? 'ko' : 'en'}" hreflang="${en ? 'ko' : 'en'}">${en ? '한국어' : 'English'}</a>
  </footer>
</body>
</html>`;
}

export function render(language, t) {
  const d = t.download;
  return `${head(language, t, 'home', 'home')}
${header(language, t, 'home')}

  <main id="main">
    <section class="hero shell">
      <div class="hero-copy">
        <p class="eyebrow">${t.eyebrow}</p>
        <h1>${t.headline[0]}<br>${t.headline[1]}</h1>
        <p class="intro">${t.intro}</p>
        <a class="primary" href="#demo">${t.see}${arrow}</a>
        <p class="platform">${t.platform}</p>
      </div>

      <section id="demo" class="demo" aria-label="${t.nav[0]}">
        <div class="scene" aria-hidden="true">
          <div class="window">
            <div class="window-bar">
              <span class="window-dots"><i></i><i></i><i></i></span>
              <span>${t.desktop[0]}</span>
            </div>
            <div class="window-content">
              <p>${t.desktop[1]}</p>
              <ul><li>${t.desktop[2]}</li><li>${t.desktop[3]}</li></ul>
            </div>
          </div>
          <img class="scene-pet" data-pet data-clip="idle" src="/assets/idle.png" width="512" height="512" alt="">
        </div>
        <div class="demo-controls">
          <div class="demo-toolbar">
            <p>${t.scene}</p>
            <button class="play" type="button" data-play hidden>
              <span data-play-icon>${playIcon}${t.play}</span>
              <span data-pause-icon hidden>${pauseIcon}${t.pause}</span>
            </button>
          </div>
          <div class="demo-modes" role="group" aria-label="${t.nav[0]}" data-modes hidden>
            ${t.demoModes.map((name, index) => `<button type="button" data-mode="${index}" aria-pressed="${index === 0}">${name}</button>`).join('')}
          </div>
          <div class="steps" role="group" aria-label="${t.demoModes[0]}" data-demo-panel>
            ${motionSteps(t.steps, 0)}
          </div>
          <div class="steps" role="group" aria-label="${t.demoModes[1]}" data-demo-panel hidden>
            ${motionSteps(t.interactions, t.steps.length)}
          </div>
          <p class="sr-only" aria-live="polite" aria-label="${t.status}" data-live>${t.idle}</p>
        </div>
      </section>
    </section>

    <section id="wardrobe" class="wardrobe">
      <div class="shell wardrobe-inner">
        <div class="wardrobe-copy">
          <p class="eyebrow">${t.wardrobeLabel}</p>
          <h2>${t.wardrobeTitle}</h2>
          <p>${t.wardrobeIntro}</p>
          <div class="outfits" role="group" aria-label="${t.looksLabel}">
            ${outfits.map(({ color, hat, face }, index) => `<button class="outfit" data-outfit="${color}" data-hat-file="${hat}" data-face-file="${face}" aria-pressed="${index === 0}" type="button" disabled><i aria-hidden="true"></i>${t.looks[index]}</button>`).join('')}
          </div>
        </div>
        <div class="wardrobe-scene" data-look="cream">
          <div class="shelf"></div>
          <div class="dressed">
            <img src="/assets/idle.png" width="512" height="512" loading="lazy" alt="">
            <svg aria-hidden="true" viewBox="0 0 512 512"><g transform="${accessoryFit}">
              <image width="240" height="200" data-face />
              <image width="240" height="200" data-hat />
            </g></svg>
          </div>
          <p class="look-caption" data-look-caption aria-live="polite">${t.looks[0]}</p>
        </div>
      </div>
    </section>

    <section class="download shell" id="download">
      <div class="download-card">
        <div class="download-copy">
          <p class="eyebrow">${d.label}</p>
          <h2>${d.title}</h2>
          <p>${d.copy}</p>
          <div class="download-actions">
            <a class="primary" href="${links.releases}">${d.button}${download}</a>
            <a class="text-link" href="${paths.install[language]}">${d.guide}</a>
            <a class="text-link" href="${links.source}">${d.source}</a>
          </div>
          <p class="download-note">${d.note}</p>
          <p class="download-support">${d.support[0]} <a href="${links.support}">${d.support[1]}</a> ${d.support[2]}</p>
        </div>
        <div class="download-pet" aria-hidden="true">
          <img src="/assets/reply.png" width="512" height="512" loading="lazy" alt="">
        </div>
      </div>
    </section>
  </main>

${footer(language, t, 'home')}`;
}

function table(i) {
  return `<div class="table-wrap" role="region" aria-label="${i.tableLabel}" tabindex="0">
        <table>
          <thead><tr>${i.tableHead.map(name => `<th scope="col">${name}</th>`).join('')}</tr></thead>
          <tbody>${hookTable.map(([tool, file, events]) => `
            <tr><th scope="row">${tool}</th><td><code>${file}</code></td><td>${events.map(event => `<code>${event}</code>`).join(' ')}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>`;
}

export function renderInstall(language, t) {
  const i = t.install;
  const body = html => html.replaceAll('{{releases}}', links.releases).replaceAll('{{source}}', links.source)
    .replaceAll('{{issues}}', links.issues).replaceAll('{{apple}}', links.apple).replaceAll('{{table}}', table(i));
  return `${head(language, i, 'install', 'install')}
${header(language, t, 'install')}

  <main id="main" class="guide shell">
    <p class="eyebrow">${i.eyebrow}</p>
    <h1>${i.heading}</h1>
    <p class="guide-lead">${body(i.lead)}</p>
    <div class="guide-actions">
      <a class="primary" href="${links.releases}">${t.download.button}${download}</a>
      <a class="text-link" href="${links.source}">${t.download.source}</a>
    </div>
${i.sections.map(({ id, heading, html }) => `
    <section class="guide-section" id="${id}">
      <h2>${heading}</h2>
      ${body(html)}
    </section>`).join('\n')}
  </main>

${footer(language, t, 'install')}`;
}
