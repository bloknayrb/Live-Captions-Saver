// Automated Test Suite for Live Captions Saver Improvements
// Run this in browser console on Teams page after loading the extension

class CaptionTestSuite {
    constructor() {
        this.tests = [];
        this.results = [];
        console.log('🧪 Caption Test Suite Initialized');
    }

    // Test helper functions
    assert(condition, message) {
        if (condition) {
            console.log(`✅ PASS: ${message}`);
            this.results.push({ test: message, status: 'PASS' });
            return true;
        } else {
            console.error(`❌ FAIL: ${message}`);
            this.results.push({ test: message, status: 'FAIL' });
            return false;
        }
    }

    // Test 1: Text Normalization
    testTextNormalization() {
        console.log('\n📝 Testing Text Normalization...');
        
        const tests = [
            { input: '  Hello   world  ', expected: 'Hello world' },
            { input: 'Test&nbsp;text', expected: 'Test text' },
            { input: 'Text...', expected: 'Text' },
            { input: '   Multiple    spaces   ', expected: 'Multiple spaces' },
            { input: 'Text (typing)', expected: 'Text' },
            { input: '[noise] Real text', expected: 'Real text' }
        ];

        tests.forEach((test, i) => {
            const result = normalizeText(test.input);
            this.assert(
                result === test.expected,
                `Normalize test ${i + 1}: "${test.input}" → "${result}" (expected: "${test.expected}")`
            );
        });
    }

    // Test 2: Key Generation Consistency
    testKeyGeneration() {
        console.log('\n🔑 Testing Key Generation Consistency...');
        
        const key1 = createCaptionKey('John Doe', '  Hello  world  ');
        const key2 = createCaptionKey('John Doe', 'Hello world');
        const key3 = createCaptionKey('Jane Smith', 'Hello world');
        
        this.assert(key1 === key2, 'Same speaker + normalized text should generate same key');
        this.assert(key1 !== key3, 'Different speakers should generate different keys');
        this.assert(key1.includes('John Doe'), 'Key should contain speaker name');
        this.assert(key1.includes('Hello world'), 'Key should contain normalized text');
    }

    // Test 3: Text Similarity Calculation
    testSimilarityCalculation() {
        console.log('\n🔍 Testing Text Similarity Calculation...');
        
        const tests = [
            { text1: 'Hello', text2: 'Hello', expected: 1.0 },
            { text1: 'Hello', text2: 'Hello there', expectedMin: 0.5 },
            { text1: 'Hello world', text2: 'Goodbye world', expectedMin: 0.3 },
            { text1: 'Completely different', text2: 'Nothing similar', expectedMax: 0.2 },
            { text1: '', text2: 'anything', expected: 0 }
        ];

        tests.forEach((test, i) => {
            const similarity = calculateTextSimilarity(test.text1, test.text2);
            
            if (test.expected !== undefined) {
                this.assert(
                    Math.abs(similarity - test.expected) < 0.01,
                    `Similarity test ${i + 1}: "${test.text1}" vs "${test.text2}" = ${similarity.toFixed(3)} (expected: ${test.expected})`
                );
            } else if (test.expectedMin !== undefined) {
                this.assert(
                    similarity >= test.expectedMin,
                    `Similarity test ${i + 1}: "${test.text1}" vs "${test.text2}" = ${similarity.toFixed(3)} (expected: >= ${test.expectedMin})`
                );
            } else if (test.expectedMax !== undefined) {
                this.assert(
                    similarity <= test.expectedMax,
                    `Similarity test ${i + 1}: "${test.text1}" vs "${test.text2}" = ${similarity.toFixed(3)} (expected: <= ${test.expectedMax})`
                );
            }
        });
    }

    // Test 4: Safe DOM Operations
    testSafeDOMOperations() {
        console.log('\n🛡️ Testing Safe DOM Operations...');
        
        // Test with null element
        const result1 = safeQuerySelector(null, '.test');
        this.assert(result1 === null, 'safeQuerySelector handles null element');
        
        // Test with invalid selector
        const result2 = safeQuerySelectorAll('invalid[selector');
        this.assert(Array.isArray(result2), 'safeQuerySelectorAll returns array even with invalid selector');
        
        // Test text extraction with null
        const result3 = safeExtractText(null);
        this.assert(result3 === '', 'safeExtractText handles null element');
        
        // Test with mock element
        const mockElement = { innerText: 'Test text' };
        const result4 = safeExtractText(mockElement);
        this.assert(result4 === 'Test text', 'safeExtractText extracts text correctly');
    }

