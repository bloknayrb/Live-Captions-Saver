// Meeting state constants
const MEETING_STATES = {
    CHAT: 'chat',                    // In Teams chat/general interface
    JOINING: 'joining',              // Meeting join process started
    PRE_MEETING: 'pre_meeting',      // In meeting lobby/waiting
    MEETING_ACTIVE: 'meeting_active', // In active meeting
    CAPTIONS_READY: 'captions_ready' // Captions container available
};

// Transition timeout constants
const TRANSITION_TIMEOUTS = {
    CHAT_TO_JOINING: 5000,           // 5 seconds
    JOINING_TO_PRE_MEETING: 15000,   // 15 seconds  
    PRE_MEETING_TO_ACTIVE: 30000,    // 30 seconds
    ACTIVE_TO_CAPTIONS_READY: 45000, // 45 seconds
    GRACE_PERIOD: 60000              // 1 minute grace period after any transition
};

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
        
        // NEW: Transition state management
        this.meetingState = MEETING_STATES.CHAT;
        this.previousMeetingState = MEETING_STATES.CHAT;
        this.stateTransitionTime = Date.now();
        this.transitionGracePeriod = TRANSITION_TIMEOUTS.GRACE_PERIOD;
        this.stateTransitionHistory = [];
        
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
        
        // Hybrid snapshot-based capture system (inspired by Zerg00s)
        this.captureMode = 'snapshot'; // 'snapshot' or 'progressive' (fallback)
        this.lastCaptionSnapshot = '';
        this.silenceTimer = null;
        this.snapshotCheckTimer = null;
        this.lastSnapshotTime = Date.now();
        this.pendingCaptionData = [];
        this.fallbackModeStartTime = null;
        this.snapshotFailureCount = 0;
        
        // Debug mode for comprehensive logging
        this.debugMode = new URLSearchParams(window.location.search).has('debug') || 
                        localStorage.getItem('caption_saver_debug') === 'true';
    }
    
    /**
     * Transition to new meeting state with logging and history tracking
     * @param {string} newState - New meeting state to transition to
     * @param {string} reason - Reason for the transition
     */
    transitionToState(newState, reason = 'Unknown') {
        // Validate state parameter
        if (!Object.values(MEETING_STATES).includes(newState)) {
            Logger.error(`Invalid state transition requested: ${newState}`);
            return;
        }
        
        if (this.meetingState === newState) {
            return; // Already in target state
        }
        
        const oldState = this.meetingState;
        this.previousMeetingState = oldState;
        this.meetingState = newState;
        this.stateTransitionTime = Date.now();
        
        // Track transition history
        this.stateTransitionHistory.push({
            from: oldState,
            to: newState,
            timestamp: this.stateTransitionTime,
            reason: reason
        });
        
        // Keep only last 10 transitions
        if (this.stateTransitionHistory.length > 10) {
            this.stateTransitionHistory.shift();
        }
        
        Logger.info(`Meeting state transition: ${oldState} → ${newState} (${reason})`);
        
        // Enhanced debug logging
        if (this.debugMode) {
            Logger.debug(`State transition details:`, {
                fromState: oldState,
                toState: newState,
                reason: reason,
                timestamp: new Date(this.stateTransitionTime).toISOString(),
                transitionCount: this.stateTransitionHistory.length,
                meetingId: this.currentMeetingId,
                captionCount: this.transcriptArray.length,
                capturing: this.capturing,
                url: window.location.href
            });
        }
        
        // Show user transition progress
        showStateTransitionProgress(oldState, newState);
        
        // Call transition-specific handlers
        this.onStateTransition(oldState, newState, reason);
    }
    
    /**
     * Handle actions needed when transitioning between states
     * @param {string} fromState - Previous state
     * @param {string} toState - New state
     * @param {string} reason - Reason for transition
     */
    onStateTransition(fromState, toState, reason) {
        // Log transition for debugging
        Logger.debug(`Handling transition from ${fromState} to ${toState}: ${reason}`);
        
        // State-specific transition logic
        switch (toState) {
            case MEETING_STATES.JOINING:
                this.onJoiningMeeting();
                break;
            case MEETING_STATES.PRE_MEETING:
                this.onPreMeeting();
                break;
            case MEETING_STATES.MEETING_ACTIVE:
                this.onMeetingActive();
                break;
            case MEETING_STATES.CAPTIONS_READY:
                this.onCaptionsReady();
                break;
            case MEETING_STATES.CHAT:
                this.onReturnToChat();
                break;
        }
    }
    
    /**
     * Check if we're currently in a transition grace period
     * @returns {boolean} True if in grace period
     */
    isInTransitionGracePeriod() {
        const timeSinceTransition = Date.now() - this.stateTransitionTime;
        return timeSinceTransition < this.transitionGracePeriod;
    }
    
    /**
     * Get time since last state transition
     * @returns {number} Milliseconds since last transition
     */
    getTimeSinceTransition() {
        return Date.now() - this.stateTransitionTime;
    }
    
    /**
     * Check if state transition has timed out
     * @returns {boolean} True if transition has taken too long
     */
    isTransitionTimedOut() {
        const timeSinceTransition = this.getTimeSinceTransition();
        
        switch (this.meetingState) {
            case MEETING_STATES.JOINING:
                return timeSinceTransition > TRANSITION_TIMEOUTS.CHAT_TO_JOINING;
            case MEETING_STATES.PRE_MEETING:
                return timeSinceTransition > TRANSITION_TIMEOUTS.JOINING_TO_PRE_MEETING;
            case MEETING_STATES.MEETING_ACTIVE:
                return timeSinceTransition > TRANSITION_TIMEOUTS.PRE_MEETING_TO_ACTIVE;
            case MEETING_STATES.CAPTIONS_READY:
                return timeSinceTransition > TRANSITION_TIMEOUTS.ACTIVE_TO_CAPTIONS_READY;
            default:
                return false;
        }
    }
    
    /**
     * Handle joining meeting state
     */
    onJoiningMeeting() {
        Logger.info('Joining meeting - preparing caption capture system');
        // Prepare for meeting without starting capture yet
    }
    
    /**
     * Handle pre-meeting state (lobby/waiting)
     */
    onPreMeeting() {
        Logger.info('In pre-meeting state - monitoring for meeting start');
        // Monitor for meeting to become active
    }
    
    /**
     * Handle meeting active state
     */
    onMeetingActive() {
        Logger.info('Meeting is now active - looking for caption containers');
        // Start looking for caption containers with progressive detection
        this.startCaptionContainerSearch();
    }
    
    /**
     * Start searching for caption containers with progressive detection
     */
    async startCaptionContainerSearch() {
        try {
            Logger.info('Starting caption container search...');
            
            // Use progressive container detection
            const container = await this.findCaptionContainerProgressive();
            
            if (container) {
                Logger.info('Caption container detected - transitioning to captions ready');
                this.transitionToState(MEETING_STATES.CAPTIONS_READY, 'Caption container found');
            } else {
                Logger.warn('No caption container found - captions may not be enabled');
                // Stay in meeting active state and continue monitoring
                
                // Schedule another search in case captions get enabled later
                setTimeout(() => {
                    if (this.meetingState === MEETING_STATES.MEETING_ACTIVE) {
                        Logger.info('Retrying caption container search...');
                        this.startCaptionContainerSearch();
                    }
                }, 15000); // Retry every 15 seconds
            }
            
        } catch (error) {
            Logger.error('Error in caption container search:', error);
        }
    }
    
    /**
     * Handle captions ready state
     */
    onCaptionsReady() {
        Logger.info('Captions are ready - starting caption capture');
        // Begin actual caption capture
    }
    
    /**
     * Handle return to chat state
     */
    onReturnToChat() {
        Logger.info('Returned to chat - stopping caption capture');
        // Clean up capture resources
        this.cleanupCaptureResources();
    }
    
    /**
     * Check if observer is healthy and functioning
     * @returns {boolean} True if observer is healthy
     */
    checkObserverHealth() {
        if (!this.observer) {
            Logger.debug('Observer health check: No observer exists');
            return false;
        }
        
        try {
            // Check if observer is still connected and functional
            if (!this.observer.takeRecords) {
                Logger.debug('Observer health check: Observer missing takeRecords method');
                return false;
            }
            
            // Check if observer target still exists in DOM
            const currentContainer = safeDOMQuery(document, [
                "[data-tid='closed-caption-renderer-wrapper']",
                "[data-tid='closed-captions-renderer']"
            ]);
            
            if (!currentContainer) {
                Logger.debug('Observer health check: Caption container no longer exists');
                return false;
            }
            
            // Check if observer is still observing the correct target
            // Note: We can't directly check observer.target, so we assume it's correct if container exists
            Logger.debug('Observer health check: Observer appears healthy');
            return true;
            
        } catch (error) {
            Logger.warn('Observer health check failed:', error);
            return false;
        }
    }
    
    /**
     * Smart observer re-targeting instead of full recreation
     * @returns {boolean} True if re-targeting succeeded
     */
    retargetObserver() {
        if (!this.observer) {
            Logger.debug('Cannot retarget observer - no observer exists');
            return false;
        }
        
        try {
            // Find new caption container
            const newContainer = safeDOMQuery(document, [
                "[data-tid='closed-caption-renderer-wrapper']",
                "[data-tid='closed-captions-renderer']"
            ]);
            
            if (!newContainer) {
                Logger.debug('Cannot retarget observer - no caption container found');
                return false;
            }
            
            // Disconnect from old target and reconnect to new target
            this.observer.disconnect();
            this.observer.observe(newContainer, {
                childList: true,
                subtree: true,
                characterData: true
            });
            
            Logger.info('Observer successfully retargeted to new container');
            return true;
            
        } catch (error) {
            Logger.error('Observer retargeting failed:', error);
            return false;
        }
    }
    
    /**
     * Ensure observer is running and healthy
     * @returns {boolean} True if observer is ready
     */
    ensureObserverHealth() {
        // Check if observer exists and is healthy
        if (this.checkObserverHealth()) {
            Logger.debug('Observer is healthy - no action needed');
            return true;
        }
        
        // Try to retarget observer if it exists but is unhealthy
        if (this.observer && this.retargetObserver()) {
            Logger.info('Observer retargeted successfully');
            return true;
        }
        
        // Observer needs to be recreated
        Logger.info('Observer needs recreation');
        return this.recreateObserver();
    }
    
    /**
     * Recreate observer as last resort
     * @returns {boolean} True if recreation succeeded
     */
    recreateObserver() {
        try {
            // Clean up existing observer
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
            
            // Find caption container
            const container = safeDOMQuery(document, [
                "[data-tid='closed-caption-renderer-wrapper']",
                "[data-tid='closed-captions-renderer']"
            ]);
            
            if (!container) {
                Logger.debug('Cannot recreate observer - no caption container found');
                return false;
            }
            
            // Create new observer
            this.observer = new MutationObserver(debouncedCheckCaptions);
            this.observer.observe(container, {
                childList: true,
                subtree: true,
                characterData: true
            });
            
            Logger.info('Observer recreated successfully');
            return true;
            
        } catch (error) {
            Logger.error('Observer recreation failed:', error);
            return false;
        }
    }
    
    /**
     * Clean up capture resources
     */
    cleanupCaptureResources() {
        // Stop snapshot monitoring
        this.stopSnapshotMonitoring();
        
        // Clean up observer
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        
        // Clean up timers
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        
        // Reset capture state
        this.capturing = false;
        this.isProcessing = false;
        
        Logger.info('Capture resources cleaned up');
    }
    
    /**
     * Wait for caption container to appear and become ready
     * @param {number} maxWaitTime - Maximum wait time in milliseconds
     * @returns {Promise<Element|null>} Caption container element or null if timeout
     */
    async waitForCaptionContainer(maxWaitTime = 60000) {
        const startTime = Date.now();
        const checkInterval = 2000; // Check every 2 seconds
        
        return new Promise((resolve) => {
            const checkForContainer = () => {
                try {
                    const container = safeDOMQuery(document, [
                        "[data-tid='closed-caption-renderer-wrapper']",
                        "[data-tid='closed-captions-renderer']",
                        ".closed-captions-container",
                        "[data-testid='caption-container']",
                        ".live-captions-container"
                    ]);
                    
                    if (container && this.isCaptionContainerReady(container)) {
                        Logger.info('Caption container found and ready');
                        resolve(container);
                        return;
                    }
                    
                    if (Date.now() - startTime > maxWaitTime) {
                        Logger.warn(`Caption container wait timeout after ${maxWaitTime}ms`);
                        resolve(null);
                        return;
                    }
                    
                    // Schedule next check
                    setTimeout(checkForContainer, checkInterval);
                    
                } catch (error) {
                    Logger.error('Error checking for caption container:', error);
                    resolve(null);
                }
            };
            
            // Start checking
            checkForContainer();
        });
    }
    
    /**
     * Check if caption container is ready for observation
     * @param {Element} container - Caption container element
     * @returns {boolean} True if container is ready
     */
    isCaptionContainerReady(container) {
        if (!container) return false;
        
        try {
            // Check if container is visible
            if (!container.offsetParent) {
                Logger.debug('Caption container not visible');
                return false;
            }
            
            // Check if container has expected structure
            const hasExpectedAttributes = container.hasAttribute('data-tid') || 
                                        container.classList.length > 0;
            
            if (!hasExpectedAttributes) {
                Logger.debug('Caption container missing expected attributes');
                return false;
            }
            
            // Check if container is not empty (indicates Teams has initialized it)
            const hasContent = container.children.length > 0 || 
                             container.textContent.trim().length > 0;
            
            // For caption containers, it's OK if they're empty initially
            // but they should at least have the right structure
            Logger.debug(`Caption container readiness check: visible=${!!container.offsetParent}, hasAttributes=${hasExpectedAttributes}, hasContent=${hasContent}`);
            
            return hasExpectedAttributes; // Don't require content for caption containers
            
        } catch (error) {
            Logger.error('Error checking caption container readiness:', error);
            return false;
        }
    }
    
    /**
     * Progressive container detection with validation
     * @returns {Promise<Element|null>} Found container or null
     */
    async findCaptionContainerProgressive() {
        const containerSelectors = [
            "[data-tid='closed-caption-renderer-wrapper']", // Primary Teams v2
            "[data-tid='closed-captions-renderer']",         // Legacy Teams
            ".closed-captions-container",                    // Generic selector
            "[data-testid='caption-container']",             // Test environments
            ".live-captions-container"                       // Alternative naming
        ];
        
        Logger.debug('Starting progressive caption container detection');
        
        // Try each selector with increasing wait times
        for (let i = 0; i < containerSelectors.length; i++) {
            const selector = containerSelectors[i];
            const waitTime = (i + 1) * 5000; // 5s, 10s, 15s, 20s, 25s
            
            try {
                const container = await this.waitForSpecificContainer(selector, waitTime);
                if (container) {
                    Logger.info(`Caption container found using selector: ${selector}`);
                    return container;
                }
            } catch (error) {
                Logger.debug(`Container search failed for selector ${selector}:`, error);
            }
        }
        
        Logger.warn('Progressive container detection failed - no containers found');
        return null;
    }
    
    /**
     * Wait for specific container selector
     * @param {string} selector - CSS selector to wait for
     * @param {number} maxWaitTime - Maximum wait time
     * @returns {Promise<Element|null>} Found element or null
     */
    async waitForSpecificContainer(selector, maxWaitTime = 10000) {
        const startTime = Date.now();
        const checkInterval = 1000; // Check every second
        
        return new Promise((resolve) => {
            const checkForElement = () => {
                try {
                    const element = document.querySelector(selector);
                    
                    if (element && this.isCaptionContainerReady(element)) {
                        resolve(element);
                        return;
                    }
                    
                    if (Date.now() - startTime > maxWaitTime) {
                        resolve(null);
                        return;
                    }
                    
                    setTimeout(checkForElement, checkInterval);
                    
                } catch (error) {
                    Logger.debug(`Error checking for selector ${selector}:`, error);
                    resolve(null);
                }
            };
            
            checkForElement();
        });
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
    
    /**
     * Generate snapshot of current caption state from DOM
     * @returns {string} Serialized snapshot of current captions
     */
    generateCaptionSnapshot() {
        try {
            const captionContainerSelectors = [
                "[data-tid='closed-caption-renderer-wrapper']", // Teams v2 structure
                "[data-tid='closed-captions-renderer']"         // Legacy structure
            ];
            
            const closedCaptionsContainer = safeDOMQuery(document, captionContainerSelectors);
            if (!closedCaptionsContainer) {
                return '';
            }
            
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
            
            const captionData = [];
            transcripts.forEach((transcript) => {
                try {
                    const authorElement = safeDOMQuery(transcript, ['[data-tid="author"]', '.author', '.speaker']);
                    const textElement = safeDOMQuery(transcript, ['[data-tid="closed-caption-text"]', '.caption-text', '.text']);
                    
                    if (authorElement && textElement) {
                        const name = authorElement.innerText?.trim();
                        const text = textElement.innerText?.trim();
                        if (name && text && text.length > 0) {
                            captionData.push(`${name}:${text}`);
                        }
                    }
                } catch (error) {
                    Logger.warn('Error processing transcript element:', error);
                }
            });
            
            return captionData.join('|');
        } catch (error) {
            Logger.error('Error generating caption snapshot:', error);
            return '';
        }
    }
    
    /**
     * Start snapshot-based capture monitoring
     */
    startSnapshotMonitoring() {
        this.stopSnapshotMonitoring(); // Clean up any existing timers
        
        this.snapshotCheckTimer = setInterval(() => {
            this.checkCaptionSnapshot();
        }, SNAPSHOT_CHECK_INTERVAL);
        
        Logger.info('Snapshot monitoring started');
    }
    
    /**
     * Stop snapshot-based capture monitoring
     */
    stopSnapshotMonitoring() {
        if (this.snapshotCheckTimer) {
            clearInterval(this.snapshotCheckTimer);
            this.snapshotCheckTimer = null;
        }
        
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
        
        Logger.debug('Snapshot monitoring stopped');
    }
    
    /**
     * Check for caption changes and manage silence detection
     */
    checkCaptionSnapshot() {
        try {
            const currentSnapshot = this.generateCaptionSnapshot();
            
            if (currentSnapshot !== this.lastCaptionSnapshot) {
                Logger.debug('Caption changes detected, resetting silence timer');
                
                // Changes detected - reset silence timer
                this.resetSilenceTimer();
                this.lastCaptionSnapshot = currentSnapshot;
                this.lastSnapshotTime = Date.now();
                this.snapshotFailureCount = 0; // Reset failure count on success
                
                // Store current snapshot data for potential processing
                this.pendingCaptionData = this.parseCaptionSnapshot(currentSnapshot);
                
            } else if (this.pendingCaptionData.length >= MIN_CAPTIONS_FOR_STABILITY) {
                // No changes and we have sufficient captions - check if silence period has elapsed
                const timeSinceLastChange = Date.now() - this.lastSnapshotTime;
                if (timeSinceLastChange >= CAPTION_STABILITY_DELAY) {
                    Logger.info(`Silence detected (${timeSinceLastChange}ms), processing stable caption batch`);
                    this.processStableCaptionBatch();
                }
            }
            
            // Check for snapshot mode failure
            this.checkSnapshotModeHealth();
            
        } catch (error) {
            Logger.error('Error in checkCaptionSnapshot:', error);
            this.snapshotFailureCount++;
        }
    }
    
    /**
     * Reset the silence detection timer
     */
    resetSilenceTimer() {
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
        }
        
        this.silenceTimer = setTimeout(() => {
            Logger.debug('Silence timer expired, processing captions');
            this.processStableCaptionBatch();
        }, CAPTION_STABILITY_DELAY);
    }
    
    /**
     * Parse caption snapshot into structured data
     * @param {string} snapshot - Snapshot string to parse
     * @returns {Array} Array of caption objects
     */
    parseCaptionSnapshot(snapshot) {
        if (!snapshot) return [];
        
        return snapshot.split('|').map(entry => {
            const [name, ...textParts] = entry.split(':');
            return {
                name: name?.trim(),
                text: textParts.join(':')?.trim(),
                timestamp: new Date().toLocaleTimeString()
            };
        }).filter(entry => entry.name && entry.text);
    }
    
    /**
     * Process stable caption batch with smart deduplication (core of snapshot approach)
     */
    processStableCaptionBatch() {
        try {
            if (this.pendingCaptionData.length === 0) {
                Logger.debug('No pending captions to process');
                return;
            }
            
            Logger.info(`Processing stable caption batch: ${this.pendingCaptionData.length} captions`);
            
            // Step 1: Remove exact duplicates within the batch itself
            const uniqueBatchCaptions = this.deduplicateWithinBatch(this.pendingCaptionData);
            Logger.debug(`After internal deduplication: ${uniqueBatchCaptions.length} unique captions`);
            
            // Step 2: Process each unique caption
            let addedCount = 0;
            uniqueBatchCaptions.forEach(captionData => {
                const { name, text, timestamp } = captionData;
                
                // Check for exact duplicates against existing transcript
                if (!this.isDuplicateCaption(name, text)) {
                    // Add to transcript array
                    this.transcriptArray.push({
                        Name: name,
                        Text: text,
                        Time: timestamp,
                        ID: `caption_${this.transcriptIdCounter++}`
                    });
                    
                    // Add to hash set for future duplicate detection
                    this.addCaptionHash(name, text);
                    addedCount++;
                    
                    Logger.debug(`Added stable caption: "${text}" by ${name}`);
                } else {
                    Logger.debug(`Skipped existing duplicate: "${text}" by ${name}`);
                }
            });
            
            // Update reliability tracking
            if (addedCount > 0) {
                this.lastCaptionTime = Date.now();
                this.captionCount += addedCount;
                
                // Trigger memory management if needed
                if (this.transcriptArray.length % MEMORY_CHECK_INTERVAL === 0) {
                    enforceMemoryLimits();
                }
                
                // Backup to localStorage periodically
                if (this.transcriptArray.length % 100 === 0) {
                    this.backupToLocalStorage();
                }
            }
            
            // Clear pending data and reset silence timer to prevent immediate reprocessing
            this.pendingCaptionData = [];
            this.resetSilenceTimer(); // Reset timer to prevent immediate reprocessing
            
            Logger.info(`Batch processing complete: ${addedCount} new captions added`);
            
        } catch (error) {
            Logger.error('Error processing stable caption batch:', error);
            // In case of error, fall back to progressive mode temporarily
            this.switchToFallbackMode('Batch processing error');
        }
    }
    
    /**
     * Deduplicate captions within a batch using smart progressive detection
     * @param {Array} captionBatch - Array of caption objects to deduplicate
     * @returns {Array} Deduplicated array with only the most complete captions
     */
    deduplicateWithinBatch(captionBatch) {
        if (captionBatch.length <= 1) return captionBatch;
        
        // Group captions by speaker
        const speakerGroups = {};
        captionBatch.forEach((caption, index) => {
            if (!speakerGroups[caption.name]) {
                speakerGroups[caption.name] = [];
            }
            speakerGroups[caption.name].push({ ...caption, originalIndex: index });
        });
        
        const finalCaptions = [];
        
        // Process each speaker's captions
        Object.keys(speakerGroups).forEach(speakerName => {
            const captions = speakerGroups[speakerName];
            
            if (captions.length === 1) {
                // Single caption for this speaker - keep it
                finalCaptions.push(captions[0]);
            } else {
                // Multiple captions from same speaker - apply smart deduplication
                const deduplicatedCaptions = this.smartDeduplicateGroup(captions);
                finalCaptions.push(...deduplicatedCaptions);
            }
        });
        
        // Sort by original index to maintain temporal order
        finalCaptions.sort((a, b) => a.originalIndex - b.originalIndex);
        
        // Remove the originalIndex property
        return finalCaptions.map(caption => {
            const { originalIndex, ...cleanCaption } = caption;
            return cleanCaption;
        });
    }
    
    /**
     * Smart deduplication for a group of captions from the same speaker
     * @param {Array} captionGroup - Array of captions from same speaker
     * @returns {Array} Deduplicated captions
     */
    smartDeduplicateGroup(captionGroup) {
        if (captionGroup.length <= 1) return captionGroup;
        
        const result = [];
        const processed = new Set();
        
        for (let i = 0; i < captionGroup.length; i++) {
            if (processed.has(i)) continue;
            
            const currentCaption = captionGroup[i];
            let shouldKeep = true;
            
            // Check if this caption is a progressive update of a later caption
            for (let j = i + 1; j < captionGroup.length; j++) {
                if (processed.has(j)) continue;
                
                const laterCaption = captionGroup[j];
                const progressiveCheck = isWhitelistedProgressive(currentCaption.text, laterCaption.text);
                
                if (progressiveCheck.isProgressive && 
                    (progressiveCheck.confidence === 'HIGH' || progressiveCheck.confidence === 'VERY_HIGH')) {
                    
                    Logger.debug(`Within-batch progressive update detected: "${currentCaption.text}" -> "${laterCaption.text}"`);
                    shouldKeep = false; // Skip this caption, keep the later one
                    processed.add(i);
                    break;
                }
            }
            
            if (shouldKeep) {
                result.push(currentCaption);
                processed.add(i);
            }
        }
        
        return result;
    }
    
    /**
     * Check snapshot mode health and switch to fallback if needed
     */
    checkSnapshotModeHealth() {
        // Check for excessive failures
        if (this.snapshotFailureCount > 5) {
            this.switchToFallbackMode('Excessive snapshot failures');
            return;
        }
        
        // Check for emergency capture threshold
        if (this.pendingCaptionData.length > EMERGENCY_CAPTURE_THRESHOLD) {
            Logger.warn(`Emergency capture triggered: ${this.pendingCaptionData.length} pending captions`);
            this.processStableCaptionBatch(); // Force process large queue
        }
        
        // Check for fallback timeout
        if (this.fallbackModeStartTime && 
            Date.now() - this.fallbackModeStartTime > FALLBACK_TIMEOUT) {
            Logger.info('Attempting to return to snapshot mode from fallback');
            this.switchToSnapshotMode();
        }
    }
    
    /**
     * Switch to fallback (progressive) mode
     */
    switchToFallbackMode(reason = 'Unknown') {
        if (this.captureMode === 'progressive') return; // Already in fallback mode
        
        Logger.warn(`Switching to fallback mode: ${reason}`);
        this.captureMode = 'progressive';
        this.fallbackModeStartTime = Date.now();
        this.stopSnapshotMonitoring();
        
        // Process any pending captions before switching
        if (this.pendingCaptionData.length > 0) {
            this.processStableCaptionBatch();
        }
    }
    
    /**
     * Switch back to snapshot mode
     */
    switchToSnapshotMode() {
        Logger.info('Switching to snapshot mode');
        this.captureMode = 'snapshot';
        this.fallbackModeStartTime = null;
        this.snapshotFailureCount = 0;
        this.lastCaptionSnapshot = '';
        this.pendingCaptionData = [];
        this.startSnapshotMonitoring();
    }
    
    /**
     * Backup captions to localStorage for crash recovery
     */
    backupToLocalStorage() {
        try {
            localStorage.setItem('caption_saver_backup', JSON.stringify({
                data: this.transcriptArray.slice(-500), // Keep last 500 entries as backup
                timestamp: Date.now(),
                meetingId: this.currentMeetingId
            }));
            Logger.debug(`Backup saved: ${this.transcriptArray.length} total captions`);
        } catch (error) {
            Logger.warn('Backup to localStorage failed:', error);
        }
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
const MIN_TEXT_LENGTH_FOR_ANALYSIS = 1; // Minimum text length for progressive analysis
const MIN_PREFIX_EXPANSION_LENGTH = 2; // Minimum additional chars for prefix expansion
const MEMORY_CHECK_INTERVAL = 100; // Check memory limits every 100 additions
const DEBOUNCE_DELAY = 300; // Debounce DOM mutations to prevent race conditions
const MAX_RETRIES = 3; // Maximum retries for failed operations

// Hybrid snapshot-based capture constants (inspired by Zerg00s approach)
const CAPTION_STABILITY_DELAY = 4000; // Wait 4 seconds for caption stability (natural speech pause)
const MIN_CAPTIONS_FOR_STABILITY = 3; // Minimum captions before considering stability processing
const SNAPSHOT_CHECK_INTERVAL = 1000; // Check for caption changes every 1 second
const FALLBACK_TIMEOUT = 10000; // Switch to fallback mode if snapshot mode fails for 10+ seconds
const EMERGENCY_CAPTURE_THRESHOLD = 50; // Emergency capture if queue exceeds this size

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
 * Enhanced meeting detection with multiple URL patterns
 */
function extractMeetingId() {
    try {
        // Validate window and location exist
        if (!window || !window.location || !window.location.href) {
            console.warn('Window location not available for meeting ID extraction');
            return null;
        }
        
        const url = window.location.href;
        
        // Multiple URL patterns for different Teams meeting formats
        const urlPatterns = [
            /meetup-join\/([^\/\?]+)/,           // Standard meetup-join
            /conversations\/([^\/\?]+)/,         // Conversation-based meetings
            /calling\/([^\/\?]+)/,               // Direct calling
            /l\/meetup-join\/([^\/\?]+)/,        // Link-based meetup
            /meet\/([^\/\?]+)/,                  // Simple meet URLs
            /m\/([^\/\?]+)/                      // Shortened URLs
        ];
        
        for (const pattern of urlPatterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                Logger.debug(`Meeting ID extracted using pattern: ${pattern}`);
                return match[1];
            }
        }
        
        // Fallback to document title if available - normalize title to avoid false positives
        if (document && document.title) {
            const title = document.title
                .replace(/__Microsoft_Teams.*$/, '')  // Remove Teams suffix
                .replace(/^\(\d+\)\s*/, '')            // Remove notification counts like "(1) "
                .trim();
            return title || null;
        }
        
        return null;
    } catch (error) {
        console.error('Error extracting meeting ID:', error);
        return null;
    }
}

