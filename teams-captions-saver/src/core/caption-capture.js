/**
 * Core caption capture and processing logic
 */

import { TIMING, MEMORY, SIMILARITY_THRESHOLDS } from '../config/constants.js';
import { DOMHelpers } from '../utils/dom-helpers.js';
import { TextProcessor } from '../utils/text-processing.js';

export class CaptionCapture {
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
            const { text, name } = captionData;
            
            // Create tracking key based on element position and speaker
            const trackingKey = `${elementIndex}:${name}`;
            
            // Check if we've seen this element position before
            const previousData = this.memoryManager.captionElementTracking.get(trackingKey);
            
            if (previousData) {
                // This is potentially an update to an existing caption
                const previousText = previousData.text;
                
                // Check if current text is an extension/correction of previous text using similarity
                const similarity = TextProcessor.calculateTextSimilarity(text, previousText);
                const isUpdate = (text.length > previousText.length && similarity > SIMILARITY_THRESHOLDS.UPDATE_DETECTION) || 
                                (similarity > SIMILARITY_THRESHOLDS.HIGH_SIMILARITY);
                
                if (isUpdate) {
                    console.log(`Caption update detected (similarity: ${similarity.toFixed(2)}): "${previousText}" -> "${text}"`);
                    
                    // Remove the previous version from processed set and transcript array
                    const oldCaptionKey = TextProcessor.createCaptionKey(name, previousText);
                    this.memoryManager.processedCaptions.delete(oldCaptionKey);
                    
                    // Remove old version from transcript array
                    const oldIndex = this.transcriptArray.findIndex(item => 
                        item.Name === name && item.Text === previousText && item.ID === oldCaptionKey
                    );
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
            const captionKey = TextProcessor.createCaptionKey(name, text);
            
            // First check exact match
            if (this.memoryManager.processedCaptions.has(captionKey)) {
                return true;
            }
            
            // Check for similar captions in recent transcript
            const recentTranscripts = this.transcriptArray.slice(-MEMORY.RECENT_TRANSCRIPTS_LIMIT);
            
            for (const transcript of recentTranscripts) {
                if (transcript.Name === name) {
                    const similarity = TextProcessor.calculateTextSimilarity(text, transcript.Text);
                    if (similarity > SIMILARITY_THRESHOLDS.DUPLICATE_DETECTION) {
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
            const captionTextElements = DOMHelpers.getCaptionElements();
            
            // Create a snapshot of current caption content to detect real changes
            if (captionTextElements.length > 0) {
                const currentSnapshot = Array.from(captionTextElements).map(el => DOMHelpers.safeExtractText(el)).join('|');
                
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
                    }, TIMING.SILENCE_TIMEOUT);
                }
            }
            
            // Use configurable thresholds for better caption capture
            if (captionTextElements.length < MEMORY.MIN_CAPTIONS_REQUIRED) {
                console.log(`Only ${captionTextElements.length} captions, need at least ${MEMORY.MIN_CAPTIONS_REQUIRED} for stable processing`);
                return;
            }
            
            const numStableElements = Math.max(1, captionTextElements.length - MEMORY.STABILITY_BUFFER);
            
            for (let i = 0; i < numStableElements; i++) {
                const textElement = captionTextElements[i];
                
                // Use helper function with fallback strategies
                const captionData = DOMHelpers.extractCaptionData(textElement);
                if (!captionData) continue;
                
                const { text: Text, name: Name } = captionData;
                const normalizedText = TextProcessor.normalizeText(Text);
                
                // Process caption update detection
                const shouldProcess = this.processCaptionUpdate({...captionData, text: normalizedText}, i);
                if (!shouldProcess) continue;
                
                // Enhanced duplicate detection with fuzzy matching
                if (this.isDuplicateCaption(Name, normalizedText)) {
                    continue;
                }
                
                // Create a unique key using consistent helper function
                const captionKey = TextProcessor.createCaptionKey(Name, normalizedText);
                
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
            
            const captionTextElements = DOMHelpers.getCaptionElements();
            
            if (captionTextElements.length === 0) {
                console.log('No caption elements found for silence check');
                return;
            }
            
            console.log(`Found ${captionTextElements.length} caption elements for silence check`);
            
            const timeSinceLastCaption = Date.now() - this.stateManager.lastCaptionTime;
            console.log(`Time since last caption: ${timeSinceLastCaption}ms`);
            
            if (timeSinceLastCaption >= TIMING.SILENCE_TIMER_OFFSET) {
                console.log('Processing recent captions due to silence...');
                
                const startIndex = Math.max(0, captionTextElements.length - MEMORY.STABILITY_BUFFER); 
                let endIndex = captionTextElements.length - 1;
                
                // Check if the last caption looks complete (ends with punctuation)
                if (captionTextElements.length > 0) {
                    const lastElement = captionTextElements[captionTextElements.length - 1];
                    const lastText = DOMHelpers.safeExtractText(lastElement);
                    if (lastText.match(/[.!?]$/)) {
                        console.log('Last caption ends with punctuation, including it:', lastText);
                        endIndex = captionTextElements.length;
                    }
                }
                
                console.log(`Processing captions from index ${startIndex} to ${endIndex - 1}`);
                
                for (let i = startIndex; i < endIndex; i++) {
                    const textElement = captionTextElements[i];
                    
                    const captionData = DOMHelpers.extractCaptionData(textElement);
                    if (!captionData) continue;
                    
                    const { text: Text, name: Name } = captionData;
                    const normalizedText = TextProcessor.normalizeText(Text);
                    
                    // Process caption update detection for silence-based captions
                    const shouldProcess = this.processCaptionUpdate({...captionData, text: normalizedText}, i);
                    if (!shouldProcess) continue;
                    
                    // Enhanced duplicate detection with fuzzy matching
                    if (this.isDuplicateCaption(Name, normalizedText)) {
                        console.log(`Skipping duplicate silence caption: ${normalizedText}`);
                        continue;
                    }
                    
                    const captionKey = TextProcessor.createCaptionKey(Name, normalizedText);
                    
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
        if (timeSinceLastProcessing < TIMING.DEBOUNCE_INTERVAL) {
            this.stateManager.processingStats.throttledCalls++;
            this.stateManager.processingThrottle = setTimeout(() => {
                if (this.stateManager.canStartProcessing()) {
                    this.stateManager.lastProcessingTime = Date.now();
                    this.stateManager.setProcessingState(true);
                    const startTime = performance.now();
                    this.checkCaptions();
                    const endTime = performance.now();
                    this.stateManager.processingStats.runs++;
                    this.stateManager.processingStats.totalTime += (endTime - startTime);
                    this.stateManager.setProcessingState(false);
                }
            }, TIMING.DEBOUNCE_INTERVAL - timeSinceLastProcessing);
            return;
        }
        
        // Process immediately
        this.stateManager.lastProcessingTime = now;
        this.stateManager.setProcessingState(true);
        const startTime = performance.now();
        this.checkCaptions();
        const endTime = performance.now();
        this.stateManager.processingStats.runs++;
        this.stateManager.processingStats.totalTime += (endTime - startTime);
        this.stateManager.setProcessingState(false);
    }

    /**
     * Sort transcripts by screen order
     */
    sortTranscriptsByScreenOrder() {
        try {
            // Get the current order of captions as they appear on screen
            const captionTextElements = DOMHelpers.getCaptionElements();
            const screenOrder = [];
            
            captionTextElements.forEach((element, index) => {
                const captionData = DOMHelpers.extractCaptionData(element);
                if (captionData) {
                    screenOrder.push({
                        text: TextProcessor.normalizeText(captionData.text),
                        name: captionData.name,
                        screenPosition: index
                    });
                }
            });
            
            // Create a map for quick lookup of screen positions using consistent keys
            const positionMap = new Map();
            screenOrder.forEach(item => {
                const key = TextProcessor.createCaptionKey(item.name, item.text);
                positionMap.set(key, item.screenPosition);
            });
            
            // Sort transcriptArray based on screen order
            const orderedTranscripts = [...this.transcriptArray].sort((a, b) => {
                const keyA = TextProcessor.createCaptionKey(a.Name, a.Text);
                const keyB = TextProcessor.createCaptionKey(b.Name, b.Text);
                
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