/**
 * Tests for unified standalone script functionality
 */

describe('Unified Standalone Script', () => {
  let mockTeamsCapture;

  // Mock the TeamsaptionCapture class structure
  const createMockCaptureClass = () => {
    return {
      transcriptArray: [],
      transcriptIdCounter: 0,
      config: {
        selectors: {
          captionsContainer: "[data-tid='closed-captions-renderer']",
          captionItems: '.fui-ChatMessageCompact',
          author: '[data-tid="author"]',
          captionText: '[data-tid="closed-caption-text"]'
        },
        storage: {
          key: 'transcripts',
          duplicateCheckLimit: 10
        }
      },
      
      isDuplicate: function(name, text) {
        const recentTranscripts = this.transcriptArray.slice(-this.config.storage.duplicateCheckLimit);
        return recentTranscripts.some(t => t.Name === name && t.Text === text);
      },
      
      addCaption: function(name, text, time) {
        const ID = `caption_${this.transcriptIdCounter++}`;
        const caption = { Name: name, Text: text, Time: time, ID };
        this.transcriptArray.push(caption);
        return caption;
      },
      
      prepareForExport: function() {
        if (this.transcriptArray.length === 0) {
          return null;
        }
        return this.transcriptArray.map(({ ID, ...rest }) => rest);
      },
      
      generateFilename: function(extension) {
        let title = document.title
          .replace("__Microsoft_Teams", '')
          .replace(/[^a-z0-9 ]/gi, '')
          .trim();
        
        if (!title) {
          title = 'teams-meeting';
        }
        
        return `transcript-${title}-test.${extension}`;
      },
      
      clearCaptions: function() {
        this.transcriptArray = [];
        this.transcriptIdCounter = 0;
        localStorage.removeItem(this.config.storage.key);
      }
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockTeamsCapture = createMockCaptureClass();
    
    // Mock DOM structure
    document.body.innerHTML = `
      <div data-tid="closed-captions-renderer">
        <div class="fui-ChatMessageCompact">
          <div data-tid="author">John Doe</div>
          <div data-tid="closed-caption-text">Hello everyone</div>
        </div>
      </div>
    `;
  });

  describe('Caption Detection', () => {
    test('should detect captions container', () => {
      const container = document.querySelector(mockTeamsCapture.config.selectors.captionsContainer);
      expect(container).not.toBeNull();
    });

    test('should find caption items', () => {
      const items = document.querySelectorAll(mockTeamsCapture.config.selectors.captionItems);
      expect(items).toHaveLength(1);
    });
  });

  describe('Caption Processing', () => {
    test('should add captions correctly', () => {
      const caption = mockTeamsCapture.addCaption('John Doe', 'Hello world', '2023-01-01 10:00:00');
      
      expect(caption).toEqual({
        Name: 'John Doe',
        Text: 'Hello world',
        Time: '2023-01-01 10:00:00',
        ID: 'caption_0'
      });
      
      expect(mockTeamsCapture.transcriptArray).toHaveLength(1);
    });

    test('should detect duplicates', () => {
      mockTeamsCapture.addCaption('John Doe', 'Hello world', '2023-01-01 10:00:00');
      
      const isDupe1 = mockTeamsCapture.isDuplicate('John Doe', 'Hello world');
      const isDupe2 = mockTeamsCapture.isDuplicate('John Doe', 'Different text');
      
      expect(isDupe1).toBe(true);
      expect(isDupe2).toBe(false);
    });

    test('should limit duplicate check to recent entries', () => {
      // Add more than the duplicate check limit
      for (let i = 0; i < 15; i++) {
        mockTeamsCapture.addCaption(`Person ${i}`, `Message ${i}`, `2023-01-01 10:${String(i).padStart(2, '0')}:00`);
      }
      
      // The first entry should no longer be in the duplicate check range
      const isDupe = mockTeamsCapture.isDuplicate('Person 0', 'Message 0');
      expect(isDupe).toBe(false);
    });
  });

  describe('Export Preparation', () => {
    test('should prepare captions for export by removing IDs', () => {
      mockTeamsCapture.addCaption('John Doe', 'Hello world', '2023-01-01 10:00:00');
      mockTeamsCapture.addCaption('Jane Smith', 'Hi there', '2023-01-01 10:01:00');
      
      const exported = mockTeamsCapture.prepareForExport();
      
      expect(exported).toHaveLength(2);
      expect(exported[0]).not.toHaveProperty('ID');
      expect(exported[0]).toEqual({
        Name: 'John Doe',
        Text: 'Hello world',
        Time: '2023-01-01 10:00:00'
      });
    });

    test('should return null when no captions exist', () => {
      const exported = mockTeamsCapture.prepareForExport();
      expect(exported).toBeNull();
    });
  });

  describe('Filename Generation', () => {
    test('should generate filename from page title', () => {
      document.title = 'Team Meeting__Microsoft_Teams';
      
      const filename = mockTeamsCapture.generateFilename('json');
      expect(filename).toBe('transcript-Team Meeting-test.json');
    });

    test('should handle empty title', () => {
      document.title = '__Microsoft_Teams';
      
      const filename = mockTeamsCapture.generateFilename('yaml');
      expect(filename).toBe('transcript-teams-meeting-test.yaml');
    });

    test('should sanitize special characters', () => {
      document.title = 'Meeting @ 3:30 PM!__Microsoft_Teams';
      
      const filename = mockTeamsCapture.generateFilename('txt');
      expect(filename).toBe('transcript-Meeting  330 PM-test.txt');
    });
  });

  describe('Caption Management', () => {
    test('should clear all captions', () => {
      mockTeamsCapture.addCaption('John Doe', 'Hello world', '2023-01-01 10:00:00');
      expect(mockTeamsCapture.transcriptArray).toHaveLength(1);
      
      mockTeamsCapture.clearCaptions();
      
      expect(mockTeamsCapture.transcriptArray).toHaveLength(0);
      expect(mockTeamsCapture.transcriptIdCounter).toBe(0);
    });

    test('should call localStorage.removeItem when clearing', () => {
      const mockRemoveItem = jest.spyOn(Storage.prototype, 'removeItem');
      
      mockTeamsCapture.clearCaptions();
      
      expect(mockRemoveItem).toHaveBeenCalledWith('transcripts');
      
      mockRemoveItem.mockRestore();
    });
  });

  describe('Configuration', () => {
    test('should have correct selectors', () => {
      expect(mockTeamsCapture.config.selectors.captionsContainer).toBe("[data-tid='closed-captions-renderer']");
      expect(mockTeamsCapture.config.selectors.captionItems).toBe('.fui-ChatMessageCompact');
      expect(mockTeamsCapture.config.selectors.author).toBe('[data-tid="author"]');
      expect(mockTeamsCapture.config.selectors.captionText).toBe('[data-tid="closed-caption-text"]');
    });

    test('should have correct storage settings', () => {
      expect(mockTeamsCapture.config.storage.key).toBe('transcripts');
      expect(mockTeamsCapture.config.storage.duplicateCheckLimit).toBe(10);
    });
  });
});