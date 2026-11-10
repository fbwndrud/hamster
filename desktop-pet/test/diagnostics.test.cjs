const assert = require('node:assert/strict');
const {test} = require('node:test');
const {createErrorLog, diagnosticsText} = require('../diagnostics.cjs');

const input = (overrides = {}) => ({
  version:'1.0.13',macos:'15.1',arch:'arm64',
  providers:[{id:'codex',state:'verified'},{id:'claude',state:'waiting'},{id:'cursor',state:'notInstalled'}],
  update:{kind:'available',update:{version:'1.0.13',remote:{}}},
  errors:[],...overrides,
});

test('diagnostics list versions, connections, update state and recent error codes', () => {
  const text = diagnosticsText(input({errors:[{at:'2026-11-10T00:00:00.000Z',scope:'settings write',code:'EACCES'}]}));
  assert.equal(text,[
    'Hamster 1.0.13','macOS 15.1 arm64','AI connections:','  codex: verified','  claude: waiting','  cursor: notInstalled',
    'Update: available 1.0.13 (remote)','Recent errors:','  2026-11-10T00:00:00.000Z settings write: EACCES',
  ].join('\n'));
  assert.match(diagnosticsText(input()),/Recent errors:\n  none$/);
  assert.match(diagnosticsText(input({update:{kind:'current'}})),/Update: current\n/);
});

test('home folders in any value become ~ and never leave a user name behind', () => {
  const log = createErrorLog();
  log.note('read /Users/jane/Library','EACCES /Users/jane');
  log.note('other','/Users/ann/x');
  const text = diagnosticsText(input({errors:log.list(),providers:[{id:'codex',state:'/Users/jane'}]}));
  assert.ok(!/jane|ann/.test(text));
  assert.match(text,/ codex: ~\n/);
  assert.match(text,/read ~\?Library: EACCES ~\n/);
  assert.match(text,/other: ~\?x$/);
});

test('path-like or multi-line values cannot smuggle content into the report', () => {
  const log = createErrorLog();
  log.note('settings read','/Users/jane/Documents/secret.txt');
  log.note('x\ninjected','E\nFAKE');
  const text = diagnosticsText(input({errors:log.list(),providers:[{id:'codex',state:'/Users/jane/key'}]}));
  assert.ok(!text.includes('/Users/jane'));
  assert.ok(!text.includes('secret.txt/'));
  assert.equal(text.split('\n').length,8);
  assert.match(text,/x injected: E\?FAKE|x\?injected/);
});

test('the error ring keeps only the latest entries', () => {
  const log = createErrorLog(3,() => 0);
  for (const code of ['A','B','C','D']) log.note('scope',code);
  assert.deepEqual(log.list().map(entry => entry.code),['B','C','D']);
  assert.equal(log.list()[0].at,'1970-01-01T00:00:00.000Z');
  log.list()[0].code = 'changed';
  assert.equal(log.list()[0].code,'B');
});
