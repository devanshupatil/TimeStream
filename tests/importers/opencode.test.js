const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { extractSession, isDuplicate, extractErrors, extractTags, extractFiles } = require('../../src/importers/opencode.js');

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
