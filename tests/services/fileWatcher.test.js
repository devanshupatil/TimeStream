const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { debounce, parseWithRetry } = require('../../src/services/fileWatcher.js');

describe('debounce', () => {
  it('calls function after delay', async () => {
    let called = 0;
    const fn = debounce(() => called++, 50);
    fn(); fn(); fn();
    await new Promise(r => setTimeout(r, 100));
    assert.equal(called, 1);
  });

  it('resets timer on repeated calls', async () => {
    let called = 0;
    const fn = debounce(() => called++, 100);
    fn();
    await new Promise(r => setTimeout(r, 50));
    fn(); // resets
    await new Promise(r => setTimeout(r, 150));
    assert.equal(called, 1);
  });
});

describe('parseWithRetry', () => {
  it('returns parsed object on valid JSON', async () => {
    const read = async () => '{"id":"abc"}';
    const result = await parseWithRetry(read, 1, 10);
    assert.deepEqual(result, { id: 'abc' });
  });

  it('retries on invalid JSON and eventually throws', async () => {
    let attempts = 0;
    const read = async () => { attempts++; return '{bad json'; };
    await assert.rejects(() => parseWithRetry(read, 3, 10), /JSON/);
    assert.equal(attempts, 3);
  });
});
