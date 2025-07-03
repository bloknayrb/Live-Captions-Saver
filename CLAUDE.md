# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an enterprise-grade Chrome browser extension that provides zero-loss caption capture from Microsoft Teams meetings. Version 3.6.2 features comprehensive reliability improvements, crash recovery, auto-save functionality, and performance optimizations. The extension runs on `teams.microsoft.com` and provides users with robust caption management capabilities.

## Architecture

The extension follows Chrome Extension Manifest V3 with enterprise-grade reliability patterns:

- **Content Script** (`content_script.js`): Core caption capture engine with CaptionManager class, debounced DOM processing, crash recovery, and zero-loss memory management
- **Service Worker** (`service_worker.js`): Background task handler for downloads, viewer tabs, and comprehensive XSS protection
- **Popup** (`popup.html` + `popup.js`): User interface with three main actions (Save, View, Clear) and robust error handling

## Core Architecture Patterns

### CaptionManager Class
Centralized state management with:
- **Encapsulated State**: All caption data, observers, and timers managed in one class
- **Hash-based Deduplication**: O(1) duplicate detection using Set for performance
- **Reliability Tracking**: lastCaptionTime and captionCount for health monitoring
- **Memory Management**: Automatic backup to localStorage every 100 captions

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

**30-Second Health Checks**:
- **Observer Monitoring**: Verifies MutationObserver is active
- **DOM Container Validation**: Ensures caption container exists
- **Caption Flow Detection**: Alerts if no captions captured for 5+ minutes
- **Auto-Restart**: Automatically restarts failed observers
- **User Notifications**: Alerts user of potential capture issues

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

## Development Commands

This project uses modern JavaScript without build tools for simplicity and reliability.

### Development Workflow
1. **Load Extension**: Use Chrome's "Load unpacked" feature pointing to `teams-captions-saver/` directory
2. **Test Environment**: Navigate to `https://teams.microsoft.com/v2/` and join a meeting with captions enabled
3. **Enable Debug Mode**: `localStorage.setItem('caption_saver_debug', 'true')` or add `?debug=true` to URL
4. **Run Tests**: Comprehensive 18-test suite automatically runs in debug mode
5. **Version Updates**: Increment version in `manifest.json` before publishing

### Testing & Validation
- **Syntax Validation**: `node -c content_script.js`
- **Comprehensive Testing**: 18 automated test cases covering security, performance, reliability
- **Manual Testing**: Load extension and test with live Teams meetings
- **Performance Testing**: Monitor with 1000+ captions for memory/performance validation

### Key Testing Commands
```bash
# Validate all JavaScript files
node -c content_script.js && node -c popup.js && node -c service_worker.js

# Check for potential issues
grep -n "console\." *.js    # Find debug statements
grep -n "TODO\|FIXME" *.js  # Find pending work
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
- Monitor caption flow with health checks every 30 seconds
- Auto-restart observers if caption flow stops for 5+ minutes

## Testing

**Comprehensive 18-Test Suite** automatically runs in debug mode:
1. **Security Tests**: XSS prevention, input validation, Chrome API error handling
2. **Performance Tests**: Large dataset handling, memory management, debouncing
3. **Reliability Tests**: Crash recovery, observer monitoring, resource cleanup
4. **Integration Tests**: Extension communication, DOM manipulation, state synchronization

**Manual Testing Checklist**:
1. Load extension in Chrome and verify popup interface
2. Join Teams meeting and enable live captions
3. Verify caption capture with real-time deduplication
4. Test save/view/clear functionality
5. Test auto-save prompts at 5,000+ captions
6. Test crash recovery by refreshing page
7. Verify long meeting performance (1000+ captions)