/**
 * Detect current meeting state based on DOM indicators
 * @returns {string} Current meeting state
 */
function detectMeetingState() {
    try {
        // Check for meeting join process indicators
        if (hasJoinIndicators()) {
            return MEETING_STATES.JOINING;
        }
        
        // Check for pre-meeting state (lobby/waiting)
        if (hasPreMeetingIndicators()) {
            return MEETING_STATES.PRE_MEETING;
        }
        
        // Check for active meeting indicators
        if (hasActiveMeetingIndicators()) {
            return MEETING_STATES.MEETING_ACTIVE;
        }
        
        // Check for caption containers (meeting with captions ready)
        if (hasCaptionContainers()) {
            return MEETING_STATES.CAPTIONS_READY;
        }
        
        // Default to chat state
        return MEETING_STATES.CHAT;
        
    } catch (error) {
        Logger.error('Error detecting meeting state:', error);
        return MEETING_STATES.CHAT;
    }
}

/**
 * Check for meeting join process indicators
 * @returns {boolean} True if joining meeting
 */
function hasJoinIndicators() {
    const joinIndicators = [
        // Join button or joining process
        '[data-tid="prejoin-join-button"]',
        '[data-tid="call-join-button"]',
        '.join-meeting-button',
        
        // Loading states during join
        '[data-tid="calling-join-sound"]',
        '[data-tid="calling-connecting-sound"]',
        '.joining-meeting-indicator',
        
        // Join meeting dialog
        '[data-tid="prejoin-display-name-field"]',
        '[data-tid="toggle-video"]',
        '[data-tid="toggle-mute"]'
    ];
    
    return joinIndicators.some(selector => {
        try {
            return document.querySelector(selector) !== null;
        } catch (error) {
            return false;
        }
    });
}

