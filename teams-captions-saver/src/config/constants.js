/**
 * Configuration constants for MS Teams Caption Saver
 */

export const SIMILARITY_THRESHOLDS = {
    UPDATE_DETECTION: 0.7,      // Minimum similarity to consider caption an update
    HIGH_SIMILARITY: 0.85,      // High similarity threshold for updates
    DUPLICATE_DETECTION: 0.9    // Very high similarity for duplicate detection
};

export const TIMING = {
    DEBOUNCE_INTERVAL: 500,           // Minimum ms between processing runs
    SILENCE_TIMEOUT: 5000,            // Ms to wait before considering silence
    SILENCE_TIMER_OFFSET: 4500,       // Slightly less than silence timeout
    MEMORY_CLEANUP_INTERVAL: 60000,   // Memory cleanup frequency (60 seconds)
    FALLBACK_TIMER_INTERVAL: 3000,    // Fallback processing check interval
    PERIODIC_CHECK_INTERVAL: 1000,    // Periodic silence check interval
    DEFER_RETRY_DELAY: 1000,          // Delay for deferred operations
    MEETING_CACHE_DURATION: 30000     // Meeting detection cache duration
};

export const MEMORY = {
    MAX_TRACKING_ENTRIES: 1000,     // Maximum caption tracking entries
    TRACKING_DATA_MAX_AGE: 300000,  // 5 minutes for tracking data
    RECENT_TRANSCRIPTS_LIMIT: 20,   // Number of recent transcripts to check for duplicates
    STABILITY_BUFFER: 2,            // Number of recent captions to skip for stability
    MIN_CAPTIONS_REQUIRED: 3        // Minimum captions needed before processing
};

export const PERFORMANCE = {
    MAX_WORD_LENGTH_FILTER: 2,      // Minimum word length for similarity comparison
    PERFORMANCE_LOG_FREQUENCY: 60   // How often to log performance stats (cleanup cycles)
};

export const SELECTORS = {
    PRIMARY_CAPTION: '[data-tid="closed-caption-text"]',
    CAPTIONS_CONTAINER: '[data-tid="closed-captions-renderer"]',
    CHAT_MESSAGE: '.fui-ChatMessageCompact',
    AUTHOR: '[data-tid="author"]',
    FALLBACK_CAPTIONS: [
        '[class*="closed-caption"]',
        '[class*="caption-text"]',
        '[class*="CaptionText"]',
        '[aria-label*="caption"]',
        '[role="log"] [class*="text"]'
    ],
    MEETING_INDICATORS: {
        CALL_DURATION: '#call-duration-custom',
        CALL_STATUS_CONTAINER: '[data-tid="call-status-container-test-id"]',
        CALL_STATUS: '#call-status'
    }
};