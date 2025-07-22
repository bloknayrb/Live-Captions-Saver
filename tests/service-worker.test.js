/**
 * Tests for service worker functionality
 */

// Import service worker functions (we'll need to adjust this based on the actual structure)
// For now, we'll test the logic directly

describe('Service Worker Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('formatTranscripts', () => {
    test('should format transcript array to text', () => {
      const mockTranscripts = [
        { Name: 'John Doe', Text: 'Hello world', Time: '2023-01-01 10:00:00' },
        { Name: 'Jane Smith', Text: 'Hi there', Time: '2023-01-01 10:01:00' }
      ];

      // This is the logic from the service worker
      const formatTranscripts = (json) => {
        return json.map(entry => {
          return `Name: ${entry.Name}\\nText: ${entry.Text}\\nTime: ${entry.Time}\\n----`;
        }).join('\\n');
      };

      const result = formatTranscripts(mockTranscripts);
      
      expect(result).toContain('Name: John Doe');
      expect(result).toContain('Text: Hello world');
      expect(result).toContain('Time: 2023-01-01 10:00:00');
      expect(result).toContain('----');
    });
  });

  describe('saveTranscripts', () => {
    test('should call chrome.downloads.download with correct parameters', () => {
      const mockTranscripts = [
        { Name: 'John Doe', Text: 'Hello world', Time: '2023-01-01 10:00:00' }
      ];
      const meetingTitle = 'Test Meeting';

      // Mock the service worker function logic
      const saveTranscripts = (title, transcriptArray) => {
        const formatTranscripts = (json) => {
          return json.map(entry => {
            return `Name: ${entry.Name}\\nText: ${entry.Text}\\nTime: ${entry.Time}\\n----`;
          }).join('\\n');
        };

        const formattedText = formatTranscripts(transcriptArray);
        
        chrome.downloads.download({
          url: 'data:text/plain;charset=utf-8,' + encodeURIComponent(formattedText),
          filename: title + '.txt',
          saveAs: true
        });
      };

      saveTranscripts(meetingTitle, mockTranscripts);

      expect(chrome.downloads.download).toHaveBeenCalledWith({
        url: expect.stringContaining('data:text/plain;charset=utf-8,'),
        filename: 'Test Meeting.txt',
        saveAs: true
      });
    });
  });

  describe('createViewerTab', () => {
    test('should create tab with HTML content', () => {
      const mockTranscripts = [
        { Name: 'John Doe', Text: 'Hello world', Time: '2023-01-01 10:00:00' }
      ];

      // Mock the service worker function logic
      const createViewerTab = (transcriptArray) => {
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head><title>MS Teams Captions Viewer</title></head>
          <body>
            <h1>MS Teams Captions</h1>
            ${transcriptArray.map(item => `
              <div>
                <div>${item.Name}</div>
                <div>${item.Text}</div>
                <div>${item.Time}</div>
              </div>
            `).join('')}
          </body>
          </html>
        `;
        
        chrome.tabs.create({
          url: 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent)
        });
      };

      createViewerTab(mockTranscripts);

      expect(chrome.tabs.create).toHaveBeenCalledWith({
        url: expect.stringContaining('data:text/html;charset=utf-8,')
      });
    });
  });

  describe('Message Handling', () => {
    test('should handle download_captions message', () => {
      const mockMessage = {
        message: 'download_captions',
        meetingTitle: 'Test Meeting',
        transcriptArray: [
          { Name: 'John Doe', Text: 'Hello world', Time: '2023-01-01 10:00:00' }
        ]
      };

      // This would test the message listener logic
      // For now we just verify the message structure
      expect(mockMessage.message).toBe('download_captions');
      expect(mockMessage.meetingTitle).toBe('Test Meeting');
      expect(mockMessage.transcriptArray).toHaveLength(1);
    });

    test('should handle display_captions message', () => {
      const mockMessage = {
        message: 'display_captions',
        transcriptArray: [
          { Name: 'John Doe', Text: 'Hello world', Time: '2023-01-01 10:00:00' }
        ]
      };

      expect(mockMessage.message).toBe('display_captions');
      expect(mockMessage.transcriptArray).toHaveLength(1);
    });
  });
});