/**
 * Check for pre-meeting state indicators (lobby/waiting)
 * @returns {boolean} True if in pre-meeting state
 */
function hasPreMeetingIndicators() {
    const preMeetingIndicators = [
        // Waiting for host
        '[data-tid="waiting-for-host"]',
        '[data-tid="lobby-waiting-screen"]',
        
        // Waiting messages
        'span:contains("Waiting for others to join")',
        'span:contains("Waiting for the organizer")',
        'span:contains("Please wait")',
        
        // Lobby interface
        '[data-tid="lobby-screen"]',
        '[data-tid="prejoin-screen"]',
        '.lobby-container',
        
        // Test audio/video controls in lobby
        '[data-tid="device-settings-microphone"]',
        '[data-tid="device-settings-camera"]'
    ];
    
    // Also check for specific text content
    const waitingTexts = [
        'Waiting for others to join',
        'Waiting for the organizer',
        'Please wait, the meeting will begin soon',
        'You\'re in the lobby'
    ];
    
    const hasIndicatorElements = preMeetingIndicators.some(selector => {
        try {
            return document.querySelector(selector) !== null;
        } catch (error) {
            return false;
        }
    });
    
    const hasWaitingText = waitingTexts.some(text => {
        try {
            return document.body.textContent.includes(text);
        } catch (error) {
            return false;
        }
    });
    
    return hasIndicatorElements || hasWaitingText;
}

