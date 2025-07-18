# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an enterprise-grade Chrome browser extension that provides zero-loss caption capture from Microsoft Teams meetings. Version 3.7.0 features a revolutionary transition-aware architecture that eliminates false "paused due to inactivity" alerts during chat-to-meeting transitions. The extension includes comprehensive reliability improvements, crash recovery, auto-save functionality, and performance optimizations. The extension runs on `teams.microsoft.com` and provides users with robust caption management capabilities.

## Architecture

The extension follows Chrome Extension Manifest V3 with enterprise-grade reliability patterns:

- **Content Script** (`content_script.js`): Core caption capture engine with CaptionManager class, debounced DOM processing, crash recovery, and zero-loss memory management
- **Service Worker** (`service_worker.js`): Background task handler for downloads, viewer tabs, and comprehensive XSS protection
- **Popup** (`popup.html` + `popup.js`): User interface with three main actions (Save, View, Clear) and robust error handling

## Core Architecture Patterns

### CaptionManager Class
Centralized state management with:
- **Encapsulated State**: All caption data, observers, and timers managed in one class
- **Transition-Aware Architecture**: 5-state meeting model with graceful transitions
- **Hash-based Deduplication**: O(1) duplicate detection using Set for performance
- **Reliability Tracking**: lastCaptionTime and captionCount for health monitoring
- **Memory Management**: Automatic backup to localStorage every 100 captions
- **Smart Observer Management**: Health-aware observer lifecycle with re-targeting capabilities

### Transition-Aware Architecture (v3.7.0)

**Revolutionary 5-State Meeting Model**:
```javascript
const MEETING_STATES = {
    CHAT: 'chat',                    // In Teams chat/general interface
    JOINING: 'joining',              // Meeting join process started
    PRE_MEETING: 'pre_meeting',      // In meeting lobby/waiting
    MEETING_ACTIVE: 'meeting_active', // In active meeting
    CAPTIONS_READY: 'captions_ready' // Captions container available
};
```

**Key Features**:
- **Eliminates False Alerts**: No more "paused due to inactivity" during chat-to-meeting transitions
- **Grace Period Logic**: 1-minute grace period after state transitions prevents false alarms
- **Progressive Timeout Strategy**: 5s → 15s → 30s → 45s timeouts for each transition
- **State-Specific Health Monitoring**: Dynamic health check intervals based on current state
- **Comprehensive Transition Logging**: Enhanced debugging with state transition history
- **Smart Observer Re-targeting**: Reduces unnecessary observer recreation during transitions

**State-Specific Health Check Intervals**:
- **CHAT**: 60 seconds (low frequency monitoring)
- **JOINING**: 15 seconds (frequent monitoring during transition)
- **PRE_MEETING**: 30 seconds (moderate frequency)
- **MEETING_ACTIVE**: 20 seconds (active monitoring in meeting)
- **CAPTIONS_READY**: 30 seconds (standard caption monitoring)

### Caption Detection and Processing

**Zero-Loss Pipeline**:
1. **DOM Observation**: Debounced MutationObserver prevents race conditions
2. **Multi-Selector Fallbacks**: Resilient to Teams UI changes with backup selectors
3. **Progressive Detection**: Sophisticated whitelist algorithm for caption updates
4. **Validation & Sanitization**: Comprehensive input validation and XSS prevention
5. **Hash Deduplication**: O(1) duplicate detection with caption hashing
6. **Auto-Backup**: Continuous localStorage backup for crash recovery

**Whitelist-Based Progressive Update Detection**:
- **Four Pattern Types**: Prefix expansion, punctuation completion, capitalization fixes, word building
- **Confidence Levels**: VERY_HIGH, HIGH, MEDIUM, LOW (only HIGH+ trigger removals)
- **Safety First**: Conservative approach - better duplicates than lost captions
- **Recovery Mechanism**: `restoreRecentlyRemoved()` function for safety

### Zero-Loss Memory Management

**CRITICAL PRINCIPLE**: Never delete captions without explicit user consent

- **10,000 Caption Capacity**: 10x increase from previous 1,000 limit
- **Auto-Save at 5,000**: Proactive user prompt for backup at 5,000 captions
- **User Consent Required**: All save/clear operations require explicit user approval
- **Performance Warnings**: Alerts user at high caption counts instead of silent deletion
- **Crash Recovery**: Automatic restoration from localStorage backup on startup

### Self-Healing Reliability System

