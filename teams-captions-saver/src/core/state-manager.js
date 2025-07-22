/**
 * State management for caption processing
 */

import { TIMING } from '../config/constants.js';

export class StateManager {
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
                setTimeout(() => this.triggerSilenceDetection(reason, captionProcessor), TIMING.DEFER_RETRY_DELAY);
                return false;
            }

            this.processingState.isSilenceDetection = true;
            this.processingState.lastSilenceDetectionReason = reason;
            
            console.log(`🔕 Triggering silence detection: ${reason}`);

            // Set artificial timing state for silence detection
            const originalTime = this.lastCaptionTime;
            this.lastCaptionTime = Date.now() - (TIMING.SILENCE_TIMEOUT + 1000);

            // Execute silence detection
            const result = captionProcessor.checkRecentCaptions();

            // Restore original timing state if not naturally updated
            if (this.lastCaptionTime === Date.now() - (TIMING.SILENCE_TIMEOUT + 1000)) {
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