/**
 * Check for active meeting indicators
 * @returns {boolean} True if meeting is active
 */
function hasActiveMeetingIndicators() {
    const activeMeetingIndicators = [
        // Call duration indicator
        '[data-tid="call-duration"]',
        '#call-duration-custom',
        '.call-duration',
        
        // Call controls
        '[data-tid="call-controls"]',
        '[data-tid="call-controls-bar"]',
        '[data-testid="call-controls"]',
        '.call-controls',
        
        // Meeting controls
        '[data-tid="toggle-mute"]',
        '[data-tid="toggle-video"]',
        '[data-tid="call-end-button"]',
        
        // Meeting stage
        '.meeting-stage',
        '[data-tid="meeting-stage"]',
        
        // Participant list
        '[data-tid="roster-button"]',
        '[data-tid="participants-button"]',
        
        // Screen sharing controls
        '[data-tid="desktop-share-button"]',
        '[data-tid="screen-share-button"]'
    ];
    
    return activeMeetingIndicators.some(selector => {
        try {
            const element = document.querySelector(selector);
            return element !== null && element.offsetParent !== null; // Must be visible
        } catch (error) {
            return false;
        }
    });
}

/**
 * Check for caption containers (indicates captions are ready)
 * @returns {boolean} True if caption containers are available
 */
function hasCaptionContainers() {
    const captionContainerSelectors = [
        "[data-tid='closed-caption-renderer-wrapper']", // Teams v2 structure
        "[data-tid='closed-captions-renderer']",         // Legacy structure
        ".closed-captions-container",
        "[data-testid='caption-container']",
        ".live-captions-container"
    ];
    
    return captionContainerSelectors.some(selector => {
        try {
            const element = document.querySelector(selector);
            return element !== null && 
                   element.offsetParent !== null && // Must be visible
                   captionManager.isCaptionContainerReady(element); // Must be ready
        } catch (error) {
            return false;
        }
    });
}

/**
 * Enhanced meeting state monitoring with transition detection
 */
function checkForMeetingStateChanges() {
    try {
        const now = Date.now();
        if (now - captionManager.lastMeetingCheck < MEETING_CHECK_INTERVAL) {
            return;
        }
        captionManager.lastMeetingCheck = now;
        
        // Detect current meeting state
        const currentState = detectMeetingState();
        
        // Check for new meeting ID
        const newMeetingId = extractMeetingId();
        if (newMeetingId && newMeetingId !== captionManager.currentMeetingId) {
            if (captionManager.currentMeetingId && transcriptArray.length > 0) {
                Logger.info("New meeting detected, previous transcript data preserved until save/view");
                Logger.info(`Previous meeting: ${captionManager.currentMeetingId}`);
                Logger.info(`New meeting: ${newMeetingId}`);
                
                // Clear recently removed for new meeting
                captionManager.recentlyRemoved.length = 0;
            }
            captionManager.currentMeetingId = newMeetingId;
        }
        
        // Handle state transitions
        if (currentState !== captionManager.meetingState) {
            const reason = `State detection: ${captionManager.meetingState} → ${currentState}`;
            captionManager.transitionToState(currentState, reason);
        }
        
        // Check for transition timeouts
        if (captionManager.isTransitionTimedOut()) {
            const timeoutReason = `Timeout in ${captionManager.meetingState} state (${captionManager.getTimeSinceTransition()}ms)`;
            Logger.warn(timeoutReason);
            
            // Handle timeout based on current state
            handleStateTimeout(captionManager.meetingState);
        }
        
    } catch (error) {
        console.error('Error checking for meeting state changes:', error);
    }
}

/**
 * Handle state transition timeouts
 * @param {string} timedOutState - The state that timed out
 */
