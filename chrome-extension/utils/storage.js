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
        return (await this.get('stats')) || { dailyCount: 0, lastSync: null };
    },

    async updateStats() {
        const stats = await this.getStats();
        stats.dailyCount += 1;
        await this.set('stats', stats);
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
if (typeof module !== 'undefined') {
    module.exports = Storage;
}
