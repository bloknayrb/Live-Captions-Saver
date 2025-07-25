const transcriptArray = [];
let capturing = false;
let observer = null;
const transcriptIdCounter = 0; // Since IDs are not reliable in new structure
const processedCaptions = new Set(); // Track captions we've already processed
let lastCaptionTime = 0; // Track when we last saw a caption change (0 = never)
let silenceCheckTimer = null; // Timer to check for silence periods
let lastCaptionSnapshot = ''; // Track the actual content to detect real changes
const captionElementTracking = new Map(); // Track caption elements for update detection
let processingThrottle = null; // Throttle processing during high activity
let lastProcessingTime = 0; // Track when we last processed captions
const processingStats = { runs: 0, totalTime: 0, throttledCalls: 0 }; // Performance monitoring
let fallbackTimer = null; // Track fallback timer to prevent leaks
const meetingDetectionCache = { result: false, timestamp: 0, cacheDuration: 30000 }; // Cache meeting detection for 30 seconds
const processingState = { // State management for concurrent operations
    isProcessing: false,
    isSilenceDetection: false,
    isForceCapture: false,
    lastSilenceDetectionReason: ''
};

// Configuration constants for easy tuning and maintenance
const CONFIG = {
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
        DEFER_RETRY_DELAY: 1000           // Delay for deferred operations
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
    }
};