    // Test 5: Caption Element Detection
    testCaptionElementDetection() {
        console.log('\n🔍 Testing Caption Element Detection...');
        
        const elements = getCaptionElements();
        this.assert(Array.isArray(elements), 'getCaptionElements returns array');
        this.assert(elements.length >= 0, 'getCaptionElements returns valid array');
        
        console.log(`Found ${elements.length} caption elements`);
        
        if (elements.length > 0) {
            this.assert(elements[0].nodeType === Node.ELEMENT_NODE, 'Caption elements are valid DOM nodes');
        }
    }

    // Test 6: Memory Management
    testMemoryManagement() {
        console.log('\n💾 Testing Memory Management...');
        
        const initialMemory = {
            transcripts: transcriptArray ? transcriptArray.length : 0,
            processed: processedCaptions ? processedCaptions.size : 0,
            tracking: captionElementTracking ? captionElementTracking.size : 0
        };
        
        console.log('Initial memory state:', initialMemory);
        
        // Test cleanup function exists and runs without error
        try {
            cleanupMemory();
            this.assert(true, 'cleanupMemory function executes without error');
        } catch (error) {
            this.assert(false, `cleanupMemory function failed: ${error.message}`);
        }
        
        // Test timer cleanup
        try {
            cleanupAllTimers();
            this.assert(true, 'cleanupAllTimers function executes without error');
        } catch (error) {
            this.assert(false, `cleanupAllTimers function failed: ${error.message}`);
        }
    }

    // Test 7: Clear Functionality
    testClearFunctionality() {
        console.log('\n🧹 Testing Clear Functionality...');
        
        // Check if CaptionSaver is available
        if (typeof window.CaptionSaver === 'undefined') {
            this.assert(false, 'CaptionSaver not available for clear testing');
            return;
        }
        
        // Test error handler availability
        this.assert(typeof window.CaptionSaver.ErrorHandler !== 'undefined', 'ErrorHandler module available');
        this.assert(typeof window.CaptionSaver.ErrorHandler.handleError === 'function', 'handleError method available');
        this.assert(typeof window.CaptionSaver.ErrorHandler.createOperationalError === 'function', 'createOperationalError method available');
        
        const data = window.CaptionSaver.Data;
        const controller = window.CaptionSaver.Controller;
        const memoryManager = window.CaptionSaver.MemoryManager;
        
        // Store original state
        const originalTranscript = [...data.transcriptArray];
        const originalProcessed = new Set(memoryManager.processedCaptions);
        const originalTracking = new Map(memoryManager.captionElementTracking);
        
        try {
            // Add test data
            data.transcriptArray = [
                { Name: "Test Speaker", Text: "Test caption", Time: "10:30:00", ID: "test1" }
            ];
            memoryManager.processedCaptions.add("test1");
            memoryManager.captionElementTracking.set("0:Test Speaker", {
                text: "Test caption",
                timestamp: Date.now(),
                processed: true
            });
            
            // Test clear functionality
            const clearResult = controller.clearTranscript();
            this.assert(clearResult === true, 'clearTranscript returns true on success');
            this.assert(data.transcriptArray.length === 0, 'Transcript array cleared');
            this.assert(memoryManager.processedCaptions.size === 0, 'Processed captions cleared');
            this.assert(memoryManager.captionElementTracking.size === 0, 'Caption tracking cleared');
            
            // Test message handler
            data.transcriptArray = [{ Name: "Test", Text: "Test", Time: "10:30:00", ID: "test2" }];
            let responseReceived = false;
            let responseSuccess = false;
            
            controller.handleMessage(
                { message: "clear_transcript" },
                null,
                (response) => {
                    responseReceived = true;
                    responseSuccess = response && response.success;
                }
            );
            
            this.assert(responseReceived, 'Clear message handler responds');
            this.assert(responseSuccess, 'Clear message handler returns success');
            this.assert(data.transcriptArray.length === 0, 'Message handler clears transcript');
            
        } finally {
            // Restore original state
            data.transcriptArray = originalTranscript;
            memoryManager.processedCaptions = originalProcessed;
            memoryManager.captionElementTracking = originalTracking;
        }
    }

    // Test 8: Error Handling Resilience
    testErrorHandling() {
        console.log('\n🚨 Testing Error Handling...');
        
        // Test extractCaptionData with invalid input
        const result1 = extractCaptionData(null);
        this.assert(result1 === null, 'extractCaptionData handles null input gracefully');
        
        // Test calculateTextSimilarity with invalid input
        const result2 = calculateTextSimilarity(null, undefined);
        this.assert(result2 === 0, 'calculateTextSimilarity handles invalid input');
        
        // Test createCaptionKey with edge cases
        const result3 = createCaptionKey('', '');
        this.assert(typeof result3 === 'string', 'createCaptionKey returns string even with empty input');
        
        const result4 = createCaptionKey(null, undefined);
        this.assert(typeof result4 === 'string', 'createCaptionKey handles null/undefined input');
    }

