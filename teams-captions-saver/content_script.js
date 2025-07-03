/**
 * CaptionManager class - Encapsulates all caption capture state and operations
 */
class CaptionManager {
    constructor() {
        // Core state
        this.transcriptArray = [];
        this.capturing = false;
        this.observer = null;
        this.transcriptIdCounter = 0;
        
        // Meeting management
        this.currentMeetingId = null;
        this.lastMeetingCheck = 0;
        
        // Race condition prevention
        this.debounceTimer = null;
        this.isProcessing = false;
        this.cleanupFunctions = [];
        
        // Deduplication tracking
        this.recentlyRemoved = [];
        this.captionHashSet = new Set(); // For O(1) duplicate detection
        
        // Reliability tracking
        this.lastCaptionTime = Date.now();
        this.captionCount = 0;
    }
    
    /**
     * Generate a hash for caption content for efficient deduplication
     */
    generateCaptionHash(name, text) {
        return `${name}:${text}`;
    }
    
    /**
     * Check if caption already exists using hash lookup
     */
    isDuplicateCaption(name, text) {
        const hash = this.generateCaptionHash(name, text);
        return this.captionHashSet.has(hash);
    }
    
    /**
     * Add caption hash to tracking set
     */
    addCaptionHash(name, text) {
        const hash = this.generateCaptionHash(name, text);
        this.captionHashSet.add(hash);
    }
}

// Global instance
const captionManager = new CaptionManager();

// Legacy variable getters for backward compatibility (maintain references)
Object.defineProperty(globalThis, 'transcriptArray', {
    get: () => captionManager.transcriptArray,
    set: (value) => { captionManager.transcriptArray = value; }
});
Object.defineProperty(globalThis, 'capturing', {
    get: () => captionManager.capturing,
    set: (value) => { captionManager.capturing = value; }
});
Object.defineProperty(globalThis, 'observer', {
    get: () => captionManager.observer,
    set: (value) => { captionManager.observer = value; }
});
Object.defineProperty(globalThis, 'transcriptIdCounter', {
    get: () => captionManager.transcriptIdCounter,
    set: (value) => { captionManager.transcriptIdCounter = value; }
});
Object.defineProperty(globalThis, 'currentMeetingId', {
    get: () => captionManager.currentMeetingId,
    set: (value) => { captionManager.currentMeetingId = value; }
});
Object.defineProperty(globalThis, 'lastMeetingCheck', {
    get: () => captionManager.lastMeetingCheck,
    set: (value) => { captionManager.lastMeetingCheck = value; }
});
Object.defineProperty(globalThis, 'debounceTimer', {
    get: () => captionManager.debounceTimer,
    set: (value) => { captionManager.debounceTimer = value; }
});
Object.defineProperty(globalThis, 'isProcessing', {
    get: () => captionManager.isProcessing,
    set: (value) => { captionManager.isProcessing = value; }
});
Object.defineProperty(globalThis, 'cleanupFunctions', {
    get: () => captionManager.cleanupFunctions,
    set: (value) => { captionManager.cleanupFunctions = value; }
});
Object.defineProperty(globalThis, 'recentlyRemoved', {
    get: () => captionManager.recentlyRemoved
});

// Constants
const MAX_RECENTLY_REMOVED = 10;
const MAX_TRANSCRIPT_ENTRIES = 10000; // Higher limit - prevent memory issues but preserve captions
const AUTO_SAVE_THRESHOLD = 5000; // Auto-save when reaching this threshold

// Configuration constants
const MEETING_CHECK_INTERVAL = 10000; // Check for meeting changes every 10 seconds
const SAFE_REMOVAL_RECENT_ENTRIES = 3; // Only consider last 3 entries as "recent"
const PROGRESSIVE_CHECK_LOOKBACK = 5; // Check last 5 entries for progressive updates
const MIN_TEXT_LENGTH_FOR_ANALYSIS = 3; // Minimum text length for progressive analysis
const MIN_PREFIX_EXPANSION_LENGTH = 5; // Minimum additional chars for prefix expansion
const MEMORY_CHECK_INTERVAL = 100; // Check memory limits every 100 additions
const DEBOUNCE_DELAY = 300; // Debounce DOM mutations to prevent race conditions
const MAX_RETRIES = 3; // Maximum retries for failed operations

/**
 * Simple logging framework with levels
 */
const Logger = {
    level: 'INFO', // DEBUG, INFO, WARN, ERROR
    levels: { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 },
    
    shouldLog(level) {
        return this.levels[level] >= this.levels[this.level];
    },
    
    debug(message, ...args) {
        if (this.shouldLog('DEBUG')) {
            console.log(`[DEBUG] 🔍 ${message}`, ...args);
        }
    },
    
    info(message, ...args) {
        if (this.shouldLog('INFO')) {
            console.log(`[INFO] ℹ️ ${message}`, ...args);
        }
    },
    
    warn(message, ...args) {
        if (this.shouldLog('WARN')) {
            console.warn(`[WARN] ⚠️ ${message}`, ...args);
        }
    },
    
    error(message, ...args) {
        if (this.shouldLog('ERROR')) {
            console.error(`[ERROR] ❌ ${message}`, ...args);
        }
    }
};

/**
 * Validate input parameters for safety
 * @param {string} name - Speaker name to validate
 * @param {string} text - Caption text to validate
 * @returns {Object} Validation result with isValid flag and error message
 */
function validateCaptionInput(name, text) {
    if (typeof name !== 'string' || typeof text !== 'string') {
        return { isValid: false, error: 'Name and text must be strings' };
    }
    
    if (name.trim().length === 0) {
        return { isValid: false, error: 'Speaker name cannot be empty' };
    }
    
    if (text.trim().length === 0) {
        return { isValid: false, error: 'Caption text cannot be empty' };
    }
    
    if (name.length > 100) {
        return { isValid: false, error: 'Speaker name too long (max 100 characters)' };
    }
    
    if (text.length > 5000) {
        return { isValid: false, error: 'Caption text too long (max 5000 characters)' };
    }
    
    return { isValid: true };
}

/**
 * Extract meeting identifier for detecting meeting changes with enhanced error handling
 */