**State-Aware Health Monitoring**:
- **Dynamic Health Check Intervals**: Adjusts monitoring frequency based on meeting state
- **Observer Health Verification**: Validates MutationObserver functionality before recreation
- **Smart Observer Re-targeting**: Retargets observers instead of full recreation when possible
- **Transition Grace Periods**: Prevents false alarms during state transitions
- **Caption Flow Detection**: Distinguishes between silence and system issues
- **Auto-Restart with Context**: Automatically restarts failed observers with state awareness
- **Progressive Status Notifications**: User-friendly transition progress indicators

**Crash Recovery**:
- **localStorage Backup**: Last 500 captions saved every 100 additions
- **4-Hour Retention**: Backups expire after 4 hours
- **Startup Recovery**: Offers restoration on extension reload
- **Meeting Context**: Preserves meeting ID with backup data

### Enhanced Security Framework

- **Comprehensive XSS Protection**: Multi-layer input validation and output escaping
- **Type Safety**: Runtime type checking for all inputs with length limits
- **Chrome API Security**: Robust error boundaries for all extension APIs
- **Input Sanitization**: Removes dangerous characters while preserving data integrity
- **Error Boundaries**: Comprehensive exception handling prevents crashes

## Key Architecture Components

### Core Class Structure
- **CaptionManager**: Central state management class in `content_script.js`
  - Manages transcript array, observers, and timers
  - Implements 5-state transition-aware architecture
  - Handles dual capture modes: snapshot-based and progressive fallback
  - Implements hash-based deduplication with `captionHashSet`
  - Provides crash recovery through localStorage backup system
  - Maintains state transition history for debugging
  - Supports enhanced debug logging with URL parameters

### Inter-Component Communication
- **Content Script ↔ Popup**: Chrome extension messaging API
  - `return_transcript`: Trigger save operation
  - `get_captions_for_viewing`: Open viewer tab
  - `clear_transcript`: Clear all captions with user confirmation
- **Content Script ↔ Service Worker**: Background processing
  - File download operations via `chrome.downloads` API
  - HTML content generation for viewer tabs
  - XSS protection through `escapeHtml()` function

### DOM Interaction Patterns
- **Multi-Selector Fallbacks**: Resilient DOM queries with `safeDOMQuery()`
  - Primary: `[data-tid='closed-caption-renderer-wrapper']`
  - Fallback: `[data-tid='closed-captions-renderer']`
- **Debounced Processing**: Prevents race conditions in DOM observation
- **Progressive Update Detection**: Whitelist-based algorithm for caption updates

## Development Commands

This project uses modern JavaScript without build tools for simplicity and reliability.

### Development Workflow
1. **Load Extension**: Use Chrome's "Load unpacked" feature pointing to `teams-captions-saver/` directory
2. **Test Environment**: Navigate to `https://teams.microsoft.com/v2/` and join a meeting with captions enabled
3. **Enable Debug Mode**: `localStorage.setItem('caption_saver_debug', 'true')` or add `?debug=true` to URL
4. **Run Tests**: Comprehensive 18-test suite automatically runs in debug mode
5. **Version Updates**: Increment version in `manifest.json` before publishing

### Essential Development Commands
```bash
# Navigate to extension directory
cd teams-captions-saver

# Validate all JavaScript files syntax
node -c content_script.js && node -c popup.js && node -c service_worker.js

# Check for potential issues
grep -n "console\." *.js    # Find debug statements
grep -n "TODO\|FIXME" *.js  # Find pending work

# Package extension for Chrome Web Store
cd .. && zip -r teams-captions-saver.zip teams-captions-saver/ -x "*.git*" "*.DS_Store*"
```

### Testing & Validation
- **Syntax Validation**: `node -c <filename>.js` for individual files
- **Comprehensive Testing**: 18 automated test cases automatically run in debug mode
- **Manual Testing**: Load extension and test with live Teams meetings
- **Performance Testing**: Monitor with 1000+ captions for memory/performance validation

### Debug Mode Testing
```javascript
// Enable debug mode in browser console
localStorage.setItem('caption_saver_debug', 'true');

// Or add debug parameter to Teams URL
// https://teams.microsoft.com/v2/?debug=true

// Check test results in browser console
// All 18 tests run automatically in debug mode
```

## File Structure

```
teams-captions-saver/
├── manifest.json          # Extension configuration and permissions
├── content_script.js      # Main caption capture logic
├── service_worker.js      # Background processing and file operations
├── popup.html            # Extension popup interface
├── popup.js              # Popup button handlers
└── icon.png              # Extension icon
```

