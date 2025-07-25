document.addEventListener('DOMContentLoaded', function () {
    // Code inside this block will execute after the extension is fully loaded
    console.log('popup.js loaded!');
    
    // Centralized error handling for popup
    function handlePopupError(error, context) {
        console.error(`[Popup Error - ${context}]:`, error);
        // Could show user-friendly error message
        alert(`Error: ${error.message || 'Something went wrong'}`);
    }
    
    // Safe message sending with error handling
    function sendMessageSafely(message, callback) {
        try {
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (chrome.runtime.lastError) {
                    handlePopupError(new Error(chrome.runtime.lastError.message), 'tab-query');
                    return;
                }
                
                if (!tabs || tabs.length === 0) {
                    handlePopupError(new Error('No active tab found'), 'tab-query');
                    return;
                }
                
                chrome.tabs.sendMessage(tabs[0].id, message, function(response) {
                    if (chrome.runtime.lastError) {
                        handlePopupError(new Error(chrome.runtime.lastError.message), 'message-send');
                        return;
                    }
                    
                    if (callback) {
                        callback(response);
                    }
                });
            });
        } catch (error) {
            handlePopupError(error, 'message-send');
        }
    }

    document.getElementById('saveButton').addEventListener('click', function () {
        console.log('save_captions clicked!');
        sendMessageSafely({message: "return_transcript"});
    });

    document.getElementById('viewButton').addEventListener('click', function () {
        console.log('view_captions clicked!');
        sendMessageSafely({message: "get_captions_for_viewing"});
    });

    document.getElementById('clearButton').addEventListener('click', function () {
        console.log('clear_transcript clicked!');
        
        sendMessageSafely({message: "clear_transcript"}, function(response) {
            if (response && response.success) {
                console.log('Transcript cleared successfully');
                // Show a brief confirmation
                const button = document.getElementById('clearButton');
                const originalText = button.textContent;
                const originalColor = button.style.backgroundColor;
                
                button.textContent = 'Cleared!';
                button.style.backgroundColor = '#28a745';
                button.disabled = true;
                
                setTimeout(() => {
                    button.textContent = originalText;
                    button.style.backgroundColor = originalColor || '#dc3545';
                    button.disabled = false;
                }, 1500);
            } else {
                const errorMsg = response?.error || 'Unknown error occurred';
                handlePopupError(new Error(errorMsg), 'clear-transcript');
            }
        });
    });
});