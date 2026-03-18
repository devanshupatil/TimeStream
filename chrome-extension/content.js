/**
 * TimeStream Extension - Content Script
 * Scrapes activity data from YouTube, GitHub, and AI Tools
 */

const CONFIG = {
    YOUTUBE: {
        matches: /youtube\.com\/watch/,
        titleSelector: 'h1.ytd-video-primary-info-renderer, #title h1',
        channelSelector: '#upload-info #channel-name a, #text.ytd-channel-name',
        descriptionSelector: '#description-inner, ytd-text-inline-expander #attributed-snippet-text, #snippet-text'
    },
    GITHUB: {
        matches: /github\.com/
    },
    AI_TOOLS: [
        { id: 'chatgpt', label: 'ChatGPT', matches: /chatgpt\.com/ },
        { id: 'claude', label: 'Claude', matches: /claude\.ai/ },
        { id: 'perplexity', label: 'Perplexity', matches: /perplexity\.ai/ },
        { id: 'qwen', label: 'Qwen', matches: /chat\.qwenlm\.ai/ }
    ]
};

// ── Smart YouTube Classification ──────────────────────────────

const CLASSIFICATION = {
    // Strong indicators — any one of these in the title = Learning
    strongKeywords: [
        'tutorial', 'course', 'lesson', 'lecture', 'bootcamp', 'masterclass',
        'crash course', 'explained', 'walkthrough', 'how to', 'learn',
        'guide', 'study', 'training', 'workshop', 'deep dive',
        'step by step', 'for beginners', 'from scratch', 'in depth',
        'interview prep', 'cheat sheet'
    ],

    // Tech keywords — need 2+ matches or 1 match combined with other signals
    techKeywords: [
        'programming', 'coding', 'development', 'developer', 'devops',
        'fullstack', 'full stack', 'frontend', 'front end', 'backend', 'back end',
        'algorithm', 'data structure', 'system design', 'architecture',
        'api', 'database', 'sql', 'nosql', 'mongodb', 'postgresql',
        'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'cloud',
        'react', 'angular', 'vue', 'svelte', 'next.js', 'nuxt',
        'node.js', 'express', 'django', 'flask', 'spring boot',
        'python', 'javascript', 'typescript', 'rust', 'golang',
        'java', 'c++', 'c#', 'swift', 'kotlin',
        'machine learning', 'deep learning', 'neural network', 'ai model',
        'tensorflow', 'pytorch', 'hugging face', 'langchain',
        'git', 'github', 'ci/cd', 'pipeline', 'linux', 'terminal',
        'web development', 'mobile development', 'app development',
        'dsa', 'leetcode', 'hackerrank', 'competitive programming',
        'open source', 'npm', 'webpack', 'vite', 'tailwind',
        'cybersecurity', 'penetration testing', 'ethical hacking',
        'blockchain', 'smart contract', 'solidity', 'web3',
        'mcp', 'claude', 'openai', 'anthropic', 'llm', 'rag',
        'prompt engineering', 'fine tuning', 'embeddings'
    ],

    // Known educational channels
    educationalChannels: [
        'fireship', 'traversy media', 'the coding train', 'academind',
        'the net ninja', 'net ninja', 'web dev simplified', 'freecodecamp',
        'cs50', 'mit opencourseware', '3blue1brown', 'computerphile',
        'numberphile', 'tech with tim', 'corey schafer', 'sentdex',
        'programming with mosh', 'clever programmer', 'codewithharry',
        'thenewboston', 'derek banas', 'brad traversy', 'kevin powell',
        'theo - t3', 't3dotgg', 'theo - t3.gg', 'primeagen', 'theprimeagen',
        'jack herrington', 'ben awad', 'william lin', 'neetcode',
        'abdul bari', 'jenny\'s lectures', 'gate smashers', 'apna college',
        'code with harry', 'hitesh choudhary', 'telusko', 'edureka',
        'simplilearn', 'great learning', 'intellipaat', 'kudvenkat',
        'caleb curry', 'bro code', 'dave gray', 'sonny sangha',
        'javascript mastery', 'lama dev', 'pedro tech', 'developedbyed',
        'hyperplexed', 'online tutorials', 'coding addict',
        'john smilga', 'james q quick', 'ania kubow',
        'bukola', 'forrest knight', 'andy sterkowitz',
        'techworld with nana', 'kunal kushwaha', 'love babbar',
        'striver', 'take u forward', 'aditya verma', 'pepcoding',
        'codestorywithMIK', 'arjun khara', 'two minute papers'
    ],

    // Description keywords that boost classification
    descriptionKeywords: [
        'source code', 'github repo', 'documentation', 'prerequisites',
        'timestamps', 'chapters', 'follow along', 'code along',
        'in this video you will learn', 'in this tutorial',
        'subscribe for more', 'coding', 'programming',
        'what you\'ll learn', 'learning objectives', 'curriculum',
        'project based', 'hands on', 'practical'
    ]
};

