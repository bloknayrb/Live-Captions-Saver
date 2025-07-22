// ========================================================================
// MS Teams Live Captions Saver - Modular Architecture
// ========================================================================

// Create main namespace
window.CaptionSaver = window.CaptionSaver || {};

// ========================================================================
// CONFIG MODULE - All constants and configuration
// ========================================================================
window.CaptionSaver.Config = {
    SIMILARITY_THRESHOLDS: {
        UPDATE_DETECTION: 0.7,      // Minimum similarity to consider caption an update
        HIGH_SIMILARITY: 0.85,      // High similarity threshold for updates
        DUPLICATE_DETECTION: 0.9    // Very high similarity for duplicate detection
    },
    TIMING: {
        DEBOUNCE_INTERVAL: 500,           // Minimum ms between processing runs
        SILENCE_TIMEOUT: 5000,            // Ms to wait before considering silence
        SILENCE_TIMER_OFFSET: 4500,       // Slightly less than silence timeout
        MEMORY_CLEANUP_INTERVAL: 60000,   // Memory cleanup frequency (60 seconds)
        FALLBACK_TIMER_INTERVAL: 3000,    // Fallback processing check interval
        PERIODIC_CHECK_INTERVAL: 1000,    // Periodic silence check interval
        DEFER_RETRY_DELAY: 1000,          // Delay for deferred operations
        MEETING_CACHE_DURATION: 30000     // Meeting detection cache duration
    },
    MEMORY: {
        MAX_TRACKING_ENTRIES: 1000,     // Maximum caption tracking entries
        TRACKING_DATA_MAX_AGE: 300000,  // 5 minutes for tracking data
        RECENT_TRANSCRIPTS_LIMIT: 20,   // Number of recent transcripts to check for duplicates
        STABILITY_BUFFER: 2,            // Number of recent captions to skip for stability
        MIN_CAPTIONS_REQUIRED: 3        // Minimum captions needed before processing
    },
    PERFORMANCE: {
        MAX_WORD_LENGTH_FILTER: 2,      // Minimum word length for similarity comparison
        PERFORMANCE_LOG_FREQUENCY: 60   // How often to log performance stats (cleanup cycles)
    },
    SELECTORS: {
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
    }
};

// ========================================================================
// DOM UTILS MODULE - Safe DOM operations and element handling
// ========================================================================
window.CaptionSaver.DOMUtils = {
    // Safe DOM operation wrappers
    safeQuerySelector(element, selector) {
        try {
            return element ? element.querySelector(selector) : null;
        } catch (error) {
            console.warn(`Safe query selector failed for "${selector}":`, error);
            return null;
        }
    },

    safeQuerySelectorAll(selector) {
        try {
            return document.querySelectorAll(selector) || [];
        } catch (error) {
            console.warn(`Safe query selector all failed for "${selector}":`, error);
            return [];
        }
    },

    safeExtractText(element) {
        try {
            if (!element) return '';
            return (element.innerText || element.textContent || '').trim();
        } catch (error) {
            console.warn('Safe text extraction failed:', error);
            return '';
        }
    },

    safeClosest(element, selector) {
        try {
            return element ? element.closest(selector) : null;
        } catch (error) {
            console.warn(`Safe closest failed for "${selector}":`, error);
            return null;
        }
    },

    // Get caption elements with fallback selectors
    getCaptionElements() {
        try {
            const config = window.CaptionSaver.Config;
            
            // Primary selector
            let captionTextElements = this.safeQuerySelectorAll(config.SELECTORS.PRIMARY_CAPTION);
            
            // Fallback selectors if primary doesn't work
            if (captionTextElements.length === 0) {
                for (const selector of config.SELECTORS.FALLBACK_CAPTIONS) {
                    captionTextElements = this.safeQuerySelectorAll(selector);
                    if (captionTextElements.length > 0) {
                        console.log(`Using fallback caption selector: ${selector}`);
                        break;
                    }
                }
            }
            
            return captionTextElements;
        } catch (error) {
            console.error('Error in getCaptionElements:', error);
            return [];
        }
    },

    // Extract caption data with fallback strategies
    extractCaptionData(textElement) {
        try {
            const result = {
                text: '',
                name: 'Unknown Speaker',
                element: textElement
            };
            
            // Primary text extraction with normalization
            const rawText = this.safeExtractText(textElement);
            result.text = window.CaptionSaver.TextProcessor.normalizeText(rawText);
            if (!result.text) return null;
            
            // Primary author extraction strategy
            const config = window.CaptionSaver.Config;
            const transcript = this.safeClosest(textElement, config.SELECTORS.CHAT_MESSAGE);
            if (transcript) {
                const authorElement = this.safeQuerySelector(transcript, config.SELECTORS.AUTHOR);
                if (authorElement) {
                    result.name = this.safeExtractText(authorElement);
                }
            }
            
            // Fallback author extraction strategies
            if (result.name === 'Unknown Speaker') {
                const fallbackSelectors = [
                    '[data-tid="author"]',
                    '.fui-ChatMessageAuthor',
                    '[class*="author"]',
                    '[class*="Author"]',
                    '[class*="name"]',
                    '[class*="Name"]'
                ];
                
                for (const selector of fallbackSelectors) {
                    const chatMessage = this.safeClosest(textElement, '[class*="ChatMessage"]');
                    const authorEl = this.safeQuerySelector(chatMessage, selector) ||
                                   this.safeQuerySelector(textElement.parentElement, selector) ||
                                   this.safeQuerySelector(textElement.parentElement?.parentElement, selector);
                    
                    if (authorEl) {
                        const authorText = this.safeExtractText(authorEl);
                        if (authorText && authorText !== result.text) {
                            result.name = authorText;
                            break;
                        }
                    }
                }
            }
            
            return result;
        } catch (error) {
            console.error('Error in extractCaptionData:', error);
            return null;
        }
    }
};