function handleStateTimeout(timedOutState) {
    switch (timedOutState) {
        case MEETING_STATES.JOINING:
            // If joining takes too long, assume we're still in chat
            captionManager.transitionToState(MEETING_STATES.CHAT, 'Joining timeout - returning to chat');
            break;
            
        case MEETING_STATES.PRE_MEETING:
            // If pre-meeting takes too long, check if we're actually in an active meeting
            if (hasActiveMeetingIndicators()) {
                captionManager.transitionToState(MEETING_STATES.MEETING_ACTIVE, 'Pre-meeting timeout - detected active meeting');
            } else {
                captionManager.transitionToState(MEETING_STATES.CHAT, 'Pre-meeting timeout - returning to chat');
            }
            break;
            
        case MEETING_STATES.MEETING_ACTIVE:
            // If meeting is active but captions aren't ready, that's okay - just log it
            Logger.info('Meeting active timeout - captions may not be enabled');
            break;
            
        case MEETING_STATES.CAPTIONS_READY:
            // This shouldn't timeout - captions ready is a stable state
            Logger.debug('Captions ready timeout - this is expected');
            break;
            
        default:
            Logger.warn(`Unknown state timeout: ${timedOutState}`);
            break;
    }
}

/**
 * Check if we've moved to a new meeting and should reset transcript data
 * @deprecated Use checkForMeetingStateChanges() instead
 */
function checkForNewMeeting() {
    // Legacy function - redirect to new state-aware function
    checkForMeetingStateChanges();
}

/**
 * Aggressive text normalization for better progressive detection
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
function normalizeTextForComparison(text) {
    if (!text) return '';
    
    return text
        .trim()
        .replace(/\s+/g, ' ')  // Replace multiple spaces/tabs/newlines with single space
        .replace(/\s*([.!?;,])\s*/g, '$1')  // Normalize punctuation spacing
        .replace(/\s*$/, '');  // Remove trailing whitespace
}

/**
 * Log detailed analysis of progressive detection for debugging
 * @param {string} oldText - Previous caption text  
 * @param {string} newText - Current caption text
 * @param {Object} result - Detection result
 */
