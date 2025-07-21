# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome extension (Manifest V3) for zero-loss caption capture from Microsoft Teams meetings. Version 3.7+ features transition-aware architecture that handles chat-to-meeting state transitions without false alerts. Runs exclusively on `teams.microsoft.com` with enterprise-grade reliability patterns.

## Core Architecture

**3-Component Structure:**
- **Content Script** (`content_script.js`): CaptionManager class with 5-state meeting model, debounced DOM processing, hash-based deduplication
- **Service Worker** (`service_worker.js`): Download handling, HTML viewer generation, XSS protection via `escapeHtml()`  
- **Popup** (`popup.html` + `popup.js`): 3-button interface (Save/View/Clear) with Chrome extension messaging

## Critical Architecture Patterns

### 5-State Meeting Model (content_script.js:1-17)
```javascript
const MEETING_STATES = {
    CHAT: 'chat',                    // Teams chat interface
    JOINING: 'joining',              // Meeting join started  
    PRE_MEETING: 'pre_meeting',      // Meeting lobby
    MEETING_ACTIVE: 'meeting_active', // In meeting
    CAPTIONS_READY: 'captions_ready' // Captions available
};
```

**Key Transition Logic:**
- Grace periods prevent false "paused" alerts during state changes
- Progressive timeouts: 5s → 15s → 30s → 45s → 60s  
- State-aware health check intervals (15-60 seconds based on state)
- `transitionToState()` method tracks state history for debugging

### Zero-Loss Memory Management
- **10,000 caption capacity** with user warnings at high counts
- **Hash-based deduplication** (`captionHashSet`) for O(1) duplicate detection
- **Auto-backup every 100 captions** to localStorage with 4-hour retention
- **NEVER delete captions automatically** - always requires user consent

### DOM Interaction & Security
- **Multi-selector fallbacks**: `[data-tid='closed-caption-renderer-wrapper']` with fallbacks
- **Debounced MutationObserver**: Prevents race conditions in DOM changes
- **XSS Protection**: All content escaped via `escapeHtml()` before DOM insertion
- **Input validation**: `validateCaptionInput()` with length limits and type checking

## Development Commands

**Extension Development (No build tools - vanilla JS):**
```bash
# Navigate to extension directory
cd teams-captions-saver

# Validate JavaScript syntax
node -c content_script.js && node -c popup.js && node -c service_worker.js

# Load extension in Chrome for testing
# 1. Open chrome://extensions/
# 2. Enable Developer mode
# 3. Click "Load unpacked" -> select teams-captions-saver/ directory
# 4. Navigate to https://teams.microsoft.com/v2/

# Package for Chrome Web Store
cd .. && zip -r teams-captions-saver.zip teams-captions-saver/ -x "*.git*"
```

**Debug Mode:**
```bash
# Enable comprehensive testing (18 test cases)
localStorage.setItem('caption_saver_debug', 'true')
# OR add ?debug=true to Teams URL
```

## Extension Communication Pattern

**Chrome Extension Messaging:**
- **Popup → Content Script**: `chrome.tabs.sendMessage()`
  - `"return_transcript"`: Trigger save operation
  - `"get_captions_for_viewing"`: Open viewer tab  
  - `"clear_transcript"`: Clear captions with user confirmation
- **Content Script → Service Worker**: Background file operations
  - Downloads via `chrome.downloads.download()`
  - HTML viewer generation with XSS protection

## File Structure & Key Components

```
teams-captions-saver/
├── manifest.json          # Extension config (v3.7.2, teams.microsoft.com permissions)
├── content_script.js      # CaptionManager class, 5-state model, DOM capture
├── service_worker.js      # File downloads, escapeHtml(), viewer generation
├── popup.html/.js         # 3-button UI (Save/View/Clear)
└── icon.png              # Extension icon

Standalone-scripts/        # Console-based alternatives (YAML/JSON output)
├── Capture-Teams-Captions - YAML.js
└── Capture-Teams-Captions - JSON.js
```

**Standalone Scripts**: For environments where extensions are blocked. Paste in browser console during Teams meetings, then call `downloadYAML()` or `downloadJSON()`.

## Critical Implementation Rules

### Zero-Loss Principles
- **NEVER delete captions automatically** - always require user consent  
- **Auto-save prompts at 5,000 captions**, warnings at 10,000+
- **NEVER use `splice(0, removeCount)`** for automatic caption removal
- Crash recovery from localStorage is automatic on startup

### Security Requirements  
- All user input must pass `validateCaptionInput()`
- All DOM output must use `escapeHtml()` in service worker
- Chrome API calls require error boundaries and retry logic
- Multi-selector fallbacks via `safeDOMQuery()` for DOM resilience

### State Transition Debugging
- State changes logged to `stateTransitionHistory` array (last 10)
- Debug mode enables comprehensive 18-test suite automatically  
- Grace periods prevent false "paused due to inactivity" during transitions
- `transitionToState(newState, reason)` tracks all state changes

## Testing & Development Notes

**Critical Testing:**
- **Chat-to-meeting transitions**: Must not trigger false "paused" alerts (v3.7.0 fix)
- **State transition logging**: Check browser console for transition history
- **18-test suite**: Runs automatically in debug mode (security, performance, reliability)

**Manual Test Flow:**
1. Load extension via "Load unpacked" in chrome://extensions/
2. Navigate to https://teams.microsoft.com/v2/ 
3. Test chat-to-meeting transition without false alerts
4. Join meeting, enable captions, verify capture
5. Test save/view/clear operations
6. Test auto-save prompts at 5,000+ captions

**Version Publishing:**
1. Update version in `manifest.json`  
2. Run `node -c` validation on all JS files
3. Package as ZIP: `zip -r teams-captions-saver.zip teams-captions-saver/`
4. Upload to Chrome Developer Dashboard