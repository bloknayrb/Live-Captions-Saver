/**
 * MS Teams Live Captions Saver - Unified Standalone Script
 * Captures live captions from Microsoft Teams meetings and exports in multiple formats
 * 
 * Usage:
 * 1. Open Microsoft Teams meeting with live captions enabled
 * 2. Open browser console and paste this entire script
 * 3. Use the floating UI or console commands to export captions
 * 
 * Console Commands:
 * - downloadJSON() - Export captions as JSON file
 * - downloadYAML() - Export captions as YAML-like text file  
 * - downloadTXT() - Export captions as plain text file
 * - clearCaptions() - Clear captured captions
 * - showStats() - Display capture statistics
 */

class TeamsaptionCapture {
    constructor() {
        this.transcriptArray = [];
        this.transcriptIdCounter = 0;
        this.observer = null;
        this.periodicInterval = null;
        this.uiContainer = null;
        
        // Configuration
        this.config = {
            selectors: {
                captionsContainer: "[data-tid='closed-captions-renderer']",
                captionItems: '.fui-ChatMessageCompact',
                author: '[data-tid="author"]',
                captionText: '[data-tid="closed-caption-text"]'
            },
            storage: {
                key: 'transcripts',
                duplicateCheckLimit: 10
            },
            timing: {
                periodicCheckInterval: 10000
            }
        };
        
        this.init();
    }
    
    /**
     * Initialize the caption capture system
     */
    init() {
        this.clearStorage();
        this.setupObserver();
        this.setupPeriodicCheck();
        this.createFloatingUI();
        this.initialCheck();
        this.logStartup();
    }
    
    /**
     * Clear existing transcript storage
     */
    clearStorage() {
        if (localStorage.getItem(this.config.storage.key) !== null) {
            localStorage.removeItem(this.config.storage.key);
        }
    }
    