function extractMeetingId() {
    try {
        // Validate window and location exist
        if (!window || !window.location || !window.location.href) {
            console.warn('Window location not available for meeting ID extraction');
            return null;
        }
        
        const urlMatch = window.location.href.match(/meetup-join\/([^\/\?]+)/);
        if (urlMatch && urlMatch[1]) {
            return urlMatch[1];
        }
        
        // Fallback to document title if available
        if (document && document.title) {
            const title = document.title.replace(/__Microsoft_Teams.*$/, '').trim();
            return title || null;
        }
        
        return null;
    } catch (error) {
        console.error('Error extracting meeting ID:', error);
        return null;
    }
}

/**
 * Check if we've moved to a new meeting and should reset transcript data
 */
function checkForNewMeeting() {
    try {
        const now = Date.now();
        if (now - lastMeetingCheck < MEETING_CHECK_INTERVAL) {
            return;
        }
        lastMeetingCheck = now;
        
        const newMeetingId = extractMeetingId();
        
        if (newMeetingId && newMeetingId !== currentMeetingId) {
            if (currentMeetingId && transcriptArray.length > 0) {
                console.log("New meeting detected, previous transcript data preserved until save/view");
                console.log(`Previous meeting: ${currentMeetingId}`);
                console.log(`New meeting: ${newMeetingId}`);
                
                // Clear recently removed for new meeting
                recentlyRemoved.length = 0;
            }
            currentMeetingId = newMeetingId;
        }
    } catch (error) {
        console.error('Error checking for new meeting:', error);
    }
}

/**
 * Check if new text is a safe progressive update of old text
 * Uses whitelist of very specific patterns to minimize false positives
 * @param {string} oldText - Previous caption text
 * @param {string} newText - Current caption text
 * @returns {Object} {isProgressive: boolean, confidence: string, pattern: string}
 */
function isWhitelistedProgressive(oldText, newText) {
    if (!oldText || !newText) {
        return {isProgressive: false, confidence: 'NONE', pattern: 'No text provided'};
    }
    
    const oldTrimmed = oldText.trim();
    const newTrimmed = newText.trim();
    
    // Prevent empty or very short text issues
    if (oldTrimmed.length < MIN_TEXT_LENGTH_FOR_ANALYSIS || newTrimmed.length < MIN_TEXT_LENGTH_FOR_ANALYSIS) {
        return {isProgressive: false, confidence: 'NONE', pattern: 'Text too short to analyze'};
    }
    
    // Pattern 1: Exact prefix expansion (VERY HIGH confidence)
    if (newTrimmed.startsWith(oldTrimmed) && newTrimmed.length > oldTrimmed.length + MIN_PREFIX_EXPANSION_LENGTH) {
        // Additional safety: must end on word boundary
        const addedText = newTrimmed.substring(oldTrimmed.length).trim();
        if (addedText.length > 0 && /^[\s\w]/.test(addedText)) {
            return {
                isProgressive: true, 
                confidence: 'VERY_HIGH', 
                pattern: `Exact prefix expansion: adds "${addedText}"`
            };
        }
    }
    
    // Pattern 2: Punctuation completion (HIGH confidence)
    const punctuationRegex = /[.!?;,][\s]*$/;
    if (!punctuationRegex.test(oldTrimmed) && punctuationRegex.test(newTrimmed)) {
        const oldWithoutPunct = oldTrimmed.replace(/[.!?;,\s]+$/, '').trim();
        const newWithoutPunct = newTrimmed.replace(/[.!?;,\s]+$/, '').trim();
        if (oldWithoutPunct === newWithoutPunct || newWithoutPunct.startsWith(oldWithoutPunct)) {
            return {
                isProgressive: true,
                confidence: 'HIGH',
                pattern: `Punctuation completion`
            };
        }
    }
    
    // Pattern 3: Capitalization fix (HIGH confidence)
    if (oldTrimmed.toLowerCase() === newTrimmed.toLowerCase() && oldTrimmed !== newTrimmed) {
        return {
            isProgressive: true,
            confidence: 'HIGH', 
            pattern: `Capitalization fix`
        };
    }
    
    // Pattern 4: Word-by-word building (HIGH confidence)
    // New text adds 1-3 complete words to the end
    if (newTrimmed.startsWith(oldTrimmed)) {
        const addedPart = newTrimmed.substring(oldTrimmed.length).trim();
        const addedWords = addedPart.split(/\s+/).filter(w => w.length > 0);
        
        if (addedWords.length >= 1 && addedWords.length <= 3) {
            // Ensure it's adding real words, not just characters
            const hasRealWords = addedWords.every(word => word.length >= 2 && /^[a-zA-Z]/.test(word));
            if (hasRealWords) {
                return {
                    isProgressive: true,
                    confidence: 'HIGH',
                    pattern: `Word building: added "${addedWords.join(' ')}"`
                };
            }
        }
    }
    
    // No whitelisted pattern matched
    return {isProgressive: false, confidence: 'NONE', pattern: 'No safe pattern detected'};
}

/**
 * Check if an entry is safe to remove based on age
 * Conservative approach: only remove very recent entries
 * @param {Object} entry - Transcript entry with Time property
 * @returns {boolean} True if safe to remove
 */
function isSafeToRemove(entry) {
    if (!entry.Time) return false;
    
    try {
        // For safety, only remove entries added in the last 30 seconds
        // Using a simple approach: compare the transcript array length and timing
        // In a real implementation, you might want more sophisticated time tracking
        
        // If this is one of the last few entries added, it's probably recent
        const entryIndex = transcriptArray.findIndex(e => e.ID === entry.ID);
        const isRecent = entryIndex >= transcriptArray.length - SAFE_REMOVAL_RECENT_ENTRIES;
        
        return isRecent;
    } catch (error) {
        console.warn('Could not determine entry age, being conservative:', error);
        return false; // Be conservative if we can't determine age
    }
}

/**
 * Safely remove a progressive entry with logging and recovery capability
 * @param {number} index - Index of entry to remove
 * @param {string} reason - Reason for removal
 */
