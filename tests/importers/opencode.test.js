const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { extractSession, isDuplicate, extractErrors, extractTags, extractFiles, saveSession, loadSessions } = require('../../src/importers/opencode.js');

const SAMPLE_RAW = {
  id: 'abc123',
  title: 'Fix missing module error in Node server',
  createdAt: '2026-03-17T10:30:00Z',
  updatedAt: '2026-03-17T11:15:00Z',
  messages: [
    { role: 'user', content: "I'm getting this error: Cannot find module 'express'", createdAt: '2026-03-17T10:30:05Z' },
    { role: 'assistant', content: 'Run npm install express to fix it.', createdAt: '2026-03-17T10:30:10Z' }
  ]
};

describe('extractSession', () => {
  it('maps id to sessionId', () => {
    const s = extractSession(SAMPLE_RAW, '/fake/path', Date.now());
    assert.equal(s.sessionId, 'abc123');
  });

  it('uses title from source', () => {
    const s = extractSession(SAMPLE_RAW, '/fake/path', Date.now());
    assert.equal(s.title, 'Fix missing module error in Node server');
  });

  it('falls back to first 60 chars of first user message when title missing', () => {
    const raw = { ...SAMPLE_RAW, title: undefined };
    const s = extractSession(raw, '/fake/path', Date.now());
    assert.ok(s.title.startsWith("I'm getting this error"));
  });

  it('uses last assistant message as summary', () => {
    const s = extractSession(SAMPLE_RAW, '/fake/path', Date.now());
    assert.equal(s.summary, 'Run npm install express to fix it.');
  });

  it('falls back to first user message when no assistant messages', () => {
    const raw = { ...SAMPLE_RAW, messages: [{ role: 'user', content: 'hello', createdAt: '2026-03-17T10:30:00Z' }] };
    const s = extractSession(raw, '/fake/path', Date.now());
    assert.equal(s.summary, 'hello');
  });

  it('sets source to opencode', () => {
    const s = extractSession(SAMPLE_RAW, '/fake/path', Date.now());
    assert.equal(s.source, 'opencode');
  });

  it('sets date from createdAt', () => {
    const s = extractSession(SAMPLE_RAW, '/fake/path', Date.now());
    assert.equal(s.date, '2026-03-17');
  });
});

describe('isDuplicate', () => {
  it('returns true when sessionId exists', () => {
    assert.equal(isDuplicate('abc123', [{ sessionId: 'abc123' }]), true);
  });

  it('returns false when sessionId not present', () => {
    assert.equal(isDuplicate('xyz999', [{ sessionId: 'abc123' }]), false);
  });

  it('returns false for empty array', () => {
    assert.equal(isDuplicate('abc123', []), false);
  });
});

describe('extractErrors', () => {
  it('detects error patterns in messages', () => {
    const msgs = [
      { role: 'user', content: "Cannot find module 'express'" },
      { role: 'assistant', content: 'Run npm install.' }
    ];
    const errors = extractErrors(msgs);
    assert.equal(errors.length, 1);
    assert.ok(errors[0].message.includes('Cannot find module'));
    assert.equal(errors[0].fixed, true);
  });

  it('returns empty array when no errors', () => {
    const msgs = [{ role: 'user', content: 'hello world' }];
    assert.deepEqual(extractErrors(msgs), []);
  });
});

describe('extractTags', () => {
  it('extracts tags from file extensions', () => {
    const tags = extractTags([], ['src/server.js', 'package.json']);
    assert.ok(tags.includes('javascript'));
    assert.ok(tags.includes('json'));
  });

  it('extracts npm tag from error messages', () => {
    const tags = extractTags([{ message: 'Cannot find module express' }], []);
    assert.ok(tags.includes('npm'));
  });
});

describe('extractFiles', () => {
  it('finds file paths in message content', () => {
    const msgs = [{ role: 'user', content: 'Error in src/server.js line 10' }];
    const files = extractFiles(msgs);
    assert.ok(files.includes('src/server.js'));
  });

  it('returns empty array when no file paths', () => {
    const msgs = [{ role: 'user', content: 'hello world' }];
    assert.deepEqual(extractFiles(msgs), []);
  });
});

describe('extractErrors - edge cases', () => {
  it('skips messages with non-string content', () => {
    const msgs = [
      { role: 'user', content: null },
      { role: 'user', content: undefined },
      { role: 'user', content: 42 },
    ];
    assert.deepEqual(extractErrors(msgs), []);
  });
});

describe('extractFiles - edge cases', () => {
  it('handles messages with non-string content', () => {
    const msgs = [{ role: 'user', content: null }];
    assert.deepEqual(extractFiles(msgs), []);
  });

  it('does not return bare version strings without path separator', () => {
    const msgs = [{ role: 'user', content: 'version 1.0 and v2.3 are out' }];
    const files = extractFiles(msgs);
    assert.ok(!files.some(f => f === '1.0' || f === 'v2.3'));
  });

  it('finds path with directory separator', () => {
    const msgs = [{ role: 'user', content: 'Error in src/server.js line 10' }];
    const files = extractFiles(msgs);
    assert.ok(files.includes('src/server.js'));
  });
});

describe('loadSessions', () => {
  it('returns empty array when file does not exist', () => {
    const result = loadSessions('/nonexistent/path.json');
    assert.deepEqual(result, []);
  });

  it('returns parsed sessions from valid file', () => {
    const tmp = path.join(os.tmpdir(), `oc-test-${Date.now()}.json`);
    fs.writeFileSync(tmp, JSON.stringify([{ sessionId: 'x1' }]));
    const result = loadSessions(tmp);
    assert.equal(result.length, 1);
    assert.equal(result[0].sessionId, 'x1');
    fs.unlinkSync(tmp);
  });
});

describe('saveSession', () => {
  it('saves a new session and returns true', () => {
    const tmp = path.join(os.tmpdir(), `oc-test-${Date.now()}.json`);
    fs.writeFileSync(tmp, JSON.stringify([]));
    const session = { sessionId: 'new1', date: '2026-03-18' };
    const result = saveSession(session, tmp);
    assert.equal(result, true);
    const stored = JSON.parse(fs.readFileSync(tmp, 'utf8'));
    assert.equal(stored.length, 1);
    fs.unlinkSync(tmp);
  });

  it('returns false and does not duplicate for existing sessionId', () => {
    const tmp = path.join(os.tmpdir(), `oc-test-${Date.now()}.json`);
    fs.writeFileSync(tmp, JSON.stringify([{ sessionId: 'dup1' }]));
    const result = saveSession({ sessionId: 'dup1' }, tmp);
    assert.equal(result, false);
    const stored = JSON.parse(fs.readFileSync(tmp, 'utf8'));
    assert.equal(stored.length, 1);
    fs.unlinkSync(tmp);
  });
});
