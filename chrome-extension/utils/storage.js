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
        const stats = (await this.get('stats')) || { dailyCount: 0, lastSync: null, lastDate: null, loggedKeys: [] };
        const today = new Date().toDateString();

        if (stats.lastDate !== today) {
            stats.dailyCount = 0;
            stats.lastDate = today;
            stats.loggedKeys = []; // Reset logged keys for the new day
            await this.set('stats', stats);
        }

        return stats;
    },

    async isKeyLoggedToday(key) {
        if (!key) return false;
        const stats = await this.getStats();
        return (stats.loggedKeys || []).includes(key);
    },

    async updateStats(key) {
        const stats = await this.getStats();
        const dedupKey = key;

        // Only update if Key hasn't been logged today
        if (dedupKey && !(stats.loggedKeys || []).includes(dedupKey)) {
            stats.dailyCount += 1;
            stats.loggedKeys = stats.loggedKeys || [];
            stats.loggedKeys.push(dedupKey);
            await this.set('stats', stats);
            return true;
        }

        // If no key provided (direct increment)
        if (!dedupKey) {
            stats.dailyCount += 1;
            await this.set('stats', stats);
            return true;
        }

        return false;
    },

    async getLearningSeconds(dateStr) {
        const key = 'learningSeconds_' + dateStr;
        return (await this.get(key)) || 0;
    },

    async addLearningSeconds(seconds, dateStr) {
        const key = 'learningSeconds_' + dateStr;
        const current = (await this.get(key)) || 0;
        await this.set(key, current + seconds);
        return current + seconds;
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
