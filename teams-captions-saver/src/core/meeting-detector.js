/**
 * Meeting state detection with caching
 */

import { TIMING, SELECTORS } from '../config/constants.js';
import { DOMHelpers } from '../utils/dom-helpers.js';

export class MeetingDetector {
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
        if (now - this.meetingDetectionCache.timestamp < TIMING.MEETING_CACHE_DURATION) {
            return this.meetingDetectionCache.result;
        }
        
        try {
            // Check specific, efficient indicators first
            const quickIndicators = [
                document.getElementById(SELECTORS.MEETING_INDICATORS.CALL_DURATION.slice(1)),
                DOMHelpers.safeQuerySelector(document, SELECTORS.MEETING_INDICATORS.CALL_STATUS_CONTAINER),
                DOMHelpers.safeQuerySelector(document, SELECTORS.MEETING_INDICATORS.CALL_STATUS)
            ];
            
            let inMeeting = quickIndicators.some(indicator => indicator !== null);
            
            // Only do expensive span query if quick checks fail
            if (!inMeeting) {
                const waitingSpans = DOMHelpers.safeQuerySelectorAll('span[class*="waiting"], span[class*="join"]');
                inMeeting = Array.from(waitingSpans).some(el => {
                    const text = DOMHelpers.safeExtractText(el);
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