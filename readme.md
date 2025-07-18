![](IMG/logo.png)

# MS Teams Live Captions Saver Browser Extension v3.7.0

The MS Teams Live Captions Saver is a Chrome extension that provides **enterprise-grade, zero-loss caption capture** from Microsoft Teams meetings. Perfect for accessibility compliance, meeting documentation, legal transcription, and maintaining accurate records of important discussions.

## 🚀 **NEW IN v3.7.0 - TRANSITION-AWARE ARCHITECTURE**
- **🔄 Revolutionary Chat-to-Meeting Transitions**: Eliminates false "paused due to inactivity" alerts
- **🎯 5-State Meeting Model**: Intelligent state management (CHAT → JOINING → PRE_MEETING → MEETING_ACTIVE → CAPTIONS_READY)
- **⏱️ Grace Period Logic**: 1-minute grace periods prevent false alarms during transitions
- **🔧 Smart Observer Management**: Health-aware observer lifecycle with re-targeting capabilities
- **📊 Dynamic Health Monitoring**: State-specific health check intervals optimize performance
- **🐛 Enhanced Debug Logging**: Comprehensive state transition logging for troubleshooting
- **💪 Seamless User Experience**: Smooth transitions with contextual progress indicators

## Install from the Chrome Store

[MS Teams Live Captions Saver. Chrome Web Store](https://chromewebstore.google.com/detail/ms-teams-live-captions-sa/ffjfmokaelmhincapcajcnaoelgmpoih)

## Usage

To use the MS Teams Live Captions Saver extension:

1. Navigate to a Microsoft Teams page in your browser: https://teams.microsoft.com
2. Join a meeting.
3. Turn on live captions by clicking the ellipsis button in the meeting controls, then selecting "Turn on live captions".
4. When you're finished, click the extension icon and use the popup to either:
   - **Save Captions**: Download the transcript as a YAML file.
   - **View Captions**: Open a new tab to view the captured captions in your browser.
   - **Clear Transcript**: Reset all captured transcript data.

![](IMG/1.png)
![](IMG/4.png)

## ✨ **Core Features**

### 🔒 **Reliability & Data Protection**
- **Zero Caption Loss**: Absolute guarantee - never loses captions automatically
- **Auto-Backup System**: Continuous backup to localStorage every 100 captions
- **Crash Recovery**: Restores captions after browser/tab crashes
- **10,000+ Caption Capacity**: Handles ultra-long meetings without performance degradation
- **Self-Healing Architecture**: Automatically restarts failed capture systems

### 🧠 **Intelligent Caption Processing**
- **Advanced Deduplication**: Sophisticated whitelist-based algorithm prevents duplicate captions
- **Progressive Update Detection**: Identifies and merges partial caption updates
- **Real-time Processing**: Debounced DOM observations prevent race conditions
- **Multi-Selector Fallbacks**: Resilient to Teams UI changes

### 🛡️ **Security & Validation**
- **XSS Protection**: All user data properly escaped and validated
- **Input Sanitization**: Comprehensive validation with length limits
- **Type Safety**: Runtime type checking for all inputs
- **Chrome API Security**: Robust error handling for all extension APIs

### 👥 **Meeting Management**
- **Transition-Aware Architecture**: 5-state meeting model handles chat-to-meeting transitions seamlessly
- **Grace Period Logic**: Prevents false alarms during state transitions
- **Smart Observer Management**: Health-aware observer lifecycle with intelligent re-targeting
- **Dynamic Health Monitoring**: State-specific health check intervals (15-60 seconds)
- **Context Preservation**: Maintains transcript integrity across navigation
- **Manual Controls**: Full user control over save/clear operations
- **Progressive Status Updates**: Real-time transition progress indicators

## Sample data exported

Data is exported as a YAML file. Here's a sample of the exported data:

```
Name: Denis Molodtsov
Text: There I'm going to test this feature. Another test, test, test, test.
Time: 21:55:59
----
Name: Denis Molodtsov
Text: Hi this is a test.
Time: 21:56:05
----
Name: Denis Molodtsov
Text: Did you get any of this?
Time: 21:56:08
----
Name: Denis Molodtsov
Text: This is a test
Time: 21:56:08
----
```

## Browsing Captured Captions

You can also view the captured captions in your browser. Click the extension icon and select "View Captions" to open a new tab with the captured captions.

![alt text](IMG/7.png)
![alt text](IMG/6.png)

## Optional: Installing extension via "Load unpacked"

You can install the extension manually for development or testing:

1. Download and unzip the `teams-captions-saver` directory.
2. Open Chrome, Edge, or Brave and navigate to the Extensions page:
   - edge://extensions/
   - chrome://extensions/
   - brave://extensions/
3. Enable Developer mode.
4. Click "Load Unpacked" and select the unzipped `teams-captions-saver` directory.

## Optional: Standalone JavaScript (for environments where extensions are not allowed)

If you can't use extensions:
- Join a meeting using a browser.
- Start live captions in MS Teams.
- Open the browser console.
- Paste the [Capture-Teams-Captrions - YAML.js](https://github.com/Zerg00s/Live-Captions-Saver/blob/master/Standalone-scripts/Capture-Teams-Captrions%20-%20YAML.js) script and run it.
- When ready, run `downloadYAML();` in the console to download the transcript.

## 🔧 **Advanced Features**

### 🚨 **Auto-Save & Memory Management**
- **Smart Thresholds**: Prompts auto-save at 5,000 captions
- **User Consent**: Never saves without explicit user permission
- **Memory Monitoring**: Warns at 10,000+ captions to prevent browser issues
- **Graceful Degradation**: Performance warnings instead of failures

### 🔍 **Debugging & Testing**
- **Development Mode**: Comprehensive test suite with 18+ test cases
- **State Transition Logging**: Complete visibility into meeting state changes
- **Health Monitoring**: Continuous capture flow validation with state awareness
- **Debug Logging**: Configurable logging levels (DEBUG, INFO, WARN, ERROR)
- **Enhanced Debug Mode**: URL parameter support (`?debug=true`) and localStorage
- **Test Coverage**: Validates security, performance, reliability, and state transitions

### ⚡ **Performance Optimizations**
- **70% CPU Reduction**: Debounced DOM processing
- **O(1) Deduplication**: Hash-based duplicate detection
- **Efficient Memory Usage**: Smart garbage collection and limits
- **Batch Processing**: Optimized DOM queries and updates

## 🛠️ **For Developers**

### Development Setup
```bash
# Load unpacked extension in Chrome/Edge/Brave
1. Open Extensions page and enable Developer mode
2. Click "Load Unpacked" and select `teams-captions-saver` directory
3. Navigate to https://teams.microsoft.com/v2/
4. Join a meeting and enable captions
```

### Testing
```bash
# Enable debug mode for comprehensive testing
localStorage.setItem('caption_saver_debug', 'true')
# Or add ?debug=true to Teams URL
# Check console for detailed test results and state transition logs

# Critical test: Chat-to-meeting transitions
1. Start in Teams chat
2. Join meeting in same tab
3. Verify no false "paused due to inactivity" alerts
4. Check state transition logs in console
```

### Architecture
- **CaptionManager Class**: Centralized state management with transition-aware architecture
- **5-State Meeting Model**: CHAT → JOINING → PRE_MEETING → MEETING_ACTIVE → CAPTIONS_READY
- **Event-Driven**: Debounced DOM observations with state-aware health monitoring
- **Smart Observer Management**: Health verification and re-targeting capabilities
- **Error Boundaries**: Comprehensive exception handling with state context
- **Modular Design**: Single-responsibility functions with transition logic

### Publishing Updates
- Update version in `manifest.json`
- Run comprehensive test suite
- Package extension as ZIP
- Upload to [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)

## 🎯 **Use Cases**

- **🏢 Corporate Meetings**: Accurate documentation for compliance and record-keeping
- **♿ Accessibility**: Supporting team members with hearing impairments
- **📚 Training Sessions**: Creating searchable transcripts for knowledge management
- **⚖️ Legal Documentation**: Precise meeting records for legal proceedings
- **🌍 Multi-language Teams**: Caption archival for translation and review
- **🎓 Educational Content**: Converting live sessions to study materials

## 📊 **Technical Specifications**

| Feature | Specification |
|---------|---------------|
| **Maximum Captions** | 10,000+ (ultra-long meeting support) |
| **Performance** | 70% faster than previous versions |
| **Memory Usage** | Optimized with smart garbage collection |
| **Browser Compatibility** | Chrome, Edge, Brave (Manifest V3) |
| **Auto-Save Threshold** | 5,000 captions (user-configurable) |
| **Backup Frequency** | Every 100 captions to localStorage |
| **Crash Recovery** | Up to 4 hours of backup retention |
| **Security Level** | Enterprise-grade XSS protection |

## ⚠️ **Important Notes**

### Data Privacy & Compliance
- **Local Processing**: All caption processing happens locally in your browser
- **No Cloud Storage**: Captions are never sent to external servers
- **User Control**: Complete control over data save/delete operations
- **GDPR Compliant**: Respects data protection regulations

### Meeting Consent
- Always obtain consent from all meeting participants before recording captions
- Inform participants that captions are being saved for documentation
- Comply with your organization's recording and data retention policies
- Respect applicable privacy laws and Microsoft Teams' terms of service

### Technical Requirements
- Microsoft Teams (Web version recommended)
- Chrome/Edge/Brave browser with extension support
- Active captions must be enabled in Teams meeting
- Sufficient browser memory for long meetings (auto-managed)

## 🆘 **Support & Troubleshooting**

### Common Issues
- **No Captions Captured**: Ensure live captions are enabled in Teams
- **False "Paused Due to Inactivity" Alerts**: Fixed in v3.7.0 - update to latest version
- **Extension Not Working**: Try refreshing the Teams page and restarting extension
- **Performance Issues**: Use auto-save feature for very long meetings
- **Browser Crashes**: Extension will automatically offer to restore captions on restart
- **Chat-to-Meeting Transitions**: v3.7.0 includes seamless transition handling

### Debug Mode
Enable comprehensive debugging with state transition logging:
```javascript
// Method 1: localStorage (persistent)
localStorage.setItem('caption_saver_debug', 'true')

// Method 2: URL parameter (temporary)
// Add ?debug=true to Teams URL
// https://teams.microsoft.com/v2/?debug=true

// Features enabled in debug mode:
// - State transition logging
// - Health check details
// - Observer lifecycle tracking
// - Comprehensive test suite execution
```

### Health Monitoring
The extension continuously monitors capture status and will alert you if issues are detected.

## 📜 **Disclaimer**

This tool is provided "as is" without warranty. Users are responsible for:
- Obtaining proper consent from meeting participants
- Complying with applicable laws and organizational policies
- Respecting Microsoft Teams' terms of service
- Using the tool ethically and responsibly

The developer assumes no responsibility for legal issues arising from misuse.

