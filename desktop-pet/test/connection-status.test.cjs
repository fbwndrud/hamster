const assert = require('node:assert/strict');
const {test} = require('node:test');
const {createConnectionStatus} = require('../connection-status.cjs');

test('installation alone leaves a provider waiting for its first event', () => {
  const status = createConnectionStatus(['codex']);
  assert.deepEqual(status.read('codex', false), {state:'notInstalled', receivedAt:null});
  assert.deepEqual(status.read('codex', true), {state:'waiting', receivedAt:null});
});

test('a provider event records the latest receipt for that provider', () => {
  const status = createConnectionStatus(['codex','claude']);
  status.observe('codex', 0);
  assert.deepEqual(status.read('codex', true), {state:'verified', receivedAt:0});
  status.observe('codex', 10);
  assert.deepEqual(status.read('codex', true), {state:'verified', receivedAt:10});
  assert.deepEqual(status.read('claude', true), {state:'waiting', receivedAt:null});
});

test('legacy events and unrecognized providers do not verify a connection', () => {
  const status = createConnectionStatus(['codex']);
  status.observe(undefined, 10);
  status.observe('unknown', 20);
  assert.deepEqual(status.read('codex', true), {state:'waiting', receivedAt:null});
  assert.deepEqual(status.read('unknown', true), {state:'waiting', receivedAt:null});
});

test('removing a provider clears its proof for subsequent installations', () => {
  const status = createConnectionStatus(['codex','claude']);
  status.observe('codex', 10);
  status.observe('claude', 20);
  assert.deepEqual(status.read('codex', false), {state:'notInstalled', receivedAt:null});
  status.reset('codex');
  assert.deepEqual(status.read('codex', true), {state:'waiting', receivedAt:null});
  assert.deepEqual(status.read('claude', true), {state:'verified', receivedAt:20});
});
