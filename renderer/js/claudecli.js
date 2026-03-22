/* Claude CLI Session Dashboard */

(function () {
  let allSessions = [];
  let currentDate = todayStr();

  function todayStr() {
    return new Date().toISOString().split('T')[0];
  }

  function formatDuration(secs) {
    if (!secs || secs < 60) return `${secs || 0}s`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }

  function formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hr = parseInt(h);
    return `${hr % 12 || 12}:${m}${hr < 12 ? 'am' : 'pm'}`;
  }

  function formatTokens(n) {
    if (!n) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return Math.round(n / 1000) + 'k';
    return String(n);
  }

  function renderCard(session) {
    const errCount  = session.errors?.length || 0;
    const fixedCount = session.errorsFixed || 0;
    const duration  = formatDuration(session.durationSecs);
    const startTime = formatTime(session.startTime);
    const tools     = (session.toolsUsed || []).slice(0, 4).join(', ');
    const tokens    = formatTokens(session.tokenUsage?.total);
    const tags      = session.tags || [];

    return `
      <div class="claude-card">
        <div class="claude-card-header">
          <div class="claude-card-title" title="${escHtml(session.title)}">${escHtml(session.title)}</div>
          <div class="claude-card-time">${startTime}</div>
        </div>
        <div class="claude-card-meta">
          <span>⏱ ${duration}</span>
          <span>💬 ${session.messageCount || 0} msgs</span>
          <span>🪙 ${tokens} tokens</span>
          ${tools ? `<span>🔧 ${escHtml(tools)}</span>` : ''}
          ${session.gitBranch && session.gitBranch !== 'unknown' ? `<span>⎇ ${escHtml(session.gitBranch)}</span>` : ''}
          ${errCount > 0 ? `<span style="color:#fca5a5">🐛 ${fixedCount}/${errCount} fixed</span>` : ''}
        </div>
        <div class="claude-tags">
          ${tags.map(t => `<span class="claude-tag">${escHtml(t)}</span>`).join('')}
          ${errCount > 0 ? `<span class="claude-tag error">errors</span>` : ''}
        </div>
      </div>`;
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function render() {
    const list = document.getElementById('claude-session-list');
    if (!list) return;

    const daySessions = allSessions
      .filter(s => s.date === currentDate)
      .sort((a, b) => b.startTime.localeCompare(a.startTime));

    if (!daySessions.length) {
      list.innerHTML = `<div class="claude-empty">No Claude CLI sessions on ${escHtml(currentDate)}</div>`;
      return;
    }
    list.innerHTML = daySessions.map(renderCard).join('');
  }

  async function init() {
    const section = document.getElementById('claude-section');
    if (!section) return;

    try {
      allSessions = await window.electronAPI.getClaudeSessions();
    } catch {
      allSessions = [];
    }

    render();

    // Live updates
    window.electronAPI.onClaudeSession((session) => {
      const idx = allSessions.findIndex(s => s.sessionId === session.sessionId);
      if (idx >= 0) allSessions[idx] = session; else allSessions.push(session);
      render();
    });

    // Date nav buttons (reuse same pattern as OpenCode dashboard)
    const prevBtn = document.getElementById('claude-prev-day');
    const nextBtn = document.getElementById('claude-next-day');
    const dateLabel = document.getElementById('claude-date-label');

    if (prevBtn) prevBtn.addEventListener('click', () => {
      const d = new Date(currentDate + 'T00:00:00');
      d.setDate(d.getDate() - 1);
      currentDate = d.toISOString().split('T')[0];
      if (dateLabel) dateLabel.textContent = currentDate === todayStr() ? 'Today' : currentDate;
      render();
    });

    if (nextBtn) nextBtn.addEventListener('click', () => {
      const d = new Date(currentDate + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      const next = d.toISOString().split('T')[0];
      if (next > todayStr()) return;
      currentDate = next;
      if (dateLabel) dateLabel.textContent = currentDate === todayStr() ? 'Today' : currentDate;
      render();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
