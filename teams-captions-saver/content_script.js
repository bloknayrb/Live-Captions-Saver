const transcriptArray = [];
let capturing = false;
let observer = null;
let transcriptIdCounter = 0;

// Memory management: track meeting state to prevent data contamination
let currentMeetingId = null;
let lastMeetingCheck = 0;

// Whitelist approach: Conservative progressive update detection
const recentlyRemoved = [];
const MAX_RECENTLY_REMOVED = 10;

/**
 * Extract meeting identifier for detecting meeting changes
 */
function extractMeetingId() {
    try {
        const urlMatch = window.location.href.match(/meetup-join\/([^\/\?]+)/);
        if (urlMatch) {
            return urlMatch[1];
        }
        
        const title = document.title.replace(/__Microsoft_Teams.*$/, '').trim();
        return title || null;
    } catch (error) {
        console.error('Error extracting meeting ID:', error);
        return null;
    }
}

/**
 * Check if we've moved to a new meeting and should reset transcript data
 */
function checkForNewMeeting() {
    try {
        const now = Date.now();
        if (now - lastMeetingCheck < 10000) {
            return;
        }
        lastMeetingCheck = now;
        
        const newMeetingId = extractMeetingId();
        
        if (newMeetingId && newMeetingId !== currentMeetingId) {
            if (currentMeetingId && transcriptArray.length > 0) {
                console.log("New meeting detected, previous transcript data preserved until save/view");
                console.log(`Previous meeting: ${currentMeetingId}`);
                console.log(`New meeting: ${newMeetingId}`);
                
                // Clear recently removed for new meeting
                recentlyRemoved.length = 0;
            }
            currentMeetingId = newMeetingId;
        }
    } catch (error) {
        console.error('Error checking for new meeting:', error);
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
    
    const oldTrimmed = oldText.trim();
    const newTrimmed = newText.trim();
    
    // Prevent empty or very short text issues
    if (oldTrimmed.length < 3 || newTrimmed.length < 3) {
        return {isProgressive: false, confidence: 'NONE', pattern: 'Text too short to analyze'};
    }
    
    // Pattern 1: Exact prefix expansion (VERY HIGH confidence)
    if (newTrimmed.startsWith(oldTrimmed) && newTrimmed.length > oldTrimmed.length + 5) {
        // Additional safety: must end on word boundary
        const addedText = newTrimmed.substring(oldTrimmed.length).trim();
        if (addedText.length > 0 && /^[\s\w]/.test(addedText)) {
            return {
                isProgressive: true, 
                confidence: 'VERY_HIGH', 
                pattern: `Exact prefix expansion: adds "${addedText}"`
            };
        }
    }
    
    // Pattern 2: Punctuation completion (HIGH confidence)
    const punctuationRegex = /[.!?;,][\s]*$/;
    if (!punctuationRegex.test(oldTrimmed) && punctuationRegex.test(newTrimmed)) {
        const oldWithoutPunct = oldTrimmed.replace(/[.!?;,\s]+$/, '').trim();
        const newWithoutPunct = newTrimmed.replace(/[.!?;,\s]+$/, '').trim();
        if (oldWithoutPunct === newWithoutPunct || newWithoutPunct.startsWith(oldWithoutPunct)) {
            return {
                isProgressive: true,
                confidence: 'HIGH',
                pattern: `Punctuation completion`
            };
        }
    }
    
    // Pattern 3: Capitalization fix (HIGH confidence)
    if (oldTrimmed.toLowerCase() === newTrimmed.toLowerCase() && oldTrimmed !== newTrimmed) {
        return {
            isProgressive: true,
            confidence: 'HIGH', 
            pattern: `Capitalization fix`
        };
    }
    
    // Pattern 4: Word-by-word building (HIGH confidence)
    // New text adds 1-3 complete words to the end
    if (newTrimmed.startsWith(oldTrimmed)) {
        const addedPart = newTrimmed.substring(oldTrimmed.length).trim();
        const addedWords = addedPart.split(/\s+/).filter(w => w.length > 0);
        
        if (addedWords.length >= 1 && addedWords.length <= 3) {
            // Ensure it's adding real words, not just characters
            const hasRealWords = addedWords.every(word => word.length >= 2 && /^[a-zA-Z]/.test(word));
            if (hasRealWords) {
                return {
                    isProgressive: true,
                    confidence: 'HIGH',
                    pattern: `Word building: added "${addedWords.join(' ')}"`
                };
            }
        }
    }
    
    // No whitelisted pattern matched
    return {isProgressive: false, confidence: 'NONE', pattern: 'No safe pattern detected'};
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
        
        // If this is one of the last 3 entries added, it's probably recent
        const entryIndex = transcriptArray.findIndex(e => e.ID === entry.ID);
        const isRecent = entryIndex >= transcriptArray.length - 3;
        
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
 * Smart caption addition with conservative whitelist approach
 * @param {string} name - Speaker name
 * @param {string} text - Caption text
 * @returns {boolean} True if caption was added
 */
function conservativeSmartAddCaption(name, text) {
    // Check if this exact caption already exists
    const exactExists = transcriptArray.some(existing => 
        existing.Name === name && existing.Text === text
    );
    
    if (exactExists) {
        console.log(`  ⏭️  Exact caption already exists: "${text}"`);
        return false;
    }
    
    // Look for recent entries from the same speaker to check for progressive updates
    let foundProgressive = false;
    for (let i = transcriptArray.length - 1; i >= Math.max(0, transcriptArray.length - 5); i--) {
        const entry = transcriptArray[i];
        
        if (entry.Name === name) {
            const progressiveCheck = isWhitelistedProgressive(entry.Text, text);
            
            if (progressiveCheck.isProgressive) {
                console.log(`  🔍 Whitelist match: ${progressiveCheck.pattern}`);
                console.log(`  📊 Confidence: ${progressiveCheck.confidence}`);
                
                // Only proceed with removal for HIGH or VERY_HIGH confidence
                if (progressiveCheck.confidence === 'HIGH' || progressiveCheck.confidence === 'VERY_HIGH') {
                    const removed = safelyRemoveEntry(i, progressiveCheck.pattern);
                    if (removed) {
                        foundProgressive = true;
                        break; // Only remove one entry
                    }
                } else {
                    console.log(`  ⚠️  Confidence too low for removal: ${progressiveCheck.confidence}`);
                }
            }
            
            break; // Only check the most recent entry from this speaker
        }
    }
    
    // Add the new caption
    const Time = new Date().toLocaleTimeString();
    transcriptArray.push({ 
        Name: name, 
        Text: text, 
        Time, 
        ID: `caption_${transcriptIdCounter++}` 
    });
    
    if (foundProgressive) {
        console.log("🔄 Replaced progressive caption:", { Name: name, Text: text });
    } else {
        console.log("🎉 Added new caption:", { Name: name, Text: text });
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

function checkCaptions() {
    try {
        console.log("Checking for captions...");
        
        checkForNewMeeting();
        
        const closedCaptionsContainer = document.querySelector("[data-tid='closed-captions-renderer']");
        if (!closedCaptionsContainer) {
            console.log("❌ Caption container not found - captions may not be enabled");
            return;
        }
        
        const transcripts = closedCaptionsContainer.querySelectorAll('.fui-ChatMessageCompact');
        console.log(`Found ${transcripts.length} ChatMessageCompact elements`);
        
        if (transcripts.length === 0) {
            console.log("⚠️  No ChatMessageCompact elements found");
            return;
        }
        
        // Process each visible caption element
        transcripts.forEach((transcript, index) => {
            try {
                const authorElement = transcript.querySelector('[data-tid="author"]');
                if (!authorElement) return;
                
                const Name = authorElement.innerText.trim();
                const textElement = transcript.querySelector('[data-tid="closed-caption-text"]');
                if (!textElement) return;
                
                const Text = textElement.innerText.trim();
                
                if (Text.length > 0) {
                    // Use conservative whitelist approach
                    conservativeSmartAddCaption(Name, Text);
                }
            } catch (error) {
                console.error(`Error processing transcript ${index}:`, error);
            }
        });
        
        console.log(`Current transcript array length: ${transcriptArray.length}`);
        
    } catch (error) {
        console.error('Error in checkCaptions:', error);
    }
}

// run startTranscription every 5 seconds
function startTranscription() {
    try {
        // Check if we're in a meeting
        const meetingIndicators = [
            document.getElementById("call-duration-custom"),
            document.querySelector("[data-tid='call-status-container-test-id']"),
            document.querySelector("#call-status"),
            Array.from(document.querySelectorAll('span')).find(el => 
                el.textContent && el.textContent.includes("Waiting for others to join")
            )
        ];
        
        const inMeeting = meetingIndicators.some(indicator => indicator !== null && indicator !== undefined);
        
        if (!inMeeting) {
            console.log("Not in meeting, retrying in 5 seconds...");
            setTimeout(startTranscription, 5000);
            return false;
        }

        console.log("✅ Meeting detected");

        const closedCaptionsContainer = document.querySelector("[data-tid='closed-captions-renderer']");
        if (!closedCaptionsContainer) {
            console.log("❌ Caption container not found - Please enable captions: More > Language and speech > Turn on live captions");
            setTimeout(startTranscription, 5000);
            return false;
        }

        console.log("✅ Caption container found");

        // Initialize meeting tracking
        currentMeetingId = extractMeetingId();
        
        capturing = true;
        observer = new MutationObserver(checkCaptions);
        observer.observe(closedCaptionsContainer, {
            childList: true,
            subtree: true,
            characterData: true
        });
        
        // Do an initial check
        console.log("🚀 Starting conservative smart caption capture...");
        checkCaptions();
        console.log("Caption capturing started successfully for meeting:", currentMeetingId);

        return true;
    } catch (error) {
        console.error('Error in startTranscription:', error);
        showUserError('Failed to start caption capturing. Please refresh the page and try again.');
        return false;
    }
}

/**
 * Display error message to user
 */
function showUserError(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #d32f2f;
        color: white;
        padding: 15px;
        border-radius: 5px;
        z-index: 10000;
        max-width: 300px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    `;
    notification.textContent = `MS Teams Caption Saver: ${message}`;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

/**
 * Reset transcript data
 */
function resetTranscriptData() {
    transcriptArray.length = 0;
    transcriptIdCounter = 0;
    recentlyRemoved.length = 0;
    console.log("Transcript data reset");
}

startTranscription();

// Listen for messages from the popup.js or service_worker.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Content script received message:", request);
    
    try {
        switch (request.message) {
            case 'return_transcript':
                console.log("return_transcript request received:", transcriptArray);
                if (!capturing) {
                    const errorMsg = "Caption capturing is not active. Please make sure you're in a Teams meeting with captions enabled.";
                    console.error(errorMsg);
                    showUserError(errorMsg);
                    sendResponse({success: false, error: errorMsg});
                    return;
                }
                
                if (transcriptArray.length === 0) {
                    const errorMsg = "No captions captured yet. Please make sure live captions are turned on in Teams.";
                    console.error(errorMsg);
                    showUserError(errorMsg);
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
                    showUserError('Failed to initiate download: ' + error.message);
                    sendResponse({success: false, error: error.message});
                }
                break;

            case 'get_captions_for_viewing':
                console.log("get_captions_for_viewing request received:", transcriptArray);
                if (!capturing) {
                    const errorMsg = "Caption capturing is not active. Please make sure you're in a Teams meeting with captions enabled.";
                    console.error(errorMsg);
                    showUserError(errorMsg);
                    sendResponse({success: false, error: errorMsg});
                    return;
                }
                
                if (transcriptArray.length === 0) {
                    const errorMsg = "No captions captured yet. Please make sure live captions are turned on in Teams.";
                    console.error(errorMsg);
                    showUserError(errorMsg);
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
                    showUserError('Failed to open caption viewer: ' + error.message);
                    sendResponse({success: false, error: error.message});
                }
                break;

            case 'error_notification':
                if (request.error) {
                    showUserError(request.error);
                }
                sendResponse({success: true});
                break;

            case 'reset_transcript':
                resetTranscriptData();
                showUserError('Transcript data cleared. Starting fresh!');
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
        showUserError('Internal error: ' + error.message);
        sendResponse({success: false, error: error.message});
    }
});

console.log("🚀 Conservative whitelist-based caption content_script.js is running");