// Service worker is a script that your browser runs in the background, separate from a web page, opening the door to features that don't need a web page 
// or user interaction.
// Service worker script will be forcefully terminated after about 30 seconds of inactivity, and restarted when it's next needed.
// https://stackoverflow.com/questions/66618136/persistent-service-worker-in-chrome-extension/66618269#66618269

/**
 * MS Teams Captions Saver - Service Worker
 * Handles download and viewer tab creation for captured captions
 */

/**
 * Converts transcript array to YAML-like text format
 * @param {Array} json - Array of transcript objects with Name, Text, Time properties
 * @returns {string} Formatted text string
 */
function formatTranscripts(json) {
    return json.map(entry => {
        return `Name: ${entry.Name}\nText: ${entry.Text}\nTime: ${entry.Time}\n----`;
    }).join('\n');
}

/**
 * Downloads transcripts as a text file
 * @param {string} meetingTitle - Title for the downloaded file
 * @param {Array} transcriptArray - Array of transcript objects
 */
function saveTranscripts(meetingTitle, transcriptArray) {
    try {
        const formattedText = formatTranscripts(transcriptArray);
        console.log('Downloading transcripts:', formattedText);

        chrome.downloads.download({
            url: 'data:text/plain;charset=utf-8,' + encodeURIComponent(formattedText),
            filename: meetingTitle + ".txt",
            saveAs: true
        });
    } catch (error) {
        console.error('Error saving transcripts:', error);
    }
}

/**
 * Creates a new tab with formatted captions for viewing
 * @param {Array} transcriptArray - Array of transcript objects
 */
function createViewerTab(transcriptArray) {
    // Create a data URL containing the HTML content for viewing captions
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
                }
                .time {
                    color: #666;
                    font-size: 0.85em;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>MS Teams Captions</h1>
                <div id="captions-container">
                    ${transcriptArray.map(item => `
                        <div class="caption">
                            <div class="name">${item.Name}</div>
                            <div class="text">${item.Text}</div>
                            <div class="time">${item.Time}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </body>
        </html>
    `;
    
    try {
        // Create a new tab with the formatted HTML content
        chrome.tabs.create({
            url: 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent)
        });
    } catch (error) {
        console.error('Error creating viewer tab:', error);
    }
}

/**
 * Message listener for communication with content script
 * Handles 'download_captions' and 'display_captions' messages
 */
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    console.log("Service worker received message:", message.message);
    
    try {
        switch (message.message) {
            case 'download_captions':
                console.log('Processing download request for:', message.meetingTitle);
                saveTranscripts(message.meetingTitle, message.transcriptArray);
                break;

            case 'display_captions':
                console.log('Creating viewer tab for', message.transcriptArray.length, 'captions');
                createViewerTab(message.transcriptArray);
                break;

            default:
                console.warn('Unknown message type:', message.message);
                break;
        }
    } catch (error) {
        console.error('Error handling message:', error);
    }
});