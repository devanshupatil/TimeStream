(function () {
    'use strict';

    const MONTHS = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];

    let selectedDate = todayStr();

    function todayStr() {
        return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    }

    function formatDateLabel(dateStr) {
        const [y, m, d] = dateStr.split('-').map(Number);
        return `${MONTHS[m - 1]} ${d}, ${y}`;
    }

    function formatTime(timeStr) {
        if (!timeStr) return '';
        const [h, min] = timeStr.split(':');
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

    function renderCard(session) {
        const tagsHTML = (session.tags || [])
            .map(t => `<span class="oc-tag">${escHtml(t)}</span>`)
            .join('');

        const filesText = (session.filesChanged || []).slice(0, 3).join(', ');

        return `
        <div class="oc-session-card">
            <div class="oc-session-time">${formatTime(session.startTime)}</div>
            <div class="oc-session-title">${escHtml(session.title || '')}</div>
            <div class="oc-session-summary">${escHtml(session.summary || '')}</div>
            <div class="oc-session-meta">
                ${tagsHTML}
                ${session.errorsFixed > 0
                    ? `<span class="oc-errors-badge">✓ ${session.errorsFixed} error${session.errorsFixed > 1 ? 's' : ''} fixed</span>`
                    : ''}
                ${filesText ? `<span class="oc-files">${escHtml(filesText)}</span>` : ''}
            </div>
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
        const sessions = await window.electronAPI.getOpencodeSessions(selectedDate);

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
        list.innerHTML = sorted.map(renderCard).join('');
    }

    function initNavigation() {
        document.getElementById('oc-prev-day')?.addEventListener('click', () => {
            const d = new Date(selectedDate + 'T00:00:00');
            d.setDate(d.getDate() - 1);
            selectedDate = d.toLocaleDateString('en-CA');
            renderPage();
        });

        document.getElementById('oc-next-day')?.addEventListener('click', () => {
            const d = new Date(selectedDate + 'T00:00:00');
            d.setDate(d.getDate() + 1);
            const next = d.toLocaleDateString('en-CA');
            if (next <= todayStr()) { selectedDate = next; renderPage(); }
        });
    }

    function initLiveUpdates() {
        window.electronAPI.onOpenCodeSessionImported((session) => {
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
    });

    // Hook into existing navigate() — must load after navigate is defined
    const _origNavigate = window.navigate;
    window.navigate = function (page) {
        if (typeof _origNavigate === 'function') _origNavigate(page);
        if (page === 'opencode') renderPage();
    };
})();
