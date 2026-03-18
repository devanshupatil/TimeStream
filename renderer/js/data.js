// TimeStream - Sample Data Module
// Provides mock activity data for the UI

const today = new Date();
const fmt = (h, m) => {
    const d = new Date(today);
    d.setHours(h, m, 0, 0);
    return d;
};

const ACTIVITIES = [];

const TIMELINE_ENTRIES = [];
for (let i = 0; i < 24; i++) {
    const hour = i === 0 ? 12 : i > 12 ? i - 12 : i;
    const ampm = i < 12 ? 'AM' : 'PM';
    TIMELINE_ENTRIES.push({ hour: `${hour} ${ampm}`, activities: [] });
}
function getTodayActivities() {
    return ACTIVITIES.slice().sort((a, b) => {
        const timeA = new Date(a.time || a.timestamp || 0);
        const timeB = new Date(b.time || b.timestamp || 0);
        return timeB - timeA;
    });
}

function getTimelineEntries() {
    return TIMELINE_ENTRIES;
}

function formatLearningTime(totalSeconds) {
    if (!totalSeconds || totalSeconds <= 0) return '0m';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours === 0) return minutes + 'm';
    if (minutes === 0) return hours + 'h';
    return hours + 'h ' + minutes + 'm';
}

async function getStats(dateStr) {
    let learningHours = '0m';
    const targetDate = dateStr || new Date().toISOString().split('T')[0];

    if (window.electronAPI?.getLearningSeconds) {
        try {
            const seconds = await window.electronAPI.getLearningSeconds(targetDate);
            learningHours = formatLearningTime(seconds);
        } catch (err) {
            console.error('Failed to get learning seconds:', err);
        }
    }

    return {
        todayActivities: ACTIVITIES.length,
        learningHours,
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
