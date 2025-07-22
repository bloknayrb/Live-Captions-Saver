/**
 * Text processing utilities for caption normalization and similarity detection
 */

import { PERFORMANCE } from '../config/constants.js';

export class TextProcessor {
    /**
     * Comprehensive text cleaning and normalization
     */
    static normalizeText(text) {
        if (!text) return '';
        
        let cleaned = text;
        
        // Remove HTML entities
        cleaned = cleaned.replace(/&[a-zA-Z0-9#]+;/g, ' ');
        
        // Remove extra whitespace (multiple spaces, tabs, newlines)
        cleaned = cleaned.replace(/\s+/g, ' ');
        
        // Remove common Teams UI artifacts and typing indicators
        cleaned = cleaned.replace(/\.\.\./g, ''); // Remove ellipsis/typing indicators
        cleaned = cleaned.replace(/^\s*[.\-*><|~+=]+\s*/g, ''); // Remove leading symbols
        cleaned = cleaned.replace(/\s*[.\-*><|~+=]+\s*$/g, ''); // Remove trailing symbols
        
        // Remove common UI noise
        cleaned = cleaned.replace(/\[.*?\]/g, ''); // Remove bracketed content
        cleaned = cleaned.replace(/\(typing\)/gi, ''); // Remove typing indicators
        cleaned = cleaned.replace(/\(speaking\)/gi, ''); // Remove speaking indicators
        
        // Normalize punctuation spacing
        cleaned = cleaned.replace(/\s*([,.!?;:])\s*/g, '$1 ');
        
        // Final cleanup
        cleaned = cleaned.trim();
        
        return cleaned;
    }

    /**
     * Calculate text similarity for fuzzy duplicate detection
     */
    static calculateTextSimilarity(text1, text2) {
        try {
            if (!text1 || !text2) return 0;
            
            const norm1 = this.normalizeText(text1).toLowerCase();
            const norm2 = this.normalizeText(text2).toLowerCase();
            
            if (norm1 === norm2) return 1;
            
            // Check if one text contains the other (for progressive updates)
            if (norm1.includes(norm2) || norm2.includes(norm1)) {
                const shorter = norm1.length < norm2.length ? norm1 : norm2;
                const longer = norm1.length >= norm2.length ? norm1 : norm2;
                return shorter.length / longer.length;
            }
            
            // Simple word-based similarity for different approaches to same content
            const words1 = norm1.split(/\s+/).filter(w => w.length > PERFORMANCE.MAX_WORD_LENGTH_FILTER);
            const words2 = norm2.split(/\s+/).filter(w => w.length > PERFORMANCE.MAX_WORD_LENGTH_FILTER);
            
            if (words1.length === 0 || words2.length === 0) return 0;
            
            const commonWords = words1.filter(w => words2.includes(w)).length;
            const totalWords = Math.max(words1.length, words2.length);
            
            return commonWords / totalWords;
        } catch (error) {
            console.warn('Error calculating text similarity:', error);
            return 0;
        }
    }

    /**
     * Create consistent caption keys
     */
    static createCaptionKey(name, text) {
        const normalizedName = name ? name.trim() : 'Unknown Speaker';
        const normalizedText = this.normalizeText(text);
        return `${normalizedName}:${normalizedText}`;
    }
}