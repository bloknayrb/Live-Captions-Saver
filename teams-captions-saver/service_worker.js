// Service worker is a script that your browser runs in the background, separate from a web page, opening the door to features that don't need a web page 
// or user interaction.
// Service worker script will be forcefully terminated after about 30 seconds of inactivity, and restarted when it's next needed.
// https://stackoverflow.com/questions/66618136/persistent-service-worker-in-chrome-extension/66618269#66618269

// This code is not used. But without it, the extension does not work
let isTranscribing = false;
let transcriptArray = [];

/**
 * Escape HTML characters to prevent XSS attacks
 * @param {string} unsafe - Potentially unsafe string containing user input
 * @returns {string} - HTML-escaped string safe for insertion into DOM
 */
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') {
        return String(unsafe || '');
    }
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function jsonToYaml(json) {
    return json.map(entry => {
        return `Name: ${entry.Name}\nText: ${entry.Text}\nTime: ${entry.Time}\n----`;
    }).join('\n');
}

function saveTranscripts(meetingTitle, transcriptArray) {
    try {
        if (!transcriptArray || transcriptArray.length === 0) {
            console.error('Save failed: No transcript data provided');
            sendErrorToPopup('No captions to save. Make sure captions are being captured.');
            return;
        }

        const yaml = jsonToYaml(transcriptArray);
        
        // Sanitize filename to prevent issues
        const sanitizedTitle = meetingTitle.replace(/[^a-z0-9\s]/gi, '').trim() || 'teams_transcript';
        
        chrome.downloads.download({
            url: 'data:text/plain;charset=utf-8,' + encodeURIComponent(yaml),
            filename: sanitizedTitle + ".txt",
            saveAs: true
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                console.error('Download failed:', chrome.runtime.lastError);
                sendErrorToPopup('Download failed: ' + chrome.runtime.lastError.message);
            } else {
                console.log('Download started successfully, ID:', downloadId);
            }
        });
    } catch (error) {
        console.error('Save transcripts error:', error);
        sendErrorToPopup('Failed to prepare transcript for download: ' + error.message);
    }
}

function createViewerTab(transcriptArray) {
    try {
        if (!transcriptArray || transcriptArray.length === 0) {
            console.error('Viewer failed: No transcript data provided');
            sendErrorToPopup('No captions to view. Make sure captions are being captured.');
            return;
        }

        // Create a data URL containing the HTML content for viewing captions
        // All user data is properly escaped to prevent XSS
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>MS Teams Captions Viewer</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        margin: 0;
                        padding: 20px;
                        background-color: #f5f5f5;
                    }
                    .container {
                        max-width: 800px;
                        margin: 0 auto;
                        background-color: white;
                        padding: 20px;
                        border-radius: 5px;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                    }
                    h1 {
                        color: #333;
                        text-align: center;
                    }
                    .caption {
                        border-bottom: 1px solid #eee;
                        padding: 10px 0;
                        margin-bottom: 10px;
                    }
                    .name {
                        font-weight: bold;
                        color: #0078d4;
                    }
                    .text {
                        margin: 5px 0;
                        white-space: pre-wrap;
                    }
                    .time {
                        color: #666;
                        font-size: 0.85em;
                    }
                    .error {
                        color: #d32f2f;
                        background-color: #ffebee;
                        padding: 10px;
                        border-radius: 4px;
                        margin: 10px 0;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>MS Teams Captions</h1>
                    <div id="captions-container">
                        ${transcriptArray.map(item => {
                            // Escape all user-controlled data to prevent XSS
                            const safeName = escapeHtml(item.Name);
                            const safeText = escapeHtml(item.Text);
                            const safeTime = escapeHtml(item.Time);
                            
                            return `
                                <div class="caption">
                                    <div class="name">${safeName}</div>
                                    <div class="text">${safeText}</div>
                                    <div class="time">${safeTime}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </body>
            </html>
        `;
        
        // Create a new tab with this HTML content
        chrome.tabs.create({
            url: 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent)
        }, (tab) => {
            if (chrome.runtime.lastError) {
                console.error('Failed to create viewer tab:', chrome.runtime.lastError);
                sendErrorToPopup('Failed to open caption viewer: ' + chrome.runtime.lastError.message);
            } else {
                console.log('Viewer tab created successfully');
            }
        });
    } catch (error) {
        console.error('Create viewer tab error:', error);
        sendErrorToPopup('Failed to create caption viewer: ' + error.message);
    }
}

/**
 * Send error message back to popup for user notification
 * @param {string} errorMessage - Error message to display to user
 */
function sendErrorToPopup(errorMessage) {
    // Try to send error to active tab (popup might still be open)
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
                message: 'error_notification',
                error: errorMessage
            }).catch(() => {
                // Popup might be closed, just log the error
                console.log('Could not send error to popup:', errorMessage);
            });
        }
    });
}

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    console.log("Service worker received message:", message);
    
    try {
        switch (message.message) {
            case 'download_captions': // message from Content script
                console.log('download_captions triggered!', message);
                if (!message.transcriptArray) {
                    console.error('No transcript array provided for download');
                    sendErrorToPopup('No transcript data received for download');
                    return;
                }
                saveTranscripts(message.meetingTitle || 'teams_transcript', message.transcriptArray);
                break;

            case 'display_captions': // message from Content script with captions for viewing
                console.log('display_captions triggered!', message);
                if (!message.transcriptArray) {
                    console.error('No transcript array provided for viewer');
                    sendErrorToPopup('No transcript data received for viewer');
                    return;
                }
                createViewerTab(message.transcriptArray);
                break;

            default:
                console.log('Unknown message type:', message.message);
                break;
        }
    } catch (error) {
        console.error('Error handling message:', error);
        sendErrorToPopup('Internal error: ' + error.message);
    }
    
    // Always send a response to prevent "port closed" errors
    sendResponse({success: true});
});