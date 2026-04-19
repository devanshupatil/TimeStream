(function () {
    'use strict';

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    let selectedDate = todayStr();
    let currentLoadedSessions = [];

    function todayStr() {
        return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    }

    function formatDateLabel(dateStr) {
        const [y, m, d] = dateStr.split('-').map(Number);
        return `${MONTHS[m - 1]} ${d}, ${y}`;
    }

    function formatTime(session) {
        if (!session || !session.startTime) return '';
        try {
            const d = new Date(`${session.date}T${session.startTime}Z`);
            if (!isNaN(d.getTime())) {
                return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            }
        } catch (e) { }
        const [h, min] = session.startTime.split(':');
        const hour = parseInt(h, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        return `${hour % 12 || 12}:${min} ${ampm}`;
    }

    function escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    const SOURCE_TAGS = {
        'claude-code': { label: 'Claude Code', bg: '#0d9488', color: '#fff' },
        'opencode': { label: 'OpenCode', bg: '#6366f1', color: '#fff' },
    };

    function basename(p) { return p ? p.split('/').pop() : ''; }

    function formatDuration(secs) {
        if (!secs || secs < 60) return secs ? `${secs}s` : '';
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return s > 0 ? `${m}m ${s}s` : `${m}m`;
    }

    function renderCard(session) {
        const allTags = session.tags || [];
        const sourceKey = allTags.find(t => SOURCE_TAGS[t]);
        const techTags = allTags.filter(t => !SOURCE_TAGS[t]);

        const sourceBadge = sourceKey
            ? `<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:6px;background:${SOURCE_TAGS[sourceKey].bg};color:${SOURCE_TAGS[sourceKey].color};white-space:nowrap">${SOURCE_TAGS[sourceKey].label}</span>`
            : '';

        const techTagsHTML = techTags
            .map(t => `<span class="oc-tag">${escHtml(t)}</span>`)
            .join('');

        // Show basenames only, skip noise
        const fileNames = (session.filesChanged || [])
            .map(basename)
            .filter(f => f && !f.endsWith('.oga') && !f.endsWith('.wav'))
            .slice(0, 3);
        const filesHTML = fileNames.length
            ? `<span class="oc-files">${escHtml(fileNames.join(', '))}</span>`
            : '';

        const duration = formatDuration(session.durationSecs);
        const durationHTML = duration
            ? `<span style="color:var(--text-secondary);font-size:12px">⏱ ${duration}</span>`
            : '';

        const errorsHTML = session.errorsFixed > 0
            ? `<span class="oc-errors-badge">✓ ${session.errorsFixed} error${session.errorsFixed > 1 ? 's' : ''} fixed</span>`
            : '';

        const metaContent = [techTagsHTML, durationHTML, errorsHTML, filesHTML].filter(Boolean).join('');

        return `
        <div class="oc-session-card" style="cursor:pointer;" onclick="window.openOpencodeModal('${session.sessionId}')">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <div class="oc-session-time">${formatTime(session)}</div>
                ${sourceBadge}
            </div>
            <div class="oc-session-title">${escHtml(session.title || '')}</div>
            <div class="oc-session-summary">${escHtml(session.summary || '')}</div>
            ${metaContent ? `<div class="oc-session-meta">${metaContent}</div>` : ''}
        </div>`;
    }

    function showEmpty(missing) {
        const list = document.getElementById('oc-sessions-list');
        if (!list) return;
        list.innerHTML = missing
            ? `<div class="oc-empty">
                <h3>OpenCode not connected</h3>
                <p>Start using OpenCode CLI and sessions will appear here automatically.<br>
                Sessions are read from:<br><code>~/.opencode/sessions/</code></p>
               </div>`
            : `<div class="oc-empty">
                <h3>No sessions for this day</h3>
                <p>Use OpenCode CLI today to see your learnings here.</p>
               </div>`;
    }

    async function renderPage() {
        try {
            const [ocSessions, claudeRaw] = await Promise.all([
                window.electronAPI.getOpencodeSessions(selectedDate),
                window.electronAPI.getClaudeSessions().catch(() => []),
            ]);
            const ocTagged = ocSessions.map(s => ({ ...s, tags: ['opencode', ...(s.tags || [])] }));
            const claudeSessions = claudeRaw
                .filter(s => s.date === selectedDate)
                .map(s => ({ ...s, tags: ['claude-code', ...(s.tags || [])] }));
            const sessions = [...ocTagged, ...claudeSessions];

            const label = document.getElementById('oc-date-label');
            if (label) label.textContent = formatDateLabel(selectedDate);

            const nextBtn = document.getElementById('oc-next-day');
            if (nextBtn) nextBtn.disabled = selectedDate >= todayStr();

            const totalEl = document.getElementById('oc-total-sessions');
            const errorsEl = document.getElementById('oc-total-errors');
            if (totalEl) totalEl.textContent = sessions.length;
            if (errorsEl) errorsEl.textContent = sessions.reduce((n, s) => n + (s.errorsFixed || 0), 0);

            const list = document.getElementById('oc-sessions-list');
            if (!list) return;

            if (!sessions.length) { showEmpty(false); return; }

            const sorted = [...sessions].sort((a, b) => (a.startTime < b.startTime ? -1 : 1));
            currentLoadedSessions = sorted;
            // Register in shared session map for modal lookups
            if (!window._sessionMap) window._sessionMap = {};
            sorted.forEach(s => { window._sessionMap[s.sessionId] = s; });
            list.innerHTML = sorted.map(renderCard).join('');
        } catch (err) {
            console.error('[OpenCode] Failed to load sessions:', err);
            showEmpty(false);
        }
    }

    window.openOpencodeModal = function (sessionId) {
        // Look up session from shared map (works for both OpenCode and Claude Code sessions)
        const session = (window._sessionMap && window._sessionMap[sessionId])
            || currentLoadedSessions.find(s => s.sessionId === sessionId);
        if (!session) return;

        const titleEl = document.getElementById('oc-modal-title');
        const chatEl = document.getElementById('oc-modal-chat');

        // Display title — fall back to cwd for untitled Claude Code sessions
        const displayTitle = (session.title && session.title !== 'Untitled Session')
            ? session.title
            : (session.cwd ? session.cwd.split('/').filter(Boolean).pop() + ' session' : 'Claude Code Session');
        if (titleEl) titleEl.textContent = displayTitle;

        if (chatEl) {
            const msgsHTML = (session.messages || []).map(m => {
                const bubbleClass = m.role === 'user' ? 'oc-bubble-user' : 'oc-bubble-assistant';
                return `<div class="oc-chat-bubble ${bubbleClass}">${escHtml(m.content || '')}</div>`;
            }).join('');
            chatEl.innerHTML = msgsHTML || '<div style="color:var(--text-muted);text-align:center;">No transcript available.</div>';
        }

        const backdrop = document.getElementById('oc-modal-backdrop');
        if (backdrop) backdrop.style.display = 'flex';
    };

    window.closeOpencodeModal = function () {
        const backdrop = document.getElementById('oc-modal-backdrop');
        if (backdrop) backdrop.style.display = 'none';
    };

    function initNavigation() {
        const todayObj = new Date();
        const btn = document.getElementById('btn-calendar-oc');
        const dropdown = document.getElementById('oc-cal-dropdown');
        const monthYearEl = document.getElementById('oc-cal-month-year');
        const gridEl = document.getElementById('oc-cal-grid');
        if (!btn || !dropdown) return;

        let calView = { year: todayObj.getFullYear(), month: todayObj.getMonth() };
        let isOpen = false;

        function toDateStr(d) {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }

        function renderCalendar() {
            const { year, month } = calView;
            const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
            monthYearEl.textContent = `${MONTHS[month]} ${year}`;
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const today = toDateStr(todayObj);
            gridEl.innerHTML = '';
            for (let i = 0; i < firstDay; i++) {
                const cell = document.createElement('div');
                cell.className = 'cal-day cal-day-empty';
                gridEl.appendChild(cell);
            }
            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const cell = document.createElement('button');
                cell.className = 'cal-day';
                cell.textContent = d;
                if (dateStr > today) { cell.disabled = true; cell.style.opacity = '0.3'; }
                if (dateStr === today) cell.classList.add('cal-day-today');
                if (dateStr === selectedDate) cell.classList.add('cal-day-selected');
                cell.addEventListener('click', () => {
                    selectedDate = dateStr;
                    updateLabel();
                    renderPage();
                    closeCalendar();
                });
                gridEl.appendChild(cell);
            }
        }

        function updateLabel() {
            const el = document.getElementById('oc-date-label');
            if (!el) return;
            const today = toDateStr(todayObj);
            if (selectedDate === today) {
                el.textContent = 'Today';
            } else {
                const d = new Date(selectedDate + 'T00:00:00');
                el.textContent = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            }
        }

        function openCalendar() {
            const d = new Date(selectedDate + 'T00:00:00');
            calView = { year: d.getFullYear(), month: d.getMonth() };
            renderCalendar();
            dropdown.style.display = 'block';
            isOpen = true;
            btn.style.borderColor = 'var(--accent)';
        }

        function closeCalendar() {
            dropdown.style.display = 'none';
            isOpen = false;
            btn.style.borderColor = '';
        }

        btn.addEventListener('click', (e) => { e.stopPropagation(); isOpen ? closeCalendar() : openCalendar(); });

        document.getElementById('oc-cal-prev')?.addEventListener('click', (e) => {
            e.stopPropagation();
            calView.month--;
            if (calView.month < 0) { calView.month = 11; calView.year--; }
            renderCalendar();
        });

        document.getElementById('oc-cal-next')?.addEventListener('click', (e) => {
            e.stopPropagation();
            calView.month++;
            if (calView.month > 11) { calView.month = 0; calView.year++; }
            renderCalendar();
        });

        document.getElementById('oc-cal-today-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            selectedDate = toDateStr(todayObj);
            updateLabel();
            renderPage();
            closeCalendar();
        });

        document.getElementById('oc-cal-clear-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            selectedDate = toDateStr(todayObj);
            updateLabel();
            renderPage();
            closeCalendar();
        });

        document.addEventListener('click', (e) => {
            if (isOpen && !dropdown.contains(e.target) && e.target !== btn) closeCalendar();
        });
    }

    function initLiveUpdates() {
        window.electronAPI.onOpenCodeSessionImported((session) => {
            if (session.date === selectedDate) renderPage();
        });

        window.electronAPI.onClaudeSession((session) => {
            if (session.date === selectedDate) renderPage();
        });

        window.electronAPI.onOpenCodeMissingDir(() => {
            const page = document.getElementById('page-opencode');
            if (page && page.classList.contains('active')) {
                showEmpty(true);
            }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        initNavigation();
        initLiveUpdates();

        const closeBtn = document.getElementById('oc-modal-close');
        if (closeBtn) closeBtn.addEventListener('click', window.closeOpencodeModal);

        const backdrop = document.getElementById('oc-modal-backdrop');
        if (backdrop) backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) window.closeOpencodeModal();
        });
    });

    // Hook into existing navigate() — must load after navigate is defined
    const _origNavigate = window.navigate;
    window.navigate = function (page) {
        if (typeof _origNavigate === 'function') _origNavigate(page);
        if (page === 'opencode') renderPage();
    };
})();
