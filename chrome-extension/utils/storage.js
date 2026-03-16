/**
 * TimeStream Extension - Storage Utility
 */
const Storage = {
    async get(key) {
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => {
                resolve(result[key]);
            });
        });
    },

    async set(key, value) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [key]: value }, () => {
                resolve();
            });
        });
    },

    async getQueue() {
        return (await this.get('activity_queue')) || [];
    },

    async addToQueue(activity) {
        const queue = await this.getQueue();
        queue.push(activity);
        await this.set('activity_queue', queue);
    },

    async clearQueue() {
        await this.set('activity_queue', []);
    },

    async getStats() {
        const stats = (await this.get('stats')) || { dailyCount: 0, lastSync: null, lastDate: null, loggedUrls: [] };
        const today = new Date().toDateString();

        if (stats.lastDate !== today) {
            stats.dailyCount = 0;
            stats.lastDate = today;
            stats.loggedUrls = []; // Reset logged URLs for the new day
            await this.set('stats', stats);
        }

        return stats;
    },

    async isUrlLoggedToday(url) {
        const stats = await this.getStats();
        return (stats.loggedUrls || []).includes(url);
    },

    async updateStats(url) {
        const stats = await this.getStats();

        // Only update if URL hasn't been logged today
        if (url && !(stats.loggedUrls || []).includes(url)) {
            stats.dailyCount += 1;
            stats.loggedUrls = stats.loggedUrls || [];
            stats.loggedUrls.push(url);
            await this.set('stats', stats);
            return true;
        }

        // If no URL provided (direct increment), still increment but we shouldn't really use this much now
        if (!url) {
            stats.dailyCount += 1;
            await this.set('stats', stats);
            return true;
        }

        return false;
    },

    async getSettings() {
        const defaults = {
            trackingEnabled: true,
            trackGitHub: true,
            trackYouTube: true,
            syncInterval: 5, // minutes
            apiUrl: 'http://localhost:3000/api/activity'
        };
        const settings = await this.get('settings');
        return { ...defaults, ...settings };
    }
};

// Export for use in background and popup
export default Storage;