// ========================================================================
// TEXT PROCESSOR MODULE - Text normalization and similarity
// ========================================================================
window.CaptionSaver.TextProcessor = {
    // Comprehensive text cleaning and normalization
    normalizeText(text) {
        if (!text) return '';
        
        let cleaned = text;
        
        // Remove HTML entities
        cleaned = cleaned.replace(/&[a-zA-Z0-9#]+;/g, ' ');
        
        // Remove extra whitespace (multiple spaces, tabs, newlines)
        cleaned = cleaned.replace(/\s+/g, ' ');
        
        // Remove common Teams UI artifacts and typing indicators
        cleaned = cleaned.replace(/\.\.\./g, ''); // Remove ellipsis/typing indicators
        cleaned = cleaned.replace(/^\s*[\.\-\*\>\<\|\~\+\=]+\s*/g, ''); // Remove leading symbols
        cleaned = cleaned.replace(/\s*[\.\-\*\>\<\|\~\+\=]+\s*$/g, ''); // Remove trailing symbols
        
        // Remove common UI noise
        cleaned = cleaned.replace(/\[.*?\]/g, ''); // Remove bracketed content
        cleaned = cleaned.replace(/\(typing\)/gi, ''); // Remove typing indicators
        cleaned = cleaned.replace(/\(speaking\)/gi, ''); // Remove speaking indicators
        
        // Normalize punctuation spacing
        cleaned = cleaned.replace(/\s*([,.!?;:])\s*/g, '$1 ');
        
        // Final cleanup
        cleaned = cleaned.trim();
        
        return cleaned;
    },

    // Calculate text similarity for fuzzy duplicate detection
    calculateTextSimilarity(text1, text2) {
        try {
            if (!text1 || !text2) return 0;
            
            const norm1 = this.normalizeText(text1).toLowerCase();
            const norm2 = this.normalizeText(text2).toLowerCase();
            
            if (norm1 === norm2) return 1;
            
            // Check if one text contains the other (for progressive updates)
            if (norm1.includes(norm2) || norm2.includes(norm1)) {
                const shorter = norm1.length < norm2.length ? norm1 : norm2;
                const longer = norm1.length >= norm2.length ? norm1 : norm2;
                return shorter.length / longer.length;
            }
            
            // Simple word-based similarity for different approaches to same content
            const config = window.CaptionSaver.Config;
            const words1 = norm1.split(/\s+/).filter(w => w.length > config.PERFORMANCE.MAX_WORD_LENGTH_FILTER);
            const words2 = norm2.split(/\s+/).filter(w => w.length > config.PERFORMANCE.MAX_WORD_LENGTH_FILTER);
            
            if (words1.length === 0 || words2.length === 0) return 0;
            
            const commonWords = words1.filter(w => words2.includes(w)).length;
            const totalWords = Math.max(words1.length, words2.length);
            
            return commonWords / totalWords;
        } catch (error) {
            console.warn('Error calculating text similarity:', error);
            return 0;
        }
    },

    // Create consistent caption keys
    createCaptionKey(name, text) {
        const normalizedName = name ? name.trim() : 'Unknown Speaker';
        const normalizedText = this.normalizeText(text);
        return `${normalizedName}:${normalizedText}`;
    }
};

// ========================================================================
// STATE MANAGER MODULE - Processing coordination and state management
// ========================================================================
window.CaptionSaver.StateManager = {
    // Processing state tracking
    processingState: {
        isProcessing: false,
        isSilenceDetection: false,
        isForceCapture: false,
        lastSilenceDetectionReason: ''
    },

    // Performance monitoring
    processingStats: { 
        runs: 0, 
        totalTime: 0, 
        throttledCalls: 0 
    },

    // Timing state
    lastCaptionTime: 0,
    lastProcessingTime: 0,
    lastCaptionSnapshot: '',

    // Timer references
    silenceCheckTimer: null,
    processingThrottle: null,
    fallbackTimer: null,

    // Set processing state
    setProcessingState(isProcessing) {
        this.processingState.isProcessing = isProcessing;
        if (isProcessing) {
            console.log('🔄 Caption processing started');
        }
    },

    // Check if processing can start
    canStartProcessing() {
        return !this.processingState.isProcessing && !this.processingState.isSilenceDetection;
    },

    // Centralized silence detection control
    triggerSilenceDetection(reason = 'unknown') {
        try {
            // Prevent overlapping silence detection operations
            if (this.processingState.isSilenceDetection) {
                console.log(`Silence detection already in progress, skipping: ${reason}`);
                return false;
            }

            // Prevent interference with ongoing processing
            if (this.processingState.isProcessing) {
                console.log(`Caption processing active, deferring silence detection: ${reason}`);
                const config = window.CaptionSaver.Config;
                setTimeout(() => this.triggerSilenceDetection(reason), config.TIMING.DEFER_RETRY_DELAY);
                return false;
            }

            this.processingState.isSilenceDetection = true;
            this.processingState.lastSilenceDetectionReason = reason;
            
            console.log(`🔕 Triggering silence detection: ${reason}`);

            // Set artificial timing state for silence detection
            const config = window.CaptionSaver.Config;
            const originalTime = this.lastCaptionTime;
            this.lastCaptionTime = Date.now() - (config.TIMING.SILENCE_TIMEOUT + 1000);

            // Execute silence detection
            const result = window.CaptionSaver.CaptionProcessor.checkRecentCaptions();

            // Restore original timing state if not naturally updated
            if (this.lastCaptionTime === Date.now() - (config.TIMING.SILENCE_TIMEOUT + 1000)) {
                this.lastCaptionTime = originalTime;
            }

            this.processingState.isSilenceDetection = false;
            console.log(`✅ Silence detection completed: ${reason}`);
            
            return result;
        } catch (error) {
            this.processingState.isSilenceDetection = false;
            console.error(`Error in silence detection (${reason}):`, error);
            return false;
        }
    }
};

// ========================================================================
// MEMORY MANAGER MODULE - Cleanup and optimization
// ========================================================================
window.CaptionSaver.MemoryManager = {
    // Caption tracking data
    captionElementTracking: new Map(),
    processedCaptions: new Set(),

    // Cleanup tracking data while preserving full transcript
    cleanupMemory() {
        const stateManager = window.CaptionSaver.StateManager;
        
        // Don't run cleanup during active processing to avoid interference
        if (stateManager.processingState.isProcessing || stateManager.processingState.isSilenceDetection) {
            console.log('Deferring memory cleanup due to active operations');
            return;
        }

        const config = window.CaptionSaver.Config;
        const now = Date.now();
        
        // Clean up old caption element tracking data
        let removedTracking = 0;
        for (const [key, data] of this.captionElementTracking.entries()) {
            if (now - data.timestamp > config.MEMORY.TRACKING_DATA_MAX_AGE) {
                this.captionElementTracking.delete(key);
                removedTracking++;
            }
        }
        
        // If still too many entries, remove oldest ones
        if (this.captionElementTracking.size > config.MEMORY.MAX_TRACKING_ENTRIES) {
            const entries = Array.from(this.captionElementTracking.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            
            const toRemove = entries.slice(0, this.captionElementTracking.size - config.MEMORY.MAX_TRACKING_ENTRIES);
            for (const [key] of toRemove) {
                this.captionElementTracking.delete(key);
                removedTracking++;
            }
        }
        
        // Clean up processed captions set (keep only recent ones referenced in transcript)
        const transcriptKeys = new Set(window.CaptionSaver.Data.transcriptArray.map(item => item.ID));
        let removedProcessed = 0;
        for (const key of this.processedCaptions) {
            if (!transcriptKeys.has(key)) {
                this.processedCaptions.delete(key);
                removedProcessed++;
            }
        }
        
        if (removedTracking > 0 || removedProcessed > 0) {
            console.log(`Memory cleanup: removed ${removedTracking} tracking entries, ${removedProcessed} processed caption entries`);
            console.log(`Current memory usage: ${this.captionElementTracking.size} tracking entries, ${this.processedCaptions.size} processed captions, ${window.CaptionSaver.Data.transcriptArray.length} transcript entries`);
        }
        
        // Log performance stats
        const stats = stateManager.processingStats;
        if (stats.runs > 0) {
            const avgProcessingTime = (stats.totalTime / stats.runs).toFixed(2);
            console.log(`Performance stats: ${stats.runs} processing runs, ${avgProcessingTime}ms avg, ${stats.throttledCalls} throttled calls`);
        }
    },

    // Cleanup all timers and observers
    cleanupAllTimers() {
        try {
            const stateManager = window.CaptionSaver.StateManager;
            
            if (stateManager.silenceCheckTimer) {
                clearTimeout(stateManager.silenceCheckTimer);
                stateManager.silenceCheckTimer = null;
            }
            if (stateManager.processingThrottle) {
                clearTimeout(stateManager.processingThrottle);
                stateManager.processingThrottle = null;
            }
            if (stateManager.fallbackTimer) {
                clearInterval(stateManager.fallbackTimer);
                stateManager.fallbackTimer = null;
            }
            if (window.CaptionSaver.Data.observer) {
                window.CaptionSaver.Data.observer.disconnect();
                window.CaptionSaver.Data.observer = null;
            }
            console.log('All timers and observers cleaned up');
        } catch (error) {
            console.warn('Error during cleanup:', error);
        }
    }
};

// ========================================================================
// MEETING DETECTOR MODULE - Meeting state detection with caching
// ========================================================================
window.CaptionSaver.MeetingDetector = {
    // Meeting detection cache
    meetingDetectionCache: { 
        result: false, 
        timestamp: 0 
    },

    // Optimized meeting detection with caching
    detectMeetingState() {
        const config = window.CaptionSaver.Config;
        const now = Date.now();
        
        // Use cached result if still valid
        if (now - this.meetingDetectionCache.timestamp < config.TIMING.MEETING_CACHE_DURATION) {
            return this.meetingDetectionCache.result;
        }
        
        try {
            const domUtils = window.CaptionSaver.DOMUtils;
            
            // Check specific, efficient indicators first
            const quickIndicators = [
                document.getElementById(config.SELECTORS.MEETING_INDICATORS.CALL_DURATION.slice(1)),
                domUtils.safeQuerySelector(document, config.SELECTORS.MEETING_INDICATORS.CALL_STATUS_CONTAINER),
                domUtils.safeQuerySelector(document, config.SELECTORS.MEETING_INDICATORS.CALL_STATUS)
            ];
            
            let inMeeting = quickIndicators.some(indicator => indicator !== null);
            
            // Only do expensive span query if quick checks fail
            if (!inMeeting) {
                const waitingSpans = domUtils.safeQuerySelectorAll('span[class*="waiting"], span[class*="join"]');
                inMeeting = Array.from(waitingSpans).some(el => {
                    const text = domUtils.safeExtractText(el);
                    return text && text.includes("Waiting for others to join");
                });
            }
            
            // Cache the result
            this.meetingDetectionCache.result = inMeeting;
            this.meetingDetectionCache.timestamp = now;
            
            return inMeeting;
        } catch (error) {
            console.warn('Error in meeting detection:', error);
            return this.meetingDetectionCache.result; // Return last known state
        }
    }
};

// ========================================================================
// DATA MODULE - Global data storage
// ========================================================================
window.CaptionSaver.Data = {
    transcriptArray: [],
    capturing: false,
    observer: null,
    transcriptIdCounter: 0,
    periodicCheckCounter: 0
};

// ========================================================================
// CAPTION PROCESSOR MODULE - Core caption processing logic
// ========================================================================
window.CaptionSaver.CaptionProcessor = {
    // Process caption updates and handle live caption changes
    processCaptionUpdate(captionData, elementIndex) {
        try {
            const { text, name, element } = captionData;
            const memoryManager = window.CaptionSaver.MemoryManager;
            const textProcessor = window.CaptionSaver.TextProcessor;
            const config = window.CaptionSaver.Config;
            
            // Create tracking key based on element position and speaker
            const trackingKey = `${elementIndex}:${name}`;
            
            // Check if we've seen this element position before
            const previousData = memoryManager.captionElementTracking.get(trackingKey);
            
            if (previousData) {
                // This is potentially an update to an existing caption
                const previousText = previousData.text;
                
                // Check if current text is an extension/correction of previous text using similarity
                const similarity = textProcessor.calculateTextSimilarity(text, previousText);
                const isUpdate = (text.length > previousText.length && similarity > config.SIMILARITY_THRESHOLDS.UPDATE_DETECTION) || 
                                (similarity > config.SIMILARITY_THRESHOLDS.HIGH_SIMILARITY);
                
                if (isUpdate) {
                    console.log(`Caption update detected (similarity: ${similarity.toFixed(2)}): "${previousText}" -> "${text}"`);
                    
                    // Remove the previous version from processed set and transcript array
                    const oldCaptionKey = textProcessor.createCaptionKey(name, previousText);
                    memoryManager.processedCaptions.delete(oldCaptionKey);
                    
                    // Remove old version from transcript array
                    const data = window.CaptionSaver.Data;
                    const oldIndex = data.transcriptArray.findIndex(item => 
                        item.Name === name && item.Text === previousText && item.ID === oldCaptionKey
                    );
                    if (oldIndex !== -1) {
                        data.transcriptArray.splice(oldIndex, 1);
                        console.log(`Removed old version from transcript: "${previousText}"`);
                    }
                }
            }
            
            // Update tracking data with current caption
            memoryManager.captionElementTracking.set(trackingKey, {
                text: text,
                timestamp: Date.now(),
                processed: false
            });
            
            return true;
        } catch (error) {
            console.error('Error in processCaptionUpdate:', error);
            return false;
        }
    },

    // Enhanced duplicate detection with fuzzy matching
    isDuplicateCaption(name, text) {
        try {
            const textProcessor = window.CaptionSaver.TextProcessor;
            const memoryManager = window.CaptionSaver.MemoryManager;
            const config = window.CaptionSaver.Config;
            
            const captionKey = textProcessor.createCaptionKey(name, text);
            
            // First check exact match
            if (memoryManager.processedCaptions.has(captionKey)) {
                return true;
            }
            
            // Check for similar captions in recent transcript
            const data = window.CaptionSaver.Data;
            const recentTranscripts = data.transcriptArray.slice(-config.MEMORY.RECENT_TRANSCRIPTS_LIMIT);
            
            for (const transcript of recentTranscripts) {
                if (transcript.Name === name) {
                    const similarity = textProcessor.calculateTextSimilarity(text, transcript.Text);
                    if (similarity > config.SIMILARITY_THRESHOLDS.DUPLICATE_DETECTION) {
                        console.log(`Fuzzy duplicate detected (similarity: ${similarity.toFixed(2)}): "${transcript.Text}" ≈ "${text}"`);
                        return true;
                    }
                }
            }
            
            return false;
        } catch (error) {
            console.error('Error in isDuplicateCaption:', error);
            return false;
        }
    },

    // Main caption processing function
    checkCaptions() {
        try {
            const domUtils = window.CaptionSaver.DOMUtils;
            const stateManager = window.CaptionSaver.StateManager;
            const textProcessor = window.CaptionSaver.TextProcessor;
            const memoryManager = window.CaptionSaver.MemoryManager;
            const config = window.CaptionSaver.Config;
            const data = window.CaptionSaver.Data;
            
            // Get all caption text elements using centralized function
            const captionTextElements = domUtils.getCaptionElements();
            
            // Create a snapshot of current caption content to detect real changes
            if (captionTextElements.length > 0) {
                const currentSnapshot = Array.from(captionTextElements).map(el => domUtils.safeExtractText(el)).join('|');
                
                // Only update timing if the content actually changed
                if (currentSnapshot !== stateManager.lastCaptionSnapshot) {
                    stateManager.lastCaptionSnapshot = currentSnapshot;
                    stateManager.lastCaptionTime = Date.now();
                    
                    console.log('Caption content changed, resetting silence timer');
                    
                    // Reset the silence check timer
                    if (stateManager.silenceCheckTimer) {
                        clearTimeout(stateManager.silenceCheckTimer);
                    }
                    
                    // Set a timer to check for recent captions after configured silence timeout
                    stateManager.silenceCheckTimer = setTimeout(() => {
                        this.checkRecentCaptions();
                    }, config.TIMING.SILENCE_TIMEOUT);
                }
            }
            
            // Use configurable thresholds for better caption capture
            if (captionTextElements.length < config.MEMORY.MIN_CAPTIONS_REQUIRED) {
                console.log(`Only ${captionTextElements.length} captions, need at least ${config.MEMORY.MIN_CAPTIONS_REQUIRED} for stable processing`);
                return;
            }
            
            const numStableElements = Math.max(1, captionTextElements.length - config.MEMORY.STABILITY_BUFFER);
            
            for (let i = 0; i < numStableElements; i++) {
                const textElement = captionTextElements[i];
                
                // Use helper function with fallback strategies
                const captionData = domUtils.extractCaptionData(textElement);
                if (!captionData) continue;
                
                const { text: Text, name: Name } = captionData;
                
                // Process caption update detection
                const shouldProcess = this.processCaptionUpdate(captionData, i);
                if (!shouldProcess) continue;
                
                // Enhanced duplicate detection with fuzzy matching
                if (this.isDuplicateCaption(Name, Text)) {
                    continue;
                }
                
                // Create a unique key using consistent helper function
                const captionKey = textProcessor.createCaptionKey(Name, Text);
                
                // Mark as processed
                memoryManager.processedCaptions.add(captionKey);
                
                // Add to transcript array
                const Time = new Date().toLocaleTimeString();
                const newCaption = {
                    Name,
                    Text,
                    Time,
                    ID: captionKey
                };
                
                data.transcriptArray.push(newCaption);
                console.log('FINAL STABLE CAPTION:', newCaption);
            }
        } catch (error) {
            console.error('Error in checkCaptions:', error);
        }
    },

    // Check recent captions during silence periods
    checkRecentCaptions() {
        try {
            console.log('checkRecentCaptions called - checking for silence-based captions');
            
            const domUtils = window.CaptionSaver.DOMUtils;
            const stateManager = window.CaptionSaver.StateManager;
            const config = window.CaptionSaver.Config;
            
            const captionTextElements = domUtils.getCaptionElements();
            
            if (captionTextElements.length === 0) {
                console.log('No caption elements found for silence check');
                return;
            }
            
            console.log(`Found ${captionTextElements.length} caption elements for silence check`);
            
            const timeSinceLastCaption = Date.now() - stateManager.lastCaptionTime;
            console.log(`Time since last caption: ${timeSinceLastCaption}ms`);
            
            if (timeSinceLastCaption >= config.TIMING.SILENCE_TIMER_OFFSET) {
                console.log('Processing recent captions due to silence...');
                
                const startIndex = Math.max(0, captionTextElements.length - config.MEMORY.STABILITY_BUFFER); 
                let endIndex = captionTextElements.length - 1;
                
                // Check if the last caption looks complete (ends with punctuation)
                if (captionTextElements.length > 0) {
                    const lastElement = captionTextElements[captionTextElements.length - 1];
                    const lastText = domUtils.safeExtractText(lastElement);
                    if (lastText.match(/[.!?]$/)) {
                        console.log('Last caption ends with punctuation, including it:', lastText);
                        endIndex = captionTextElements.length;
                    }
                }
                
                console.log(`Processing captions from index ${startIndex} to ${endIndex - 1}`);
                
                for (let i = startIndex; i < endIndex; i++) {
                    const textElement = captionTextElements[i];
                    
                    const captionData = domUtils.extractCaptionData(textElement);
                    if (!captionData) continue;
                    
                    const { text: Text, name: Name } = captionData;
                    
                    // Process caption update detection for silence-based captions
                    const shouldProcess = this.processCaptionUpdate(captionData, i);
                    if (!shouldProcess) continue;
                    
                    // Enhanced duplicate detection with fuzzy matching
                    if (this.isDuplicateCaption(Name, Text)) {
                        console.log(`Skipping duplicate silence caption: ${Text}`);
                        continue;
                    }
                    
                    // Create a unique key using consistent helper function
                    const textProcessor = window.CaptionSaver.TextProcessor;
                    const memoryManager = window.CaptionSaver.MemoryManager;
                    const data = window.CaptionSaver.Data;
                    
                    const captionKey = textProcessor.createCaptionKey(Name, Text);
                    
                    // Mark as processed
                    memoryManager.processedCaptions.add(captionKey);
                    
                    // Add to transcript array
                    const Time = new Date().toLocaleTimeString();
                    const newCaption = {
                        Name,
                        Text,
                        Time,
                        ID: captionKey
                    };
                    
                    data.transcriptArray.push(newCaption);
                    console.log('SILENCE-DETECTED STABLE CAPTION:', newCaption);
                }
            } else {
                console.log('Not enough silence time elapsed');
            }
        } catch (error) {
            console.error('Error in checkRecentCaptions:', error);
        }
    },

    // Debounced caption processing to prevent excessive processing
    debouncedCheckCaptions() {
        const stateManager = window.CaptionSaver.StateManager;
        const config = window.CaptionSaver.Config;
        const now = Date.now();
        
        // Check if we can start processing
        if (!stateManager.canStartProcessing()) {
            console.log('Processing blocked by active operations');
            return;
        }
        
        // Clear existing throttle timer
        if (stateManager.processingThrottle) {
            clearTimeout(stateManager.processingThrottle);
        }
        
        // If we processed recently, delay this run
        const timeSinceLastProcessing = now - stateManager.lastProcessingTime;
        if (timeSinceLastProcessing < config.TIMING.DEBOUNCE_INTERVAL) {
            stateManager.processingStats.throttledCalls++;
            stateManager.processingThrottle = setTimeout(() => {
                if (stateManager.canStartProcessing()) {
                    stateManager.lastProcessingTime = Date.now();
                    stateManager.setProcessingState(true);
                    const startTime = performance.now();
                    this.checkCaptions();
                    const endTime = performance.now();
                    stateManager.processingStats.runs++;
                    stateManager.processingStats.totalTime += (endTime - startTime);
                    stateManager.setProcessingState(false);
                }
            }, config.TIMING.DEBOUNCE_INTERVAL - timeSinceLastProcessing);
            return;
        }
        
        // Process immediately
        stateManager.lastProcessingTime = now;
        stateManager.setProcessingState(true);
        const startTime = performance.now();
        this.checkCaptions();
        const endTime = performance.now();
        stateManager.processingStats.runs++;
        stateManager.processingStats.totalTime += (endTime - startTime);
        stateManager.setProcessingState(false);
    },

    // Sort transcripts by screen order
    sortTranscriptsByScreenOrder() {
        try {
            const domUtils = window.CaptionSaver.DOMUtils;
            const textProcessor = window.CaptionSaver.TextProcessor;
            const data = window.CaptionSaver.Data;
            
            // Get the current order of captions as they appear on screen
            const captionTextElements = domUtils.getCaptionElements();
            const screenOrder = [];
            
            captionTextElements.forEach((element, index) => {
                const captionData = domUtils.extractCaptionData(element);
                if (captionData) {
                    screenOrder.push({
                        text: captionData.text,
                        name: captionData.name,
                        screenPosition: index
                    });
                }
            });
            
            // Create a map for quick lookup of screen positions using consistent keys
            const positionMap = new Map();
            screenOrder.forEach(item => {
                const key = textProcessor.createCaptionKey(item.name, item.text);
                positionMap.set(key, item.screenPosition);
            });
            
            // Sort transcriptArray based on screen order
            const orderedTranscripts = [...data.transcriptArray].sort((a, b) => {
                const keyA = textProcessor.createCaptionKey(a.Name, a.Text);
                const keyB = textProcessor.createCaptionKey(b.Name, b.Text);
                
                const posA = positionMap.get(keyA);
                const posB = positionMap.get(keyB);
                
                // If both have screen positions, sort by screen order
                if (posA !== undefined && posB !== undefined) {
                    return posA - posB;
                }
                
                // If only one has a screen position, put it first
                if (posA !== undefined) return -1;
                if (posB !== undefined) return 1;
                
                // If neither has a screen position, maintain original order
                return 0;
            });
            
            console.log("Sorted transcripts by screen order:", orderedTranscripts);
            return orderedTranscripts;
        } catch (error) {
            console.error('Error in sortTranscriptsByScreenOrder:', error);
            return window.CaptionSaver.Data.transcriptArray;
        }
    }
};

// ========================================================================
// CONTROLLER MODULE - Main orchestration and public API
// ========================================================================
window.CaptionSaver.Controller = {
    // Initialize periodic checks
    initializePeriodicChecks() {
        const config = window.CaptionSaver.Config;
        const stateManager = window.CaptionSaver.StateManager;
        const memoryManager = window.CaptionSaver.MemoryManager;
        const data = window.CaptionSaver.Data;
        
        setInterval(() => {
            data.periodicCheckCounter++;
            
            if (stateManager.lastCaptionTime === 0) {
                return; // No captions processed yet
            }
            
            const timeSinceLastCaption = Date.now() - stateManager.lastCaptionTime;
            if (timeSinceLastCaption >= config.TIMING.SILENCE_TIMEOUT && 
                timeSinceLastCaption <= (config.TIMING.SILENCE_TIMEOUT + 1000)) {
                console.log('Periodic silence check triggered');
                stateManager.triggerSilenceDetection('periodic-check');
            }
            
            // Run memory cleanup every configured interval
            if (data.periodicCheckCounter % (config.TIMING.MEMORY_CLEANUP_INTERVAL / config.TIMING.PERIODIC_CHECK_INTERVAL) === 0) {
                memoryManager.cleanupMemory();
            }
        }, config.TIMING.PERIODIC_CHECK_INTERVAL);
    },

    // Start transcription system
    startTranscription() {
        const meetingDetector = window.CaptionSaver.MeetingDetector;
        const domUtils = window.CaptionSaver.DOMUtils;
        const captionProcessor = window.CaptionSaver.CaptionProcessor;
        const memoryManager = window.CaptionSaver.MemoryManager;
        const stateManager = window.CaptionSaver.StateManager;
        const config = window.CaptionSaver.Config;
        const data = window.CaptionSaver.Data;
        
        const inMeeting = meetingDetector.detectMeetingState();
        
        if (!inMeeting) {
            setTimeout(() => this.startTranscription(), 5000);
            return false;
        }

        const closedCaptionsContainer = domUtils.safeQuerySelector(document, config.SELECTORS.CAPTIONS_CONTAINER);
        if (!closedCaptionsContainer) {
            console.log("Please, click 'More' > 'Language and speech' > 'Turn on live captions'");
            setTimeout(() => this.startTranscription(), 5000);
            return false;
        }

        console.log("Found captions container, setting up observer...");
        
        // Clean up any existing timers/observers before setting up new ones
        memoryManager.cleanupAllTimers();
        
        data.capturing = true;
        data.observer = new MutationObserver((mutations) => {
            console.log('MutationObserver fired with', mutations.length, 'mutations');
            captionProcessor.debouncedCheckCaptions();
        });
        
        data.observer.observe(closedCaptionsContainer, {
            childList: true,
            subtree: true,
            characterData: true
        });
        
        console.log("Observer set up, doing initial check...");
        captionProcessor.debouncedCheckCaptions();
        
        // Set up a fallback timer to check periodically
        stateManager.fallbackTimer = setInterval(() => {
            console.log("Fallback timer check...");
            captionProcessor.debouncedCheckCaptions();
        }, config.TIMING.FALLBACK_TIMER_INTERVAL);
        
        return true;
    },

    // Handle extension messages
    handleMessage(request, sender, sendResponse) {
        console.log("Content script received message:", request);
        
        const stateManager = window.CaptionSaver.StateManager;
        const captionProcessor = window.CaptionSaver.CaptionProcessor;
        const data = window.CaptionSaver.Data;
        
        switch (request.message) {
            case 'return_transcript':
                console.log("return_transcript request received:", data.transcriptArray);
                
                console.log("Attempting to capture recent captions before download...");
                stateManager.triggerSilenceDetection('download-request');
                
                if (!data.capturing || data.transcriptArray.length === 0) {
                    alert("Oops! No captions were captured. Please make sure captions are turned on.");
                    sendResponse({success: false});
                    return;
                }

                const orderedForDownload = captionProcessor.sortTranscriptsByScreenOrder();
                
                const meetingTitle = document.title.replace("__Microsoft_Teams", '').replace(/[^a-z0-9 ]/gi, '');
                chrome.runtime.sendMessage({
                    message: "download_captions",
                    transcriptArray: orderedForDownload.map(({ID, ...rest}) => rest),
                    meetingTitle: meetingTitle
                });
                sendResponse({success: true});
                break;

            case 'get_captions_for_viewing':
                console.log("get_captions_for_viewing request received:", data.transcriptArray);
                
                console.log("Attempting to capture recent captions before viewing...");
                stateManager.triggerSilenceDetection('view-request');
                
                if (!data.capturing || data.transcriptArray.length === 0) {
                    alert("Oops! No captions were captured. Please make sure captions are turned on.");
                    sendResponse({success: false});
                    return;
                }

                const orderedForViewing = captionProcessor.sortTranscriptsByScreenOrder();
                const viewableTranscripts = orderedForViewing.map(({ID, ...rest}) => rest);
                
                chrome.runtime.sendMessage({
                    message: "display_captions",
                    transcriptArray: viewableTranscripts
                });
                sendResponse({success: true});
                break;

            default:
                sendResponse({success: false, error: "Unknown message"});
                break;
        }
        
        return true;
    },

    // Initialize the entire system
    initialize() {
        console.log("Starting modular transcription system...");
        
        // Initialize periodic checks
        this.initializePeriodicChecks();
        
        // Start transcription
        const startResult = this.startTranscription();
        console.log("startTranscription returned:", startResult);
        
        // Manual silence check for testing
        setTimeout(() => {
            console.log("MANUAL SILENCE CHECK - using centralized control");
            window.CaptionSaver.StateManager.triggerSilenceDetection('manual-test-check');
        }, 10000);
        
        // Set up message listener
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            return this.handleMessage(request, sender, sendResponse);
        });
        
        console.log("Modular content_script.js is running");
    }
};

// ========================================================================
// INITIALIZE SYSTEM
// ========================================================================
window.CaptionSaver.Controller.initialize();