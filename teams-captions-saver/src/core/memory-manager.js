/**
 * Memory management for caption tracking and cleanup
 */

import { MEMORY } from '../config/constants.js';

export class MemoryManager {
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
            if (now - data.timestamp > MEMORY.TRACKING_DATA_MAX_AGE) {
                this.captionElementTracking.delete(key);
                removedTracking++;
            }
        }
        
        // If still too many entries, remove oldest ones
        if (this.captionElementTracking.size > MEMORY.MAX_TRACKING_ENTRIES) {
            const entries = Array.from(this.captionElementTracking.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            
            const toRemove = entries.slice(0, this.captionElementTracking.size - MEMORY.MAX_TRACKING_ENTRIES);
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