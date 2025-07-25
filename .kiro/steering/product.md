# Product Overview

MS Teams Live Captions Saver is a Chrome browser extension that captures and exports live captions from Microsoft Teams meetings. The extension helps users save important discussions and conversations for later reference.

## Key Features

- **Real-time Caption Capture**: Automatically detects and captures live captions during Teams meetings
- **Export Functionality**: Downloads captured captions as YAML/text files with speaker names, timestamps, and text
- **In-browser Viewing**: Provides a viewer interface to review captured captions before downloading
- **Standalone Alternative**: Includes JavaScript snippets for environments where browser extensions aren't allowed

## Target Use Cases

- Meeting documentation and note-taking
- Accessibility support for hearing-impaired participants  
- Compliance and record-keeping requirements
- Post-meeting review and analysis

## Technical Requirements

- Works exclusively with Microsoft Teams (teams.microsoft.com)
- Requires live captions to be enabled in Teams meetings
- Chrome/Edge/Brave browser extension (Manifest V3)
- No server-side dependencies - fully client-side processing

## User Workflow

1. Install extension from Chrome Web Store or load unpacked
2. Join Teams meeting and enable live captions (ALT+SHIFT+C)
3. Extension automatically captures captions in background
4. Use popup to either view captions in browser or download as file
5. Downloaded files contain speaker names, text, and timestamps in YAML format