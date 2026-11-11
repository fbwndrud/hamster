const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const links = {
  releases: 'https://github.com/fbwndrud/hamster/releases/latest',
  source: 'https://github.com/fbwndrud/hamster',
  support: 'https://ko-fi.com/junelyoo',
};
const hooks = [
  ['~/.codex/hooks.json', ['UserPromptSubmit', 'Stop', 'Interrupt']],
  ['~/.claude/settings.json', ['UserPromptSubmit', 'Stop', 'StopFailure', 'SessionEnd']],
  ['~/.cursor/hooks.json', ['beforeSubmitPrompt', 'stop', 'sessionEnd']],
  ['~/.gemini/settings.json', ['BeforeAgent', 'AfterAgent', 'SessionEnd']],
  ['~/.grok/hooks/hamster.json', ['UserPromptSubmit', 'Stop', 'StopFailure', 'StopCancelled', 'SessionEnd', 'Notification']],
];

async function alternates(page) {
  return page.locator('link[rel="alternate"][hreflang]').evaluateAll(nodes =>
    Object.fromEntries(nodes.map(node => [node.hreflang, node.getAttribute('href')])));
}

// Download section on the current home page, then the install page it links to.
async function checkDownload(page, installPath, language) {
  const section = page.locator('#download');
  const hrefs = await section.locator('a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
  assert.deepEqual(hrefs, [links.releases, installPath, links.source, links.support]);
  assert.equal(await page.locator('a[href*="releases/latest"]').count(), 1);
  const home = await alternates(page);
  const installHome = await page.evaluate(() => location.pathname);
  assert.equal(home[language], installHome);

  await section.locator(`a[href="${installPath}"]`).click();
  assert.equal(new URL(page.url()).pathname, installPath);
  assert.equal(await page.locator('html').getAttribute('lang'), language);
  assert.equal(await page.locator('h1').count(), 1);
  assert.deepEqual(await alternates(page), { ko: '/install/', en: '/en/install/' });
  assert.equal(await page.locator('script[src]').count(), 0);
  assert.equal(await page.locator('a[href*="releases/latest"]').first().getAttribute('href'), links.releases);
  const rows = await page.locator('tbody tr').evaluateAll(rows => rows.map(row => [
    row.querySelector('td code').textContent,
    [...row.querySelectorAll('td:last-child code')].map(code => code.textContent),
  ]));
  assert.deepEqual(rows, hooks);
  const text = await page.locator('main').innerText();
  for (const word of language === 'ko'
    ? ['SHA-256', '응용 프로그램', '그래도 열기', '1시간', 'Issues']
    : ['SHA-256', 'Applications', 'Open Anyway', 'an hour', 'Issues']) assert.match(text, new RegExp(word));
  const issues = await page.locator('main a[href$="/issues"]').count();
  assert.equal(issues, 1);
  const switchLink = page.getByRole('banner').getByRole('link', { name: language === 'ko' ? 'English' : '한국어' });
  assert.equal(await switchLink.getAttribute('href'), language === 'ko' ? '/en/install/' : '/install/');
  await page.goBack();
}

async function verify() {
  const origin = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--disable-dev-shm-usage'],
  });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.status() >= 400) errors.push(response.status() + ' ' + response.url());
    });
    assert.equal((await page.goto(origin)).status(), 200);
    assert.equal(await page.locator('html').getAttribute('lang'), 'ko');
    assert.match(await page.locator('h1').innerText(), /햄스터가 살아요/);
    assert.equal(await page.locator('link[rel="icon"]').getAttribute('href'), '/assets/hamster-icon.png');
    assert.equal(await page.locator('.prompt').count(), 0);
    assert.equal(await page.locator('form, [download], a[href^="mailto:"]').count(), 0);
    assert.doesNotMatch(await page.locator('body').innerText(), /준비 중|베타/);
    await checkDownload(page, '/install/', 'ko');
    assert.equal(await page.locator('[data-pet]').getAttribute('src'), '/assets/idle.png');
    assert.equal(await page.locator('#demo [data-step]:visible').count(), 6);

    let releaseRequest;
    const heldRequest = new Promise(resolve => { releaseRequest = resolve; });
    await page.route('**/assets/request.gif', async route => {
      await heldRequest;
      await route.continue();
    }, { times: 1 });
    await page.getByRole('button', { name: '데모 재생' }).click();
    await page.waitForTimeout(1700);
    const waitingImage = await page.locator('[data-pet]').getAttribute('src');
    releaseRequest();
    assert.equal(waitingImage, '/assets/request.png');
    await page.waitForFunction(() => document.querySelector('[data-pet]').src.endsWith('/request.gif'));
    await page.waitForFunction(() => document.querySelector('[data-pet]').src.endsWith('/work.gif'));
    await page.waitForFunction(() => document.querySelector('[data-pet]').src.endsWith('/reply.gif'));
    await page.waitForFunction(() => document.querySelector('[data-pet]').src.endsWith('/reply.png'));
    await page.getByRole('button', { name: '데모 재생' }).click();
    await page.waitForFunction(() => document.querySelector('[data-pet]').src.endsWith('/request.gif'));
    await page.getByRole('button', { name: '재생 멈추기' }).click();
    assert.equal(await page.locator('[data-pet]').getAttribute('src'), '/assets/request.png');

    for (const [label, clip] of [['쓰다듬기', 'pat'], ['하이파이브', 'highfive'], ['첫 선물 열기', 'gift']]) {
      await page.getByRole('button', { name: new RegExp(label) }).click();
      await page.waitForFunction(name => document.querySelector('[data-pet]').src.endsWith('/' + name + '.gif'), clip);
    }
    assert.equal(await page.getByRole('button', { name: /요청을 보내면/ }).isVisible(), true);

    const outfit = page.getByRole('button', { name: '비 오는 날' });
    await outfit.focus();
    await page.keyboard.press('Enter');
    assert.equal(await outfit.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('[data-hat]').getAttribute('href'), '/assets/hat-rain.svg');
    await page.getByRole('button', { name: '하트 스티커', exact: true }).click();
    assert.equal(await page.locator('[data-face]').getAttribute('href'), '/assets/face-first-gift.svg');
    assert.equal(await page.locator('[data-hat]').getAttribute('href'), null);

    await page.getByRole('banner').getByRole('link', { name: 'English' }).click();
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.match(await page.locator('h1').innerText(), /hamster/i);
    assert.doesNotMatch(await page.locator('body').innerText(), /in preparation|beta/i);
    await checkDownload(page, '/en/install/', 'en');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: 'Play demo' }).waitFor({ state: 'hidden' });
    assert.equal(await page.getByRole('button', { name: 'Play demo' }).isVisible(), false);
    await page.getByRole('button', { name: /While Codex works/ }).click();
    assert.equal(await page.locator('[data-pet]').getAttribute('src'), '/assets/work.png');
    assert.equal(await page.getByRole('button', { name: /Pet the hamster/ }).isVisible(), true);
    await page.getByRole('button', { name: /High five/ }).click();
    assert.equal(await page.locator('[data-pet]').getAttribute('src'), '/assets/highfive.png');
    assert.equal(await page.locator('img[src$=".gif"]').count(), 0);

    for (const path of ['/', '/en/', '/install/', '/en/install/']) {
      await page.goto(origin + path);
      for (const width of [320, 375, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 950 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
          path + ' overflows at ' + width + 'px');
      }
      assert.equal(await page.locator('img').evaluateAll(async images => {
        await Promise.all(images.map(image => image.decode()));
        return images.every(image => image.naturalWidth > 0);
      }), true);
    }
    assert.deepEqual(errors, []);
    console.log('Passed both locales, download links, install guides, hreflang pairs, six motions on one panel, pause, wardrobe, reduced motion, and five viewport widths on four pages.');
  } finally {
    await browser.close();
  }
}

verify().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