/**
 * Smart YouTube classification using multiple signals
 * Returns { isLearning: boolean, confidence: number, method: string }
 */
function classifyYouTube() {
    const title = (document.querySelector(CONFIG.YOUTUBE.titleSelector)?.innerText || '').trim().toLowerCase();
    const channel = (document.querySelector(CONFIG.YOUTUBE.channelSelector)?.innerText || '').trim().toLowerCase();
    const description = (document.querySelector(CONFIG.YOUTUBE.descriptionSelector)?.innerText || '').trim().toLowerCase();

    if (!title) return { isLearning: false, confidence: 0, method: 'no-title' };

    let score = 0;
    let method = [];

    // Signal 1: Strong keywords in title (+4 each, first match is enough)
    const hasStrongKeyword = CLASSIFICATION.strongKeywords.some(kw => title.includes(kw));
    if (hasStrongKeyword) {
        score += 4;
        method.push('strong-keyword');
    }

    // Signal 2: Tech keywords in title (+1.5 each, max +4)
    const titleTechMatches = CLASSIFICATION.techKeywords.filter(kw => title.includes(kw));
    score += Math.min(titleTechMatches.length * 1.5, 4);
    if (titleTechMatches.length > 0) method.push('tech-title');

    // Signal 3: Known educational channel (+4)
    const isEduChannel = CLASSIFICATION.educationalChannels.some(ch => channel.includes(ch));
    if (isEduChannel) {
        score += 4;
        method.push('edu-channel');
    }

    // Signal 4: Description keywords (+0.5 each, max +2)
    if (description) {
        const descMatches = CLASSIFICATION.descriptionKeywords.filter(kw => description.includes(kw));
        score += Math.min(descMatches.length * 0.5, 2);
        if (descMatches.length > 0) method.push('description');
    }

    // Signal 5: Tech keywords in description (+0.5 each, max +2)
    if (description) {
        const descTechMatches = CLASSIFICATION.techKeywords.filter(kw => description.includes(kw));
        score += Math.min(descTechMatches.length * 0.5, 2);
        if (descTechMatches.length > 0) method.push('tech-description');
    }

    // Signal 6: YouTube hashtags in description
    const hashtags = description.match(/#[\w]+/g) || [];
    const techHashtags = hashtags.filter(tag => {
        const t = tag.toLowerCase();
        return CLASSIFICATION.techKeywords.some(kw => t.includes(kw.replace(/[^a-z0-9]/g, '')));
    });
    if (techHashtags.length > 0) {
        score += Math.min(techHashtags.length * 0.5, 1.5);
        method.push('hashtags');
    }

    // Threshold: score >= 3 = Learning
    const isLearning = score >= 3;
    const confidence = Math.min(score / 6, 1); // Normalize to 0-1

    console.log(`TimeStream Classification: "${title.substring(0, 50)}..." → score: ${score.toFixed(1)}, learning: ${isLearning}, signals: [${method.join(', ')}]`);

    return { isLearning, confidence, method: method.join('+') || 'none' };
}

// ── State ─────────────────────────────────────────────────────

let lastUrl = location.href;
let lastLoggedUrl = null;
let trackingTimeout = null;
let youtubeWatchTimeout = null;
let aiWatchTimeout = null;

// Heartbeat System
let heartbeatInterval = null;
let userIsActive = false;
const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds

// Cache classification result per URL to avoid re-computing every 30s
let cachedClassification = null;
let cachedClassificationUrl = null;

/**
 * Initialize tracker
 */
function init() {
    console.log('TimeStream Content Script Active');

    // Watch for URL changes (SPA support)
    const observer = new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            cachedClassification = null; // Clear cache on URL change
            cachedClassificationUrl = null;
            handlePageChange();
        }
    });
    observer.observe(document, { subtree: true, childList: true });

    // Initial check
    handlePageChange();

    // Track user activity for heartbeat
    ['mousemove', 'keydown', 'scroll', 'click'].forEach(evt => {
        document.addEventListener(evt, () => { userIsActive = true; }, { passive: true });
    });
    startHeartbeat();
}