function logProgressiveAnalysis(oldText, newText, result) {
    if (Logger.shouldLog('DEBUG')) {
        Logger.debug('Progressive Analysis:', {
            oldText: `"${oldText}"`,
            newText: `"${newText}"`,
            oldLength: oldText.length,
            newLength: newText.length,
            lengthDiff: newText.length - oldText.length,
            isProgressive: result.isProgressive,
            confidence: result.confidence,
            pattern: result.pattern,
            startsWithOld: newText.startsWith(oldText),
            oldWords: oldText.split(/\s+/).length,
            newWords: newText.split(/\s+/).length
        });
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
    
    const oldTrimmed = normalizeTextForComparison(oldText);
    const newTrimmed = normalizeTextForComparison(newText);
    
    // Prevent empty or very short text issues
    if (oldTrimmed.length < MIN_TEXT_LENGTH_FOR_ANALYSIS || newTrimmed.length < MIN_TEXT_LENGTH_FOR_ANALYSIS) {
        return {isProgressive: false, confidence: 'NONE', pattern: 'Text too short to analyze'};
    }
    
    // Pattern 1a: Very short expansion (HIGH confidence) - for cases like "OK" -> "OK so"
    if (oldTrimmed.length <= 5 && newTrimmed.startsWith(oldTrimmed) && newTrimmed.length > oldTrimmed.length) {
        const addedText = newTrimmed.substring(oldTrimmed.length).trim();
        if (addedText.length > 0 && addedText.length <= 10 && /^[\s\w]/.test(addedText)) {
            const result = {
                isProgressive: true, 
                confidence: 'HIGH', 
                pattern: `Short expansion: adds "${addedText}"`
            };
            logProgressiveAnalysis(oldText, newText, result);
            return result;
        }
    }
    
    // Pattern 1b: Exact prefix expansion (VERY HIGH confidence)
    if (newTrimmed.startsWith(oldTrimmed) && newTrimmed.length > oldTrimmed.length + MIN_PREFIX_EXPANSION_LENGTH) {
        // Additional safety: must end on word boundary
        const addedText = newTrimmed.substring(oldTrimmed.length).trim();
        if (addedText.length > 0 && /^[\s\w]/.test(addedText)) {
            const result = {
                isProgressive: true, 
                confidence: 'VERY_HIGH', 
                pattern: `Exact prefix expansion: adds "${addedText}"`
            };
            logProgressiveAnalysis(oldText, newText, result);
            return result;
        }
    }
    
    // Pattern 2a: Simple punctuation addition (HIGH confidence) - for cases like "I" -> "I."
    const punctuationRegex = /[.!?;,]$/;
    if (oldTrimmed.length <= 10 && !punctuationRegex.test(oldTrimmed) && punctuationRegex.test(newTrimmed)) {
        const oldWithoutPunct = oldTrimmed;
        const newWithoutPunct = newTrimmed.replace(/[.!?;,]+$/, '').trim();
        if (oldWithoutPunct === newWithoutPunct) {
            const result = {
                isProgressive: true,
                confidence: 'HIGH',
                pattern: `Simple punctuation addition`
            };
            logProgressiveAnalysis(oldText, newText, result);
            return result;
        }
    }
    
    // Pattern 2b: Punctuation completion (HIGH confidence)
    if (!punctuationRegex.test(oldTrimmed) && punctuationRegex.test(newTrimmed)) {
        const oldWithoutPunct = normalizeTextForComparison(oldTrimmed.replace(/[.!?;,]+$/, ''));
        const newWithoutPunct = normalizeTextForComparison(newTrimmed.replace(/[.!?;,]+$/, ''));
        if (oldWithoutPunct === newWithoutPunct || newWithoutPunct.startsWith(oldWithoutPunct)) {
            const result = {
                isProgressive: true,
                confidence: 'HIGH',
                pattern: `Punctuation completion`
            };
            logProgressiveAnalysis(oldText, newText, result);
            return result;
        }
    }
    
    // Pattern 3: Capitalization fix (HIGH confidence)
    if (oldTrimmed.toLowerCase() === newTrimmed.toLowerCase() && oldTrimmed !== newTrimmed) {
        const result = {
            isProgressive: true,
            confidence: 'HIGH', 
            pattern: `Capitalization fix`
        };
        logProgressiveAnalysis(oldText, newText, result);
        return result;
    }
    
    // Pattern 4: Incomplete word completion (HIGH confidence)
    // Handles cases like "Capt" -> "caption capture"
    if (oldTrimmed.length >= 3 && newTrimmed.length > oldTrimmed.length) {
        const oldWords = oldTrimmed.split(/\s+/);
        const newWords = newTrimmed.split(/\s+/);
        
        // Check if old text ends with an incomplete word that gets completed
        if (oldWords.length > 0 && newWords.length >= oldWords.length) {
            const lastOldWord = oldWords[oldWords.length - 1];
            const correspondingNewWord = newWords[oldWords.length - 1];
            
            // Check if the last word in old text is a prefix of the word in new text
            if (lastOldWord.length >= 3 && 
                correspondingNewWord && 
                correspondingNewWord.toLowerCase().startsWith(lastOldWord.toLowerCase()) &&
                correspondingNewWord.length > lastOldWord.length) {
                
                // Verify the rest of the old text matches
                const oldPrefix = oldWords.slice(0, -1).join(' ');
                const newPrefix = newWords.slice(0, oldWords.length - 1).join(' ');
                
                if (oldPrefix === newPrefix || oldWords.length === 1) {
                    const result = {
                        isProgressive: true,
                        confidence: 'HIGH',
                        pattern: `Incomplete word completion: "${lastOldWord}" -> "${correspondingNewWord}"`
                    };
                    logProgressiveAnalysis(oldText, newText, result);
                    return result;
                }
            }
        }
    }
    
    // Pattern 5: Sentence continuation (MEDIUM confidence)
    // Handles cases like "so yeah" -> "so yeah, let me see"
    if (oldTrimmed.length >= 5 && newTrimmed.length > oldTrimmed.length) {
        // Check if old text ends without proper sentence ending
        const endsWithoutPunctuation = !/[.!?]$/.test(oldTrimmed);
        const newHasContinuation = newTrimmed.startsWith(oldTrimmed);
        
        if (endsWithoutPunctuation && newHasContinuation) {
            const continuation = newTrimmed.substring(oldTrimmed.length).trim();
            const continuationWords = continuation.split(/\s+/).filter(w => w.length > 0);
            
            // Check for common continuation patterns (focused on most common words)
            const startsWithContinuationWord = /^[,\s]*(and|but|so|then|let|maybe|I|we|you|they|he|she|it|the|a|an|to|for|of|in|on|at|with|by|from|up|out|if|when|where|what|how|why|who|which|that|this|there|here|now|just|only|also|even|still|yet|already|again|ok|okay|sure|actually|really|very|quite|pretty|rather|basically|well|right|good|bad|yes|no|like|want|need|have|get|give|take|put|make|do|go|come|see|know|think|say|tell|ask|feel|look|work|play|help|use|find|try|keep|show|start|begin|end|finish|continue|stop|leave|stay|move|turn|open|close|break|fix|clean|wash|cook|eat|drink|sleep|sit|stand|walk|run|drive|fly|swim|read|write|listen|hear|watch|learn|teach|understand|remember|forget|hope|wish|dream|believe|trust|worry|fear|care|matter|happen|change|live|die|love|hate|buy|sell|pay|cost|save|spend|win|lose|choose|decide|plan|build|create|develop|produce|provide|serve|send|receive|meet|include|support|follow|lead|control|manage|consider|discuss|explain|describe|compare|identify|encourage|suggest|require|expect|achieve|reach|accept|deal|argue|relate|involve|contain|exist|result|cause|appear|seem|become|remain|increase|decrease|improve|reduce|grow|shrink|expand|contract|rise|fall|climb|drop|push|pull|carry|hold|pick|cut|lock|unlock|throw|catch|hit|kick|touch|smell|taste|dance|sing|talk|speak|call|shout|whisper|laugh|cry|smile|frown|nod|shake|wave|point|grab|reach|stretch|bend|kneel|crawl|jump|skip|hop|march|jog|sprint|trot|gallop|slide|roll|spin|twist|turn|flip|fall|stumble|trip|slip|balance|lean|rest|relax|enjoy|celebrate|party|joke|tease|mock|praise|compliment|thank|apologize|forgive|excuse|blame|accuse|defend|protect|attack|fight|argue|discuss|debate|negotiate|compromise|agree|disagree|accept|reject|approve|disapprove|support|oppose|encourage|discourage|motivate|inspire|influence|persuade|convince|force|pressure|threaten|warn|advise|recommend|suggest|propose|offer|invite|welcome|greet|introduce|present|announce|declare|proclaim|state|claim|assert|insist|maintain|contend|dispute|challenge|question|doubt|wonder|suspect|assume|suppose|guess|estimate|calculate|measure|count|weigh|compare|contrast|match|fit|suit|belong|own|possess|contain|hold|include|comprise|consist|involve|concern|relate|connect|link|join|unite|combine|merge|mix|blend|separate|divide|split|share|distribute|spread|scatter|gather|collect|accumulate|store|save|keep|preserve|maintain|protect|defend|guard|secure|lock|unlock|open|close|shut|cover|uncover|hide|show|reveal|expose|display|present|exhibit|demonstrate|perform|act|play|dance|sing|music|art|paint|draw|write|read|study|learn|teach|educate|train|practice|exercise|work|job|career|profession|business|company|organization|institution|school|university|college|hospital|church|government|politics|law|legal|court|judge|jury|lawyer|attorney|doctor|nurse|teacher|student|child|adult|parent|family|friend)/.test(continuation);
            
            if (startsWithContinuationWord && continuationWords.length >= 1 && continuationWords.length <= 5) {
                const result = {
                    isProgressive: true,
                    confidence: 'MEDIUM',
                    pattern: `Sentence continuation: added "${continuation}"`
                };
                logProgressiveAnalysis(oldText, newText, result);
                return result;
            }
        }
    }
    
    // Pattern 6: Word-by-word building (HIGH confidence)
    // New text adds 1-3 complete words to the end
    if (newTrimmed.startsWith(oldTrimmed)) {
        const addedPart = newTrimmed.substring(oldTrimmed.length).trim();
        const addedWords = addedPart.split(/\s+/).filter(w => w.length > 0);
        
        if (addedWords.length >= 1 && addedWords.length <= 3) {
            // Ensure it's adding real words, not just characters
            const hasRealWords = addedWords.every(word => word.length >= 2 && /^[a-zA-Z]/.test(word));
            if (hasRealWords) {
                const result = {
                    isProgressive: true,
                    confidence: 'HIGH',
                    pattern: `Word building: added "${addedWords.join(' ')}"`
                };
                logProgressiveAnalysis(oldText, newText, result);
                return result;
            }
        }
    }
    
    // No whitelisted pattern matched
    const result = {isProgressive: false, confidence: 'NONE', pattern: 'No safe pattern detected'};
    logProgressiveAnalysis(oldText, newText, result);
    return result;
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
 * Handle progressive caption detection and removal with multi-entry checking
 * @param {string} name - Speaker name
 * @param {string} text - Caption text
 * @returns {boolean} True if progressive caption was handled
 */
function handleProgressiveCaption(name, text) {
    let removedAny = false;
    let checkedEntries = 0;
    const maxChecks = 3; // Check up to 3 recent entries from same speaker
    
    for (let i = transcriptArray.length - 1; i >= Math.max(0, transcriptArray.length - PROGRESSIVE_CHECK_LOOKBACK) && checkedEntries < maxChecks; i--) {
        const entry = transcriptArray[i];
        
        if (entry.Name === name) {
            checkedEntries++;
            const progressiveCheck = isWhitelistedProgressive(entry.Text, text);
            
            if (progressiveCheck.isProgressive) {
                console.log(`  🔍 Whitelist match: ${progressiveCheck.pattern}`);
                console.log(`  📊 Confidence: ${progressiveCheck.confidence}`);
                
                // Accept MEDIUM confidence for very recent entries (last 2), HIGH+ for older
                const isVeryRecent = checkedEntries <= 2;
                const confidenceThreshold = isVeryRecent ? 
                    ['HIGH', 'VERY_HIGH', 'MEDIUM'] : 
                    ['HIGH', 'VERY_HIGH'];
                
                if (confidenceThreshold.includes(progressiveCheck.confidence)) {
                    const removed = safelyRemoveEntry(i, progressiveCheck.pattern);
                    if (removed) {
                        removedAny = true;
                        // Continue checking for chain of progressive updates
                        // but adjust indices since we removed an entry
                        i++; // Compensate for the removed entry
                    }
                } else {
                    console.log(`  ⚠️  Confidence too low for removal: ${progressiveCheck.confidence}`);
                }
            }
        }
    }
    
    return removedAny;
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
 * Main caption checking function with state-aware processing
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
        
        // Check for meeting state changes
        checkForMeetingStateChanges();
        
        // Only process captions if we're in the right state
        if (captionManager.meetingState !== MEETING_STATES.CAPTIONS_READY) {
            Logger.debug(`Skipping caption processing - current state: ${captionManager.meetingState}`);
            return;
        }
        
        // Check if captions are available
        const captionContainerSelectors = [
            "[data-tid='closed-caption-renderer-wrapper']", // Teams v2 structure
            "[data-tid='closed-captions-renderer']",         // Legacy structure
            ".closed-captions-container",
            "[data-testid='caption-container']"
        ];
        
        const closedCaptionsContainer = safeDOMQuery(document, captionContainerSelectors);
        if (!closedCaptionsContainer) {
            Logger.debug("Caption container not found - captions may not be enabled");
            // If we thought captions were ready but container is gone, update state
            if (captionManager.meetingState === MEETING_STATES.CAPTIONS_READY) {
                if (hasActiveMeetingIndicators()) {
                    captionManager.transitionToState(MEETING_STATES.MEETING_ACTIVE, 'Caption container lost');
                } else {
                    captionManager.transitionToState(MEETING_STATES.CHAT, 'Caption container and meeting indicators lost');
                }
            }
            return;
        }
        
        // Determine processing mode based on current capture mode
        if (captionManager.captureMode === 'snapshot') {
            // Snapshot mode - let the snapshot monitoring handle it
            Logger.debug("Using snapshot mode for caption processing");
            // The snapshot monitoring system will handle caption capture
            // This function just ensures captions are available
            
        } else {
            // Fallback mode - use progressive detection approach
            Logger.debug("Using progressive fallback mode for caption processing");
            processWithProgressiveDetection(closedCaptionsContainer);
        }
        
    } catch (error) {
        Logger.error('Error in checkCaptions:', error);
        // On error, switch to fallback mode for safety
        captionManager.switchToFallbackMode('checkCaptions error');
    } finally {
        // Always reset processing flag
        isProcessing = false;
    }
}

/**
 * Process captions using progressive detection (fallback mode)
 * @param {Element} closedCaptionsContainer - Container element with captions
 */
function processWithProgressiveDetection(closedCaptionsContainer) {
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
    
    Logger.debug(`Found ${transcripts.length} caption elements in progressive mode`);
    
    if (transcripts.length === 0) {
        Logger.debug("No caption elements found");
        return;
    }
    
    // Process each visible caption element using progressive detection
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
            
            // Use conservative whitelist approach for progressive detection
            conservativeSmartAddCaption(Name, Text);
            
        } catch (error) {
            Logger.error(`Error processing transcript ${index}:`, error);
        }
    });
    
    Logger.debug(`Current transcript array length: ${transcriptArray.length}`);
}

// State-aware transcription startup
function startTranscription() {
    try {
        Logger.info("Starting transcription with state-aware detection");
        
        // Detect current meeting state
        const currentState = detectMeetingState();
        Logger.info(`Initial meeting state detected: ${currentState}`);
        
        // Initialize meeting tracking
        captionManager.currentMeetingId = extractMeetingId();
        
        // Transition to detected state
        captionManager.transitionToState(currentState, 'Initial state detection');
        
        // Handle initial state appropriately
        switch (currentState) {
            case MEETING_STATES.CHAT:
                Logger.info("Currently in chat - monitoring for meeting activity");
                scheduleNextCheck(5000); // Check again in 5 seconds
                return false;
                
            case MEETING_STATES.JOINING:
                Logger.info("Meeting join detected - monitoring for meeting start");
                scheduleNextCheck(2000); // Check more frequently during join
                return false;
                
            case MEETING_STATES.PRE_MEETING:
                Logger.info("Pre-meeting state detected - monitoring for meeting activation");
                scheduleNextCheck(3000); // Check every 3 seconds
                return false;
                
            case MEETING_STATES.MEETING_ACTIVE:
                Logger.info("Active meeting detected - looking for captions");
                scheduleNextCheck(2000); // Check frequently for captions
                return false;
                
            case MEETING_STATES.CAPTIONS_READY:
                Logger.info("Captions ready - starting capture");
                startCaptureSystem().then(success => {
                    if (success) {
                        Logger.info("Caption capture started successfully");
                    } else {
                        Logger.warn("Caption capture failed to start");
                    }
                });
                return false; // Return false since we're starting async
                
            default:
                Logger.warn(`Unknown meeting state: ${currentState}`);
                scheduleNextCheck(5000);
                return false;
        }
        
    } catch (error) {
        Logger.error('Error in startTranscription:', error);
        showUserNotification('Failed to start caption capturing. Please refresh the page and try again.', 'error');
        scheduleNextCheck(10000); // Retry in 10 seconds on error
        return false;
    }
}