## Extension Publishing

To publish updates to Chrome Web Store:
1. Update version number in `manifest.json`
2. Package the `teams-captions-saver/` directory as a ZIP file
3. Upload to Chrome Developer Dashboard

## Standalone Scripts

The `Standalone-scripts/` directory contains alternative JavaScript implementations for environments where extensions are not allowed. These can be run directly in the browser console on Teams meetings.

### Available Scripts
- **`Capture-Teams-Captrions - YAML.js`**: Outputs captions in YAML format
- **`Capture-Teams-Captrions - JSON.js`**: Outputs captions in JSON format

### Usage
1. Join a Teams meeting and enable live captions
2. Open browser console (F12)
3. Copy and paste the script content
4. Run `downloadYAML()` or `downloadJSON()` to download transcript

### Key Differences from Extension
- No background processing or service worker
- Direct DOM manipulation without Chrome API security
- Manual execution required for download
- Simplified deduplication logic

## Critical Implementation Notes

### Zero-Loss Guarantee
- **NEVER** use `splice(0, removeCount)` to delete captions automatically
- **ALWAYS** require user consent before clearing transcript data
- **Auto-save prompts** at 5,000 captions, **warnings** at 10,000+
- **Crash recovery** from localStorage backup is automatic on startup

### Performance Considerations
- Hash-based deduplication provides O(1) lookup vs O(n) array search
- Debounced DOM processing reduces CPU usage by ~70%
- Memory management with user warnings instead of silent deletion
- Batch processing every 100 captions for localStorage backup

### Security Requirements
- All user input must be validated with `validateCaptionInput()`
- All output must be escaped with `escapeHtml()` in service worker
- Chrome API calls require error boundaries and retry mechanisms
- Never trust DOM data without validation and sanitization

### Reliability Patterns
- Use `safeDOMQuery()` with fallback selectors for DOM queries
- Implement retry mechanisms with exponential backoff for critical operations
- Monitor caption flow with state-aware health checks at dynamic intervals
- Auto-restart observers with health verification and re-targeting capabilities
- Respect transition grace periods to prevent false alarms during state changes
- Use progressive container detection with multiple fallback selectors
- Implement comprehensive state transition logging for debugging

## Testing

**Comprehensive 18-Test Suite** automatically runs in debug mode:
1. **Security Tests**: XSS prevention, input validation, Chrome API error handling
2. **Performance Tests**: Large dataset handling, memory management, debouncing
3. **Reliability Tests**: Crash recovery, observer monitoring, resource cleanup
4. **Integration Tests**: Extension communication, DOM manipulation, state synchronization

**Manual Testing Checklist**:
1. Load extension in Chrome and verify popup interface
2. Test chat-to-meeting transitions (critical for v3.7.0)
3. Join Teams meeting and enable live captions
4. Verify caption capture with real-time deduplication
5. Test save/view/clear functionality
6. Test auto-save prompts at 5,000+ captions
7. Test crash recovery by refreshing page
8. Verify long meeting performance (1000+ captions)
9. Test meeting-to-chat transitions and observer behavior
10. Verify no false "paused due to inactivity" alerts during transitions

## Common Development Tasks

### Adding New DOM Selectors
When Teams updates their UI, you may need to add new selectors:
1. Inspect the new caption elements in Teams
2. Add new selectors to the fallback arrays in `safeDOMQuery()` calls
3. Test in both snapshot and progressive capture modes
4. Update both extension and standalone scripts

### Debugging Caption Capture Issues
1. Enable debug mode: `localStorage.setItem('caption_saver_debug', 'true')` or add `?debug=true` to URL
2. Check browser console for detailed logs including state transition history
3. Verify DOM selectors are matching current Teams structure
4. Test with different meeting types (scheduled, instant, recurring)
5. Monitor state transitions during chat-to-meeting and meeting-to-chat flows
6. Check transition timeouts and grace period handling
7. Verify observer health checks and re-targeting behavior

### Performance Optimization
- Monitor memory usage with large caption counts (5000+)
- Test deduplication efficiency with hash-based approach
- Verify debounced processing prevents UI freezing
- Check localStorage backup frequency and cleanup

### Security Validation
- Always validate input with `validateCaptionInput()`
- Use `escapeHtml()` for any user-generated content
- Test XSS prevention with malicious caption content
- Verify Chrome API error boundaries handle failures gracefully