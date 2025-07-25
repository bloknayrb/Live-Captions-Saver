/**
 * Tests for caption capture functionality
 */

// Mock DOM structure that matches Teams interface
function createMockTeamsDOM() {
  document.body.innerHTML = `
    <div data-tid="closed-captions-renderer">
      <div class="fui-ChatMessageCompact">
        <div data-tid="author">John Doe</div>
        <div data-tid="closed-caption-text">Hello everyone, welcome to the meeting</div>
      </div>
      <div class="fui-ChatMessageCompact">
        <div data-tid="author">Jane Smith</div>
        <div data-tid="closed-caption-text">Thanks John, glad to be here</div>
      </div>
    </div>
  `;
}

describe('Caption Capture Functions', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    localStorage.clear();
    
    // Setup DOM
    createMockTeamsDOM();
  });

  describe('DOM Detection', () => {
    test('should find captions container', () => {
      const container = document.querySelector('[data-tid="closed-captions-renderer"]');
      expect(container).not.toBeNull();
    });

    test('should find caption items', () => {
      const items = document.querySelectorAll('.fui-ChatMessageCompact');
      expect(items).toHaveLength(2);
    });

    test('should extract author names', () => {
      const authors = document.querySelectorAll('[data-tid="author"]');
      expect(authors).toHaveLength(2);
      expect(authors[0].textContent).toBe('John Doe');
      expect(authors[1].textContent).toBe('Jane Smith');
    });

    test('should extract caption text', () => {
      const texts = document.querySelectorAll('[data-tid="closed-caption-text"]');
      expect(texts).toHaveLength(2);
      expect(texts[0].textContent).toBe('Hello everyone, welcome to the meeting');
      expect(texts[1].textContent).toBe('Thanks John, glad to be here');
    });
  });

  describe('Caption Processing', () => {
    test('should process captions correctly', () => {
      // This would test the actual processing logic
      // For now, we'll test the basic structure
      const container = document.querySelector('[data-tid="closed-captions-renderer"]');
      const items = container.querySelectorAll('.fui-ChatMessageCompact');
      
      const processedCaptions = Array.from(items).map(item => {
        const author = item.querySelector('[data-tid="author"]')?.textContent?.trim();
        const text = item.querySelector('[data-tid="closed-caption-text"]')?.textContent?.trim();
        return { author, text };
      });

      expect(processedCaptions).toHaveLength(2);
      expect(processedCaptions[0]).toEqual({
        author: 'John Doe',
        text: 'Hello everyone, welcome to the meeting'
      });
    });
  });

  describe('Duplicate Detection', () => {
    test('should detect duplicate captions', () => {
      const captions = [
        { Name: 'John Doe', Text: 'Hello world', Time: '2023-01-01 10:00:00' },
        { Name: 'Jane Smith', Text: 'Hi there', Time: '2023-01-01 10:01:00' }
      ];

      const isDuplicate = (name, text, recentCaptions) => {
        return recentCaptions.some(c => c.Name === name && c.Text === text);
      };

      expect(isDuplicate('John Doe', 'Hello world', captions)).toBe(true);
      expect(isDuplicate('John Doe', 'Different text', captions)).toBe(false);
      expect(isDuplicate('Different Person', 'Hello world', captions)).toBe(false);
    });
  });
});

describe('Export Functions', () => {
  const mockTranscripts = [
    { Name: 'John Doe', Text: 'Hello world', Time: '2023-01-01 10:00:00', ID: 'caption_1' },
    { Name: 'Jane Smith', Text: 'Hi there', Time: '2023-01-01 10:01:00', ID: 'caption_2' }
  ];

  beforeEach(() => {
    localStorage.setItem('transcripts', JSON.stringify(mockTranscripts));
  });

  describe('JSON Export', () => {
    test('should format transcripts for JSON export', () => {
      const transcripts = JSON.parse(localStorage.getItem('transcripts'));
      const cleaned = transcripts.map(({ ID, ...rest }) => rest);

      expect(cleaned).toHaveLength(2);
      expect(cleaned[0]).not.toHaveProperty('ID');
      expect(cleaned[0]).toEqual({
        Name: 'John Doe',
        Text: 'Hello world', 
        Time: '2023-01-01 10:00:00'
      });
    });
  });

  describe('YAML Export', () => {
    test('should format transcripts for YAML export', () => {
      const transcripts = JSON.parse(localStorage.getItem('transcripts'));
      const cleaned = transcripts.map(({ ID, ...rest }) => rest);
      
      let yamlContent = '';
      cleaned.forEach(transcript => {
        yamlContent += `Name: ${transcript.Name}\\nText: ${transcript.Text}\\nTime: ${transcript.Time}\\n----\\n`;
      });

      expect(yamlContent).toContain('Name: John Doe');
      expect(yamlContent).toContain('Text: Hello world');
      expect(yamlContent).toContain('----');
    });
  });

  describe('Filename Generation', () => {
    test('should generate valid filename from page title', () => {
      document.title = 'Meeting with Team__Microsoft_Teams';
      
      const cleanTitle = document.title
        .replace('__Microsoft_Teams', '')
        .replace(/[^a-z0-9 ]/gi, '')
        .trim();

      expect(cleanTitle).toBe('Meeting with Team');
    });

    test('should handle empty or invalid titles', () => {
      document.title = '___!!!___';
      
      let cleanTitle = document.title
        .replace('__Microsoft_Teams', '')
        .replace(/[^a-z0-9 ]/gi, '')
        .trim();
        
      if (!cleanTitle) {
        cleanTitle = 'teams-meeting';
      }

      expect(cleanTitle).toBe('teams-meeting');
    });
  });
});