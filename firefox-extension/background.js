/**
 * TimeStream Extension - Background Service Worker
 */

import Storage from './utils/storage.js';

const SYNC_ALARM = 'sync-activities';

// Initialization
chrome.runtime.onInstalled.addListener(async () => {
    console.log('TimeStream Activity Tracker Installed');

    // Set default settings if not exists
    const settings = await Storage.getSettings();
    await Storage.set('settings', settings);

    // Setup sync alarm
    chrome.alarms.create(SYNC_ALARM, { periodInMinutes: settings.syncInterval });
});

// Alarm Listener (Scheduled Sync)
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === SYNC_ALARM) {
        await syncData();
    }
});

// Listener for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'NEW_ACTIVITY') {
        handleNewActivity(request.activity).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
        return true;
    }

    if (request.type === 'HEARTBEAT') {
        handleHeartbeat().then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
        return true;
    }

    if (request.type === 'FORCE_SYNC') {
        syncData().then(sendResponse);
        return true;
    }
});

/**
 * Handle incoming activity from content script
 */
async function handleNewActivity(activity) {
    const settings = await Storage.getSettings();
    if (!settings.trackingEnabled) return;

    // Filter by source
    if (activity.source === 'github' && !settings.trackGitHub) return;
    if (activity.source === 'youtube' && !settings.trackYouTube) return;
    if (activity.source === 'reddit' && !settings.trackReddit) return;

    // De-duplication check for today
    const dedupKey = activity.dedupKey || activity.url;
    const isLogged = await Storage.isKeyLoggedToday(dedupKey);
    if (isLogged) {
        console.log('Activity already logged today, skipping:', dedupKey);
        return;
    }

    console.log('Logging Activity:', activity);

    // Add to queue and update local stats (which now handles dedupKey recording)
    await Storage.addToQueue(activity);
    await Storage.updateStats(dedupKey);

    // Broadcast to popup if open
    chrome.runtime.sendMessage({ type: 'STATS_UPDATED' }).catch(() => { });
}

/**
 * Handle heartbeat - accumulate learning seconds
 */
async function handleHeartbeat() {
    const settings = await Storage.getSettings();
    if (!settings.trackingEnabled) return;

    const today = new Date().toISOString().split('T')[0];
    await Storage.addLearningSeconds(30, today);

    chrome.runtime.sendMessage({ type: 'STATS_UPDATED' }).catch(() => { });
}

/**
 * Sync queued data to the backend
 */
async function syncData() {
    const queue = await Storage.getQueue();
    const today = new Date().toISOString().split('T')[0];
    const learningSeconds = await Storage.getLearningSeconds(today);

    // Nothing to sync
    if (queue.length === 0 && learningSeconds === 0) return { success: true, count: 0 };

    const settings = await Storage.getSettings();

    try {
        console.log(`Syncing ${queue.length} activities + ${learningSeconds}s learning to ${settings.apiUrl}...`);

        const response = await fetch(settings.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                activities: queue.length > 0 ? queue : undefined,
                learningSeconds: { [today]: learningSeconds }
            })
        });

        if (response.ok) {
            if (queue.length > 0) await Storage.clearQueue();
            const stats = await Storage.getStats();
            stats.lastSync = new Date().toISOString();
            await Storage.set('stats', stats);

            chrome.runtime.sendMessage({ type: 'SYNC_COMPLETED' }).catch(() => { });
            return { success: true, count: queue.length };
        } else {
            console.error('Sync failed:', response.statusText);
            return { success: false, error: response.statusText };
        }
    } catch (error) {
        console.error('Sync Error:', error);
        return { success: false, error: error.message };
    }
}
