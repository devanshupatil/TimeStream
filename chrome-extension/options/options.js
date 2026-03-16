/**
 * TimeStream Extension - Options Logic
 */
import Storage from '../utils/storage.js';

document.addEventListener('DOMContentLoaded', async () => {
    const trackingEnabled = document.getElementById('trackingEnabled');
    const trackGitHub = document.getElementById('trackGitHub');
    const trackYouTube = document.getElementById('trackYouTube');
    const apiUrl = document.getElementById('apiUrl');
    const syncInterval = document.getElementById('syncInterval');
    const saveBtn = document.getElementById('save');
    const status = document.getElementById('status');

    // Load current settings
    const settings = await Storage.getSettings();
    trackingEnabled.checked = settings.trackingEnabled;
    trackGitHub.checked = settings.trackGitHub;
    trackYouTube.checked = settings.trackYouTube;
    apiUrl.value = settings.apiUrl;
    syncInterval.value = settings.syncInterval;

    // Save settings
    saveBtn.addEventListener('click', async () => {
        const newSettings = {
            trackingEnabled: trackingEnabled.checked,
            trackGitHub: trackGitHub.checked,
            trackYouTube: trackYouTube.checked,
            apiUrl: apiUrl.value,
            syncInterval: parseInt(syncInterval.value, 10) || 5
        };

        await Storage.set('settings', newSettings);

        // Show status
        status.classList.add('success');
        setTimeout(() => {
            status.classList.remove('success');
        }, 2000);

        // Update background alarm if interval changed
        if (newSettings.syncInterval !== settings.syncInterval) {
            chrome.alarms.clear('sync-activities', () => {
                chrome.alarms.create('sync-activities', { periodInMinutes: newSettings.syncInterval });
            });
        }
    });

    // Clean History
    const cleanHistoryBtn = document.getElementById('btn-clean-history');
    if (cleanHistoryBtn) {
        cleanHistoryBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to clear all history and statistics? This cannot be undone.')) {
                await Storage.clearQueue();
                await Storage.set('stats', {
                    dailyCount: 0,
                    lastSync: null,
                    lastDate: new Date().toDateString()
                });
                alert('History cleared successfully!');
                chrome.runtime.sendMessage({ type: 'STATS_UPDATED' });
            }
        });
    }
});