    // Test 8: Performance Characteristics
    testPerformance() {
        console.log('\n⚡ Testing Performance...');
        
        // Test text normalization performance
        const start1 = performance.now();
        for (let i = 0; i < 1000; i++) {
            normalizeText('Sample text with various    spaces and symbols... [noise]');
        }
        const time1 = performance.now() - start1;
        this.assert(time1 < 100, `Text normalization performance: ${time1.toFixed(2)}ms for 1000 operations (should be < 100ms)`);
        
        // Test similarity calculation performance
        const start2 = performance.now();
        for (let i = 0; i < 100; i++) {
            calculateTextSimilarity('Sample text for testing similarity', 'Sample text for testing performance');
        }
        const time2 = performance.now() - start2;
        this.assert(time2 < 50, `Similarity calculation performance: ${time2.toFixed(2)}ms for 100 operations (should be < 50ms)`);
    }

    // Test 9: Integration Test
    testIntegration() {
        console.log('\n🔄 Testing Integration...');
        
        // Test full pipeline with mock data
        const mockCaptionData = {
            text: '  Sample caption text...  ',
            name: 'Test Speaker',
            element: { nodeType: 1 }
        };
        
        // Test processCaptionUpdate
        try {
            const result = processCaptionUpdate(mockCaptionData, 0);
            this.assert(typeof result === 'boolean', 'processCaptionUpdate returns boolean');
        } catch (error) {
            this.assert(false, `processCaptionUpdate integration failed: ${error.message}`);
        }
        
        // Test isDuplicateCaption
        try {
            const result = isDuplicateCaption('Test Speaker', 'Sample text');
            this.assert(typeof result === 'boolean', 'isDuplicateCaption returns boolean');
        } catch (error) {
            this.assert(false, `isDuplicateCaption integration failed: ${error.message}`);
        }
    }

    // Run all tests
    async runAllTests() {
        console.log('🚀 Starting Automated Test Suite for Caption Improvements');
        console.log('=' .repeat(60));
        
        const testMethods = [
            'testTextNormalization',
            'testKeyGeneration', 
            'testSimilarityCalculation',
            'testSafeDOMOperations',
            'testCaptionElementDetection',
            'testMemoryManagement',
            'testClearFunctionality',
            'testErrorHandling',
            'testPerformance',
            'testIntegration'
        ];

        for (const testMethod of testMethods) {
            try {
                await this[testMethod]();
            } catch (error) {
                console.error(`❌ Test suite error in ${testMethod}:`, error);
                this.results.push({ test: testMethod, status: 'ERROR', error: error.message });
            }
        }

        this.printSummary();
    }

    // Print test summary
    printSummary() {
        console.log('\n' + '=' .repeat(60));
        console.log('📊 TEST SUMMARY');
        console.log('=' .repeat(60));
        
        const passed = this.results.filter(r => r.status === 'PASS').length;
        const failed = this.results.filter(r => r.status === 'FAIL').length;
        const errors = this.results.filter(r => r.status === 'ERROR').length;
        const total = this.results.length;
        
        console.log(`✅ Passed: ${passed}/${total}`);
        console.log(`❌ Failed: ${failed}/${total}`);
        console.log(`🚨 Errors: ${errors}/${total}`);
        console.log(`📈 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
        
        if (failed > 0) {
            console.log('\n❌ FAILED TESTS:');
            this.results.filter(r => r.status === 'FAIL').forEach(r => {
                console.log(`  - ${r.test}`);
            });
        }
        
        if (errors > 0) {
            console.log('\n🚨 ERROR TESTS:');
            this.results.filter(r => r.status === 'ERROR').forEach(r => {
                console.log(`  - ${r.test}: ${r.error}`);
            });
        }
        
        console.log('\n🎯 Overall Status:', passed === total ? '🟢 ALL TESTS PASSED' : '🟡 SOME TESTS FAILED');
    }
}

// Global test runner
window.testCaptions = new CaptionTestSuite();

// Auto-run tests when this script is loaded
console.log('📋 To run automated tests, execute: testCaptions.runAllTests()');
console.log('📋 For individual tests, try: testCaptions.testTextNormalization()');

// Export for manual testing
window.testCaptions;