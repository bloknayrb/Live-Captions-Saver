document.addEventListener('DOMContentLoaded', function () {
    // Code inside this block will execute after the extension is fully loaded
    console.log('popup.js loaded!');   

    document.getElementById('saveButton').addEventListener('click', function () {
        console.log('save_captions clicked!');
        
        // Get active tab and send message with retry logic
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs || tabs.length === 0) {
                console.warn('No active tab found');
                return;
            }
            
            chrome.tabs.sendMessage(tabs[0].id, {message: "return_transcript"}, function(response) {
                if (chrome.runtime.lastError) {
                    // Only log if it's not a common timing issue
                    if (!chrome.runtime.lastError.message.includes('receiving end does not exist')) {
                        console.warn('Save message communication issue:', chrome.runtime.lastError.message);
                    }
                } else if (response && !response.success) {
                    console.warn('Save operation failed:', response.error);
                }
            });
        });
    });

    document.getElementById('viewButton').addEventListener('click', function () {
        console.log('view_captions clicked!');
        
        // Get active tab and send message with retry logic
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs || tabs.length === 0) {
                console.warn('No active tab found');
                return;
            }
            
            chrome.tabs.sendMessage(tabs[0].id, {message: "get_captions_for_viewing"}, function(response) {
                if (chrome.runtime.lastError) {
                    // Only log if it's not a common timing issue
                    if (!chrome.runtime.lastError.message.includes('receiving end does not exist')) {
                        console.warn('View message communication issue:', chrome.runtime.lastError.message);
                    }
                } else if (response && !response.success) {
                    console.warn('View operation failed:', response.error);
                }
            });
        });
    });

    document.getElementById('resetButton').addEventListener('click', function () {
        console.log('reset_transcript clicked!');
        
        // Confirm before resetting
        if (confirm('Are you sure you want to clear all captured transcript data? This cannot be undone.')) {
            // Get active tab and send message with retry logic
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (!tabs || tabs.length === 0) {
                    console.warn('No active tab found');
                    return;
                }
                
                chrome.tabs.sendMessage(tabs[0].id, {message: "reset_transcript"}, function(response) {
                    if (chrome.runtime.lastError) {
                        // Only log if it's not a common timing issue
                        if (!chrome.runtime.lastError.message.includes('receiving end does not exist')) {
                            console.warn('Reset message communication issue:', chrome.runtime.lastError.message);
                        }
                    } else if (response && response.success) {
                        console.log('Transcript reset successfully');
                    }
                });
            });
        }
    });
});