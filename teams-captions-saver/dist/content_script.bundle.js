/******/ (function() { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 54:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.StateManager = void 0;
var _constants = __webpack_require__(997);
/**
 * State management for caption processing
 */

class StateManager {
  constructor() {
    // Processing state tracking
    this.processingState = {
      isProcessing: false,
      isSilenceDetection: false,
      isForceCapture: false,
      lastSilenceDetectionReason: ''
    };

    // Performance monitoring
    this.processingStats = {
      runs: 0,
      totalTime: 0,
      throttledCalls: 0
    };

    // Timing state
    this.lastCaptionTime = 0;
    this.lastProcessingTime = 0;
    this.lastCaptionSnapshot = '';

    // Timer references
    this.silenceCheckTimer = null;
    this.processingThrottle = null;
    this.fallbackTimer = null;
  }

  /**
   * Set processing state
   */
  setProcessingState(isProcessing) {
    this.processingState.isProcessing = isProcessing;
    if (isProcessing) {
      console.log('🔄 Caption processing started');
    }
  }

  /**
   * Check if processing can start
   */
  canStartProcessing() {
    return !this.processingState.isProcessing && !this.processingState.isSilenceDetection;
  }

  /**
   * Centralized silence detection control
   */
  triggerSilenceDetection(reason = 'unknown', captionProcessor) {
    try {
      // Prevent overlapping silence detection operations
      if (this.processingState.isSilenceDetection) {
        console.log(`Silence detection already in progress, skipping: ${reason}`);
        return false;
      }

      // Prevent interference with ongoing processing
      if (this.processingState.isProcessing) {
        console.log(`Caption processing active, deferring silence detection: ${reason}`);
        setTimeout(() => this.triggerSilenceDetection(reason, captionProcessor), _constants.TIMING.DEFER_RETRY_DELAY);
        return false;
      }
      this.processingState.isSilenceDetection = true;
      this.processingState.lastSilenceDetectionReason = reason;
      console.log(`🔕 Triggering silence detection: ${reason}`);

      // Set artificial timing state for silence detection
      const originalTime = this.lastCaptionTime;
      this.lastCaptionTime = Date.now() - (_constants.TIMING.SILENCE_TIMEOUT + 1000);

      // Execute silence detection
      const result = captionProcessor.checkRecentCaptions();

      // Restore original timing state if not naturally updated
      if (this.lastCaptionTime === Date.now() - (_constants.TIMING.SILENCE_TIMEOUT + 1000)) {
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

  /**
   * Cleanup all timers
   */
  cleanupAllTimers() {
    try {
      if (this.silenceCheckTimer) {
        clearTimeout(this.silenceCheckTimer);
        this.silenceCheckTimer = null;
      }
      if (this.processingThrottle) {
        clearTimeout(this.processingThrottle);
        this.processingThrottle = null;
      }
      if (this.fallbackTimer) {
        clearInterval(this.fallbackTimer);
        this.fallbackTimer = null;
      }
      console.log('All timers cleaned up');
    } catch (error) {
      console.warn('Error during timer cleanup:', error);
    }
  }
}
exports.StateManager = StateManager;

/***/ }),

/***/ 95:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.MeetingDetector = void 0;
var _constants = __webpack_require__(997);
var _domHelpers = __webpack_require__(103);
/**
 * Meeting state detection with caching
 */

class MeetingDetector {
  constructor() {
    // Meeting detection cache
    this.meetingDetectionCache = {
      result: false,
      timestamp: 0
    };
  }

  /**
   * Optimized meeting detection with caching
   */
  detectMeetingState() {
    const now = Date.now();

    // Use cached result if still valid
    if (now - this.meetingDetectionCache.timestamp < _constants.TIMING.MEETING_CACHE_DURATION) {
      return this.meetingDetectionCache.result;
    }
    try {
      // Check specific, efficient indicators first
      const quickIndicators = [document.getElementById(_constants.SELECTORS.MEETING_INDICATORS.CALL_DURATION.slice(1)), _domHelpers.DOMHelpers.safeQuerySelector(document, _constants.SELECTORS.MEETING_INDICATORS.CALL_STATUS_CONTAINER), _domHelpers.DOMHelpers.safeQuerySelector(document, _constants.SELECTORS.MEETING_INDICATORS.CALL_STATUS)];
      let inMeeting = quickIndicators.some(indicator => indicator !== null);

      // Only do expensive span query if quick checks fail
      if (!inMeeting) {
        const waitingSpans = _domHelpers.DOMHelpers.safeQuerySelectorAll('span[class*="waiting"], span[class*="join"]');
        inMeeting = Array.from(waitingSpans).some(el => {
          const text = _domHelpers.DOMHelpers.safeExtractText(el);
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
}
exports.MeetingDetector = MeetingDetector;

/***/ }),

/***/ 103:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.DOMHelpers = void 0;
var _constants = __webpack_require__(997);
/**
 * DOM utility functions for safe DOM operations
 */

class DOMHelpers {
  /**
   * Safe DOM query selector
   */
  static safeQuerySelector(element, selector) {
    try {
      return element ? element.querySelector(selector) : null;
    } catch (error) {
      console.warn(`Safe query selector failed for "${selector}":`, error);
      return null;
    }
  }

  /**
   * Safe DOM query selector all
   */
  static safeQuerySelectorAll(selector) {
    try {
      return document.querySelectorAll(selector) || [];
    } catch (error) {
      console.warn(`Safe query selector all failed for "${selector}":`, error);
      return [];
    }
  }

  /**
   * Safe text extraction
   */
  static safeExtractText(element) {
    try {
      if (!element) return '';
      return (element.innerText || element.textContent || '').trim();
    } catch (error) {
      console.warn('Safe text extraction failed:', error);
      return '';
    }
  }

  /**
   * Safe closest element search
   */
  static safeClosest(element, selector) {
    try {
      return element ? element.closest(selector) : null;
    } catch (error) {
      console.warn(`Safe closest failed for "${selector}":`, error);
      return null;
    }
  }

  /**
   * Get caption elements with fallback selectors
   */
  static getCaptionElements() {
    try {
      // Primary selector
      let captionTextElements = this.safeQuerySelectorAll(_constants.SELECTORS.PRIMARY_CAPTION);

      // Fallback selectors if primary doesn't work
      if (captionTextElements.length === 0) {
        for (const selector of _constants.SELECTORS.FALLBACK_CAPTIONS) {
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
  }

  /**
   * Extract caption data with fallback strategies
   */
  static extractCaptionData(textElement) {
    try {
      const result = {
        text: '',
        name: 'Unknown Speaker',
        element: textElement
      };

      // Primary text extraction with normalization
      const rawText = this.safeExtractText(textElement);
      result.text = rawText; // Will be normalized by TextProcessor
      if (!result.text) return null;

      // Primary author extraction strategy
      const transcript = this.safeClosest(textElement, _constants.SELECTORS.CHAT_MESSAGE);
      if (transcript) {
        const authorElement = this.safeQuerySelector(transcript, _constants.SELECTORS.AUTHOR);
        if (authorElement) {
          result.name = this.safeExtractText(authorElement);
        }
      }

      // Fallback author extraction strategies
      if (result.name === 'Unknown Speaker') {
        const fallbackSelectors = ['[data-tid="author"]', '.fui-ChatMessageAuthor', '[class*="author"]', '[class*="Author"]', '[class*="name"]', '[class*="Name"]'];
        for (const selector of fallbackSelectors) {
          var _textElement$parentEl;
          const chatMessage = this.safeClosest(textElement, '[class*="ChatMessage"]');
          const authorEl = this.safeQuerySelector(chatMessage, selector) || this.safeQuerySelector(textElement.parentElement, selector) || this.safeQuerySelector((_textElement$parentEl = textElement.parentElement) === null || _textElement$parentEl === void 0 ? void 0 : _textElement$parentEl.parentElement, selector);
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
}
exports.DOMHelpers = DOMHelpers;

/***/ }),

/***/ 128:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.CaptionCapture = void 0;
var _constants = __webpack_require__(997);
var _domHelpers = __webpack_require__(103);
var _textProcessing = __webpack_require__(666);
/**
 * Core caption capture and processing logic
 */

class CaptionCapture {
  constructor(stateManager, memoryManager) {
    this.stateManager = stateManager;
    this.memoryManager = memoryManager;
    this.transcriptArray = [];
    this.transcriptIdCounter = 0;
  }

  /**
   * Process caption updates and handle live caption changes
   */
  processCaptionUpdate(captionData, elementIndex) {
    try {
      const {
        text,
        name
      } = captionData;

      // Create tracking key based on element position and speaker
      const trackingKey = `${elementIndex}:${name}`;

      // Check if we've seen this element position before
      const previousData = this.memoryManager.captionElementTracking.get(trackingKey);
      if (previousData) {
        // This is potentially an update to an existing caption
        const previousText = previousData.text;

        // Check if current text is an extension/correction of previous text using similarity
        const similarity = _textProcessing.TextProcessor.calculateTextSimilarity(text, previousText);
        const isUpdate = text.length > previousText.length && similarity > _constants.SIMILARITY_THRESHOLDS.UPDATE_DETECTION || similarity > _constants.SIMILARITY_THRESHOLDS.HIGH_SIMILARITY;
        if (isUpdate) {
          console.log(`Caption update detected (similarity: ${similarity.toFixed(2)}): "${previousText}" -> "${text}"`);

          // Remove the previous version from processed set and transcript array
          const oldCaptionKey = _textProcessing.TextProcessor.createCaptionKey(name, previousText);
          this.memoryManager.processedCaptions.delete(oldCaptionKey);

          // Remove old version from transcript array
          const oldIndex = this.transcriptArray.findIndex(item => item.Name === name && item.Text === previousText && item.ID === oldCaptionKey);
          if (oldIndex !== -1) {
            this.transcriptArray.splice(oldIndex, 1);
            console.log(`Removed old version from transcript: "${previousText}"`);
          }
        }
      }

      // Update tracking data with current caption
      this.memoryManager.captionElementTracking.set(trackingKey, {
        text: text,
        timestamp: Date.now(),
        processed: false
      });
      return true;
    } catch (error) {
      console.error('Error in processCaptionUpdate:', error);
      return false;
    }
  }

  /**
   * Enhanced duplicate detection with fuzzy matching
   */
  isDuplicateCaption(name, text) {
    try {
      const captionKey = _textProcessing.TextProcessor.createCaptionKey(name, text);

      // First check exact match
      if (this.memoryManager.processedCaptions.has(captionKey)) {
        return true;
      }

      // Check for similar captions in recent transcript
      const recentTranscripts = this.transcriptArray.slice(-_constants.MEMORY.RECENT_TRANSCRIPTS_LIMIT);
      for (const transcript of recentTranscripts) {
        if (transcript.Name === name) {
          const similarity = _textProcessing.TextProcessor.calculateTextSimilarity(text, transcript.Text);
          if (similarity > _constants.SIMILARITY_THRESHOLDS.DUPLICATE_DETECTION) {
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
  }

  /**
   * Main caption processing function
   */
  checkCaptions() {
    try {
      // Get all caption text elements using centralized function
      const captionTextElements = _domHelpers.DOMHelpers.getCaptionElements();

      // Create a snapshot of current caption content to detect real changes
      if (captionTextElements.length > 0) {
        const currentSnapshot = Array.from(captionTextElements).map(el => _domHelpers.DOMHelpers.safeExtractText(el)).join('|');

        // Only update timing if the content actually changed
        if (currentSnapshot !== this.stateManager.lastCaptionSnapshot) {
          this.stateManager.lastCaptionSnapshot = currentSnapshot;
          this.stateManager.lastCaptionTime = Date.now();
          console.log('Caption content changed, resetting silence timer');

          // Reset the silence check timer
          if (this.stateManager.silenceCheckTimer) {
            clearTimeout(this.stateManager.silenceCheckTimer);
          }

          // Set a timer to check for recent captions after configured silence timeout
          this.stateManager.silenceCheckTimer = setTimeout(() => {
            this.checkRecentCaptions();
          }, _constants.TIMING.SILENCE_TIMEOUT);
        }
      }

      // Use configurable thresholds for better caption capture
      if (captionTextElements.length < _constants.MEMORY.MIN_CAPTIONS_REQUIRED) {
        console.log(`Only ${captionTextElements.length} captions, need at least ${_constants.MEMORY.MIN_CAPTIONS_REQUIRED} for stable processing`);
        return;
      }
      const numStableElements = Math.max(1, captionTextElements.length - _constants.MEMORY.STABILITY_BUFFER);
      for (let i = 0; i < numStableElements; i++) {
        const textElement = captionTextElements[i];

        // Use helper function with fallback strategies
        const captionData = _domHelpers.DOMHelpers.extractCaptionData(textElement);
        if (!captionData) continue;
        const {
          text: Text,
          name: Name
        } = captionData;
        const normalizedText = _textProcessing.TextProcessor.normalizeText(Text);

        // Process caption update detection
        const shouldProcess = this.processCaptionUpdate({
          ...captionData,
          text: normalizedText
        }, i);
        if (!shouldProcess) continue;

        // Enhanced duplicate detection with fuzzy matching
        if (this.isDuplicateCaption(Name, normalizedText)) {
          continue;
        }

        // Create a unique key using consistent helper function
        const captionKey = _textProcessing.TextProcessor.createCaptionKey(Name, normalizedText);

        // Mark as processed
        this.memoryManager.processedCaptions.add(captionKey);

        // Add to transcript array
        const Time = new Date().toLocaleTimeString();
        const newCaption = {
          Name,
          Text: normalizedText,
          Time,
          ID: captionKey
        };
        this.transcriptArray.push(newCaption);
        console.log('FINAL STABLE CAPTION:', newCaption);
      }
    } catch (error) {
      console.error('Error in checkCaptions:', error);
    }
  }

  /**
   * Check recent captions during silence periods
   */
  checkRecentCaptions() {
    try {
      console.log('checkRecentCaptions called - checking for silence-based captions');
      const captionTextElements = _domHelpers.DOMHelpers.getCaptionElements();
      if (captionTextElements.length === 0) {
        console.log('No caption elements found for silence check');
        return;
      }
      console.log(`Found ${captionTextElements.length} caption elements for silence check`);
      const timeSinceLastCaption = Date.now() - this.stateManager.lastCaptionTime;
      console.log(`Time since last caption: ${timeSinceLastCaption}ms`);
      if (timeSinceLastCaption >= _constants.TIMING.SILENCE_TIMER_OFFSET) {
        console.log('Processing recent captions due to silence...');
        const startIndex = Math.max(0, captionTextElements.length - _constants.MEMORY.STABILITY_BUFFER);
        let endIndex = captionTextElements.length - 1;

        // Check if the last caption looks complete (ends with punctuation)
        if (captionTextElements.length > 0) {
          const lastElement = captionTextElements[captionTextElements.length - 1];
          const lastText = _domHelpers.DOMHelpers.safeExtractText(lastElement);
          if (lastText.match(/[.!?]$/)) {
            console.log('Last caption ends with punctuation, including it:', lastText);
            endIndex = captionTextElements.length;
          }
        }
        console.log(`Processing captions from index ${startIndex} to ${endIndex - 1}`);
        for (let i = startIndex; i < endIndex; i++) {
          const textElement = captionTextElements[i];
          const captionData = _domHelpers.DOMHelpers.extractCaptionData(textElement);
          if (!captionData) continue;
          const {
            text: Text,
            name: Name
          } = captionData;
          const normalizedText = _textProcessing.TextProcessor.normalizeText(Text);

          // Process caption update detection for silence-based captions
          const shouldProcess = this.processCaptionUpdate({
            ...captionData,
            text: normalizedText
          }, i);
          if (!shouldProcess) continue;

          // Enhanced duplicate detection with fuzzy matching
          if (this.isDuplicateCaption(Name, normalizedText)) {
            console.log(`Skipping duplicate silence caption: ${normalizedText}`);
            continue;
          }
          const captionKey = _textProcessing.TextProcessor.createCaptionKey(Name, normalizedText);

          // Mark as processed
          this.memoryManager.processedCaptions.add(captionKey);

          // Add to transcript array
          const Time = new Date().toLocaleTimeString();
          const newCaption = {
            Name,
            Text: normalizedText,
            Time,
            ID: captionKey
          };
          this.transcriptArray.push(newCaption);
          console.log('SILENCE-DETECTED STABLE CAPTION:', newCaption);
        }
      } else {
        console.log('Not enough silence time elapsed');
      }
    } catch (error) {
      console.error('Error in checkRecentCaptions:', error);
    }
  }

  /**
   * Debounced caption processing to prevent excessive processing
   */
  debouncedCheckCaptions() {
    const now = Date.now();

    // Check if we can start processing
    if (!this.stateManager.canStartProcessing()) {
      console.log('Processing blocked by active operations');
      return;
    }

    // Clear existing throttle timer
    if (this.stateManager.processingThrottle) {
      clearTimeout(this.stateManager.processingThrottle);
    }

    // If we processed recently, delay this run
    const timeSinceLastProcessing = now - this.stateManager.lastProcessingTime;
    if (timeSinceLastProcessing < _constants.TIMING.DEBOUNCE_INTERVAL) {
      this.stateManager.processingStats.throttledCalls++;
      this.stateManager.processingThrottle = setTimeout(() => {
        if (this.stateManager.canStartProcessing()) {
          this.stateManager.lastProcessingTime = Date.now();
          this.stateManager.setProcessingState(true);
          const startTime = performance.now();
          this.checkCaptions();
          const endTime = performance.now();
          this.stateManager.processingStats.runs++;
          this.stateManager.processingStats.totalTime += endTime - startTime;
          this.stateManager.setProcessingState(false);
        }
      }, _constants.TIMING.DEBOUNCE_INTERVAL - timeSinceLastProcessing);
      return;
    }

    // Process immediately
    this.stateManager.lastProcessingTime = now;
    this.stateManager.setProcessingState(true);
    const startTime = performance.now();
    this.checkCaptions();
    const endTime = performance.now();
    this.stateManager.processingStats.runs++;
    this.stateManager.processingStats.totalTime += endTime - startTime;
    this.stateManager.setProcessingState(false);
  }

  /**
   * Sort transcripts by screen order
   */
  sortTranscriptsByScreenOrder() {
    try {
      // Get the current order of captions as they appear on screen
      const captionTextElements = _domHelpers.DOMHelpers.getCaptionElements();
      const screenOrder = [];
      captionTextElements.forEach((element, index) => {
        const captionData = _domHelpers.DOMHelpers.extractCaptionData(element);
        if (captionData) {
          screenOrder.push({
            text: _textProcessing.TextProcessor.normalizeText(captionData.text),
            name: captionData.name,
            screenPosition: index
          });
        }
      });

      // Create a map for quick lookup of screen positions using consistent keys
      const positionMap = new Map();
      screenOrder.forEach(item => {
        const key = _textProcessing.TextProcessor.createCaptionKey(item.name, item.text);
        positionMap.set(key, item.screenPosition);
      });

      // Sort transcriptArray based on screen order
      const orderedTranscripts = [...this.transcriptArray].sort((a, b) => {
        const keyA = _textProcessing.TextProcessor.createCaptionKey(a.Name, a.Text);
        const keyB = _textProcessing.TextProcessor.createCaptionKey(b.Name, b.Text);
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
      return this.transcriptArray;
    }
  }
}
exports.CaptionCapture = CaptionCapture;

/***/ }),

/***/ 666:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.TextProcessor = void 0;
var _constants = __webpack_require__(997);
/**
 * Text processing utilities for caption normalization and similarity detection
 */

class TextProcessor {
  /**
   * Comprehensive text cleaning and normalization
   */
  static normalizeText(text) {
    if (!text) return '';
    let cleaned = text;

    // Remove HTML entities
    cleaned = cleaned.replace(/&[a-zA-Z0-9#]+;/g, ' ');

    // Remove extra whitespace (multiple spaces, tabs, newlines)
    cleaned = cleaned.replace(/\s+/g, ' ');

    // Remove common Teams UI artifacts and typing indicators
    cleaned = cleaned.replace(/\.\.\./g, ''); // Remove ellipsis/typing indicators
    cleaned = cleaned.replace(/^\s*[.\-*><|~+=]+\s*/g, ''); // Remove leading symbols
    cleaned = cleaned.replace(/\s*[.\-*><|~+=]+\s*$/g, ''); // Remove trailing symbols

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

  /**
   * Calculate text similarity for fuzzy duplicate detection
   */
  static calculateTextSimilarity(text1, text2) {
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
      const words1 = norm1.split(/\s+/).filter(w => w.length > _constants.PERFORMANCE.MAX_WORD_LENGTH_FILTER);
      const words2 = norm2.split(/\s+/).filter(w => w.length > _constants.PERFORMANCE.MAX_WORD_LENGTH_FILTER);
      if (words1.length === 0 || words2.length === 0) return 0;
      const commonWords = words1.filter(w => words2.includes(w)).length;
      const totalWords = Math.max(words1.length, words2.length);
      return commonWords / totalWords;
    } catch (error) {
      console.warn('Error calculating text similarity:', error);
      return 0;
    }
  }

  /**
   * Create consistent caption keys
   */
  static createCaptionKey(name, text) {
    const normalizedName = name ? name.trim() : 'Unknown Speaker';
    const normalizedText = this.normalizeText(text);
    return `${normalizedName}:${normalizedText}`;
  }
}
exports.TextProcessor = TextProcessor;

/***/ }),

/***/ 732:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.MemoryManager = void 0;
var _constants = __webpack_require__(997);
/**
 * Memory management for caption tracking and cleanup
 */

class MemoryManager {
  constructor() {
    // Caption tracking data
    this.captionElementTracking = new Map();
    this.processedCaptions = new Set();
  }

  /**
   * Cleanup tracking data while preserving full transcript
   */
  cleanupMemory(transcriptArray, processingState) {
    // Don't run cleanup during active processing to avoid interference
    if (processingState.isProcessing || processingState.isSilenceDetection) {
      console.log('Deferring memory cleanup due to active operations');
      return;
    }
    const now = Date.now();

    // Clean up old caption element tracking data
    let removedTracking = 0;
    for (const [key, data] of this.captionElementTracking.entries()) {
      if (now - data.timestamp > _constants.MEMORY.TRACKING_DATA_MAX_AGE) {
        this.captionElementTracking.delete(key);
        removedTracking++;
      }
    }

    // If still too many entries, remove oldest ones
    if (this.captionElementTracking.size > _constants.MEMORY.MAX_TRACKING_ENTRIES) {
      const entries = Array.from(this.captionElementTracking.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = entries.slice(0, this.captionElementTracking.size - _constants.MEMORY.MAX_TRACKING_ENTRIES);
      for (const [key] of toRemove) {
        this.captionElementTracking.delete(key);
        removedTracking++;
      }
    }

    // Clean up processed captions set (keep only recent ones referenced in transcript)
    const transcriptKeys = new Set(transcriptArray.map(item => item.ID));
    let removedProcessed = 0;
    for (const key of this.processedCaptions) {
      if (!transcriptKeys.has(key)) {
        this.processedCaptions.delete(key);
        removedProcessed++;
      }
    }
    if (removedTracking > 0 || removedProcessed > 0) {
      console.log(`Memory cleanup: removed ${removedTracking} tracking entries, ${removedProcessed} processed caption entries`);
      console.log(`Current memory usage: ${this.captionElementTracking.size} tracking entries, ${this.processedCaptions.size} processed captions, ${transcriptArray.length} transcript entries`);
    }
  }
}
exports.MemoryManager = MemoryManager;

/***/ }),

/***/ 997:
/***/ (function(__unused_webpack_module, exports) {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.TIMING = exports.SIMILARITY_THRESHOLDS = exports.SELECTORS = exports.PERFORMANCE = exports.MEMORY = void 0;
/**
 * Configuration constants for MS Teams Caption Saver
 */

const SIMILARITY_THRESHOLDS = exports.SIMILARITY_THRESHOLDS = {
  UPDATE_DETECTION: 0.7,
  // Minimum similarity to consider caption an update
  HIGH_SIMILARITY: 0.85,
  // High similarity threshold for updates
  DUPLICATE_DETECTION: 0.9 // Very high similarity for duplicate detection
};
const TIMING = exports.TIMING = {
  DEBOUNCE_INTERVAL: 500,
  // Minimum ms between processing runs
  SILENCE_TIMEOUT: 5000,
  // Ms to wait before considering silence
  SILENCE_TIMER_OFFSET: 4500,
  // Slightly less than silence timeout
  MEMORY_CLEANUP_INTERVAL: 60000,
  // Memory cleanup frequency (60 seconds)
  FALLBACK_TIMER_INTERVAL: 3000,
  // Fallback processing check interval
  PERIODIC_CHECK_INTERVAL: 1000,
  // Periodic silence check interval
  DEFER_RETRY_DELAY: 1000,
  // Delay for deferred operations
  MEETING_CACHE_DURATION: 30000 // Meeting detection cache duration
};
const MEMORY = exports.MEMORY = {
  MAX_TRACKING_ENTRIES: 1000,
  // Maximum caption tracking entries
  TRACKING_DATA_MAX_AGE: 300000,
  // 5 minutes for tracking data
  RECENT_TRANSCRIPTS_LIMIT: 20,
  // Number of recent transcripts to check for duplicates
  STABILITY_BUFFER: 2,
  // Number of recent captions to skip for stability
  MIN_CAPTIONS_REQUIRED: 3 // Minimum captions needed before processing
};
const PERFORMANCE = exports.PERFORMANCE = {
  MAX_WORD_LENGTH_FILTER: 2,
  // Minimum word length for similarity comparison
  PERFORMANCE_LOG_FREQUENCY: 60 // How often to log performance stats (cleanup cycles)
};
const SELECTORS = exports.SELECTORS = {
  PRIMARY_CAPTION: '[data-tid="closed-caption-text"]',
  CAPTIONS_CONTAINER: '[data-tid="closed-captions-renderer"]',
  CHAT_MESSAGE: '.fui-ChatMessageCompact',
  AUTHOR: '[data-tid="author"]',
  FALLBACK_CAPTIONS: ['[class*="closed-caption"]', '[class*="caption-text"]', '[class*="CaptionText"]', '[aria-label*="caption"]', '[role="log"] [class*="text"]'],
  MEETING_INDICATORS: {
    CALL_DURATION: '#call-duration-custom',
    CALL_STATUS_CONTAINER: '[data-tid="call-status-container-test-id"]',
    CALL_STATUS: '#call-status'
  }
};

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};


var _constants = __webpack_require__(997);
var _domHelpers = __webpack_require__(103);
var _stateManager = __webpack_require__(54);
var _memoryManager = __webpack_require__(732);
var _captionCapture = __webpack_require__(128);
var _meetingDetector = __webpack_require__(95);
/**
 * MS Teams Caption Saver - Modular Content Script
 * Main entry point for the Chrome extension content script
 */

class TeamsaptionSaver {
  constructor() {
    this.stateManager = new _stateManager.StateManager();
    this.memoryManager = new _memoryManager.MemoryManager();
    this.meetingDetector = new _meetingDetector.MeetingDetector();
    this.captionCapture = new _captionCapture.CaptionCapture(this.stateManager, this.memoryManager);
    this.capturing = false;
    this.observer = null;
    this.periodicCheckCounter = 0;
  }

  /**
   * Initialize periodic checks
   */
  initializePeriodicChecks() {
    setInterval(() => {
      this.periodicCheckCounter++;
      if (this.stateManager.lastCaptionTime === 0) {
        return; // No captions processed yet
      }
      const timeSinceLastCaption = Date.now() - this.stateManager.lastCaptionTime;
      if (timeSinceLastCaption >= _constants.TIMING.SILENCE_TIMEOUT && timeSinceLastCaption <= _constants.TIMING.SILENCE_TIMEOUT + 1000) {
        console.log('Periodic silence check triggered');
        this.stateManager.triggerSilenceDetection('periodic-check', this.captionCapture);
      }

      // Run memory cleanup every configured interval
      if (this.periodicCheckCounter % (_constants.TIMING.MEMORY_CLEANUP_INTERVAL / _constants.TIMING.PERIODIC_CHECK_INTERVAL) === 0) {
        this.memoryManager.cleanupMemory(this.captionCapture.transcriptArray, this.stateManager.processingState);

        // Log performance stats
        const stats = this.stateManager.processingStats;
        if (stats.runs > 0) {
          const avgProcessingTime = (stats.totalTime / stats.runs).toFixed(2);
          console.log(`Performance stats: ${stats.runs} processing runs, ${avgProcessingTime}ms avg, ${stats.throttledCalls} throttled calls`);
        }
      }
    }, _constants.TIMING.PERIODIC_CHECK_INTERVAL);
  }

  /**
   * Start transcription system
   */
  startTranscription() {
    const inMeeting = this.meetingDetector.detectMeetingState();
    if (!inMeeting) {
      setTimeout(() => this.startTranscription(), 5000);
      return false;
    }
    const closedCaptionsContainer = _domHelpers.DOMHelpers.safeQuerySelector(document, _constants.SELECTORS.CAPTIONS_CONTAINER);
    if (!closedCaptionsContainer) {
      console.log("Please, click 'More' > 'Language and speech' > 'Turn on live captions'");
      setTimeout(() => this.startTranscription(), 5000);
      return false;
    }
    console.log("Found captions container, setting up observer...");

    // Clean up any existing timers/observers before setting up new ones
    this.stateManager.cleanupAllTimers();
    if (this.observer) {
      this.observer.disconnect();
    }
    this.capturing = true;
    this.observer = new MutationObserver(mutations => {
      console.log('MutationObserver fired with', mutations.length, 'mutations');
      this.captionCapture.debouncedCheckCaptions();
    });
    this.observer.observe(closedCaptionsContainer, {
      childList: true,
      subtree: true,
      characterData: true
    });
    console.log("Observer set up, doing initial check...");
    this.captionCapture.debouncedCheckCaptions();

    // Set up a fallback timer to check periodically
    this.stateManager.fallbackTimer = setInterval(() => {
      console.log("Fallback timer check...");
      this.captionCapture.debouncedCheckCaptions();
    }, _constants.TIMING.FALLBACK_TIMER_INTERVAL);
    return true;
  }

  /**
   * Handle extension messages
   */
  handleMessage(request, sender, sendResponse) {
    console.log("Content script received message:", request);
    switch (request.message) {
      case 'return_transcript':
        console.log("return_transcript request received:", this.captionCapture.transcriptArray);
        console.log("Attempting to capture recent captions before download...");
        this.stateManager.triggerSilenceDetection('download-request', this.captionCapture);
        if (!this.capturing || this.captionCapture.transcriptArray.length === 0) {
          alert("Oops! No captions were captured. Please make sure captions are turned on.");
          sendResponse({
            success: false
          });
          return;
        }
        const orderedForDownload = this.captionCapture.sortTranscriptsByScreenOrder();
        const meetingTitle = document.title.replace("__Microsoft_Teams", '').replace(/[^a-z0-9 ]/gi, '');
        chrome.runtime.sendMessage({
          message: "download_captions",
          transcriptArray: orderedForDownload.map(({
            ID,
            ...rest
          }) => rest),
          meetingTitle: meetingTitle
        });
        sendResponse({
          success: true
        });
        break;
      case 'get_captions_for_viewing':
        console.log("get_captions_for_viewing request received:", this.captionCapture.transcriptArray);
        console.log("Attempting to capture recent captions before viewing...");
        this.stateManager.triggerSilenceDetection('view-request', this.captionCapture);
        if (!this.capturing || this.captionCapture.transcriptArray.length === 0) {
          alert("Oops! No captions were captured. Please make sure captions are turned on.");
          sendResponse({
            success: false
          });
          return;
        }
        const orderedForViewing = this.captionCapture.sortTranscriptsByScreenOrder();
        const viewableTranscripts = orderedForViewing.map(({
          ID,
          ...rest
        }) => rest);
        chrome.runtime.sendMessage({
          message: "display_captions",
          transcriptArray: viewableTranscripts
        });
        sendResponse({
          success: true
        });
        break;
      default:
        sendResponse({
          success: false,
          error: "Unknown message"
        });
        break;
    }
    return true;
  }

  /**
   * Initialize the entire system
   */
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
      this.stateManager.triggerSilenceDetection('manual-test-check', this.captionCapture);
    }, 10000);

    // Set up message listener
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      return this.handleMessage(request, sender, sendResponse);
    });
    console.log("Modular content_script.js is running");
  }
}

// Initialize the system
const teamscaptionSaver = new TeamsaptionSaver();
teamscaptionSaver.initialize();
/******/ })()
;
//# sourceMappingURL=content_script.bundle.js.map