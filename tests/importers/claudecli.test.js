'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const os = require('os');
const {
  cwdToSlug, getProjectDir, parseSessionFile,
  extractTitle, extractDuration, extractFilesChanged,
  extractToolsUsed, extractTokenUsage, extractErrors,
  extractTags, extractSession, isDuplicate, loadSessions, saveSession,
} = require('../../src/importers/claudecli');

const makeUser = (content, extra = {}) => ({
  type: 'user', isSidechain: false,
  timestamp: '2026-03-22T10:00:00.000Z',
  sessionId: 'sess-1', uuid: 'u1',
  message: { role: 'user', content },
  ...extra,
});

const makeAssistant = (textOrContent, model = 'claude-sonnet-4-6', usage = {}) => ({
  type: 'assistant', isSidechain: false,
  timestamp: '2026-03-22T10:01:00.000Z',
  sessionId: 'sess-1', uuid: 'a1',
  message: {
    role: 'assistant', model,
    content: typeof textOrContent === 'string'
      ? [{ type: 'text', text: textOrContent }]
      : textOrContent,
    usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, ...usage },
  },
});

const makeSnapshot = (files = {}) => ({
  type: 'file-history-snapshot',
  snapshot: { trackedFileBackups: files, timestamp: '2026-03-22T10:00:30.000Z' },
  isSnapshotUpdate: false,
});

// cwdToSlug
test('cwdToSlug: replaces non-alphanumeric with dashes', () => {
  assert.equal(cwdToSlug('/home/devanshu/TimeStream '), '-home-devanshu-TimeStream-');
});
test('cwdToSlug: simple path', () => {
  assert.equal(cwdToSlug('/home/user/project'), '-home-user-project');
});

// getProjectDir
test('getProjectDir: returns correct path', () => {
  const result = getProjectDir('/home/devanshu/TimeStream ');
  const expected = path.join(os.homedir(), '.claude', 'projects', '-home-devanshu-TimeStream-');
  assert.equal(result, expected);
});

// extractTitle
test('extractTitle: returns first user message as title', () => {
  assert.equal(extractTitle([makeUser('Fix the bug in renderer')]), 'Fix the bug in renderer');
});
test('extractTitle: truncates long messages to 80 chars', () => {
  assert.equal(extractTitle([makeUser('A'.repeat(100))]).length, 80);
});
test('extractTitle: skips sidechains', () => {
  const entries = [makeUser('sidechain', { isSidechain: true }), makeUser('real')];
  assert.equal(extractTitle(entries), 'real');
});
test('extractTitle: handles array content', () => {
  const entries = [{ type: 'user', isSidechain: false, message: { role: 'user', content: [{ type: 'text', text: 'array content' }] } }];
  assert.equal(extractTitle(entries), 'array content');
});
test('extractTitle: returns Untitled Session when no user entry', () => {
  assert.equal(extractTitle([]), 'Untitled Session');
});

// extractDuration
test('extractDuration: calculates seconds between first and last timestamps', () => {
  assert.equal(extractDuration([{ timestamp: '2026-03-22T10:00:00.000Z' }, { timestamp: '2026-03-22T10:05:30.000Z' }]), 330);
});
test('extractDuration: returns 0 for single entry', () => {
  assert.equal(extractDuration([{ timestamp: '2026-03-22T10:00:00.000Z' }]), 0);
});
test('extractDuration: returns 0 for no entries', () => {
  assert.equal(extractDuration([]), 0);
});

// extractFilesChanged
test('extractFilesChanged: extracts file paths from snapshots', () => {
  const files = extractFilesChanged([makeSnapshot({ '/src/main.js': 'backup', '/src/preload.js': 'backup' })]);
  assert.ok(files.includes('/src/main.js'));
  assert.ok(files.includes('/src/preload.js'));
});
test('extractFilesChanged: returns empty array with no snapshots', () => {
  assert.deepEqual(extractFilesChanged([makeUser('hi')]), []);
});
test('extractFilesChanged: deduplicates across multiple snapshots', () => {
  const files = extractFilesChanged([makeSnapshot({ '/src/main.js': 'v1' }), makeSnapshot({ '/src/main.js': 'v2' })]);
  assert.equal(files.filter(f => f === '/src/main.js').length, 1);
});

// extractToolsUsed
test('extractToolsUsed: extracts tool names from assistant content', () => {
  const tools = extractToolsUsed([makeAssistant([{ type: 'tool_use', name: 'Edit', input: {} }, { type: 'tool_use', name: 'Bash', input: {} }])]);
  assert.ok(tools.includes('Edit'));
  assert.ok(tools.includes('Bash'));
});
test('extractToolsUsed: deduplicates tool names', () => {
  const tools = extractToolsUsed([makeAssistant([{ type: 'tool_use', name: 'Edit', input: {} }, { type: 'tool_use', name: 'Edit', input: {} }])]);
  assert.equal(tools.filter(t => t === 'Edit').length, 1);
});
test('extractToolsUsed: returns empty for no tool_use blocks', () => {
  assert.deepEqual(extractToolsUsed([makeAssistant('just text')]), []);
});

