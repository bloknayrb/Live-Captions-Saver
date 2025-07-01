# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MS Teams Live Captions Saver is a Chrome extension that captures and exports live captions from Microsoft Teams meetings. The extension works exclusively with the new Microsoft Teams interface and requires live captions to be enabled during meetings.

## Architecture

### Core Components

**Chrome Extension Structure (Manifest V3):**
- `teams-captions-saver/manifest.json` - Extension configuration, permissions, and entry points
- `teams-captions-saver/content_script.js` - Main caption capture logic, injected into Teams pages
- `teams-captions-saver/service_worker.js` - Background script handling downloads and tab management
- `teams-captions-saver/popup.html` + `popup.js` - Extension popup UI with Save/View buttons

**Standalone Scripts:**
- `Standalone-scripts/` - Browser console scripts for environments where extensions aren't allowed

### Caption Capture Logic

The extension uses a sophisticated multi-layered approach to capture captions reliably:

1. **DOM Observation**: MutationObserver watches `[data-tid='closed-captions-renderer']` container
2. **Stability Detection**: Only processes captions that are "stable" (skips last 5 elements by default)
3. **Silence Detection**: After 5 seconds of no caption changes, processes recent captions
4. **Deduplication**: Uses `Name:Text` keys to prevent duplicate captures
5. **Screen Order Sorting**: Final export maintains the visual order of captions as they appear on screen

Key selectors:
- Caption container: `[data-tid='closed-captions-renderer']`
- Individual captions: `[data-tid='closed-caption-text']`
- Authors: `[data-tid='author']` within `.fui-ChatMessageCompact`

### Data Flow

1. Content script detects meeting and live captions
2. MutationObserver + periodic checks capture caption changes
3. Captions stored in `transcriptArray` with deduplication
4. User clicks Save/View → message sent to content script
5. Content script processes recent captions and sends to service worker
6. Service worker either downloads YAML file or opens viewer tab

## Development Commands

### Extension Development
- Load unpacked extension in Chrome: Navigate to `chrome://extensions/`, enable Developer mode, click "Load Unpacked", select `teams-captions-saver/` directory
- Test environment: Open https://teams.microsoft.com/v2/, join meeting, press ALT+SHIFT+C for live captions

### Publishing
- Update version in `teams-captions-saver/manifest.json`
- ZIP the `teams-captions-saver/` directory
- Upload to Chrome Web Store Developer Dashboard

## Key Technical Details

### Meeting Detection
The extension detects active meetings by checking for multiple indicators:
- `#call-duration-custom`
- `[data-tid='call-status-container-test-id']`
- `#call-status`
- Text content "Waiting for others to join"

### Caption Processing Strategy
- **Conservative approach**: Skips last 5 captions to ensure stability
- **Silence-based processing**: Captures recent captions after 5 seconds of inactivity
- **Fallback mechanisms**: Periodic checks every 2 seconds, manual silence checks
- **Screen order preservation**: Final export matches visual order in Teams UI

### Export Formats
- **YAML-style text format**: `Name: [Author]\nText: [Caption]\nTime: [Timestamp]\n----`
- **HTML viewer**: Styled web page opened in new tab for in-browser viewing

## File Structure Notes

- Extension files are in `teams-captions-saver/` directory
- Standalone scripts provide fallback for restricted environments
- Chrome Store assets and documentation in root directory
- No build process required - extension runs directly from source files