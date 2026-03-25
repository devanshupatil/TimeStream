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

  const SOURCE_TAGS = {
    'claude-code': { label: 'Claude Code', bg: '#0d9488', color: '#fff' },
    'opencode':    { label: 'OpenCode',    bg: '#6366f1', color: '#fff' },
  };

  function renderCard(session) {
    const allTags = session.tags || [];
    const sourceKey = allTags.find(t => SOURCE_TAGS[t]);
    const techTags = allTags.filter(t => !SOURCE_TAGS[t]);

    const sourceBadge = sourceKey
      ? `<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:6px;background:${SOURCE_TAGS[sourceKey].bg};color:${SOURCE_TAGS[sourceKey].color};white-space:nowrap">${SOURCE_TAGS[sourceKey].label}</span>`
      : '';

    const techTagsHTML = techTags
      .map(t => `<span class="claude-tag">${escHtml(t)}</span>`)
      .join('');

    const errCount  = session.errors?.length || 0;
    const fixedCount = session.errorsFixed || 0;
    const duration  = formatDuration(session.durationSecs);
    const startTime = formatTime(session.startTime);

    const durationHTML = duration
      ? `<span style="color:var(--text-secondary);font-size:12px">⏱ ${duration}</span>`
      : '';
    const errorsHTML = fixedCount > 0
      ? `<span class="claude-tag error">✓ ${fixedCount} error${fixedCount > 1 ? 's' : ''} fixed</span>`
      : '';
    const summaryHTML = session.summary
      ? `<div class="claude-card-summary">${escHtml(session.summary)}</div>`
      : '';

    const metaContent = [techTagsHTML, durationHTML, errorsHTML].filter(Boolean).join('');

    return `
      <div class="claude-card" style="cursor:pointer" onclick="window.openOpencodeModal('${session.sessionId}')">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <div class="claude-card-time">${startTime}</div>
          ${sourceBadge}
        </div>
        <div class="claude-card-title" title="${escHtml(session.title)}">${escHtml(session.title || '')}</div>
        ${summaryHTML}
        ${metaContent ? `<div class="claude-card-meta">${metaContent}</div>` : ''}
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

    window.allSessions = daySessions;

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
      if (window.allSessions) {
        const gIdx = window.allSessions.findIndex(s => s.sessionId === session.sessionId);
        if (gIdx >= 0) window.allSessions[gIdx] = session; else window.allSessions.push(session);
      }
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
