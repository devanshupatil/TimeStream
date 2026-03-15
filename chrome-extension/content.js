/**
 * TimeStream Extension - Content Script
 * Scrapes activity data from YouTube and GitHub
 */

const CONFIG = {
    YOUTUBE: {
        matches: /youtube\.com\/watch/,
        titleSelector: 'h1.ytd-video-primary-info-renderer, #title h1',
        channelSelector: '#upload-info #channel-name a, #text.ytd-channel-name'
    },
    GITHUB: {
        matches: /github\.com/,
        repoSelector: '[itemprop="name"] a, .author + .path-divider + strong a'
    }
};

let lastUrl = location.href;
let trackingTimeout = null;

/**
 * Initialize tracker
 */
function init() {
    console.log('TimeStream Content Script Active');

    // Watch for URL changes (SPA support)
    const observer = new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            handlePageChange();
        }
    });
    observer.observe(document, { subtree: true, childList: true });

    // Initial check
    handlePageChange();
}

/**
 * Handle URL or page content change
 */
function handlePageChange() {
    if (trackingTimeout) clearTimeout(trackingTimeout);

    // Delay to let page load
    trackingTimeout = setTimeout(() => {
        detectActivity();
    }, 2000);
}

/**
 * Detect what the user is doing
 */
function detectActivity() {
    const url = location.href;

    if (CONFIG.YOUTUBE.matches.test(url)) {
        trackYouTube();
    } else if (CONFIG.GITHUB.matches.test(url)) {
        trackGitHub();
    }
}

/**
 * Extract YouTube info
 */
function trackYouTube() {
    const title = document.querySelector(CONFIG.YOUTUBE.titleSelector)?.innerText;
    const channel = document.querySelector(CONFIG.YOUTUBE.channelSelector)?.innerText;

    if (title) {
        sendActivity({
            source: 'youtube',
            sourceLabel: 'YouTube',
            title: title.trim(),
            url: location.href,
            category: 'Learning',
            metadata: {
                channel: channel ? channel.trim() : 'Unknown'
            }
        });
    }
}

/**
 * Extract GitHub info
 */
function trackGitHub() {
    // Basic repo/page detection
    const pathParts = location.pathname.split('/').filter(p => p);
    if (pathParts.length < 2) return;

    const owner = pathParts[0];
    const repo = pathParts[1];
    let type = 'viewing';
    let title = `${owner}/${repo}`;

    if (pathParts.includes('commit') || pathParts.includes('commits')) {
        type = 'commit';
        title = `Viewing commits in ${owner}/${repo}`;
    } else if (pathParts.includes('pull') || pathParts.includes('pulls')) {
        type = 'pr';
        const prTitle = document.querySelector('.js-issue-title')?.innerText;
        title = prTitle ? `PR: ${prTitle}` : `Viewing PRs in ${owner}/${repo}`;
    } else if (pathParts.includes('issues')) {
        type = 'issue';
        const issueTitle = document.querySelector('.js-issue-title')?.innerText;
        title = issueTitle ? `Issue: ${issueTitle}` : `Viewing Issues in ${owner}/${repo}`;
    }

    sendActivity({
        source: 'github',
        sourceLabel: 'GitHub',
        title: title,
        url: location.href,
        category: 'Coding',
        metadata: {
            repo: `${owner}/${repo}`,
            type: type
        }
    });
}

/**
 * Send activity to background script
 */
function sendActivity(activity) {
    chrome.runtime.sendMessage({
        type: 'NEW_ACTIVITY',
        activity: {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            ...activity
        }
    });
}

// Start
init();
