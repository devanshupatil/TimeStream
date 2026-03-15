// TimeStream - Sample Data Module
// Provides mock activity data for the UI

const today = new Date();
const fmt = (h, m) => {
    const d = new Date(today);
    d.setHours(h, m, 0, 0);
    return d;
};

const ACTIVITIES = [];

const TIMELINE_ENTRIES = [
    { hour: '9 AM', activities: [] },
    { hour: '10 AM', activities: [] },
    { hour: '11 AM', activities: [] },
    { hour: '12 PM', activities: [] },
    { hour: '1 PM', activities: [] },
    { hour: '2 PM', activities: [] },
    { hour: '3 PM', activities: [] },
    { hour: '4 PM', activities: [] },
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
        learningHours: '0h',
        streak: '0 Days',
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
