# Technology Stack

## Core Technologies

- **JavaScript ES6+**: Main programming language for all extension components
- **Chrome Extension API**: Manifest V3 with service workers, content scripts, and popup interface
- **HTML5/CSS3**: Popup interface and caption viewer UI
- **DOM APIs**: Real-time caption detection and text extraction from Teams interface

## Architecture Pattern

**Modular Architecture** - The extension uses a clean modular structure with separated concerns:

- **Config Module**: Centralized configuration and constants
- **DOMUtils Module**: Safe DOM operations with comprehensive error handling  
- **TextProcessor Module**: Text normalization and similarity algorithms
- **StateManager Module**: Processing coordination and race condition prevention
- **MemoryManager Module**: Automatic cleanup and memory optimization
- **MeetingDetector Module**: Meeting state detection with caching
- **CaptionProcessor Module**: Core caption processing logic
- **Controller Module**: Main orchestration and public API

## Key Libraries & Frameworks

- **Native Browser APIs**: No external dependencies - uses only built-in browser capabilities
- **Chrome Extensions API**: downloads, activeTab permissions, host permissions for teams.microsoft.com
- **MutationObserver**: For real-time DOM change detection
- **Performance API**: Built-in performance monitoring and optimization

## Build System & Commands

This project uses **no build system** - it's vanilla JavaScript that runs directly in the browser.

### Development Commands

```bash
# Load extension for development
# 1. Open chrome://extensions/ (or edge://extensions/, brave://extensions/)
# 2. Enable Developer mode
# 3. Click "Load Unpacked" and select teams-captions-saver/ directory

# Test the extension
# 1. Navigate to https://teams.microsoft.com/v2/
# 2. Join a meeting and enable live captions (ALT+SHIFT+C)
# 3. Open browser console and run: testCaptions.runAllTests()
```

### Testing Commands

```javascript
// Run comprehensive test suite in browser console
testCaptions.runAllTests()

// Run individual test categories
testCaptions.testTextNormalization()
testCaptions.testMemoryManagement()
testCaptions.testPerformance()
```

### Publishing Commands

```bash
# Update version in manifest.json
# ZIP the teams-captions-saver directory
# Upload to Chrome Developer Dashboard
```

## Performance Considerations

- **Debounced Processing**: 500ms minimum interval between processing runs
- **Memory Management**: Automatic cleanup every 60 seconds with configurable limits
- **DOM Query Optimization**: Cached selectors with fallback strategies
- **Text Processing**: Optimized similarity algorithms with configurable thresholds

## Browser Compatibility

- **Primary**: Chrome (Manifest V3)
- **Secondary**: Edge, Brave (Chromium-based browsers)
- **Fallback**: Standalone JavaScript for restricted environments