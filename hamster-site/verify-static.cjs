// Node-only check of dist/ for machines without Playwright. Run after build.mjs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dist = path.join(__dirname, 'dist');
const read = file => fs.readFileSync(path.join(dist, file), 'utf8');
const releases = 'https://github.com/fbwndrud/hamster/releases/latest';
const source = 'https://github.com/fbwndrud/hamster';
const support = 'https://ko-fi.com/junelyoo';
const pages = {
  ko: { home: 'index.html', install: 'install/index.html', homeUrl: '/', installUrl: '/install/' },
  en: { home: 'en/index.html', install: 'en/install/index.html', homeUrl: '/en/', installUrl: '/en/install/' },
};
const hooks = [
  ['~/.codex/hooks.json', ['UserPromptSubmit', 'Stop', 'Interrupt']],
  ['~/.claude/settings.json', ['UserPromptSubmit', 'Stop', 'StopFailure', 'SessionEnd']],
  ['~/.cursor/hooks.json', ['beforeSubmitPrompt', 'stop', 'sessionEnd']],
  ['~/.gemini/settings.json', ['BeforeAgent', 'AfterAgent', 'SessionEnd']],
  ['~/.grok/hooks/hamster.json', ['UserPromptSubmit', 'Stop', 'StopFailure', 'StopCancelled', 'SessionEnd', 'Notification']],
];

const attrs = (html, tag) => [...html.matchAll(new RegExp('<' + tag + '\\b([^>]*)>', 'g'))].map(match =>
  Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(pair => [pair[1], pair[2]])));
const urlToFile = url => url.endsWith('/') ? url.slice(1) + 'index.html' : url.slice(1);

for (const [language, { home, install, homeUrl, installUrl }] of Object.entries(pages)) {
  for (const [kind, file, url] of [['home', home, homeUrl], ['install', install, installUrl]]) {
    const html = read(file);
    const label = file;
    assert.match(html, new RegExp(`<html lang="${language}">`), label + ' lang');
    assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1, label + ' h1 count');
    assert.doesNotMatch(html, /<script(?![^>]*\ssrc="\/demo\.js")/, label + ' has a script other than /demo.js');
    assert.doesNotMatch(html, /<style|\sstyle=|\son\w+=/, label + ' has inline style or handler');
    assert.doesNotMatch(html, /googletagmanager|google-analytics|cloudflareinsights|plausible|<iframe|<form/, label + ' has analytics or embeds');
    assert.equal(html.includes('/demo.js'), kind === 'home', label + ' demo.js scope');

    // hreflang: both languages point at the same pair, and this page is one side of it.
    const pair = Object.fromEntries(attrs(html, 'link').filter(link => link.rel === 'alternate')
      .map(link => [link.hreflang, link.href]));
    assert.deepEqual(pair, kind === 'home'
      ? { ko: pages.ko.homeUrl, en: pages.en.homeUrl }
      : { ko: pages.ko.installUrl, en: pages.en.installUrl }, label + ' hreflang');
    assert.equal(pair[language], url, label + ' hreflang self reference');
    const other = language === 'ko' ? 'en' : 'ko';
    const switcher = attrs(html, 'a').filter(link => link.class === 'language');
    assert.ok(switcher.length >= 2 && switcher.every(link => link.href === pair[other] && link.hreflang === other), label + ' language links');

    // Every internal link, asset and anchor resolves.
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]));
    const targets = [...attrs(html, 'a'), ...attrs(html, 'link'), ...attrs(html, 'img'), ...attrs(html, 'script'), ...attrs(html, 'image')]
      .flatMap(node => [node.href, node.src]).filter(Boolean);
    for (const target of targets) {
      if (/^https:\/\//.test(target)) continue;
      assert.ok(!/^\w+:|^\/\//.test(target), label + ' unexpected scheme ' + target);
      const [pathname, hash] = target.split('#');
      if (pathname === '') assert.ok(ids.has(hash), label + ' missing anchor #' + hash);
      else {
        assert.ok(fs.existsSync(path.join(dist, urlToFile(pathname))), label + ' broken link ' + target);
        if (hash && pathname === homeUrl && kind === 'home') assert.ok(ids.has(hash), label + ' missing anchor #' + hash);
      }
    }
    const external = targets.filter(target => /^https:\/\//.test(target));
    assert.ok(external.every(target => /^https:\/\/(github\.com\/fbwndrud\/hamster|ko-fi\.com\/junelyoo|support\.apple\.com\/)/.test(target)),
      label + ' unexpected outbound link: ' + external.join(' '));
    assert.equal(attrs(html, 'a').some(link => link.href?.includes('releases/latest') && link.href !== releases), false);

    if (kind === 'home') {
      const download = html.slice(html.indexOf('id="download"'), html.indexOf('</section>', html.indexOf('id="download"')));
      assert.deepEqual(attrs(download, 'a').map(link => link.href), [releases, installUrl, source, support], label + ' download links');
      assert.doesNotMatch(html, /준비 중|베타|in preparation|beta/i, label + ' still says beta');
    } else {
      assert.ok(html.includes(`href="${releases}"`) && html.includes('https://github.com/fbwndrud/hamster/issues'), label + ' links');
      const rows = [...html.matchAll(/<tr><th scope="row">[^<]+<\/th><td><code>([^<]+)<\/code><\/td><td>(.*?)<\/td><\/tr>/g)]
        .map(match => [match[1], [...match[2].matchAll(/<code>([^<]+)<\/code>/g)].map(code => code[1])]);
      assert.deepEqual(rows, hooks, label + ' hook table');
      for (const id of ['download', 'move', 'open', 'connect', 'updates', 'remove', 'privacy', 'help']) {
        assert.ok(html.includes(`id="${id}"`), label + ' missing section ' + id);
      }
      assert.match(html, /SHA-256/);
    }
  }
}

const headers = read('_headers');
assert.match(headers, /script-src 'self'; style-src 'self'/);
assert.doesNotMatch(headers, /https?:/);
console.log('Static check passed: four pages, hreflang pairs, download and install links, strict CSP, no external scripts.');