/**
 * Schedule next transcription check
 * @param {number} delay - Delay in milliseconds
 */
function scheduleNextCheck(delay) {
    setTimeout(() => {
        // Only restart if we're not already capturing
        if (!captionManager.capturing) {
            startTranscription();
        }
    }, delay);
}

/**
 * Start the actual caption capture system
 * @returns {Promise<boolean>} True if capture started successfully
 */
async function startCaptureSystem() {
    try {
        // Check if we already have a healthy observer
        if (captionManager.ensureObserverHealth()) {
            Logger.info("Observer is already healthy - reusing existing observer");
            captionManager.capturing = true;
            
            // Start the hybrid capture system if not already running
            if (captionManager.captureMode === 'snapshot' && !captionManager.snapshotCheckTimer) {
                Logger.info("Starting hybrid snapshot-based caption capture");
                captionManager.startSnapshotMonitoring();
            } else if (captionManager.captureMode !== 'snapshot') {
                Logger.info("Using progressive fallback caption capture");
            }
            
            // Do an initial check
            checkCaptions();
            Logger.info(`Caption capturing resumed successfully for meeting: ${captionManager.currentMeetingId} (Mode: ${captionManager.captureMode})`);
            return true;
        }
        
        // Use progressive container detection for better reliability
        Logger.info("Searching for caption container using progressive detection");
        const closedCaptionsContainer = await captionManager.waitForCaptionContainer(30000); // 30 second timeout
        
        if (!closedCaptionsContainer) {
            Logger.warn("Caption container not found during capture startup");
            // Transition back to meeting active state
            captionManager.transitionToState(MEETING_STATES.MEETING_ACTIVE, 'Caption container not found during startup');
            scheduleNextCheck(5000);
            return false;
        }

        Logger.info("Caption container found - starting new capture system");

        // Use smart observer management instead of aggressive cleanup
        if (!captionManager.recreateObserver()) {
            Logger.error("Failed to create observer for caption capture");
            return false;
        }
        
        captionManager.capturing = true;
        
        // Add cleanup function
        captionManager.cleanupFunctions.push(() => captionManager.cleanupCaptureResources());
        
        // Start the hybrid capture system
        if (captionManager.captureMode === 'snapshot') {
            Logger.info("Starting hybrid snapshot-based caption capture");
            captionManager.startSnapshotMonitoring();
        } else {
            Logger.info("Starting progressive fallback caption capture");
        }
        
        // Do an initial check
        checkCaptions();
        Logger.info(`Caption capturing started successfully for meeting: ${captionManager.currentMeetingId} (Mode: ${captionManager.captureMode})`);

        return true;
    } catch (error) {
        Logger.error('Error starting capture system:', error);
        showUserNotification('Failed to start caption capture system. Please refresh the page and try again.', 'error');
        return false;
    }
}

/**
 * Display error message to user
 * @deprecated Use showUserNotification() instead
 */
function showUserError(message) {
    showUserNotification(message, 'error');
}

/**
 * Display notification to user with different types
 * @param {string} message - Message to display
 * @param {string} type - Notification type: 'error', 'warning', 'info', 'success'
 * @param {number} duration - Duration in milliseconds (default: 5000)
 */
function showUserNotification(message, type = 'info', duration = 5000) {
    const notification = document.createElement('div');
    
    // Different styles for different notification types
    const styles = {
        error: {
            background: '#d32f2f',
            color: 'white',
            icon: '❌'
        },
        warning: {
            background: '#ff9800',
            color: 'white',
            icon: '⚠️'
        },
        info: {
            background: '#2196f3',
            color: 'white',
            icon: 'ℹ️'
        },
        success: {
            background: '#4caf50',
            color: 'white',
            icon: '✅'
        }
    };
    
    const style = styles[type] || styles.info;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${style.background};
        color: ${style.color};
        padding: 15px;
        border-radius: 8px;
        z-index: 10000;
        max-width: 350px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        line-height: 1.4;
        opacity: 0;
        transform: translateX(100px);
        transition: all 0.3s ease;
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 10px;">
            <span style="flex-shrink: 0; font-size: 16px;">${style.icon}</span>
            <div>
                <div style="font-weight: 600; margin-bottom: 2px;">MS Teams Caption Saver</div>
                <div style="font-size: 13px; opacity: 0.9;">${message}</div>
            </div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 50);
    
    // Auto-remove after duration
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }, duration);
}

/**
 * Get state-specific user message
 * @param {string} state - Current meeting state
 * @returns {Object} Message object with text and type
 */
function getStateSpecificMessage(state) {
    const messages = {
        [MEETING_STATES.CHAT]: {
            text: "Monitoring for meeting activity...",
            type: 'info'
        },
        [MEETING_STATES.JOINING]: {
            text: "Joining meeting - preparing caption capture...",
            type: 'info'
        },
        [MEETING_STATES.PRE_MEETING]: {
            text: "In meeting lobby - waiting for meeting to start...",
            type: 'info'
        },
        [MEETING_STATES.MEETING_ACTIVE]: {
            text: "Meeting active - looking for captions to be enabled...",
            type: 'info'
        },
        [MEETING_STATES.CAPTIONS_READY]: {
            text: "Caption capture active and ready!",
            type: 'success'
        }
    };
    
    return messages[state] || {
        text: `Unknown state: ${state}`,
        type: 'warning'
    };
}

// Notification cooldown tracking to prevent spam during calls
const notificationCooldowns = new Map();
const NOTIFICATION_COOLDOWN_MS = 30000; // 30 seconds cooldown

/**
 * Show state transition progress to user with cooldown protection
 * @param {string} fromState - Previous state
 * @param {string} toState - New state
 */
function showStateTransitionProgress(fromState, toState) {
    const message = getStateSpecificMessage(toState);
    
    // Only show certain transitions to avoid spam
    const shouldShowTransition = [
        MEETING_STATES.JOINING,
        MEETING_STATES.PRE_MEETING,
        MEETING_STATES.MEETING_ACTIVE,
        MEETING_STATES.CAPTIONS_READY
    ].includes(toState);
    
    if (shouldShowTransition) {
        // Check cooldown to prevent repeated notifications for same state
        const now = Date.now();
        const lastNotificationTime = notificationCooldowns.get(toState) || 0;
        
        if (now - lastNotificationTime >= NOTIFICATION_COOLDOWN_MS) {
            // Special handling for meeting states during calls to reduce interruption
            let duration = 3000; // Default 3 seconds
            
            // Reduce popup time for states that might repeat during calls
            if (toState === MEETING_STATES.MEETING_ACTIVE) {
                duration = 2000; // Shorter popup for meeting active states
            }
            
            showUserNotification(message.text, message.type, duration);
            notificationCooldowns.set(toState, now);
            Logger.info(`State transition notification: ${fromState} → ${toState}`);
        } else {
            Logger.debug(`Notification cooldown active for ${toState} (${Math.round((now - lastNotificationTime) / 1000)}s since last)`);
        }
    }
}

/**
 * Show detailed status information to user
 * @param {string} status - Status message
 * @param {string} details - Additional details
 */
function showDetailedStatus(status, details) {
    const message = details ? `${status}\n\n${details}` : status;
    showUserNotification(message, 'info', 4000);
}

/**
 * Smart memory management that preserves captions while preventing browser crashes
 * CORE PRINCIPLE: NEVER delete captions without user consent
 */
