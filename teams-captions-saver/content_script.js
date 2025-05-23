class TeamsTranscriptCapture {
    constructor() {
        this.transcriptArray = [];
        this.capturing = false;
        this.observer = null;
        this.captionsContainer = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 50;
        this.isProcessing = false;
        
        // Debounce processing to prevent race conditions
        this.debouncedProcess = this.debounce(this.processNewCaptions.bind(this), 100);
        
        this.startCapture();
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    async startCapture() {
        console.log('Starting transcript capture...');
        
        // Wait for meeting to be active
        await this.waitForMeeting();
        
        // Wait for captions to be available
        await this.waitForCaptions();
        
        this.setupObserver();
        this.capturing = true;
        
        console.log('Transcript capture started successfully');
    }

    async waitForMeeting() {
        return new Promise((resolve) => {
            const checkMeeting = () => {
                const meetingElement = document.getElementById("call-duration-custom") || 
                                    document.querySelector('[data-tid="call-duration"]') ||
                                    document.querySelector('[class*="call-duration"]');
                
                if (meetingElement) {
                    console.log('Meeting detected');
                    resolve();
                } else {
                    setTimeout(checkMeeting, 2000);
                }
            };
            checkMeeting();
        });
    }

    async waitForCaptions() {
        return new Promise((resolve) => {
            const checkCaptions = () => {
                this.captionsContainer = this.findCaptionsContainer();
                
                if (this.captionsContainer) {
                    console.log('Captions container found');
                    resolve();
                } else {
                    console.log('Waiting for captions... Make sure live captions are enabled');
                    setTimeout(checkCaptions, 3000);
                }
            };
            checkCaptions();
        });
    }

    findCaptionsContainer() {
        // Try multiple selectors for different Teams versions
        const selectors = [
            "[data-tid='closed-captions-renderer']",
            "[data-tid='captions-renderer']",
            ".closed-captions-renderer",
            "[class*='captions-renderer']",
            "[class*='closed-captions']"
        ];

        for (const selector of selectors) {
            const container = document.querySelector(selector);
            if (container) {
                return container;
            }
        }
        return null;
    }

    setupObserver() {
        if (this.observer) {
            this.observer.disconnect();
        }

        if (!this.captionsContainer) {
            console.error('No captions container available for observation');
            this.scheduleReconnect();
            return;
        }

        try {
            this.observer = new MutationObserver(() => {
                this.debouncedProcess();
            });

            // Observe only the captions container, not the entire body
            this.observer.observe(this.captionsContainer, {
                childList: true,
                subtree: true,
                characterData: true
            });

            // Reset reconnect attempts on successful setup
            this.reconnectAttempts = 0;
            console.log('Observer setup complete');

        } catch (error) {
            console.error('Failed to setup observer:', error);
            this.scheduleReconnect();
        }
    }

    processNewCaptions() {
        if (this.isProcessing) {
            return; // Prevent concurrent processing
        }

        this.isProcessing = true;

        try {
            // Verify container still exists
            if (!this.captionsContainer || !document.contains(this.captionsContainer)) {
                console.log('Captions container lost, attempting reconnection...');
                this.scheduleReconnect();
                return;
            }

            const transcripts = this.captionsContainer.querySelectorAll('.ui-chat__item');
            
            if (transcripts.length === 0) {
                return; // No captions yet
            }

            transcripts.forEach(transcript => {
                try {
                    this.processTranscriptItem(transcript);
                } catch (error) {
                    console.error('Error processing transcript item:', error);
                    // Continue processing other items
                }
            });

        } catch (error) {
            console.error('Error in processNewCaptions:', error);
            this.scheduleReconnect();
        } finally {
            this.isProcessing = false;
        }
    }

    processTranscriptItem(transcript) {
        // Safely extract message element
        const messageElement = transcript.querySelector('.fui-Flex > .ui-chat__message') ||
                             transcript.querySelector('[class*="ui-chat__message"]') ||
                             transcript.querySelector('[id]');

        if (!messageElement || !messageElement.id) {
            return; // Skip items without ID
        }

        const ID = messageElement.id;

        // Safely extract author
        const authorElement = transcript.querySelector('.ui-chat__message__author') ||
                            transcript.querySelector('[class*="message__author"]');
        
        if (!authorElement) {
            return; // Skip items without author (usually means caption is still being generated)
        }

        // Safely extract text
        const textElement = transcript.querySelector('.fui-StyledText') ||
                          transcript.querySelector('[class*="StyledText"]') ||
                          transcript.querySelector('[class*="caption-text"]');

        if (!textElement) {
            return; // Skip items without text
        }

        const Name = authorElement.innerText.trim();
        const Text = textElement.innerText.trim();
        const Time = new Date().toLocaleTimeString();

        // Skip empty captions
        if (!Text) {
            return;
        }

        const existingIndex = this.transcriptArray.findIndex(t => t.ID === ID);

        if (existingIndex > -1) {
            // Update existing transcript if text changed
            if (this.transcriptArray[existingIndex].Text !== Text) {
                this.transcriptArray[existingIndex] = { Name, Text, Time, ID };
                console.log('Updated transcript:', { Name, Text: Text.substring(0, 50) + '...' });
            }
        } else {
            // Add new transcript
            this.transcriptArray.push({ Name, Text, Time, ID });
            console.log('New transcript:', { Name, Text: Text.substring(0, 50) + '...' });
        }
    }

    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached. Please refresh the page.');
            return;
        }

        this.reconnectAttempts++;
        console.log(`Scheduling reconnection attempt ${this.reconnectAttempts}...`);

        setTimeout(() => {
            this.captionsContainer = this.findCaptionsContainer();
            if (this.captionsContainer) {
                console.log('Captions container found, re-establishing observer...');
                this.setupObserver();
            } else {
                console.log('Captions container still not found, will retry...');
                this.scheduleReconnect();
            }
        }, 2000);
    }

    getTranscripts() {
        return this.transcriptArray.map(({ ID, ...rest }) => rest);
    }

    isCapturing() {
        return this.capturing && this.transcriptArray.length > 0;
    }

    getMeetingTitle() {
        return document.title.replace("__Microsoft_Teams", '').replace(/[^a-z0-9 ]/gi, '').trim();
    }
}

// Initialize the capture system
const captureSystem = new TeamsTranscriptCapture();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Content script received message:", request);
    
    switch (request.message) {
        case 'return_transcript':
            console.log("return_transcript request received");
            
            const transcripts = captureSystem.getTranscripts();
            if (!captureSystem.capturing || transcripts.length === 0) {
                alert("Oops! No captions were captured. Please make sure captions are turned on.");
                return;
            }

            chrome.runtime.sendMessage({
                message: "download_captions",
                transcriptArray: transcripts,
                meetingTitle: captureSystem.getMeetingTitle()
            });
            break;

        case 'get_captions_for_viewing':
            console.log("get_captions_for_viewing request received");
            
            const viewTranscripts = captureSystem.getTranscripts();
            if (!captureSystem.capturing || viewTranscripts.length === 0) {
                alert("Oops! No captions were captured. Please make sure captions are turned on.");
                return;
            }

            chrome.runtime.sendMessage({
                message: "display_captions",
                transcriptArray: viewTranscripts
            });
            break;

        default:
            break;
    }
});

console.log("Enhanced Teams transcript capture system loaded");