// extractTokenUsage
test('extractTokenUsage: sums input + cache_read + output across entries', () => {
  const entries = [
    makeAssistant('a', 'model', { input_tokens: 100, cache_read_input_tokens: 200, output_tokens: 50 }),
    makeAssistant('b', 'model', { input_tokens: 50, cache_read_input_tokens: 0, output_tokens: 30 }),
  ];
  const usage = extractTokenUsage(entries);
  assert.equal(usage.input, 350);
  assert.equal(usage.output, 80);
  assert.equal(usage.total, 430);
});
test('extractTokenUsage: returns zeros for no assistant entries', () => {
  assert.deepEqual(extractTokenUsage([makeUser('hi')]), { input: 0, output: 0, total: 0 });
});

// extractErrors
test('extractErrors: detects error patterns in user messages', () => {
  const entries = [makeUser('Error: Cannot find module foo'), makeAssistant('I fixed it')];
  const errors = extractErrors(entries);
  assert.equal(errors.length, 1);
  assert.ok(errors[0].message.includes('Error:'));
  assert.equal(errors[0].fixed, true);
});
test('extractErrors: marks fixed=false when next entry is not assistant', () => {
  const errors = extractErrors([makeUser('Error: something broke'), makeUser('also broken')]);
  assert.equal(errors[0].fixed, false);
});
test('extractErrors: skips non-error user messages', () => {
  assert.equal(extractErrors([makeUser('add a new feature')]).length, 0);
});
test('extractErrors: skips user messages with array content', () => {
  const entries = [{ type: 'user', isSidechain: false, message: { role: 'user', content: [{ type: 'text', text: 'Error: something broke' }] } }];
  assert.equal(extractErrors(entries).length, 0);
});

// extractTags
test('extractTags: adds tag from file extension', () => {
  const tags = extractTags([], ['/src/main.js', '/styles.css'], []);
  assert.ok(tags.includes('javascript'));
  assert.ok(tags.includes('css'));
});
test('extractTags: adds tag from error text keyword', () => {
  const tags = extractTags([{ message: 'react component failed', fixed: false }], [], []);
  assert.ok(tags.includes('react'));
});
test('extractTags: adds electron tag from error text', () => {
  const tags = extractTags([{ message: 'electron app crashed', fixed: false }], [], []);
  assert.ok(tags.includes('electron'));
});

// extractSession
test('extractSession: returns null for empty entries', () => {
  assert.equal(extractSession([], '/path/sess.jsonl', Date.now()), null);
});
test('extractSession: returns full session object with correct shape', () => {
  const entries = [
    { ...makeUser('Add reddit tracking'), sessionId: 'sess-1', cwd: '/project', gitBranch: 'main', timestamp: '2026-03-22T10:00:00.000Z' },
    makeSnapshot({ '/src/content.js': 'v1' }),
    { ...makeAssistant([{ type: 'tool_use', name: 'Edit', input: {} }], 'claude-sonnet-4-6', { input_tokens: 100, output_tokens: 50 }), timestamp: '2026-03-22T10:05:00.000Z' },
  ];
  const session = extractSession(entries, '/path/sess-1.jsonl', Date.now());
  assert.equal(session.sessionId, 'sess-1');
  assert.equal(session.title, 'Add reddit tracking');
  assert.equal(session.date, '2026-03-22');
  assert.equal(session.durationSecs, 300);
  assert.ok(session.filesChanged.includes('/src/content.js'));
  assert.ok(session.toolsUsed.includes('Edit'));
  assert.equal(session.tokenUsage.output, 50);
  assert.equal(session.source, 'claudecli');
  assert.equal(session.gitBranch, 'main');
});

// parseSessionFile
test('parseSessionFile: skips malformed JSON lines', () => {
  const tmpPath = os.tmpdir() + '/malformed-' + Date.now() + '.jsonl';
  require('fs').writeFileSync(tmpPath,
    '{"type":"user","sessionId":"x"}\nnot-json\n{"type":"assistant","sessionId":"x"}\n'
  );
  const entries = require('../../src/importers/claudecli').parseSessionFile(tmpPath);
  assert.equal(entries.length, 2);
  require('fs').unlinkSync(tmpPath);
});

// isDuplicate
test('isDuplicate: returns true when sessionId exists', () => {
  assert.equal(isDuplicate('sess-1', [{ sessionId: 'sess-1' }]), true);
});
test('isDuplicate: returns false when sessionId absent', () => {
  assert.equal(isDuplicate('sess-2', [{ sessionId: 'sess-1' }]), false);
});

// loadSessions / saveSession
const tmpFile = os.tmpdir() + '/claude-test-' + Date.now() + '.json';
test('loadSessions: returns empty array for missing file', () => {
  assert.deepEqual(loadSessions('/nonexistent/path.json'), []);
});
test('saveSession: creates file and persists session', () => {
  saveSession({ sessionId: 'x1', title: 'Test' }, tmpFile);
  const loaded = loadSessions(tmpFile);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].sessionId, 'x1');
});
test('saveSession: upserts existing session', () => {
  saveSession({ sessionId: 'x1', title: 'Updated' }, tmpFile);
  const loaded = loadSessions(tmpFile);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].title, 'Updated');
});