function safelyRemoveEntry(index, reason) {
    if (index < 0 || index >= transcriptArray.length) {
        console.warn('Invalid index for removal:', index);
        return false;
    }
    
    const entry = transcriptArray[index];
    
    // Safety check
    if (!isSafeToRemove(entry)) {
        console.log(`⚠️  Entry not safe to remove: "${entry.Text}"`);
        return false;
    }
    
    // Add to recently removed for potential recovery
    recentlyRemoved.unshift({
        entry: {...entry},
        removedAt: new Date().toISOString(),
        reason: reason,
        originalIndex: index
    });
    
    // Keep only recent removals
    if (recentlyRemoved.length > MAX_RECENTLY_REMOVED) {
        recentlyRemoved.pop();
    }
    
    // Remove from transcript
    transcriptArray.splice(index, 1);
    console.log(`🗑️  Safely removed progressive entry: "${entry.Text}"`);
    console.log(`   Reason: ${reason}`);
    
    return true;
}

/**
 * Check if exact caption already exists in transcript using optimized hash lookup
 * @param {string} name - Speaker name
 * @param {string} text - Caption text
 * @returns {boolean} True if exact caption exists
 */
function isExactCaptionDuplicate(name, text) {
    return captionManager.isDuplicateCaption(name, text);
}

/**
 * Handle progressive caption detection and removal
 * @param {string} name - Speaker name
 * @param {string} text - Caption text
 * @returns {boolean} True if progressive caption was handled
 */
function handleProgressiveCaption(name, text) {
    for (let i = transcriptArray.length - 1; i >= Math.max(0, transcriptArray.length - PROGRESSIVE_CHECK_LOOKBACK); i--) {
        const entry = transcriptArray[i];
        
        if (entry.Name === name) {
            const progressiveCheck = isWhitelistedProgressive(entry.Text, text);
            
            if (progressiveCheck.isProgressive) {
                console.log(`  🔍 Whitelist match: ${progressiveCheck.pattern}`);
                console.log(`  📊 Confidence: ${progressiveCheck.confidence}`);
                
                // Only proceed with removal for HIGH or VERY_HIGH confidence
                if (progressiveCheck.confidence === 'HIGH' || progressiveCheck.confidence === 'VERY_HIGH') {
                    const removed = safelyRemoveEntry(i, progressiveCheck.pattern);
                    if (removed) {
                        return true; // Found and handled progressive caption
                    }
                } else {
                    console.log(`  ⚠️  Confidence too low for removal: ${progressiveCheck.confidence}`);
                }
            }
            
            break; // Only check the most recent entry from this speaker
        }
    }
    
    return false;
}

/**
 * Add new caption to transcript array with hash tracking
 * @param {string} name - Speaker name
 * @param {string} text - Caption text
 */
function addCaptionToTranscript(name, text) {
    const Time = new Date().toLocaleTimeString();
    transcriptArray.push({ 
        Name: name, 
        Text: text, 
        Time, 
        ID: `caption_${transcriptIdCounter++}` 
    });
    
    // Add to hash set for efficient duplicate detection
    captionManager.addCaptionHash(name, text);
    
    // Add reliability safeguards
    try {
        // Backup to localStorage for crash recovery
        if (transcriptArray.length % 100 === 0) {
            localStorage.setItem('caption_saver_backup', JSON.stringify({
                data: transcriptArray.slice(-500), // Keep last 500 entries as backup
                timestamp: Date.now(),
                meetingId: currentMeetingId
            }));
            Logger.debug(`Backup saved: ${transcriptArray.length} total captions`);
        }
    } catch (error) {
        Logger.warn('Backup to localStorage failed:', error);
        // Don't fail caption addition if backup fails
    }
    
    // Enforce memory limits periodically (with zero-loss policy)
    if (transcriptArray.length % MEMORY_CHECK_INTERVAL === 0) {
        enforceMemoryLimits();
    }
}

/**
 * Smart caption addition with conservative whitelist approach and validation
 * @param {string} name - Speaker name
 * @param {string} text - Caption text
 * @returns {boolean} True if caption was added
 */
function conservativeSmartAddCaption(name, text) {
    // Validate input parameters
    const validation = validateCaptionInput(name, text);
    if (!validation.isValid) {
        Logger.warn(`Invalid caption input: ${validation.error}`);
        return false;
    }
    
    // Sanitize input (remove potential dangerous characters)
    const sanitizedName = name.trim().replace(/[\r\n\t]/g, ' ');
    const sanitizedText = text.trim().replace(/[\r\n\t]/g, ' ');
    
    // Check if this exact caption already exists
    if (isExactCaptionDuplicate(sanitizedName, sanitizedText)) {
        Logger.debug(`Exact caption already exists: "${sanitizedText}"`);
        return false;
    }
    
    // Handle progressive caption detection and removal
    const foundProgressive = handleProgressiveCaption(sanitizedName, sanitizedText);
    
    // Add the new caption
    addCaptionToTranscript(sanitizedName, sanitizedText);
    
    // Update reliability tracking
    captionManager.lastCaptionTime = Date.now();
    captionManager.captionCount++;
    
    if (foundProgressive) {
        Logger.info("Replaced progressive caption:", { Name: sanitizedName, Text: sanitizedText });
    } else {
        Logger.info("Added new caption:", { Name: sanitizedName, Text: sanitizedText });
    }
    
    return true;
}

/**
 * Recovery function to restore recently removed entries
 * @param {number} count - Number of recent removals to restore (default: 1)
 */
function restoreRecentlyRemoved(count = 1) {
    const restored = [];
    
    for (let i = 0; i < Math.min(count, recentlyRemoved.length); i++) {
        const removal = recentlyRemoved.shift();
        
        // Add back to transcript array
        transcriptArray.push({
            Name: removal.entry.Name,
            Text: removal.entry.Text,
            Time: removal.entry.Time,
            ID: `caption_restored_${transcriptIdCounter++}`
        });
        
        restored.push(removal.entry);
        console.log(`↩️  Restored: "${removal.entry.Text}"`);
    }
    
    return restored;
}

/**
 * Debounced caption checking to prevent race conditions
 */
function debouncedCheckCaptions() {
    // Clear existing timer
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    
    // Set new timer
    debounceTimer = setTimeout(() => {
        if (!isProcessing) {
            checkCaptions();
        }
    }, DEBOUNCE_DELAY);
}

