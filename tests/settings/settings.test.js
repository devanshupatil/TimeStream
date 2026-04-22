const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  sanitizeName,
  getDefaultBrowsers,
  addExclusion,
  removeExclusion,
  parseExclusions,
} = require('../../renderer/js/settings.js');

describe('sanitizeName', () => {
  it('returns trimmed value when non-empty', () => {
    assert.equal(sanitizeName('  Alice  '), 'Alice');
  });
  it('returns "Developer" for empty string', () => {
    assert.equal(sanitizeName(''), 'Developer');
  });
  it('returns "Developer" for whitespace-only', () => {
    assert.equal(sanitizeName('   '), 'Developer');
  });
});

describe('getDefaultBrowsers', () => {
  it('returns saved array when non-empty', () => {
    assert.deepEqual(getDefaultBrowsers(['brave']), ['brave']);
  });
  it('returns default when null', () => {
    assert.deepEqual(getDefaultBrowsers(null), ['chrome', 'firefox']);
  });
  it('returns default when empty array', () => {
    assert.deepEqual(getDefaultBrowsers([]), ['chrome', 'firefox']);
  });
});

describe('addExclusion', () => {
  it('appends trimmed entry to list', () => {
    assert.deepEqual(addExclusion(['a.com'], '  b.com  '), ['a.com', 'b.com']);
  });
  it('returns null for whitespace-only entry', () => {
    assert.equal(addExclusion(['a.com'], '  '), null);
  });
  it('returns null for empty entry', () => {
    assert.equal(addExclusion([], ''), null);
  });
});

describe('removeExclusion', () => {
  it('removes item at index', () => {
    assert.deepEqual(removeExclusion(['a.com', 'b.com'], 0), ['b.com']);
  });
  it('removes last item', () => {
    assert.deepEqual(removeExclusion(['a.com'], 0), []);
  });
});

describe('parseExclusions', () => {
  it('parses valid JSON array', () => {
    assert.deepEqual(parseExclusions('["a.com","b.com"]'), ['a.com', 'b.com']);
  });
  it('returns empty array for null', () => {
    assert.deepEqual(parseExclusions(null), []);
  });
  it('returns empty array for invalid JSON', () => {
    assert.deepEqual(parseExclusions('not-json'), []);
  });
});
