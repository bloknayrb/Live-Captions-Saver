/**
 * DOM utility functions for safe DOM operations
 */

import { SELECTORS } from '../config/constants.js';

export class DOMHelpers {
    /**
     * Safe DOM query selector
     */
    static safeQuerySelector(element, selector) {
        try {
            return element ? element.querySelector(selector) : null;
        } catch (error) {
            console.warn(`Safe query selector failed for "${selector}":`, error);
            return null;
        }
    }

    /**
     * Safe DOM query selector all
     */
    static safeQuerySelectorAll(selector) {
        try {
            return document.querySelectorAll(selector) || [];
        } catch (error) {
            console.warn(`Safe query selector all failed for "${selector}":`, error);
            return [];
        }
    }

    /**
     * Safe text extraction
     */
    static safeExtractText(element) {
        try {
            if (!element) return '';
            return (element.innerText || element.textContent || '').trim();
        } catch (error) {
            console.warn('Safe text extraction failed:', error);
            return '';
        }
    }

    /**
     * Safe closest element search
     */
    static safeClosest(element, selector) {
        try {
            return element ? element.closest(selector) : null;
        } catch (error) {
            console.warn(`Safe closest failed for "${selector}":`, error);
            return null;
        }
    }

    /**
     * Get caption elements with fallback selectors
     */
    static getCaptionElements() {
        try {
            // Primary selector
            let captionTextElements = this.safeQuerySelectorAll(SELECTORS.PRIMARY_CAPTION);
            
            // Fallback selectors if primary doesn't work
            if (captionTextElements.length === 0) {
                for (const selector of SELECTORS.FALLBACK_CAPTIONS) {
                    captionTextElements = this.safeQuerySelectorAll(selector);
                    if (captionTextElements.length > 0) {
                        console.log(`Using fallback caption selector: ${selector}`);
                        break;
                    }
                }
            }
            
            return captionTextElements;
        } catch (error) {
            console.error('Error in getCaptionElements:', error);
            return [];
        }
    }

    /**
     * Extract caption data with fallback strategies
     */
    static extractCaptionData(textElement) {
        try {
            const result = {
                text: '',
                name: 'Unknown Speaker',
                element: textElement
            };
            
            // Primary text extraction with normalization
            const rawText = this.safeExtractText(textElement);
            result.text = rawText; // Will be normalized by TextProcessor
            if (!result.text) return null;
            
            // Primary author extraction strategy
            const transcript = this.safeClosest(textElement, SELECTORS.CHAT_MESSAGE);
            if (transcript) {
                const authorElement = this.safeQuerySelector(transcript, SELECTORS.AUTHOR);
                if (authorElement) {
                    result.name = this.safeExtractText(authorElement);
                }
            }
            
            // Fallback author extraction strategies
            if (result.name === 'Unknown Speaker') {
                const fallbackSelectors = [
                    '[data-tid="author"]',
                    '.fui-ChatMessageAuthor',
                    '[class*="author"]',
                    '[class*="Author"]',
                    '[class*="name"]',
                    '[class*="Name"]'
                ];
                
                for (const selector of fallbackSelectors) {
                    const chatMessage = this.safeClosest(textElement, '[class*="ChatMessage"]');
                    const authorEl = this.safeQuerySelector(chatMessage, selector) ||
                                   this.safeQuerySelector(textElement.parentElement, selector) ||
                                   this.safeQuerySelector(textElement.parentElement?.parentElement, selector);
                    
                    if (authorEl) {
                        const authorText = this.safeExtractText(authorEl);
                        if (authorText && authorText !== result.text) {
                            result.name = authorText;
                            break;
                        }
                    }
                }
            }
            
            return result;
        } catch (error) {
            console.error('Error in extractCaptionData:', error);
            return null;
        }
    }
}