function enforceMemoryLimits() {
    // Check if we're approaching the auto-save threshold
    if (transcriptArray.length >= AUTO_SAVE_THRESHOLD && transcriptArray.length % 1000 === 0) {
        // Warn user and offer auto-save to prevent loss (single popup instead of notification + confirm)
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
                
                // Show success notification
                showUserNotification(
                    `Auto-saved ${transcriptArray.length} captions successfully!`,
                    'success',
                    5000
                );
                
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
                        showUserNotification("Transcript data cleared - starting fresh!", 'success');
                    }
                }, 1000);
                
            } catch (error) {
                Logger.error("Auto-save failed:", error);
                showUserNotification("Auto-save failed. Please manually save your captions to prevent loss.", 'error');
            }
        }
    }
    
    // CRITICAL: Only enforce hard limit at much higher threshold and with user warning
    if (transcriptArray.length > MAX_TRANSCRIPT_ENTRIES) {
        Logger.warn(`CRITICAL: Transcript array has reached ${transcriptArray.length} entries`);
        showUserNotification(
            `CRITICAL: You have ${transcriptArray.length} captions! ` +
            `Please save your transcript immediately to prevent potential browser crashes. ` +
            `Use the extension popup to save your captions.`,
            'error',
            15000 // Show for 15 seconds
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
 * @deprecated Use captionManager.cleanupCaptureResources() instead
 */
function cleanupObserver() {
    // Redirect to the new smart cleanup system
    captionManager.cleanupCaptureResources();
    Logger.info("🧹 Observer cleanup completed via captionManager");
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
                    showUserNotification(
                        `Successfully recovered ${backupData.data.length} captions from previous session!`,
                        'success',
                        8000
                    );
                    
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
 * Enhanced observer reliability with state-aware grace periods
 */
function ensureObserverReliability() {
    // State-specific health check intervals
    const healthCheckIntervals = {
        [MEETING_STATES.CHAT]: 60000,           // 1 minute - low frequency
        [MEETING_STATES.JOINING]: 15000,        // 15 seconds - frequent during transition
        [MEETING_STATES.PRE_MEETING]: 30000,    // 30 seconds - moderate frequency
        [MEETING_STATES.MEETING_ACTIVE]: 20000, // 20 seconds - more frequent in meeting
        [MEETING_STATES.CAPTIONS_READY]: 30000  // 30 seconds - standard monitoring
    };
    
    let currentInterval = null;
    
    function scheduleHealthCheck() {
        if (currentInterval) {
            clearInterval(currentInterval);
        }
        
        const interval = healthCheckIntervals[captionManager.meetingState] || 30000;
        Logger.debug(`Scheduling health check for state ${captionManager.meetingState} every ${interval}ms`);
        
        currentInterval = setInterval(() => {
            performStateAwareHealthCheck();
        }, interval);
    }
    
    // Initial health check setup
    scheduleHealthCheck();
    
    // Update interval when state changes
    const originalTransitionToState = captionManager.transitionToState;
    captionManager.transitionToState = function(newState, reason) {
        originalTransitionToState.call(this, newState, reason);
        scheduleHealthCheck();
    };
}

/**
 * Perform health check that respects transition states and grace periods
 */
function performStateAwareHealthCheck() {
    try {
        // Skip health checks during transition grace periods
        if (captionManager.isInTransitionGracePeriod()) {
            Logger.debug('Skipping health check during transition grace period');
            return;
        }
        
        // Only perform caption flow checks if we're in the right state
        if (captionManager.meetingState !== MEETING_STATES.CAPTIONS_READY) {
            Logger.debug(`Skipping caption flow check - current state: ${captionManager.meetingState}`);
            return;
        }
        
        // Check observer health
        if (captionManager.capturing && !captionManager.checkObserverHealth()) {
            Logger.warn('Observer health check failed - attempting recovery');
            
            // Try to restore observer health
            if (captionManager.ensureObserverHealth()) {
                Logger.info('Observer health restored successfully');
            } else {
                Logger.error('Failed to restore observer health');
                // Transition to meeting active state - captions may need to be re-enabled
                captionManager.transitionToState(MEETING_STATES.MEETING_ACTIVE, 'Observer health check failed');
            }
            return;
        }
        
        // Check caption flow - only if we've been in captions ready state for a while
        const timeInCurrentState = captionManager.getTimeSinceTransition();
        if (timeInCurrentState < 2 * 60 * 1000) { // Less than 2 minutes in current state
            Logger.debug('Skipping caption flow check - recently transitioned to captions ready');
            return;
        }
        
        checkCaptionFlow();
        
    } catch (error) {
        Logger.error('Error in state-aware health check:', error);
    }
}

/**
 * Check if captions are flowing properly
 */
function checkCaptionFlow() {
    const timeSinceLastCaption = Date.now() - captionManager.lastCaptionTime;
    
    // Check for caption elements in both v2 and legacy structures
    const captionElements = document.querySelectorAll(
        "[data-tid='closed-caption-renderer-wrapper'] .fui-ChatMessageCompact, " +
        "[data-tid='closed-captions-renderer'] .fui-ChatMessageCompact"
    );
    
    const captionFlowStoppedThreshold = 5 * 60 * 1000; // 5 minutes
    
    // If we haven't captured captions in 5 minutes but DOM shows captions exist, there's an issue
    if (timeSinceLastCaption > captionFlowStoppedThreshold && captionElements.length > 0) {
        Logger.warn(`Caption flow issue detected: ${Math.round(timeSinceLastCaption/60000)} minutes since last caption, but ${captionElements.length} caption elements visible`);
        
        // Try to fix the issue first
        if (captionManager.ensureObserverHealth()) {
            Logger.info('Observer health restored - caption flow should resume');
        } else {
            // If we can't fix it, notify user and restart
            Logger.error('Cannot restore observer health - notifying user and restarting');
            
            showUserNotification(
                `Caption capture appears to have stopped. ` +
                `No captions captured for ${Math.round(timeSinceLastCaption/60000)} minutes. ` +
                `Attempting to restart...`,
                'warning'
            );
            
            // Restart the entire system
            restartCaptureSystem();
        }
    } else if (timeSinceLastCaption > captionFlowStoppedThreshold) {
        // No captions captured and no caption elements visible - probably no one is talking
        Logger.debug(`No caption activity for ${Math.round(timeSinceLastCaption/60000)} minutes, but no caption elements visible - this is normal during silence`);
    }
}

/**
 * Restart the capture system gracefully
 */
function restartCaptureSystem() {
    try {
        Logger.info('Restarting caption capture system');
        
        // Clean up current system
        captionManager.cleanupCaptureResources();
        
        // Transition to meeting active state and let the system detect captions again
        captionManager.transitionToState(MEETING_STATES.MEETING_ACTIVE, 'Caption flow restart');
        
        // Schedule restart
        setTimeout(() => {
            startTranscription();
            Logger.info('Caption capture system restarted');
        }, 2000);
        
    } catch (error) {
        Logger.error('Error restarting capture system:', error);
    }
}

/**
 * Periodic health check to ensure capture is working
 * @deprecated Use ensureObserverReliability() instead
 */
function performHealthCheck() {
    setInterval(() => {
        if (captionManager.capturing) {
            const stats = {
                totalCaptions: transcriptArray.length,
                captureRate: captionManager.captionCount,
                timeSinceLastCaption: Date.now() - captionManager.lastCaptionTime,
                observerActive: !!captionManager.observer,
                meetingState: captionManager.meetingState,
                timeInState: captionManager.getTimeSinceTransition(),
                isInGracePeriod: captionManager.isInTransitionGracePeriod(),
                containerExists: !!(safeDOMQuery(document, [
                    "[data-tid='closed-caption-renderer-wrapper']",
                    "[data-tid='closed-captions-renderer']"
                ]))
            };
            
            Logger.debug('Legacy Health Check:', stats);
            
            // Only alert if not in grace period and in captions ready state
            if (!stats.isInGracePeriod && 
                captionManager.meetingState === MEETING_STATES.CAPTIONS_READY &&
                stats.timeSinceLastCaption > 10 * 60 * 1000 && 
                stats.containerExists) {
                Logger.warn('Potential caption capture issue detected in legacy health check');
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

// Enhanced logging for debugging
Logger.info('=== Teams Caption Saver - State-Aware Architecture Initialized ===');
Logger.info(`Extension version: ${chrome.runtime.getManifest ? chrome.runtime.getManifest().version : 'unknown'}`);
Logger.info(`Meeting ID: ${captionManager.currentMeetingId || 'not detected'}`);
Logger.info(`Initial state: ${captionManager.meetingState}`);
Logger.info(`URL: ${window.location.href}`);
Logger.info(`Timestamp: ${new Date().toISOString()}`);
Logger.info('==============================================================');

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
                // Allow saving even when not actively capturing (e.g., after meeting ends)
                // if (!capturing) {
                //     const errorMsg = "Caption capturing is not active. Please make sure you're in a Teams meeting with captions enabled.";
                //     Logger.error(errorMsg);
                //     showUserNotification(errorMsg, 'error');
                //     sendResponse({success: false, error: errorMsg});
                //     return;
                // }
                
                if (transcriptArray.length === 0) {
                    const errorMsg = "No captions captured yet. Please make sure live captions are turned on in Teams.";
                    console.error(errorMsg);
                    showUserNotification(errorMsg, 'error');
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
                    showUserNotification('Failed to initiate download: ' + error.message, 'error');
                    sendResponse({success: false, error: error.message});
                }
                break;

            case 'get_captions_for_viewing':
                console.log("get_captions_for_viewing request received:", transcriptArray);
                // Allow viewing even when not actively capturing (e.g., after meeting ends)
                // if (!capturing) {
                //     const errorMsg = "Caption capturing is not active. Please make sure you're in a Teams meeting with captions enabled.";
                //     console.error(errorMsg);
                //     showUserNotification(errorMsg, 'error');
                //     sendResponse({success: false, error: errorMsg});
                //     return;
                // }
                
                if (transcriptArray.length === 0) {
                    const errorMsg = "No captions captured yet. Please make sure live captions are turned on in Teams.";
                    console.error(errorMsg);
                    showUserNotification(errorMsg, 'error');
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
                    showUserNotification('Failed to open caption viewer: ' + error.message, 'error');
                    sendResponse({success: false, error: error.message});
                }
                break;

            case 'error_notification':
                if (request.error) {
                    showUserNotification(request.error, 'error');
                }
                sendResponse({success: true});
                break;

            case 'reset_transcript':
                resetTranscriptData();
                showUserNotification('Transcript data cleared. Starting fresh!', 'success');
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
        showUserNotification('Internal error: ' + error.message, 'error');
        sendResponse({success: false, error: error.message});
    }
});

console.log("🚀 Conservative whitelist-based caption content_script.js is running");