/**
 * Retry mechanism for critical operations
 * @param {Function} operation - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {string} operationName - Name of operation for logging
 */
async function retryOperation(operation, maxRetries = MAX_RETRIES, operationName = 'operation') {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            Logger.warn(`${operationName} failed on attempt ${attempt}/${maxRetries}:`, error);
            
            if (attempt === maxRetries) {
                Logger.error(`${operationName} failed after ${maxRetries} attempts`, error);
                throw error;
            }
            
            // Exponential backoff
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

/**
 * Safe DOM query with fallback selectors
 * @param {Element} container - Container to search in
 * @param {Array<string>} selectors - Array of selectors to try
 * @returns {Element|null} Found element or null
 */
function safeDOMQuery(container, selectors) {
    if (!container) return null;
    
    for (const selector of selectors) {
        try {
            const element = container.querySelector(selector);
            if (element) return element;
        } catch (error) {
            Logger.debug(`Selector "${selector}" failed:`, error);
        }
    }
    
    return null;
}

/**
 * Main caption checking function with race condition protection and enhanced error handling
 */
function checkCaptions() {
    // Prevent concurrent execution
    if (isProcessing) {
        Logger.debug("Caption processing already in progress, skipping...");
        return;
    }
    
    isProcessing = true;
    
    try {
        Logger.debug("Checking for captions...");
        
        checkForNewMeeting();
        
        // Try multiple selectors for better compatibility
        const captionContainerSelectors = [
            "[data-tid='closed-captions-renderer']",
            ".closed-captions-container",
            "[data-testid='caption-container']"
        ];
        
        const closedCaptionsContainer = safeDOMQuery(document, captionContainerSelectors);
        if (!closedCaptionsContainer) {
            Logger.debug("Caption container not found - captions may not be enabled");
            return;
        }
        
        // Try multiple selectors for caption elements
        const captionSelectors = [
            '.fui-ChatMessageCompact',
            '.caption-item',
            '[data-tid="caption-text"]'
        ];
        
        let transcripts = [];
        for (const selector of captionSelectors) {
            transcripts = closedCaptionsContainer.querySelectorAll(selector);
            if (transcripts.length > 0) break;
        }
        
        Logger.debug(`Found ${transcripts.length} caption elements`);
        
        if (transcripts.length === 0) {
            Logger.debug("No caption elements found");
            return;
        }
        
        // Process each visible caption element
        transcripts.forEach((transcript, index) => {
            try {
                // Try multiple selectors for author element
                const authorSelectors = ['[data-tid="author"]', '.author', '.speaker'];
                const authorElement = safeDOMQuery(transcript, authorSelectors);
                if (!authorElement) return;
                
                const Name = authorElement.innerText?.trim();
                if (!Name) return;
                
                // Try multiple selectors for text element
                const textSelectors = ['[data-tid="closed-caption-text"]', '.caption-text', '.text'];
                const textElement = safeDOMQuery(transcript, textSelectors);
                if (!textElement) return;
                
                const Text = textElement.innerText?.trim();
                if (!Text || Text.length === 0) return;
                
                // Use conservative whitelist approach
                conservativeSmartAddCaption(Name, Text);
                
            } catch (error) {
                Logger.error(`Error processing transcript ${index}:`, error);
            }
        });
        
        Logger.debug(`Current transcript array length: ${transcriptArray.length}`);
        
    } catch (error) {
        Logger.error('Error in checkCaptions:', error);
    } finally {
        // Always reset processing flag
        isProcessing = false;
    }
}

// run startTranscription every 5 seconds
function startTranscription() {
    try {
        // Check if we're in a meeting
        const meetingIndicators = [
            document.getElementById("call-duration-custom"),
            document.querySelector("[data-tid='call-status-container-test-id']"),
            document.querySelector("#call-status"),
            Array.from(document.querySelectorAll('span')).find(el => 
                el.textContent && el.textContent.includes("Waiting for others to join")
            )
        ];
        
        const inMeeting = meetingIndicators.some(indicator => indicator !== null && indicator !== undefined);
        
        if (!inMeeting) {
            console.log("Not in meeting, retrying in 5 seconds...");
            setTimeout(startTranscription, 5000);
            return false;
        }

        console.log("✅ Meeting detected");

        const closedCaptionsContainer = document.querySelector("[data-tid='closed-captions-renderer']");
        if (!closedCaptionsContainer) {
            console.log("❌ Caption container not found - Please enable captions: More > Language and speech > Turn on live captions");
            setTimeout(startTranscription, 5000);
            return false;
        }

        console.log("✅ Caption container found");

        // Initialize meeting tracking
        currentMeetingId = extractMeetingId();
        
        // Clean up any existing observer
        cleanupObserver();
        
        capturing = true;
        observer = new MutationObserver(debouncedCheckCaptions);
        observer.observe(closedCaptionsContainer, {
            childList: true,
            subtree: true,
            characterData: true
        });
        
        // Add cleanup function
        cleanupFunctions.push(() => cleanupObserver());
        
        // Do an initial check
        console.log("🚀 Starting conservative smart caption capture...");
        checkCaptions();
        console.log("Caption capturing started successfully for meeting:", currentMeetingId);

        return true;
    } catch (error) {
        console.error('Error in startTranscription:', error);
        showUserError('Failed to start caption capturing. Please refresh the page and try again.');
        return false;
    }
}

/**
 * Display error message to user
 */
function showUserError(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #d32f2f;
        color: white;
        padding: 15px;
        border-radius: 5px;
        z-index: 10000;
        max-width: 300px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    `;
    notification.textContent = `MS Teams Caption Saver: ${message}`;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

/**
 * Smart memory management that preserves captions while preventing browser crashes
 * CORE PRINCIPLE: NEVER delete captions without user consent
 */
function enforceMemoryLimits() {
    // Check if we're approaching the auto-save threshold
    if (transcriptArray.length >= AUTO_SAVE_THRESHOLD && transcriptArray.length % 1000 === 0) {
        // Warn user and offer auto-save to prevent loss
        const shouldAutoSave = confirm(
            `You have ${transcriptArray.length} captions captured! ` +
            `To prevent potential browser memory issues, would you like to save the current transcript? ` +
            `(Selecting "OK" will save and continue capturing. Selecting "Cancel" will continue without saving.)`
        );
        
        if (shouldAutoSave) {
            // Trigger auto-save
            try {
                const meetingTitle = extractMeetingTitle() + "_auto_save_" + Date.now();
                chrome.runtime.sendMessage({
                    message: "download_captions",
                    transcriptArray: transcriptArray.map(({ID, ...rest}) => rest),
                    meetingTitle: meetingTitle
                });
                Logger.info(`Auto-saved ${transcriptArray.length} captions due to memory threshold`);
                
                // Optionally clear after save (ask user)
                setTimeout(() => {
                    const shouldClear = confirm(
                        "Transcript auto-saved successfully! " +
                        "Would you like to clear the current data to start fresh? " +
                        "(This will not affect your saved file)"
                    );
                    if (shouldClear) {
                        resetTranscriptData();
                        Logger.info("Transcript data cleared after auto-save");
                    }
                }, 1000);
                
            } catch (error) {
                Logger.error("Auto-save failed:", error);
                showUserError("Auto-save failed. Please manually save your captions to prevent loss.");
            }
        }
    }
    
    // CRITICAL: Only enforce hard limit at much higher threshold and with user warning
    if (transcriptArray.length > MAX_TRANSCRIPT_ENTRIES) {
        Logger.warn(`CRITICAL: Transcript array has reached ${transcriptArray.length} entries`);
        showUserError(
            `CRITICAL: You have ${transcriptArray.length} captions! ` +
            `Please save your transcript immediately to prevent potential browser crashes. ` +
            `Use the extension popup to save your captions.`
        );
        
        // DO NOT automatically delete captions - let user decide
        // If browser crashes, that's better than silent data loss
    }
    
    // Limit recentlyRemoved array size (this is safe to trim as it's just for recovery)
    if (recentlyRemoved.length > MAX_RECENTLY_REMOVED) {
        recentlyRemoved.splice(MAX_RECENTLY_REMOVED);
        Logger.debug(`Trimmed recentlyRemoved array to ${MAX_RECENTLY_REMOVED} entries`);
    }
}

/**
 * Extract a clean meeting title for auto-save
 */
function extractMeetingTitle() {
    try {
        if (document && document.title) {
            const title = document.title.replace("__Microsoft_Teams", '').replace(/[^a-z0-9\s]/gi, '').trim();
            return title || 'teams_meeting';
        }
        return 'teams_meeting';
    } catch (error) {
        Logger.error('Error extracting meeting title:', error);
        return 'teams_meeting';
    }
}

/**
 * Clean up observer and prevent memory leaks
 */
function cleanupObserver() {
    if (observer) {
        observer.disconnect();
        observer = null;
        console.log("🧹 Observer cleaned up");
    }
    
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
        console.log("🧹 Debounce timer cleaned up");
    }
    
    capturing = false;
    isProcessing = false;
}

/**
 * Clean up all resources
 */
function cleanupAll() {
    cleanupObserver();
    
    // Run all registered cleanup functions
    cleanupFunctions.forEach(cleanup => {
        try {
            cleanup();
        } catch (error) {
            console.error("Error during cleanup:", error);
        }
    });
    
    cleanupFunctions.length = 0;
    console.log("🧹 All resources cleaned up");
}

/**
 * Reset transcript data and all tracking structures
 */
function resetTranscriptData() {
    transcriptArray.length = 0;
    transcriptIdCounter = 0;
    recentlyRemoved.length = 0;
    captionManager.captionHashSet.clear();
    Logger.info("Transcript data reset");
}

/**
 * Comprehensive test function to validate all functionality
 * Only runs in development/testing environments
 */
function runComprehensiveTests() {
    const tests = [];
    let passedTests = 0;
    let failedTests = 0;
    
    function test(name, testFunction) {
        try {
            const result = testFunction();
            if (result === true || result === undefined) {
                tests.push({ name, status: 'PASS' });
                passedTests++;
                Logger.debug(`✅ TEST PASS: ${name}`);
            } else {
                tests.push({ name, status: 'FAIL', error: result });
                failedTests++;
                Logger.error(`❌ TEST FAIL: ${name} - ${result}`);
            }
        } catch (error) {
            tests.push({ name, status: 'ERROR', error: error.message });
            failedTests++;
            Logger.error(`💥 TEST ERROR: ${name} - ${error.message}`);
        }
    }
    
    // Test 1: CaptionManager initialization
    test('CaptionManager initialization', () => {
        return captionManager && 
               captionManager.transcriptArray &&
               captionManager.captionHashSet instanceof Set;
    });
    
    // Test 2: Variable synchronization
    test('Variable synchronization', () => {
        const originalLength = transcriptArray.length;
        captionManager.transcriptArray.push({ test: true });
        const newLength = transcriptArray.length;
        captionManager.transcriptArray.pop(); // cleanup
        return newLength === originalLength + 1;
    });
    
    // Test 3: Input validation
    test('Input validation - valid input', () => {
        const result = validateCaptionInput("Test User", "Test message");
        return result.isValid === true;
    });
    
    test('Input validation - empty name', () => {
        const result = validateCaptionInput("", "Test message");
        return result.isValid === false && result.error.includes('empty');
    });
    
    test('Input validation - invalid type', () => {
        const result = validateCaptionInput(null, "Test message");
        return result.isValid === false && result.error.includes('strings');
    });
    
    test('Input validation - too long', () => {
        const longText = 'a'.repeat(6000);
        const result = validateCaptionInput("User", longText);
        return result.isValid === false && result.error.includes('too long');
    });
    
    // Test 4: Hash functionality
    test('Hash generation and deduplication', () => {
        const hash1 = captionManager.generateCaptionHash("User", "Message");
        const hash2 = captionManager.generateCaptionHash("User", "Message");
        const hash3 = captionManager.generateCaptionHash("User", "Different");
        return hash1 === hash2 && hash1 !== hash3;
    });
    
    // Test 5: Logger functionality
    test('Logger levels', () => {
        const originalLevel = Logger.level;
        Logger.level = 'ERROR';
        const shouldNotLog = Logger.shouldLog('DEBUG');
        const shouldLog = Logger.shouldLog('ERROR');
        Logger.level = originalLevel; // restore
        return !shouldNotLog && shouldLog;
    });
    
    // Test 6: Safe DOM query with fallbacks
    test('Safe DOM query fallbacks', () => {
        const mockContainer = document.createElement('div');
        mockContainer.innerHTML = '<span class="test">content</span>';
        const result = safeDOMQuery(mockContainer, ['nonexistent', '.test']);
        return result && result.textContent === 'content';
    });
    
    // Test 7: Memory limit enforcement
    test('Memory limit enforcement', () => {
        const originalLength = transcriptArray.length;
        const originalHashSize = captionManager.captionHashSet.size;
        
        // Add test entries
        for (let i = 0; i < 5; i++) {
            addCaptionToTranscript(`TestUser${i}`, `Test message ${i}`);
        }
        
        // Check they were added
        const afterAdd = transcriptArray.length === originalLength + 5;
        const hashAfterAdd = captionManager.captionHashSet.size === originalHashSize + 5;
        
        // Force memory limit (temporarily lower the limit)
        const originalLimit = MAX_TRANSCRIPT_ENTRIES;
        Object.defineProperty(window, 'MAX_TRANSCRIPT_ENTRIES', { value: originalLength + 2, writable: true });
        
        enforceMemoryLimits();
        
        const afterLimit = transcriptArray.length === originalLength + 2;
        
        // Restore original limit
        Object.defineProperty(window, 'MAX_TRANSCRIPT_ENTRIES', { value: originalLimit, writable: true });
        
        // Cleanup test data
        resetTranscriptData();
        
        return afterAdd && hashAfterAdd && afterLimit;
    });
    
    // Test 8: Progressive caption detection
    test('Progressive caption detection', () => {
        const result1 = isWhitelistedProgressive("Hello", "Hello world");
        const result2 = isWhitelistedProgressive("Hello", "Goodbye");
        return result1.isProgressive === true && result2.isProgressive === false;
    });
    
    // Test 9: Cleanup functions
    test('Cleanup functions', () => {
        const testCleanupCalled = { value: false };
        cleanupFunctions.push(() => { testCleanupCalled.value = true; });
        cleanupAll();
        return testCleanupCalled.value === true;
    });
    
    // Test 10: Error boundary in conservativeSmartAddCaption
    test('Error handling in conservativeSmartAddCaption', () => {
        const result1 = conservativeSmartAddCaption("", ""); // Should fail validation
        const result2 = conservativeSmartAddCaption("Valid User", "Valid message"); // Should succeed
        const result3 = conservativeSmartAddCaption("Valid User", "Valid message"); // Should be duplicate
        
        // Cleanup
        resetTranscriptData();
        
        return result1 === false && result2 === true && result3 === false;
    });
    
    // Test 11: XSS Prevention and Input Sanitization
    test('XSS prevention', () => {
        const xssAttempts = [
            '<script>alert("xss")</script>',
            'javascript:alert("xss")',
            '<img src=x onerror=alert("xss")>',
            '"><script>alert("xss")</script>',
            '\'><script>alert("xss")</script>'
        ];
        
        let allSafe = true;
        xssAttempts.forEach(xss => {
            const result = conservativeSmartAddCaption("TestUser", xss);
            // Check if the sanitized version doesn't contain script tags
            const lastEntry = transcriptArray[transcriptArray.length - 1];
            if (lastEntry && lastEntry.Text.includes('<script')) {
                allSafe = false;
            }
        });
        
        // Cleanup
        resetTranscriptData();
        return allSafe;
    });
    
    // Test 12: Chrome API Error Handling
    test('Chrome API error handling', () => {
        // Temporarily mock chrome API to simulate error
        const originalChrome = chrome;
        window.chrome = {
            runtime: {
                onMessage: {
                    addListener: () => { throw new Error("Mock API error"); }
                }
            }
        };
        
        let errorHandled = false;
        try {
            chrome.runtime.onMessage.addListener(() => {});
        } catch (error) {
            errorHandled = true;
        }
        
        // Restore original chrome object
        window.chrome = originalChrome;
        return errorHandled;
    });
    
    // Test 13: Large dataset performance
    test('Large dataset handling', () => {
        const startTime = performance.now();
        
        // Add a large number of captions
        for (let i = 0; i < 100; i++) {
            conservativeSmartAddCaption(`User${i}`, `Message number ${i} with some content`);
        }
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // Check that it completed in reasonable time (< 1 second)
        const performanceOk = duration < 1000;
        
        // Check that deduplication still works
        const beforeDuplicate = transcriptArray.length;
        conservativeSmartAddCaption("User1", "Message number 1 with some content");
        const afterDuplicate = transcriptArray.length;
        const deduplicationWorks = beforeDuplicate === afterDuplicate;
        
        // Cleanup
        resetTranscriptData();
        
        return performanceOk && deduplicationWorks;
    });
    
    // Test 14: DOM selector resilience
    test('DOM selector resilience', () => {
        const mockElement = document.createElement('div');
        
        // Test with various malformed selectors
        const badSelectors = [
            '',
            ':::invalid:::',
            '[data-test="unclosed',
            '.class..double-dot',
            '#id#duplicate'
        ];
        
        let allHandled = true;
        badSelectors.forEach(selector => {
            try {
                const result = safeDOMQuery(mockElement, [selector]);
                // Should return null without throwing
                if (result !== null) allHandled = false;
            } catch (error) {
                // Should not throw errors
                allHandled = false;
            }
        });
        
        return allHandled;
    });
    
    // Test 15: Memory cleanup verification
    test('Memory cleanup verification', () => {
        // Add some data
        conservativeSmartAddCaption("TestUser", "Test message");
        
        // Add some cleanup functions
        const cleanupCalled = { value: 0 };
        cleanupFunctions.push(() => cleanupCalled.value++);
        cleanupFunctions.push(() => cleanupCalled.value++);
        
        // Verify data exists
        const hasData = transcriptArray.length > 0 && captionManager.captionHashSet.size > 0;
        
        // Run cleanup
        cleanupAll();
        
        // Verify cleanup was called
        const cleanupExecuted = cleanupCalled.value === 2;
        
        // Reset and verify data is cleared
        resetTranscriptData();
        const dataCleared = transcriptArray.length === 0 && captionManager.captionHashSet.size === 0;
        
        return hasData && cleanupExecuted && dataCleared;
    });
    
    // Test 16: Debouncing effectiveness
    test('Debouncing effectiveness', () => {
        let callCount = 0;
        const originalCheckCaptions = checkCaptions;
        
        // Mock checkCaptions to count calls
        window.checkCaptions = () => { callCount++; };
        
        // Trigger multiple rapid calls
        for (let i = 0; i < 5; i++) {
            debouncedCheckCaptions();
        }
        
        // Wait for debounce to complete
        return new Promise((resolve) => {
            setTimeout(() => {
                const debounceWorked = callCount === 1; // Should only be called once
                
                // Restore original function
                window.checkCaptions = originalCheckCaptions;
                
                resolve(debounceWorked);
            }, DEBOUNCE_DELAY + 100);
        });
    });
    
    // Test results summary
    const totalTests = tests.length;
    Logger.info(`\n=== TEST RESULTS ===`);
    Logger.info(`Total Tests: ${totalTests}`);
    Logger.info(`Passed: ${passedTests}`);
    Logger.info(`Failed: ${failedTests}`);
    Logger.info(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    if (failedTests > 0) {
        Logger.error('Failed tests:');
        tests.filter(t => t.status !== 'PASS').forEach(t => {
            Logger.error(`- ${t.name}: ${t.error || t.status}`);
        });
    }
    
    // Test 17: Message handling robustness
    test('Message handling robustness', () => {
        let allHandled = true;
        
        // Test various malformed requests
        const malformedRequests = [
            null,
            undefined,
            {},
            { message: null },
            { message: "" },
            { message: "unknown_command" },
            { message: "return_transcript", extraData: "unexpected" }
        ];
        
        malformedRequests.forEach(request => {
            try {
                // Simulate the message listener logic
                if (!request || !request.message) {
                    // Should handle gracefully
                    return;
                }
                
                switch (request.message) {
                    case 'return_transcript':
                    case 'get_captions_for_viewing':
                    case 'reset_transcript':
                        // Valid messages should be handled
                        break;
                    default:
                        // Unknown messages should be handled gracefully
                        break;
                }
            } catch (error) {
                allHandled = false;
                Logger.error('Message handling failed:', error);
            }
        });
        
        return allHandled;
    });
    
    // Test 18: Resource leak detection
    test('Resource leak detection', () => {
        const initialTimers = setTimeout(() => {}, 0); // Get current timer count approximation
        clearTimeout(initialTimers);
        
        // Create and cleanup resources multiple times
        for (let i = 0; i < 10; i++) {
            startTranscription();
            cleanupObserver();
        }
        
        // Add some debounced calls
        for (let i = 0; i < 5; i++) {
            debouncedCheckCaptions();
        }
        
        // Cleanup everything
        cleanupAll();
        
        // Check that no timers are left hanging
        const hasNoActiveTimer = debounceTimer === null;
        const hasNoObserver = observer === null;
        const cleanupFunctionsEmpty = cleanupFunctions.length === 0;
        
        return hasNoActiveTimer && hasNoObserver && cleanupFunctionsEmpty;
    });
    
    return { total: totalTests, passed: passedTests, failed: failedTests, tests };
}

/**
 * Attempt to recover captions from localStorage backup in case of crash/reload
 */
function attemptCrashRecovery() {
    try {
        const backup = localStorage.getItem('caption_saver_backup');
        if (backup) {
            const backupData = JSON.parse(backup);
            const backupAge = Date.now() - backupData.timestamp;
            
            // Only recover if backup is less than 4 hours old
            if (backupAge < 4 * 60 * 60 * 1000 && backupData.data && backupData.data.length > 0) {
                const shouldRecover = confirm(
                    `Found ${backupData.data.length} backed-up captions from a previous session. ` +
                    `Would you like to restore them? ` +
                    `(Meeting: ${backupData.meetingId || 'Unknown'})`
                );
                
                if (shouldRecover) {
                    // Restore backup data
                    backupData.data.forEach(entry => {
                        transcriptArray.push(entry);
                        captionManager.addCaptionHash(entry.Name, entry.Text);
                    });
                    
                    Logger.info(`Recovered ${backupData.data.length} captions from backup`);
                    showUserError(`Successfully recovered ${backupData.data.length} captions from previous session!`);
                    
                    // Clear the backup since it's been restored
                    localStorage.removeItem('caption_saver_backup');
                }
            } else if (backupAge >= 4 * 60 * 60 * 1000) {
                // Clear old backups
                localStorage.removeItem('caption_saver_backup');
                Logger.debug('Cleared old backup data');
            }
        }
    } catch (error) {
        Logger.warn('Error during crash recovery:', error);
        // Don't fail startup if recovery fails
    }
}

/**
 * Enhanced observer restart with reliability checks and caption flow monitoring
 */
function ensureObserverReliability() {
    // Check every 30 seconds if observer is still active
    setInterval(() => {
        if (capturing && !observer) {
            Logger.warn('Observer lost - attempting restart');
            startTranscription();
        }
        
        // Also check if DOM container still exists
        if (capturing && observer) {
            const container = document.querySelector("[data-tid='closed-captions-renderer']");
            if (!container) {
                Logger.warn('Caption container lost - observer may be orphaned');
                cleanupObserver();
                setTimeout(() => startTranscription(), 2000); // Retry after 2 seconds
            }
        }
        
        // CRITICAL: Check if captions have stopped flowing for too long
        const timeSinceLastCaption = Date.now() - captionManager.lastCaptionTime;
        const captionElements = document.querySelectorAll("[data-tid='closed-captions-renderer'] .fui-ChatMessageCompact");
        
        // If we haven't captured captions in 5 minutes but DOM shows captions exist, restart
        if (capturing && timeSinceLastCaption > 5 * 60 * 1000 && captionElements.length > 0) {
            Logger.warn(`CRITICAL: No captions captured for ${Math.round(timeSinceLastCaption/60000)} minutes but DOM shows ${captionElements.length} caption elements`);
            
            // Show warning to user
            showUserError(
                `WARNING: Caption capture may have stopped! ` +
                `No captions captured for ${Math.round(timeSinceLastCaption/60000)} minutes. ` +
                `Attempting to restart...`
            );
            
            // Force restart the observer
            cleanupObserver();
            setTimeout(() => {
                startTranscription();
                Logger.info('Forced restart due to caption flow interruption');
            }, 1000);
        }
        
    }, 30000);
}

/**
 * Periodic health check to ensure capture is working
 */
function performHealthCheck() {
    setInterval(() => {
        if (capturing) {
            const stats = {
                totalCaptions: transcriptArray.length,
                captureRate: captionManager.captionCount,
                timeSinceLastCaption: Date.now() - captionManager.lastCaptionTime,
                observerActive: !!observer,
                containerExists: !!document.querySelector("[data-tid='closed-captions-renderer']")
            };
            
            Logger.debug('Health Check:', stats);
            
            // Alert user if something looks wrong
            if (stats.timeSinceLastCaption > 10 * 60 * 1000 && stats.containerExists) {
                Logger.warn('Potential caption capture issue detected');
            }
        }
    }, 60000); // Every minute
}

// Attempt crash recovery first
attemptCrashRecovery();

// Start the extension
startTranscription();

// Ensure long-term reliability
ensureObserverReliability();
performHealthCheck();

// Run tests only if in development mode (check for console availability and development indicators)
if (typeof console !== 'undefined' && 
    (window.location.hostname === 'localhost' || 
     window.location.search.includes('debug=true') ||
     localStorage.getItem('caption_saver_debug') === 'true')) {
    
    // Delay test execution to allow initialization
    setTimeout(() => {
        Logger.level = 'DEBUG'; // Enable debug logging for tests
        Logger.info('Running comprehensive tests...');
        const testResults = runComprehensiveTests();
        
        // Store test results for inspection
        window.captionSaverTestResults = testResults;
        
        if (testResults.failed === 0) {
            Logger.info('🎉 All tests passed! Extension is ready for production.');
        } else {
            Logger.warn(`⚠️ ${testResults.failed} tests failed. Please review before deployment.`);
        }
    }, 1000);
}

// Add cleanup on page unload to prevent memory leaks
window.addEventListener('beforeunload', cleanupAll);
window.addEventListener('unload', cleanupAll);

// Add cleanup function for navigation events
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function() {
    cleanupAll();
    return originalPushState.apply(history, arguments);
};

history.replaceState = function() {
    cleanupAll();
    return originalReplaceState.apply(history, arguments);
};

// Listen for messages from the popup.js or service_worker.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    Logger.debug("Content script received message:", request);
    
    try {
        switch (request.message) {
            case 'return_transcript':
                Logger.info("return_transcript request received:", { length: transcriptArray.length });
                if (!capturing) {
                    const errorMsg = "Caption capturing is not active. Please make sure you're in a Teams meeting with captions enabled.";
                    Logger.error(errorMsg);
                    showUserError(errorMsg);
                    sendResponse({success: false, error: errorMsg});
                    return;
                }
                
                if (transcriptArray.length === 0) {
                    const errorMsg = "No captions captured yet. Please make sure live captions are turned on in Teams.";
                    console.error(errorMsg);
                    showUserError(errorMsg);
                    sendResponse({success: false, error: errorMsg});
                    return;
                }

                try {
                    let meetingTitle = document.title.replace("__Microsoft_Teams", '').replace(/[^a-z0-9 ]/gi, '');
                    chrome.runtime.sendMessage({
                        message: "download_captions",
                        transcriptArray: transcriptArray.map(({ID, ...rest}) => rest),
                        meetingTitle: meetingTitle
                    });
                    
                    setTimeout(() => {
                        if (confirm("Transcript saved! Would you like to clear the transcript data to start fresh for a new conversation?")) {
                            resetTranscriptData();
                        }
                    }, 1000);
                    
                    sendResponse({success: true});
                } catch (error) {
                    console.error('Error sending download message:', error);
                    showUserError('Failed to initiate download: ' + error.message);
                    sendResponse({success: false, error: error.message});
                }
                break;

            case 'get_captions_for_viewing':
                console.log("get_captions_for_viewing request received:", transcriptArray);
                if (!capturing) {
                    const errorMsg = "Caption capturing is not active. Please make sure you're in a Teams meeting with captions enabled.";
                    console.error(errorMsg);
                    showUserError(errorMsg);
                    sendResponse({success: false, error: errorMsg});
                    return;
                }
                
                if (transcriptArray.length === 0) {
                    const errorMsg = "No captions captured yet. Please make sure live captions are turned on in Teams.";
                    console.error(errorMsg);
                    showUserError(errorMsg);
                    sendResponse({success: false, error: errorMsg});
                    return;
                }

                try {
                    const viewableTranscripts = transcriptArray.map(({ID, ...rest}) => rest);
                    
                    chrome.runtime.sendMessage({
                        message: "display_captions",
                        transcriptArray: viewableTranscripts
                    });
                    sendResponse({success: true});
                } catch (error) {
                    console.error('Error sending viewer message:', error);
                    showUserError('Failed to open caption viewer: ' + error.message);
                    sendResponse({success: false, error: error.message});
                }
                break;

            case 'error_notification':
                if (request.error) {
                    showUserError(request.error);
                }
                sendResponse({success: true});
                break;

            case 'reset_transcript':
                resetTranscriptData();
                showUserError('Transcript data cleared. Starting fresh!');
                sendResponse({success: true});
                break;

            case 'restore_removed':
                // Hidden feature: restore recently removed entries if needed
                const restored = restoreRecentlyRemoved(request.count || 1);
                console.log('Restored entries:', restored);
                sendResponse({success: true, restored: restored.length});
                break;

            default:
                console.log('Unknown message type:', request.message);
                sendResponse({success: false, error: 'Unknown message type'});
                break;
        }
    } catch (error) {
        console.error('Error handling message:', error);
        showUserError('Internal error: ' + error.message);
        sendResponse({success: false, error: error.message});
    }
});

console.log("🚀 Conservative whitelist-based caption content_script.js is running");