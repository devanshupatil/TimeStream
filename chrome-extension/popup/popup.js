/**
 * TimeStream Extension - Popup Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
    const statCount = document.getElementById('stat-count');
    const toggleTracking = document.getElementById('toggle-tracking');
    const btnSync = document.getElementById('btn-sync');
    const syncText = document.getElementById('sync-text');
    const btnSettings = document.getElementById('btn-settings');

    // Initial load
    await updateUI();

    // Event Listeners
    toggleTracking.addEventListener('change', async () => {
        const settings = await Storage.getSettings();
        settings.trackingEnabled = toggleTracking.checked;
        await Storage.set('settings', settings);
        console.log('Tracking toggled:', settings.trackingEnabled);
    });

    btnSync.addEventListener('click', async () => {
        btnSync.disabled = true;
        const icon = btnSync.querySelector('.material-symbols-outlined');
        icon.style.animation = 'spin 1s linear infinite';

        try {
            const result = await chrome.runtime.sendMessage({ type: 'FORCE_SYNC' });
            if (result.success) {
                syncText.innerText = `Synced ${result.count} activities`;
                setTimeout(updateUI, 2000);
            } else {
                syncText.innerText = 'Sync failed';
            }
        } catch (error) {
            syncText.innerText = 'Backend unreachable';
        } finally {
            btnSync.disabled = false;
            icon.style.animation = '';
        }
    });

    btnSettings.addEventListener('click', () => {
        // Open options page or show settings panel
        chrome.runtime.openOptionsPage();
    });

    // Listen for background updates
    chrome.runtime.onMessage.addListener((request) => {
        if (request.type === 'STATS_UPDATED' || request.type === 'SYNC_COMPLETED') {
            updateUI();
        }
    });

    async function updateUI() {
        const stats = await Storage.getStats();
        const settings = await Storage.getSettings();

        statCount.textContent = stats.dailyCount;
        toggleTracking.checked = settings.trackingEnabled;

        if (stats.lastSync) {
            const lastSyncDate = new Date(stats.lastSync);
            syncText.innerText = `Last sync: ${lastSyncDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }
    }
});

// Add spin animation to CSS if not present
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);
