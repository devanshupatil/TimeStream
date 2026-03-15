// TimeStream - Sample Data Module
// Provides mock activity data for the UI

const today = new Date();
const fmt = (h, m) => {
    const d = new Date(today);
    d.setHours(h, m, 0, 0);
    return d;
};

const ACTIVITIES = [
    {
        id: 1,
        source: 'github',
        sourceLabel: 'GitHub',
        icon: 'code_blocks',
        iconBg: 'bg-slate-900',
        title: 'Pushed 4 commits to \'main\'',
        category: 'Coding',
        categoryColor: 'emerald',
        time: fmt(10, 30),
        url: '#',
    },
    {
        id: 2,
        source: 'youtube',
        sourceLabel: 'YouTube',
        icon: 'play_circle',
        iconBg: 'bg-rose-600',
        title: 'Watched \'Advanced React Patterns\'',
        category: 'Learning',
        categoryColor: 'blue',
        time: fmt(9, 15),
        url: 'https://youtube.com',
    },
    {
        id: 3,
        source: 'github',
        sourceLabel: 'GitHub',
        icon: 'merge',
        iconBg: 'bg-slate-900',
        title: 'Merged PR #44: UI Refactor',
        category: 'Coding',
        categoryColor: 'emerald',
        time: fmt(8, 45),
        url: '#',
    },
    {
        id: 4,
        source: 'browser',
        sourceLabel: 'Web Browser',
        icon: 'menu_book',
        iconBg: 'bg-amber-500',
        title: 'Read Documentation: Tailwind v4',
        category: 'Learning',
        categoryColor: 'blue',
        time: fmt(8, 0),
        url: 'https://tailwindcss.com',
    },
    {
        id: 5,
        source: 'vscode',
        sourceLabel: 'VS Code',
        icon: 'code',
        iconBg: 'bg-indigo-600',
        title: 'Worked on TimeStream Dashboard Component — 45m',
        category: 'Coding',
        categoryColor: 'emerald',
        time: fmt(9, 0),
        url: '#',
        tags: ['#react', '#ui-design'],
    },
    {
        id: 6,
        source: 'browser',
        sourceLabel: 'Chrome',
        icon: 'language',
        iconBg: 'bg-orange-500',
        title: 'Tailwind UI Documentation',
        category: 'Research',
        categoryColor: 'purple',
        time: fmt(10, 0),
        url: 'https://tailwindui.com',
    },
    {
        id: 7,
        source: 'youtube',
        sourceLabel: 'YouTube',
        icon: 'smart_display',
        iconBg: 'bg-rose-600',
        title: 'Advanced Grid Layouts with CSS',
        category: 'Learning',
        categoryColor: 'blue',
        time: fmt(10, 30),
        url: 'https://youtube.com',
    },
    {
        id: 8,
        source: 'terminal',
        sourceLabel: 'Terminal',
        icon: 'terminal',
        iconBg: 'bg-emerald-700',
        title: 'Project Initialization & Scripting — 55m',
        category: 'DevOps',
        categoryColor: 'emerald',
        time: fmt(12, 0),
        url: '#',
        tags: ['#deployment', '#backend'],
    },
];

const TIMELINE_ENTRIES = [
    { hour: '9 AM', activities: [ACTIVITIES[4]] },
    { hour: '10 AM', activities: [ACTIVITIES[5], ACTIVITIES[6]] },
    { hour: '11 AM', activities: [] },
    { hour: '12 PM', activities: [ACTIVITIES[7]] },
    { hour: '1 PM', activities: [] },
    { hour: '2 PM', activities: [ACTIVITIES[0], ACTIVITIES[2]] },
    { hour: '3 PM', activities: [ACTIVITIES[1]] },
    { hour: '4 PM', activities: [ACTIVITIES[3]] },
];

function getTodayActivities() {
    return ACTIVITIES.slice().sort((a, b) => b.time - a.time);
}

function getTimelineEntries() {
    return TIMELINE_ENTRIES;
}

function getStats() {
    return {
        todayActivities: ACTIVITIES.length,
        learningHours: '4.5h',
        streak: '12 Days',
    };
}

function search(query) {
    if (!query) return ACTIVITIES;
    const q = query.toLowerCase();
    return ACTIVITIES.filter(
        a =>
            a.title.toLowerCase().includes(q) ||
            a.sourceLabel.toLowerCase().includes(q) ||
            a.category.toLowerCase().includes(q)
    );
}

window.TSData = { getTodayActivities, getTimelineEntries, getStats, search, ACTIVITIES };
