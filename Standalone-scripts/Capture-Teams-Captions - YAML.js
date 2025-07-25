if (localStorage.getItem("transcripts") !== null) {
    localStorage.removeItem("transcripts");
}

const transcriptArray = JSON.parse(localStorage.getItem("transcripts")) || [];
let transcriptIdCounter = 0; // Since IDs are not reliable in new structure

function checkTranscripts() {
    // Teams v2 - Updated for new HTML structure
    const closedCaptionsContainer = document.querySelector("[data-tid='closed-captions-renderer']")
    if (!closedCaptionsContainer) {
        // alert("Please, click 'More' > 'Language and speech' > 'Turn on live captions'");
        return;
    }
    
    // New selector for caption items
    const transcripts = closedCaptionsContainer.querySelectorAll('.fui-ChatMessageCompact');

    transcripts.forEach(transcript => {
        // Get author name
        const authorElement = transcript.querySelector('[data-tid="author"]');
        if (!authorElement) return; // Skip if no author found
        
        const Name = authorElement.innerText.trim();
        
        // Get caption text
        const textElement = transcript.querySelector('[data-tid="closed-caption-text"]');
        if (!textElement) return; // Skip if no text found
        
        const Text = textElement.innerText.trim();
        const Time = new Date().toISOString().replace('T', ' ').slice(0, -1);
        
        // Since we don't have reliable IDs anymore, we'll use a combination of name + text
        // to detect duplicates (checking last few entries to avoid false positives)
        const recentTranscripts = transcriptArray.slice(-10); // Check last 10 entries
        const isDuplicate = recentTranscripts.some(t => 
            t.Name === Name && t.Text === Text
        );
        
        if (!isDuplicate && Text.length > 0) {
            const ID = `caption_${transcriptIdCounter++}`;
            console.log({
                Name,
                Text,
                Time,
                ID
            });
            
            // Add new transcript
            transcriptArray.push({
                Name,
                Text,
                Time,
                ID
            });
        }
    });

    localStorage.setItem('transcripts', JSON.stringify(transcriptArray));
}

const observer = new MutationObserver(checkTranscripts);

// Observe the captions container more specifically if it exists
const captionsContainer = document.querySelector("[data-tid='closed-captions-renderer']");
if (captionsContainer) {
    observer.observe(captionsContainer, {
        childList: true,
        subtree: true,
        characterData: true // Also watch for text changes
    });
} else {
    // Fallback to observing the whole body
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Initial check
checkTranscripts();

// Also check periodically in case mutations are missed
setInterval(checkTranscripts, 10000);

// Download YAML
function downloadYAML() {
    let transcripts = JSON.parse(localStorage.getItem('transcripts'));
    
    if (!transcripts || transcripts.length === 0) {
        alert("No captions captured yet. Please ensure live captions are turned on.");
        return;
    }
    
    // Remove IDs
    transcripts = transcripts.map(({
        ID,
        ...rest
    }) => rest);

    // Convert to your simple YAML format
    let yamlTranscripts = '';
    transcripts.forEach(transcript => {
        yamlTranscripts += `Name: ${transcript.Name}\nText: ${transcript.Text}\nTime: ${transcript.Time}\n----\n`;
    });

    // Use the page's title as part of the file name, replacing "__Microsoft_Teams" with nothing
    // and removing any non-alphanumeric characters except spaces
    const title = document.title.replace("__Microsoft_Teams", '').replace(/[^a-z0-9 ]/gi, '');
    const fileName = "transcript - " + title.trim() + ".yaml";

    const dataStr = "data:text/yaml;charset=utf-8," + encodeURIComponent(yamlTranscripts);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", fileName);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

// Let's download the YAML
// downloadYAML();

// Helper message for console
console.log("Teams Caption Capture (YAML) is running!");
console.log("To download captured captions, run: downloadYAML()");
console.log("Make sure live captions are turned on in Teams.");