/**
 * Handle URL or page content change
 */
function handlePageChange() {
    if (trackingTimeout) clearTimeout(trackingTimeout);
    if (youtubeWatchTimeout) clearTimeout(youtubeWatchTimeout);
    if (aiWatchTimeout) clearTimeout(aiWatchTimeout);

    if (location.href === lastLoggedUrl) return;

    trackingTimeout = setTimeout(() => {
        detectActivity();
    }, 3000);
}

/**
 * Detect what the user is doing
 */
function detectActivity() {
    const url = location.href;

    if (CONFIG.YOUTUBE.matches.test(url)) {
        console.log('YouTube detected. Waiting 3 minutes before logging...');
        youtubeWatchTimeout = setTimeout(() => {
            trackYouTube();
        }, 180000);
    } else if (CONFIG.GITHUB.matches.test(url)) {
        trackGitHub();
    } else {
        const aiTool = CONFIG.AI_TOOLS.find(t => t.matches.test(url));
        if (aiTool) {
            console.log(`${aiTool.label} detected. Waiting 3 minutes before logging...`);
            aiWatchTimeout = setTimeout(() => {
                trackAITool(aiTool);
            }, 180000);
        }
    }
}

/**
 * Extract YouTube info with smart classification
 */
function trackYouTube() {
    const title = document.querySelector(CONFIG.YOUTUBE.titleSelector)?.innerText;
    const channel = document.querySelector(CONFIG.YOUTUBE.channelSelector)?.innerText;

    if (title) {
        const result = classifyYouTube();
        cachedClassification = result;
        cachedClassificationUrl = location.href;

        if (!result.isLearning) {
            console.log('Skipping non-learning YouTube video.');
            return;
        }

        sendActivity({
            source: 'youtube',
            sourceLabel: 'YouTube',
            title: title.trim(),
            url: location.href,
            category: result.isLearning ? 'Learning' : 'Other',
            dedupKey: `youtube:${new URLSearchParams(window.location.search).get('v')}`,
            metadata: {
                channel: channel ? channel.trim() : 'Unknown',
                intelligence: result.isLearning ? 'educational' : 'general',
                confidence: result.confidence,
                classificationMethod: result.method
            }
        });
    }
}

/**
 * Extract GitHub info
 */
function trackGitHub() {
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
        dedupKey: `github:${owner}/${repo}`,
        metadata: { repo: `${owner}/${repo}`, type: type }
    });
}

/**
 * Extract AI Tool info
 */
function trackAITool(tool) {
    let title = document.title || `Chatting with ${tool.label}`;
    title = title.replace(/ - ChatGPT$/i, '')
        .replace(/ - Claude$/i, '')
        .replace(/ - Perplexity$/i, '')
        .replace(/ - Qwen$/i, '')
        .trim();

    sendActivity({
        source: tool.id,
        sourceLabel: tool.label,
        title: title,
        url: location.href,
        category: 'Learning',
        dedupKey: `${tool.id}:${location.pathname}`,
        metadata: { intelligence: 'ai_assistant' }
    });
}

/**
 * Check if current page is a learning page (used by heartbeat)
 */
function isLearningPage() {
    const url = location.href;

    // AI tools are always learning
    if (CONFIG.AI_TOOLS.some(t => t.matches.test(url))) return true;

    // YouTube — use smart classification with caching
    if (CONFIG.YOUTUBE.matches.test(url)) {
        // Use cached result if same URL
        if (cachedClassificationUrl === url && cachedClassification) {
            return cachedClassification.isLearning;
        }
        // Classify and cache
        const result = classifyYouTube();
        cachedClassification = result;
        cachedClassificationUrl = url;
        return result.isLearning;
    }

    return false;
}

/**
 * Start heartbeat interval for learning time tracking
 */
function startHeartbeat() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
        if (userIsActive && isLearningPage()) {
            chrome.runtime.sendMessage({ type: 'HEARTBEAT' }).catch(() => {
                clearInterval(heartbeatInterval);
                heartbeatInterval = null;
            });
        }
        userIsActive = false;
    }, HEARTBEAT_INTERVAL_MS);
}

/**
 * Send activity to background script
 */
function sendActivity(activity) {
    const browserName = navigator.userAgent.includes("Firefox") ? "Firefox" : "Chrome";
    lastLoggedUrl = location.href;
    chrome.runtime.sendMessage({
        type: 'NEW_ACTIVITY',
        activity: {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            browser: browserName,
            ...activity
        }
    });
}

// Start
init();
