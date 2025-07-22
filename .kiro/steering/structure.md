# Project Structure

## Root Directory Layout

```
├── teams-captions-saver/          # Main extension directory
├── Standalone-scripts/            # Alternative JavaScript implementations
├── Chrome Store Assets/           # Marketing and store assets
├── IMG/                          # Documentation images and screenshots
├── test-*.js                     # Testing and validation scripts
├── readme.md                     # Main project documentation
└── teams-captions-saver.crx      # Packaged extension file
```

## Extension Directory (`teams-captions-saver/`)

**Core Extension Files:**
- `manifest.json` - Extension configuration and permissions (Manifest V3)
- `content_script.js` - Main logic, modular architecture with 8+ modules
- `service_worker.js` - Background script for downloads and tab management
- `popup.html` - Extension popup interface
- `popup.js` - Popup interaction logic
- `icon.png` - Extension icon (16x16, 48x48, 128x128)

## Code Organization Patterns

### Modular Architecture in `content_script.js`

The main content script follows a **namespace-based modular pattern**:

```javascript
window.CaptionSaver = {
    Config: { /* constants and configuration */ },
    DOMUtils: { /* safe DOM operations */ },
    TextProcessor: { /* text normalization */ },
    StateManager: { /* processing coordination */ },
    MemoryManager: { /* cleanup and optimization */ },
    MeetingDetector: { /* meeting state detection */ },
    Data: { /* global data storage */ },
    CaptionProcessor: { /* core processing logic */ }
};
```

### File Naming Conventions

- **Extension files**: lowercase with underscores (`content_script.js`, `service_worker.js`)
- **Test files**: descriptive with hyphens (`test-suite.js`, `code-analysis-test.js`)
- **Documentation**: lowercase (`readme.md`)
- **Assets**: descriptive names in folders (`Chrome Store Assets/`, `IMG/`)

## Key Directories

### `/Standalone-scripts/`
Contains alternative implementations for environments where extensions aren't allowed:
- `Capture-Teams-Captrions - YAML.js` - YAML export version
- `Capture-Teams-Captrions - JSON.js` - JSON export version

### `/IMG/`
Documentation and UI screenshots:
- `logo.png` - Project logo
- Numbered screenshots (`1.png`, `3.jpg`, etc.) - Usage examples
- `package-extension.png` - Packaging instructions

### `/Chrome Store Assets/`
Marketing materials for Chrome Web Store:
- Promotional tiles and screenshots
- Store listing assets

## Configuration Files

### `manifest.json` Structure
```json
{
  "manifest_version": 3,
  "name": "MS Teams Live Captions Saver",
  "version": "3.6.2",
  "permissions": ["downloads", "activeTab"],
  "host_permissions": ["https://teams.microsoft.com/*"],
  "background": { "service_worker": "service_worker.js" },
  "content_scripts": [/* Teams-specific injection */],
  "action": { "default_popup": "popup.html" }
}
```

## Development Workflow Structure

### Testing Organization
- `test-suite.js` - Comprehensive automated testing framework
- `test-functions.js` - Individual function testing utilities  
- `code-analysis-test.js` - Static code analysis and validation

### Documentation Structure
- `readme.md` - User-facing documentation with installation and usage
- `CLAUDE.md` - Developer documentation and architecture notes
- `Privacy policy.txt` - Privacy and legal information

## Data Flow Architecture

```
Teams DOM → content_script.js → service_worker.js → Downloads/New Tab
     ↑            ↓                    ↓
   DOM Observer   Processing         File Export
                  Modules            Tab Creation
```

## Module Dependencies

**Core Dependencies:**
- `Config` → Used by all modules for constants
- `DOMUtils` → Used by `CaptionProcessor`, `MeetingDetector`
- `TextProcessor` → Used by `CaptionProcessor` for normalization
- `StateManager` → Coordinates all processing modules
- `MemoryManager` → Cleanup for all data structures

**Data Flow:**
1. `MeetingDetector` → Validates meeting state
2. `DOMUtils` → Extracts caption elements
3. `TextProcessor` → Normalizes and compares text
4. `CaptionProcessor` → Main processing logic
5. `StateManager` → Coordinates timing and state
6. `MemoryManager` → Periodic cleanup