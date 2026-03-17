// TimeStream App - Navigation & UI Logic

(function () {
    // ---- Navigation ----
    const navLinks = document.querySelectorAll('[data-nav]');
    const pages = document.querySelectorAll('[data-page]');

    function navigate(target) {
        pages.forEach(p => {
            p.classList.toggle('hidden', p.dataset.page !== target);
        });
        navLinks.forEach(l => {
            const isActive = l.dataset.nav === target;
            l.classList.toggle('bg-primary', isActive);
            l.classList.toggle('text-white', isActive);
            l.classList.toggle('shadow-lg', isActive);
            l.classList.toggle('shadow-primary/20', isActive);
            l.classList.toggle('text-slate-600', !isActive);
            l.classList.toggle('dark:text-slate-400', !isActive);
            l.classList.toggle('hover:bg-slate-100', !isActive);
            l.classList.toggle('dark:hover:bg-primary/10', !isActive);
        });
        // Render page-specific content
        if (target === 'dashboard') renderDashboard();
        if (target === 'timeline') renderTimeline();
        if (target === 'search') renderSearch();
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigate(link.dataset.nav);
        });
    });

    // ---- Titlebar Controls ----
    const btnMinimize = document.getElementById('btn-minimize');
    const btnMaximize = document.getElementById('btn-maximize');
    const btnClose = document.getElementById('btn-close');
    if (btnMinimize) btnMinimize.addEventListener('click', () => window.electronAPI?.minimizeWindow());
    if (btnMaximize) btnMaximize.addEventListener('click', () => window.electronAPI?.maximizeWindow());
    if (btnClose) btnClose.addEventListener('click', () => window.electronAPI?.closeWindow());

    // ---- Helper: format time ----
    function fmtTime(date) {
        if (!date) return '';
        const d = new Date(date);
        let h = d.getHours();
        const m = String(d.getMinutes()).padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${m} ${ampm}`;
    }

    // ---- Helper: category badge colors ----
    const catColors = {
        Coding: 'bg-emerald-500/20 text-emerald-400',
        Learning: 'bg-blue-500/20 text-blue-400',
        Research: 'bg-purple-500/20 text-purple-400',
        DevOps: 'bg-primary/20 text-primary',
        Communication: 'bg-orange-500/20 text-orange-400',
    };

    function catBadge(cat) {
        return catColors[cat] || 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300';
    }

    // ---- Dashboard ----
    async function renderDashboard() {
        const stats = await window.TSData.getStats();
        const el = id => document.getElementById(id);

        const todayEl = el('stat-today');
        const hoursEl = el('stat-hours');
        const streakEl = el('stat-streak');
        if (todayEl) todayEl.textContent = stats.todayActivities;
        if (hoursEl) hoursEl.textContent = stats.learningHours;
        if (streakEl) streakEl.textContent = stats.streak;

        // date
        const dateBtn = el('dashboard-date');
        if (dateBtn) {
            const now = new Date();
            dateBtn.textContent = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }

        const feed = el('activity-feed');
        if (!feed) return;
        const activities = window.TSData.getTodayActivities().slice(0, 6);
        feed.innerHTML = activities.map(a => `
      <div class="bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark p-5 rounded-xl flex items-center gap-5 hover:border-primary/40 transition-all cursor-pointer">
        <div class="w-12 h-12 rounded-full ${a.iconBg} flex items-center justify-center text-white shrink-0">
          <span class="material-symbols-outlined">${a.icon}</span>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between mb-1 gap-2">
            <h4 class="font-semibold text-slate-800 dark:text-slate-100 truncate">${a.title}</h4>
            <span class="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded shrink-0 ${catBadge(a.category)}">${a.category}</span>
          </div>
          <div class="flex items-center gap-4">
            <span class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <span class="material-symbols-outlined text-sm">schedule</span>${fmtTime(a.time)}
            </span>
            <span class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <span class="material-symbols-outlined text-sm">source</span>${a.sourceLabel}
            </span>
          </div>
        </div>
      </div>
    `).join('');
    }

    // ---- Timeline ----
    let activeFilter = 'all';

    function renderTimeline() {
        const now = new Date();
        const dateLabel = document.getElementById('timeline-date');
        if (dateLabel) {
            dateLabel.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        }

        renderTimelineEntries(activeFilter);

        // Filter pills
        document.querySelectorAll('[data-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                activeFilter = btn.dataset.filter;
                document.querySelectorAll('[data-filter]').forEach(b => {
                    const isActive = b.dataset.filter === activeFilter;
                    b.classList.toggle('bg-primary', isActive);
                    b.classList.toggle('text-white', isActive);
                    b.classList.toggle('bg-slate-100', !isActive);
                    b.classList.toggle('dark:bg-slate-800', !isActive);
                    b.classList.toggle('text-slate-600', !isActive);
                    b.classList.toggle('dark:text-slate-400', !isActive);
                });
                renderTimelineEntries(activeFilter);
            });
        });
    }

    function renderTimelineEntries(filter) {
        const container = document.getElementById('timeline-entries');
        if (!container) return;
        const entries = window.TSData.getTimelineEntries();

        const iconColors = { github: 'bg-slate-900', youtube: 'bg-rose-600', browser: 'bg-orange-500', vscode: 'bg-blue-500', terminal: 'bg-emerald-700' };
        const iconTextColors = { github: 'text-white', youtube: 'text-white', browser: 'text-white', vscode: 'text-white', terminal: 'text-white' };

        container.innerHTML = entries.map(entry => {
            let activities = entry.activities;
            if (filter !== 'all') {
                activities = activities.filter(a => a.source === filter);
            }
            const hasDot = activities.length > 0;

            return `
        <div class="flex gap-8 mb-12 relative">
          <div class="w-16 pt-1 text-right shrink-0">
            <span class="text-sm font-bold text-slate-400 uppercase">${entry.hour}</span>
          </div>
          <div class="absolute left-[64px] top-3 size-3 rounded-full ${hasDot ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'} border-4 border-background-dark z-10"></div>
          <div class="flex-1 flex flex-col gap-4">
            ${activities.length === 0 && filter === 'all' && entry.activities.length === 0 ? `
              <div class="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm opacity-60">
                <div class="flex items-center gap-3">
                  <div class="size-8 rounded-lg bg-slate-500/10 flex items-center justify-center text-slate-500">
                    <span class="material-symbols-outlined">coffee</span>
                  </div>
                  <div>
                    <h4 class="text-sm font-bold italic">Break / No recorded activity</h4>
                    <p class="text-xs text-slate-500">${entry.hour} - ${entry.hour}</p>
                  </div>
                </div>
              </div>
            ` : activities.map(a => `
              <div class="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm hover:border-primary/50 transition-colors cursor-pointer">
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-3">
                    <div class="size-8 rounded-lg ${iconColors[a.source] || 'bg-slate-800'} flex items-center justify-center ${iconTextColors[a.source] || 'text-white'}">
                      <span class="material-symbols-outlined text-sm">${a.icon}</span>
                    </div>
                    <div>
                      <h4 class="text-sm font-bold">${a.title}</h4>
                      <p class="text-xs text-slate-500">${a.sourceLabel} • ${fmtTime(a.time)}</p>
                    </div>
                  </div>
                  <span class="text-xs px-2 py-1 rounded font-bold ${catBadge(a.category)}">${a.category}</span>
                </div>
                ${a.tags ? `<div class="flex flex-wrap gap-2">${a.tags.map(t => `<span class="text-[10px] px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500">${t}</span>`).join('')}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
        }).join('');
    }

    // ---- Search ----
    function renderSearch(query) {
        const results = window.TSData.search(query || '');
        const container = document.getElementById('search-results');
        const countEl = document.getElementById('search-count');
        if (!container) return;
        if (countEl) countEl.textContent = `Search results (${results.length})`;

        const sourceIconMap = { github: 'source', youtube: 'smart_display', browser: 'language', vscode: 'code', terminal: 'terminal' };
        const sourceColorMap = { github: 'text-slate-400', youtube: 'text-red-500', browser: 'text-orange-400', vscode: 'text-blue-500', terminal: 'text-emerald-500' };

        container.innerHTML = results.map(a => `
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
        <div class="flex flex-col md:flex-row">
          <div class="md:w-56 h-36 flex-shrink-0 ${a.iconBg} flex items-center justify-center">
            <span class="material-symbols-outlined text-white text-5xl">${a.icon}</span>
          </div>
          <div class="p-5 flex-1 flex flex-col justify-between">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="material-symbols-outlined ${sourceColorMap[a.source] || 'text-slate-400'} text-sm">${sourceIconMap[a.source] || 'link'}</span>
                <span class="text-xs font-medium text-slate-500 uppercase">${a.category} • ${a.sourceLabel}</span>
              </div>
              <h3 class="text-base font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">${a.title}</h3>
            </div>
            <div class="mt-4 flex items-center justify-between">
              <div class="flex items-center gap-4 text-xs text-slate-500">
                <span class="flex items-center gap-1"><span class="material-symbols-outlined text-sm">schedule</span>${fmtTime(a.time)}</span>
              </div>
              <button class="text-primary text-xs font-bold flex items-center gap-1">
                View Details <span class="material-symbols-outlined text-xs">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `).join('');
    }

    // Search input wiring
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderSearch(e.target.value);
        });
    }

    // ---- Init ----
    navigate('dashboard');
})();
