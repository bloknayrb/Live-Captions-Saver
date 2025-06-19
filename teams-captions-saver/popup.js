document.addEventListener('DOMContentLoaded', function () {
    // Code inside this block will execute after the extension is fully loaded
    console.log('popup.js loaded!');   

    document.getElementById('saveButton').addEventListener('click', function () {
        console.log('save_captions clicked!');
        
        // Get active tab and send message
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {message: "return_transcript"}, function(response) {
                if (chrome.runtime.lastError) {
                    console.error('Error sending save message:', chrome.runtime.lastError);
                } else if (response && !response.success) {
                    console.error('Save failed:', response.error);
                }
            });
        });
    });

    document.getElementById('viewButton').addEventListener('click', function () {
        console.log('view_captions clicked!');
        
        // Get active tab and send message
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {message: "get_captions_for_viewing"}, function(response) {
                if (chrome.runtime.lastError) {
                    console.error('Error sending view message:', chrome.runtime.lastError);
                } else if (response && !response.success) {
                    console.error('View failed:', response.error);
                }
            });
        });
    });

    document.getElementById('resetButton').addEventListener('click', function () {
        console.log('reset_transcript clicked!');
        
        // Confirm before resetting
        if (confirm('Are you sure you want to clear all captured transcript data? This cannot be undone.')) {
            // Get active tab and send message
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {message: "reset_transcript"}, function(response) {
                    if (chrome.runtime.lastError) {
                        console.error('Error sending reset message:', chrome.runtime.lastError);
                    } else if (response && response.success) {
                        console.log('Transcript reset successfully');
                    }
                });
            });
        }
    });
});