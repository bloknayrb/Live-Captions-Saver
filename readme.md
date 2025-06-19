![](IMG/logo.png)

# MS Teams Live Captions Saver Browser Extension

The MS Teams Live Captions Saver is a Chrome extension that allows you to capture and export live captions from Microsoft Teams. It is helpful for saving important discussions and keeping track of conversations for later reference.

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

## Features

- **Smart Deduplication**: The extension uses a conservative whitelist-based algorithm to avoid duplicate or partial captions, ensuring clean transcripts.
- **XSS Protection**: All user data is escaped before being displayed or exported.
- **Error Handling**: User-friendly error messages are shown if captions are not available or if an operation fails.
- **Meeting Awareness**: The extension detects when you join a new meeting and manages transcript data accordingly.
- **Manual Reset**: You can clear all captured captions at any time from the popup.

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

## Contributing (Developers only)

### Load unpacked extension in Chrome/Edge/Brave

- Open the Extensions page and enable Developer mode.
- Click "Load Unpacked" and select the `teams-captions-saver` directory.
- Open https://teams.microsoft.com/v2/
- Join a meeting.

### Update the manifest.json file

- Open [teams-captions-saver/manifest.json](teams-captions-saver/manifest.json)
- Increment the version number.

### Publish New Extension Version to the Chrome Web Store

- Go to [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- Click "Add new item" and upload your zip file.

## Disclaimer

The MS Teams Live Captions Saver Extension captures and saves live captions from meetings, which might include sensitive information and private conversations. Obtain consent from all parties before using this tool.

You are responsible for complying with all applicable laws and regulations, including privacy and data protection laws, and Microsoft Teams' terms of service.

This tool is provided "as is" without warranty. The developer assumes no responsibility for any legal issues arising from its use.

By using this extension, you agree to use it responsibly and ethically, and acknowledge all potential legal implications.