    /**
     * Setup DOM mutation observer for caption changes
     */
    setupObserver() {
        this.observer = new MutationObserver(() => this.checkTranscripts());
        
        const captionsContainer = document.querySelector(this.config.selectors.captionsContainer);
        if (captionsContainer) {
            this.observer.observe(captionsContainer, {
                childList: true,
                subtree: true,
                characterData: true
            });
        } else {
            // Fallback to observing the whole body
            this.observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }
    
    /**
     * Setup periodic checking as fallback
     */
    setupPeriodicCheck() {
        this.periodicInterval = setInterval(() => {
            this.checkTranscripts();
        }, this.config.timing.periodicCheckInterval);
    }
    
    /**
     * Check for new captions and capture them
     */
    checkTranscripts() {
        const closedCaptionsContainer = document.querySelector(this.config.selectors.captionsContainer);
        if (!closedCaptionsContainer) {
            return;
        }
        
        const transcripts = closedCaptionsContainer.querySelectorAll(this.config.selectors.captionItems);
        
        transcripts.forEach(transcript => {
            const authorElement = transcript.querySelector(this.config.selectors.author);
            if (!authorElement) return;
            
            const Name = authorElement.innerText.trim();
            
            const textElement = transcript.querySelector(this.config.selectors.captionText);
            if (!textElement) return;
            
            const Text = textElement.innerText.trim();
            const Time = new Date().toISOString().replace('T', ' ').slice(0, -1);
            
            // Duplicate detection
            if (this.isDuplicate(Name, Text)) {
                return;
            }
            
            if (Text.length > 0) {
                this.addCaption(Name, Text, Time);
            }
        });
        
        this.saveToStorage();
        this.updateUI();
    }
    
    /**
     * Check if caption is a duplicate
     */
    isDuplicate(name, text) {
        const recentTranscripts = this.transcriptArray.slice(-this.config.storage.duplicateCheckLimit);
        return recentTranscripts.some(t => t.Name === name && t.Text === text);
    }
    
    /**
     * Add new caption to array
     */
    addCaption(name, text, time) {
        const ID = `caption_${this.transcriptIdCounter++}`;
        const caption = { Name: name, Text: text, Time: time, ID };
        
        console.log('Captured caption:', caption);
        this.transcriptArray.push(caption);
    }
    
    /**
     * Save transcripts to localStorage
     */
    saveToStorage() {
        localStorage.setItem(this.config.storage.key, JSON.stringify(this.transcriptArray));
    }
    
    /**
     * Load transcripts from localStorage
     */
    loadFromStorage() {
        const stored = localStorage.getItem(this.config.storage.key);
        return stored ? JSON.parse(stored) : [];
    }
    
    /**
     * Generate filename from page title
     */
    generateFilename(extension) {
        let title = document.title
            .replace("__Microsoft_Teams", '')
            .replace(/[^a-z0-9 ]/gi, '')
            .trim();
        
        if (!title) {
            title = 'teams-meeting';
        }
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        return `transcript-${title}-${timestamp}.${extension}`;
    }
    
    /**
     * Prepare transcripts for export (remove internal IDs)
     */
    prepareForExport() {
        const transcripts = this.loadFromStorage();
        
        if (!transcripts || transcripts.length === 0) {
            alert("No captions captured yet. Please ensure live captions are turned on.");
            return null;
        }
        
        // Remove internal IDs
        return transcripts.map(({ ID, ...rest }) => rest);
    }
    
    /**
     * Create download link and trigger download
     */
    triggerDownload(content, filename, mimeType) {
        const dataStr = `data:${mimeType};charset=utf-8,` + encodeURIComponent(content);
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", filename);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }
    
    /**
     * Download captions as JSON
     */
    downloadJSON() {
        const transcripts = this.prepareForExport();
        if (!transcripts) return;
        
        const content = JSON.stringify(transcripts, null, 2);
        const filename = this.generateFilename('json');
        this.triggerDownload(content, filename, 'text/json');
        
        console.log(`Downloaded ${transcripts.length} captions as JSON: ${filename}`);
    }
    
    /**
     * Download captions as YAML-like format
     */
    downloadYAML() {
        const transcripts = this.prepareForExport();
        if (!transcripts) return;
        
        let content = '';
        transcripts.forEach(transcript => {
            content += `Name: ${transcript.Name}\\nText: ${transcript.Text}\\nTime: ${transcript.Time}\\n----\\n`;
        });
        
        const filename = this.generateFilename('yaml');
        this.triggerDownload(content, filename, 'text/yaml');
        
        console.log(`Downloaded ${transcripts.length} captions as YAML: ${filename}`);
    }
    
    /**
     * Download captions as plain text
     */
    downloadTXT() {
        const transcripts = this.prepareForExport();
        if (!transcripts) return;
        
        let content = '';
        transcripts.forEach(transcript => {
            content += `[${transcript.Time}] ${transcript.Name}: ${transcript.Text}\\n\\n`;
        });
        
        const filename = this.generateFilename('txt');
        this.triggerDownload(content, filename, 'text/plain');
        
        console.log(`Downloaded ${transcripts.length} captions as TXT: ${filename}`);
    }
    
    /**
     * Clear all captured captions
     */
    clearCaptions() {
        this.transcriptArray = [];
        this.transcriptIdCounter = 0;
        localStorage.removeItem(this.config.storage.key);
        this.updateUI();
        console.log('All captions cleared');
    }
    
    /**
     * Show capture statistics
     */
    showStats() {
        const transcripts = this.loadFromStorage();
        const count = transcripts.length;
        const authors = [...new Set(transcripts.map(t => t.Name))];
        
        console.log(`📊 Caption Capture Statistics:
        Total Captions: ${count}
        Unique Speakers: ${authors.length}
        Speakers: ${authors.join(', ')}
        First Caption: ${count > 0 ? transcripts[0].Time : 'None'}
        Last Caption: ${count > 0 ? transcripts[count - 1].Time : 'None'}`);
        
        return { count, authors, transcripts };
    }
    
    /**
     * Create floating UI for easy access
     */
    createFloatingUI() {
        // Remove existing UI if present
        const existing = document.getElementById('teams-caption-ui');
        if (existing) {
            existing.remove();
        }
        
        this.uiContainer = document.createElement('div');
        this.uiContainer.id = 'teams-caption-ui';
        this.uiContainer.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                border: 2px solid #0078d4;
                border-radius: 8px;
                padding: 15px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10000;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 14px;
                min-width: 200px;
            ">
                <div style="font-weight: bold; margin-bottom: 10px; color: #0078d4;">
                    📹 Teams Captions
                </div>
                <div id="caption-count" style="margin-bottom: 10px; color: #666;">
                    Captured: 0 captions
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <button onclick="window.teamsCapture.downloadJSON()" style="
                        background: #0078d4;
                        color: white;
                        border: none;
                        padding: 8px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                    ">📄 Download JSON</button>
                    <button onclick="window.teamsCapture.downloadYAML()" style="
                        background: #107c10;
                        color: white;
                        border: none;
                        padding: 8px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                    ">📝 Download YAML</button>
                    <button onclick="window.teamsCapture.downloadTXT()" style="
                        background: #8764b8;
                        color: white;
                        border: none;
                        padding: 8px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                    ">📋 Download TXT</button>
                    <button onclick="window.teamsCapture.clearCaptions()" style="
                        background: #d83b01;
                        color: white;
                        border: none;
                        padding: 8px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                    ">🗑️ Clear All</button>
                </div>
                <div style="margin-top: 10px;">
                    <button onclick="document.getElementById('teams-caption-ui').style.display='none'" style="
                        background: #f3f2f1;
                        color: #323130;
                        border: 1px solid #d2d0ce;
                        padding: 4px 8px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 11px;
                        float: right;
                    ">Hide</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.uiContainer);
    }
    
    /**
     * Update UI with current stats
     */
    updateUI() {
        const countElement = document.getElementById('caption-count');
        if (countElement) {
            countElement.textContent = `Captured: ${this.transcriptArray.length} captions`;
        }
    }
    
    /**
     * Initial check for captions
     */
    initialCheck() {
        this.checkTranscripts();
    }
    
    /**
     * Log startup information
     */
    logStartup() {
        console.log("🎯 Teams Caption Capture (Unified) is running!");
        console.log("📋 Available commands:");
        console.log("  - window.teamsCapture.downloadJSON()");
        console.log("  - window.teamsCapture.downloadYAML()"); 
        console.log("  - window.teamsCapture.downloadTXT()");
        console.log("  - window.teamsCapture.clearCaptions()");
        console.log("  - window.teamsCapture.showStats()");
        console.log("💡 Make sure live captions are turned on in Teams.");
        console.log("🎨 Use the floating UI (top-right) for easy access.");
    }
    
    /**
     * Cleanup resources
     */
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
        if (this.periodicInterval) {
            clearInterval(this.periodicInterval);
        }
        if (this.uiContainer) {
            this.uiContainer.remove();
        }
        delete window.teamsCapture;
        console.log("Teams Caption Capture destroyed");
    }
}

// Initialize the capture system
window.teamsCapture = new TeamsaptionCapture();

// Legacy function support for backward compatibility
function downloadJSON() {
    window.teamsCapture.downloadJSON();
}

function downloadYAML() {
    window.teamsCapture.downloadYAML();
}

function downloadTXT() {
    window.teamsCapture.downloadTXT();
}

function clearCaptions() {
    window.teamsCapture.clearCaptions();
}

function showStats() {
    return window.teamsCapture.showStats();
}