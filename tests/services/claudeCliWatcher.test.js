'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const os = require('os');
const fs = require('fs');

const { createClaudeCliWatcher } = require('../../src/services/claudeCliWatcher');

test('createClaudeCliWatcher: returns object with start and stop methods', () => {
  const watcher = createClaudeCliWatcher({
    watchDir: os.tmpdir(),
    storageFile: path.join(os.tmpdir(), 'test-claude.json'),
    onSession: () => {},
  });
  assert.equal(typeof watcher.start, 'function');
  assert.equal(typeof watcher.stop, 'function');
});

test('createClaudeCliWatcher: does not call onSession for all-sidechain JSONL', (t, done) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-sidechain-'));
  const storageFile = path.join(tmpDir, 'sessions.json');
  let called = false;

  const watcher = createClaudeCliWatcher({
    watchDir: tmpDir,
    storageFile,
    debounceMs: 100,
    onSession: () => { called = true; },
  });

  watcher.start();

  setTimeout(() => {
    const entry = JSON.stringify({
      type: 'user', isSidechain: true,
      sessionId: 'sidechain-sess', uuid: 'u1',
      timestamp: new Date().toISOString(),
      cwd: '/test', gitBranch: 'main',
      message: { role: 'user', content: 'tool result' },
    });
    fs.writeFileSync(path.join(tmpDir, 'sidechain-sess.jsonl'), entry + '\n');
  }, 200);

  setTimeout(() => {
    watcher.stop();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    assert.equal(called, false);
    done();
  }, 600);
});

test('createClaudeCliWatcher: stop can be called before start without error', () => {
  const watcher = createClaudeCliWatcher({
    watchDir: os.tmpdir(),
    storageFile: path.join(os.tmpdir(), 'test-claude2.json'),
    onSession: () => {},
  });
  assert.doesNotThrow(() => watcher.stop());
});

test('createClaudeCliWatcher: detects new .jsonl file and calls onSession', (t, done) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-watcher-'));
  const storageFile = path.join(tmpDir, 'sessions.json');
  const sessionId = 'test-sess-' + Date.now();

  const watcher = createClaudeCliWatcher({
    watchDir: tmpDir,
    storageFile,
    debounceMs: 100,
    onSession: (session) => {
      watcher.stop();
      fs.rmSync(tmpDir, { recursive: true, force: true });
      assert.equal(session.source, 'claudecli');
      assert.equal(session.sessionId, sessionId);
      done();
    },
  });

  watcher.start();

  setTimeout(() => {
    const entry = JSON.stringify({
      type: 'user', isSidechain: false,
      sessionId, uuid: 'u1',
      timestamp: new Date().toISOString(),
      cwd: '/test', gitBranch: 'main',
      message: { role: 'user', content: 'test session' },
    });
    fs.writeFileSync(path.join(tmpDir, `${sessionId}.jsonl`), entry + '\n');
  }, 200);
});