// Centralized caption element finder with fallback selectors
function getCaptionElements() {
    try {
        // Primary selector
        let captionTextElements = safeQuerySelectorAll('[data-tid="closed-caption-text"]');
        
        // Fallback selectors if primary doesn't work
        if (captionTextElements.length === 0) {
            const fallbackSelectors = [
                '[class*="closed-caption"]',
                '[class*="caption-text"]',
                '[class*="CaptionText"]',
                '[aria-label*="caption"]',
                '[role="log"] [class*="text"]'
            ];
            
            for (const selector of fallbackSelectors) {
                captionTextElements = safeQuerySelectorAll(selector);
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
}

// Helper function to create consistent caption keys
function createCaptionKey(name, text) {
    // Ensure both name and text are normalized consistently
    const normalizedName = name ? name.trim() : 'Unknown Speaker';
    const normalizedText = normalizeText(text);
    return `${normalizedName}:${normalizedText}`;
}

// Safe DOM operation wrappers for error handling
function safeQuerySelector(element, selector) {
    try {
        return element ? element.querySelector(selector) : null;
    } catch (error) {
        console.warn(`Safe query selector failed for "${selector}":`, error);
        return null;
    }
}

function safeQuerySelectorAll(selector) {
    try {
        return document.querySelectorAll(selector) || [];
    } catch (error) {
        console.warn(`Safe query selector all failed for "${selector}":`, error);
        return [];
    }
}

function safeExtractText(element) {
    try {
        if (!element) return '';
        return (element.innerText || element.textContent || '').trim();
    } catch (error) {
        console.warn('Safe text extraction failed:', error);
        return '';
    }
}

function safeClosest(element, selector) {
    try {
        return element ? element.closest(selector) : null;
    } catch (error) {
        console.warn(`Safe closest failed for "${selector}":`, error);
        return null;
    }
}

// Comprehensive text cleaning and normalization function
function normalizeText(text) {
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
}

// Helper function to calculate text similarity for fuzzy duplicate detection
function calculateTextSimilarity(text1, text2) {
    try {
        if (!text1 || !text2) return 0;
        
        const norm1 = normalizeText(text1).toLowerCase();
        const norm2 = normalizeText(text2).toLowerCase();
        
        if (norm1 === norm2) return 1;
        
        // Check if one text contains the other (for progressive updates)
        if (norm1.includes(norm2) || norm2.includes(norm1)) {
            const shorter = norm1.length < norm2.length ? norm1 : norm2;
            const longer = norm1.length >= norm2.length ? norm1 : norm2;
            return shorter.length / longer.length;
        }
        
        // Simple word-based similarity for different approaches to same content
        const words1 = norm1.split(/\s+/).filter(w => w.length > CONFIG.PERFORMANCE.MAX_WORD_LENGTH_FILTER);
        const words2 = norm2.split(/\s+/).filter(w => w.length > CONFIG.PERFORMANCE.MAX_WORD_LENGTH_FILTER);
        
        if (words1.length === 0 || words2.length === 0) return 0;
        
        const commonWords = words1.filter(w => words2.includes(w)).length;
        const totalWords = Math.max(words1.length, words2.length);
        
        return commonWords / totalWords;
    } catch (error) {
        console.warn('Error calculating text similarity:', error);
        return 0;
    }
}

// Helper function to extract caption data with fallback selectors
function extractCaptionData(textElement) {
    try {
        const result = {
            text: '',
            name: 'Unknown Speaker',
            element: textElement
        };
        
        // Primary text extraction with fallbacks and normalization
        const rawText = safeExtractText(textElement);
        result.text = normalizeText(rawText);
        if (!result.text) return null;
        
        // Primary author extraction strategy
        const transcript = safeClosest(textElement, '.fui-ChatMessageCompact');
        if (transcript) {
            const authorElement = safeQuerySelector(transcript, '[data-tid="author"]');
            if (authorElement) {
                result.name = safeExtractText(authorElement);
            }
        }
        
        // Fallback author extraction strategies
        if (result.name === 'Unknown Speaker') {
            // Try alternative selectors for author
            const fallbackSelectors = [
                '[data-tid="author"]',
                '.fui-ChatMessageAuthor',
                '[class*="author"]',
                '[class*="Author"]',
                '[class*="name"]',
                '[class*="Name"]'
            ];
            
            for (const selector of fallbackSelectors) {
                const chatMessage = safeClosest(textElement, '[class*="ChatMessage"]');
                const authorEl = safeQuerySelector(chatMessage, selector) ||
                               safeQuerySelector(textElement.parentElement, selector) ||
                               safeQuerySelector(textElement.parentElement?.parentElement, selector);
                
                if (authorEl) {
                    const authorText = safeExtractText(authorEl);
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

// Helper function to detect caption updates and handle live caption changes
function processCaptionUpdate(captionData, elementIndex) {
    const { text, name, element } = captionData;
    
    // Create tracking key based on element position and speaker
    const trackingKey = `${elementIndex}:${name}`;
    
    // Check if we've seen this element position before
    const previousData = captionElementTracking.get(trackingKey);
    
    if (previousData) {
        // This is potentially an update to an existing caption
        const previousText = previousData.text;
        
        // Check if current text is an extension/correction of previous text using similarity
        const similarity = calculateTextSimilarity(text, previousText);
        const isUpdate = (text.length > previousText.length && similarity > CONFIG.SIMILARITY_THRESHOLDS.UPDATE_DETECTION) || 
                        (similarity > CONFIG.SIMILARITY_THRESHOLDS.HIGH_SIMILARITY); // High similarity suggests same content
        
        if (isUpdate) {
            console.log(`Caption update detected (similarity: ${similarity.toFixed(2)}): "${previousText}" -> "${text}"`);
            
            // Remove the previous version from processed set and transcript array
            const oldCaptionKey = createCaptionKey(name, previousText);
            processedCaptions.delete(oldCaptionKey);
            
            // Remove old version from transcript array
            const oldIndex = transcriptArray.findIndex(item => 
                item.Name === name && item.Text === previousText && item.ID === oldCaptionKey
            );
            if (oldIndex !== -1) {
                transcriptArray.splice(oldIndex, 1);
                console.log(`Removed old version from transcript: "${previousText}"`);
            }
        }
    }
    
    // Update tracking data with current caption
    captionElementTracking.set(trackingKey, {
        text: text,
        timestamp: Date.now(),
        processed: false
    });
    
    return true; // Proceed with processing this caption
}

// Enhanced duplicate detection with fuzzy matching
function isDuplicateCaption(name, text) {
    const captionKey = createCaptionKey(name, text);
    
    // First check exact match
    if (processedCaptions.has(captionKey)) {
        return true;
    }
    
    // Check for similar captions in recent transcript (configurable limit)
    const recentTranscripts = transcriptArray.slice(-CONFIG.MEMORY.RECENT_TRANSCRIPTS_LIMIT);
    
    for (const transcript of recentTranscripts) {
        if (transcript.Name === name) {
            const similarity = calculateTextSimilarity(text, transcript.Text);
            if (similarity > CONFIG.SIMILARITY_THRESHOLDS.DUPLICATE_DETECTION) { // Very high similarity threshold for duplicates
                console.log(`Fuzzy duplicate detected (similarity: ${similarity.toFixed(2)}): "${transcript.Text}" ≈ "${text}"`);
                return true;
            }
        }
    }
    
    return false;
}

// Memory management function to clean up tracking data while preserving full transcript
function cleanupMemory() {
    // Don't run cleanup during active processing to avoid interference
    if (processingState.isProcessing || processingState.isSilenceDetection) {
        console.log('Deferring memory cleanup due to active operations');
        return;
    }

    const now = Date.now();
    const maxAge = CONFIG.MEMORY.TRACKING_DATA_MAX_AGE; // 5 minutes for tracking data
    const maxTrackingEntries = CONFIG.MEMORY.MAX_TRACKING_ENTRIES; // Maximum entries in tracking maps
    
    // Clean up old caption element tracking data
    let removedTracking = 0;
    for (const [key, data] of captionElementTracking.entries()) {
        if (now - data.timestamp > maxAge) {
            captionElementTracking.delete(key);
            removedTracking++;
        }
    }
    
    // If still too many entries, remove oldest ones
    if (captionElementTracking.size > maxTrackingEntries) {
        const entries = Array.from(captionElementTracking.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        
        const toRemove = entries.slice(0, captionElementTracking.size - maxTrackingEntries);
        for (const [key] of toRemove) {
            captionElementTracking.delete(key);
            removedTracking++;
        }
    }
    
    // Clean up processed captions set (keep only recent ones referenced in transcript)
    const transcriptKeys = new Set(transcriptArray.map(item => item.ID));
    let removedProcessed = 0;
    for (const key of processedCaptions) {
        if (!transcriptKeys.has(key)) {
            processedCaptions.delete(key);
            removedProcessed++;
        }
    }
    
    if (removedTracking > 0 || removedProcessed > 0) {
        console.log(`Memory cleanup: removed ${removedTracking} tracking entries, ${removedProcessed} processed caption entries`);
        console.log(`Current memory usage: ${captionElementTracking.size} tracking entries, ${processedCaptions.size} processed captions, ${transcriptArray.length} transcript entries`);
    }
    
    // Log performance stats every cleanup cycle
    if (processingStats.runs > 0) {
        const avgProcessingTime = (processingStats.totalTime / processingStats.runs).toFixed(2);
        console.log(`Performance stats: ${processingStats.runs} processing runs, ${avgProcessingTime}ms avg, ${processingStats.throttledCalls} throttled calls`);
    }
}

// Cleanup function to clear all timers and observers
function cleanupAllTimers() {
    try {
        if (silenceCheckTimer) {
            clearTimeout(silenceCheckTimer);
            silenceCheckTimer = null;
        }
        if (processingThrottle) {
            clearTimeout(processingThrottle);
            processingThrottle = null;
        }
        if (fallbackTimer) {
            clearInterval(fallbackTimer);
            fallbackTimer = null;
        }
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        console.log('All timers and observers cleaned up');
    } catch (error) {
        console.warn('Error during cleanup:', error);
    }
}

// Centralized silence detection control system
function triggerSilenceDetection(reason = 'unknown') {
    try {
        // Prevent overlapping silence detection operations
        if (processingState.isSilenceDetection) {
            console.log(`Silence detection already in progress, skipping: ${reason}`);
            return false;
        }

        // Prevent interference with ongoing processing
        if (processingState.isProcessing) {
            console.log(`Caption processing active, deferring silence detection: ${reason}`);
            // Defer this request by configured delay
            setTimeout(() => triggerSilenceDetection(reason), CONFIG.TIMING.DEFER_RETRY_DELAY);
            return false;
        }

        processingState.isSilenceDetection = true;
        processingState.lastSilenceDetectionReason = reason;
        
        console.log(`🔕 Triggering silence detection: ${reason}`);

        // Set artificial timing state for silence detection
        const originalTime = lastCaptionTime;
        lastCaptionTime = Date.now() - (CONFIG.TIMING.SILENCE_TIMEOUT + 1000); // Force silence condition

        // Execute silence detection
        const result = checkRecentCaptions();

        // Restore original timing state if not naturally updated
        if (lastCaptionTime === Date.now() - (CONFIG.TIMING.SILENCE_TIMEOUT + 1000)) {
            lastCaptionTime = originalTime;
        }

        processingState.isSilenceDetection = false;
        console.log(`✅ Silence detection completed: ${reason}`);
        
        return result;
    } catch (error) {
        processingState.isSilenceDetection = false;
        console.error(`Error in silence detection (${reason}):`, error);
        return false;
    }
}

// Processing state management functions
function setProcessingState(isProcessing) {
    processingState.isProcessing = isProcessing;
    if (isProcessing) {
        console.log('🔄 Caption processing started');
    }
}

function canStartProcessing() {
    return !processingState.isProcessing && !processingState.isSilenceDetection;
}

// Debounced caption processing to prevent excessive processing during high activity
function debouncedCheckCaptions() {
    const now = Date.now();
    const minInterval = CONFIG.TIMING.DEBOUNCE_INTERVAL; // Minimum interval between processing runs
    
    // Check if we can start processing
    if (!canStartProcessing()) {
        console.log('Processing blocked by active operations');
        return;
    }
    
    // Clear existing throttle timer
    if (processingThrottle) {
        clearTimeout(processingThrottle);
    }
    
    // If we processed recently, delay this run
    const timeSinceLastProcessing = now - lastProcessingTime;
    if (timeSinceLastProcessing < minInterval) {
        processingStats.throttledCalls++;
        processingThrottle = setTimeout(() => {
            if (canStartProcessing()) {
                lastProcessingTime = Date.now();
                setProcessingState(true);
                const startTime = performance.now();
                checkCaptions();
                const endTime = performance.now();
                processingStats.runs++;
                processingStats.totalTime += (endTime - startTime);
                setProcessingState(false);
            }
        }, minInterval - timeSinceLastProcessing);
        return;
    }
    
    // Process immediately
    lastProcessingTime = now;
    setProcessingState(true);
    const startTime = performance.now();
    checkCaptions();
    const endTime = performance.now();
    processingStats.runs++;
    processingStats.totalTime += (endTime - startTime);
    setProcessingState(false);
}

function checkCaptions() {
    try {
        // Get all caption text elements using centralized function
        const captionTextElements = getCaptionElements();
    
    // Create a snapshot of current caption content to detect real changes
    if (captionTextElements.length > 0) {
        const currentSnapshot = Array.from(captionTextElements).map(el => el.innerText.trim()).join('|');
        
        // Only update timing if the content actually changed
        if (currentSnapshot !== lastCaptionSnapshot) {
            lastCaptionSnapshot = currentSnapshot;
            lastCaptionTime = Date.now();
            
            console.log('Caption content changed, resetting silence timer');
            
            // Reset the silence check timer
            if (silenceCheckTimer) {
                clearTimeout(silenceCheckTimer);
            }
            
            // Set a timer to check for recent captions after configured silence timeout
            silenceCheckTimer = setTimeout(checkRecentCaptions, CONFIG.TIMING.SILENCE_TIMEOUT);
        }
    }
    
    // Use configurable thresholds for better caption capture
    // Balance between stability and completeness for full transcript retention
    if (captionTextElements.length < CONFIG.MEMORY.MIN_CAPTIONS_REQUIRED) {
        console.log(`Only ${captionTextElements.length} captions, need at least ${CONFIG.MEMORY.MIN_CAPTIONS_REQUIRED} for stable processing`);
        return; // Not enough captions to safely determine which are stable
    }
    
    const numStableElements = Math.max(1, captionTextElements.length - CONFIG.MEMORY.STABILITY_BUFFER);
    
    for (let i = 0; i < numStableElements; i++) {
        const textElement = captionTextElements[i];
        
        // Use helper function with fallback strategies
        const captionData = extractCaptionData(textElement);
        if (!captionData) continue;
        
        const { text: Text, name: Name } = captionData;
        
        // Process caption update detection
        const shouldProcess = processCaptionUpdate(captionData, i);
        if (!shouldProcess) continue;
        
        // Enhanced duplicate detection with fuzzy matching
        if (isDuplicateCaption(Name, Text)) {
            continue;
        }
        
        // Create a unique key using consistent helper function
        const captionKey = createCaptionKey(Name, Text);
        
        // Mark as processed
        processedCaptions.add(captionKey);
        
        // Add to transcript array
        const Time = new Date().toLocaleTimeString();
        const newCaption = {
            Name,
            Text,
            Time,
            ID: captionKey
        };
        
        transcriptArray.push(newCaption);
        console.log('FINAL STABLE CAPTION:', newCaption);
    }
    } catch (error) {
        console.error('Error in checkCaptions:', error);
    }
}

function checkRecentCaptions() {
    console.log('checkRecentCaptions called - checking for silence-based captions');
    
    // After 5 seconds of silence, check if there are recent captions we can safely capture
    const captionTextElements = getCaptionElements();
    
    if (captionTextElements.length === 0) {
        console.log('No caption elements found for silence check');
        return;
    }
    
    console.log(`Found ${captionTextElements.length} caption elements for silence check`);
    
    // If it's been 5+ seconds since last activity, consider the last 2-3 captions as stable
    const timeSinceLastCaption = Date.now() - lastCaptionTime;
    console.log(`Time since last caption: ${timeSinceLastCaption}ms`);
    
    if (timeSinceLastCaption >= CONFIG.TIMING.SILENCE_TIMER_OFFSET) { // Slightly less than silence timeout to account for timer timing
        console.log('Processing recent captions due to silence...');
        
        // Process the more recent captions 
        // Cover the gap between stable processing and current processing
        const startIndex = Math.max(0, captionTextElements.length - CONFIG.MEMORY.STABILITY_BUFFER); 
        let endIndex = captionTextElements.length - 1; // Usually skip the very last one
        
        // If this is triggered by user export request, try to include the very last caption too
        // Check if the last caption looks complete (ends with punctuation)
        if (captionTextElements.length > 0) {
            const lastElement = captionTextElements[captionTextElements.length - 1];
            const lastText = lastElement.innerText.trim();
            if (lastText.match(/[.!?]$/)) {
                console.log('Last caption ends with punctuation, including it:', lastText);
                endIndex = captionTextElements.length; // Include the very last one
            }
        }
        
        console.log(`Processing captions from index ${startIndex} to ${endIndex - 1}`);
        
        for (let i = startIndex; i < endIndex; i++) {
            const textElement = captionTextElements[i];
            
            // Use helper function with fallback strategies
            const captionData = extractCaptionData(textElement);
            if (!captionData) continue;
            
            const { text: Text, name: Name } = captionData;
            
            // Process caption update detection for silence-based captions
            const shouldProcess = processCaptionUpdate(captionData, i);
            if (!shouldProcess) continue;
            
            // Enhanced duplicate detection with fuzzy matching
            if (isDuplicateCaption(Name, Text)) {
                console.log(`Skipping duplicate silence caption: ${Text}`);
                continue;
            }
            
            // Create a unique key using consistent helper function
            const captionKey = createCaptionKey(Name, Text);
            
            // Mark as processed
            processedCaptions.add(captionKey);
            
            // Add to transcript array
            const Time = new Date().toLocaleTimeString();
            const newCaption = {
                Name,
                Text,
                Time,
                ID: captionKey
            };
            
            transcriptArray.push(newCaption);
            console.log('SILENCE-DETECTED STABLE CAPTION:', newCaption);
        }
    } else {
        console.log('Not enough silence time elapsed');
    }
}

// Add a periodic check for silence in case MutationObserver stops firing
let periodicCheckCounter = 0;
setInterval(() => {
    periodicCheckCounter++;
    
    if (lastCaptionTime === 0) {
        // No captions have been processed yet, skip silence check
        return;
    }
    
    const timeSinceLastCaption = Date.now() - lastCaptionTime;
    if (timeSinceLastCaption >= CONFIG.TIMING.SILENCE_TIMEOUT && timeSinceLastCaption <= (CONFIG.TIMING.SILENCE_TIMEOUT + 1000)) {
        console.log('Periodic silence check triggered');
        triggerSilenceDetection('periodic-check');
    }
    
    // Run memory cleanup every configured interval
    if (periodicCheckCounter % (CONFIG.TIMING.MEMORY_CLEANUP_INTERVAL / CONFIG.TIMING.PERIODIC_CHECK_INTERVAL) === 0) {
        cleanupMemory();
    }
}, CONFIG.TIMING.PERIODIC_CHECK_INTERVAL);

// run startTranscription every 5 seconds
// cancel the interval if capturing is true
// Optimized meeting detection with caching
function detectMeetingState() {
    const now = Date.now();
    
    // Use cached result if still valid
    if (now - meetingDetectionCache.timestamp < meetingDetectionCache.cacheDuration) {
        return meetingDetectionCache.result;
    }
    
    try {
        // Check specific, efficient indicators first
        const quickIndicators = [
            document.getElementById("call-duration-custom"),
            document.querySelector("[data-tid='call-status-container-test-id']"),
            document.querySelector("#call-status")
        ];
        
        let inMeeting = quickIndicators.some(indicator => indicator !== null);
        
        // Only do expensive span query if quick checks fail
        if (!inMeeting) {
            // More targeted search for waiting text
            const waitingSpans = document.querySelectorAll('span[class*="waiting"], span[class*="join"]');
            inMeeting = Array.from(waitingSpans).some(el => 
                el.textContent && el.textContent.includes("Waiting for others to join")
            );
        }
        
        // Cache the result
        meetingDetectionCache.result = inMeeting;
        meetingDetectionCache.timestamp = now;
        
        return inMeeting;
    } catch (error) {
        console.warn('Error in meeting detection:', error);
        return meetingDetectionCache.result; // Return last known state
    }
}

function startTranscription() {
    const inMeeting = detectMeetingState();
    
    if (!inMeeting) {
        setTimeout(startTranscription, 5000);
        return false;
    }

    const closedCaptionsContainer = document.querySelector("[data-tid='closed-captions-renderer']");
    if (!closedCaptionsContainer) {
        console.log("Please, click 'More' > 'Language and speech' > 'Turn on live captions'");
        setTimeout(startTranscription, 5000);
        return false;
    }

    console.log("Found captions container, setting up observer...");
    
    // Clean up any existing timers/observers before setting up new ones
    cleanupAllTimers();
    
    capturing = true;
    observer = new MutationObserver((mutations) => {
        console.log('MutationObserver fired with', mutations.length, 'mutations');
        debouncedCheckCaptions(); // Use debounced processing
    });
    observer.observe(closedCaptionsContainer, {
        childList: true,
        subtree: true,
        characterData: true // Also watch for text changes
    });
    
    console.log("Observer set up, doing initial check...");
    // Do an initial check
    debouncedCheckCaptions();
    
    // Set up a fallback timer to check periodically (prevent timer leak)
    fallbackTimer = setInterval(() => {
        console.log("Fallback timer check...");
        debouncedCheckCaptions();
    }, CONFIG.TIMING.FALLBACK_TIMER_INTERVAL); // Configurable interval for better performance
    

    return true;
}

function sortTranscriptsByScreenOrder() {
    // Get the current order of captions as they appear on screen using centralized function
    const captionTextElements = getCaptionElements();
    const screenOrder = [];
    
    captionTextElements.forEach((element, index) => {
        // Use centralized extraction function for consistency
        const captionData = extractCaptionData(element);
        if (captionData) {
            screenOrder.push({
                text: captionData.text, // Already normalized by extractCaptionData
                name: captionData.name,
                screenPosition: index
            });
        }
    });
    
    // Create a map for quick lookup of screen positions using consistent keys
    const positionMap = new Map();
    screenOrder.forEach(item => {
        const key = createCaptionKey(item.name, item.text);
        positionMap.set(key, item.screenPosition);
    });
    
    // Sort transcriptArray based on screen order
    const orderedTranscripts = [...transcriptArray].sort((a, b) => {
        const keyA = createCaptionKey(a.Name, a.Text);
        const keyB = createCaptionKey(b.Name, b.Text);
        
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
}

console.log("Starting transcription...");
const startResult = startTranscription();
console.log("startTranscription returned:", startResult);

// Manual silence check for testing - runs regardless of startTranscription result
setTimeout(() => {
    console.log("MANUAL SILENCE CHECK - using centralized control");
    triggerSilenceDetection('manual-test-check');
}, 10000); // Run this once after 10 seconds

// Listen for messages from the popup.js or service_worker.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Content script received message:", request);
    
    switch (request.message) {
        case 'return_transcript':
            console.log("return_transcript request received:", transcriptArray);
            
            // Before sending, try to capture any recent captions that might not have been processed yet
            console.log("Attempting to capture recent captions before download...");
            triggerSilenceDetection('download-request');
            
            if (!capturing || transcriptArray.length === 0) {
                alert("Oops! No captions were captured. Please make sure captions are turned on.");
                sendResponse({success: false});
                return;
            }

            // Sort transcripts by the order they appear on screen (not by capture time)
            const orderedForDownload = sortTranscriptsByScreenOrder();
            
            const meetingTitle = document.title.replace("__Microsoft_Teams", '').replace(/[^a-z0-9 ]/gi, '');
            chrome.runtime.sendMessage({
                message: "download_captions",
                transcriptArray: orderedForDownload.map(({ID, ...rest}) => rest), // Remove ID property
                meetingTitle: meetingTitle
            });
            sendResponse({success: true});
            break;

        case 'get_captions_for_viewing':
            console.log("get_captions_for_viewing request received:", transcriptArray);
            
            // Before sending, try to capture any recent captions that might not have been processed yet
            console.log("Attempting to capture recent captions before viewing...");
            triggerSilenceDetection('view-request');
            
            if (!capturing || transcriptArray.length === 0) {
                alert("Oops! No captions were captured. Please make sure captions are turned on.");
                sendResponse({success: false});
                return;
            }

            // Sort transcripts by the order they appear on screen (not by capture time)
            const orderedForViewing = sortTranscriptsByScreenOrder();
            
            // Remove ID property from each item in the array before sending
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
    
    return true; // Keep the message channel open for async response
});

console.log("content_script.js is running");