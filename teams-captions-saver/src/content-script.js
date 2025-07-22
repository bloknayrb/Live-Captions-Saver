/**
 * MS Teams Caption Saver - Modular Content Script
 * Main entry point for the Chrome extension content script
 */

import { TIMING, SELECTORS } from './config/constants.js';
import { DOMHelpers } from './utils/dom-helpers.js';
import { StateManager } from './core/state-manager.js';
import { MemoryManager } from './core/memory-manager.js';
import { CaptionCapture } from './core/caption-capture.js';
import { MeetingDetector } from './core/meeting-detector.js';

class TeamsaptionSaver {
    constructor() {
        this.stateManager = new StateManager();
        this.memoryManager = new MemoryManager();
        this.meetingDetector = new MeetingDetector();
        this.captionCapture = new CaptionCapture(this.stateManager, this.memoryManager);
        
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
            if (timeSinceLastCaption >= TIMING.SILENCE_TIMEOUT && 
                timeSinceLastCaption <= (TIMING.SILENCE_TIMEOUT + 1000)) {
                console.log('Periodic silence check triggered');
                this.stateManager.triggerSilenceDetection('periodic-check', this.captionCapture);
            }
            
            // Run memory cleanup every configured interval
            if (this.periodicCheckCounter % (TIMING.MEMORY_CLEANUP_INTERVAL / TIMING.PERIODIC_CHECK_INTERVAL) === 0) {
                this.memoryManager.cleanupMemory(this.captionCapture.transcriptArray, this.stateManager.processingState);
                
                // Log performance stats
                const stats = this.stateManager.processingStats;
                if (stats.runs > 0) {
                    const avgProcessingTime = (stats.totalTime / stats.runs).toFixed(2);
                    console.log(`Performance stats: ${stats.runs} processing runs, ${avgProcessingTime}ms avg, ${stats.throttledCalls} throttled calls`);
                }
            }
        }, TIMING.PERIODIC_CHECK_INTERVAL);
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

        const closedCaptionsContainer = DOMHelpers.safeQuerySelector(document, SELECTORS.CAPTIONS_CONTAINER);
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
        this.observer = new MutationObserver((mutations) => {
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
        }, TIMING.FALLBACK_TIMER_INTERVAL);
        
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
                    sendResponse({success: false});
                    return;
                }

                const orderedForDownload = this.captionCapture.sortTranscriptsByScreenOrder();
                
                const meetingTitle = document.title.replace("__Microsoft_Teams", '').replace(/[^a-z0-9 ]/gi, '');
                chrome.runtime.sendMessage({
                    message: "download_captions",
                    transcriptArray: orderedForDownload.map(({ID, ...rest}) => rest),
                    meetingTitle: meetingTitle
                });
                sendResponse({success: true});
                break;

            case 'get_captions_for_viewing':
                console.log("get_captions_for_viewing request received:", this.captionCapture.transcriptArray);
                
                console.log("Attempting to capture recent captions before viewing...");
                this.stateManager.triggerSilenceDetection('view-request', this.captionCapture);
                
                if (!this.capturing || this.captionCapture.transcriptArray.length === 0) {
                    alert("Oops! No captions were captured. Please make sure captions are turned on.");
                    sendResponse({success: false});
                    return;
                }

                const orderedForViewing = this.captionCapture.sortTranscriptsByScreenOrder();
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