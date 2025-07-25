// Test script to verify the clear transcript functionality
// Run this in the browser console on a Teams page with the extension loaded

function testClearFunctionality() {
    console.log("=== Testing Clear Transcript Functionality ===");
    
    // Check if CaptionSaver is available
    if (typeof window.CaptionSaver === 'undefined') {
        console.error("❌ CaptionSaver not found. Make sure the extension is loaded.");
        return false;
    }
    
    const data = window.CaptionSaver.Data;
    const controller = window.CaptionSaver.Controller;
    
    // Add some test data to simulate captured captions
    console.log("📝 Adding test transcript data...");
    data.transcriptArray = [
        { Name: "Test Speaker 1", Text: "This is a test caption", Time: "10:30:00", ID: "test1" },
        { Name: "Test Speaker 2", Text: "This is another test caption", Time: "10:30:05", ID: "test2" },
        { Name: "Test Speaker 1", Text: "Final test caption", Time: "10:30:10", ID: "test3" }
    ];
    
    // Add some processed captions
    const memoryManager = window.CaptionSaver.MemoryManager;
    memoryManager.processedCaptions.add("test1");
    memoryManager.processedCaptions.add("test2");
    memoryManager.processedCaptions.add("test3");
    
    // Add some tracking data
    memoryManager.captionElementTracking.set("0:Test Speaker 1", {
        text: "This is a test caption",
        timestamp: Date.now(),
        processed: true
    });
    
    console.log("📊 Before clearing:");
    console.log(`  - Transcript entries: ${data.transcriptArray.length}`);
    console.log(`  - Processed captions: ${memoryManager.processedCaptions.size}`);
    console.log(`  - Tracking entries: ${memoryManager.captionElementTracking.size}`);
    
    // Test the clear functionality
    console.log("🧹 Clearing transcript...");
    const clearResult = controller.clearTranscript();
    
    console.log("📊 After clearing:");
    console.log(`  - Transcript entries: ${data.transcriptArray.length}`);
    console.log(`  - Processed captions: ${memoryManager.processedCaptions.size}`);
    console.log(`  - Tracking entries: ${memoryManager.captionElementTracking.size}`);
    
    // Verify everything was cleared
    const success = data.transcriptArray.length === 0 && 
                   memoryManager.processedCaptions.size === 0 && 
                   memoryManager.captionElementTracking.size === 0;
    
    if (success) {
        console.log("✅ Clear functionality test PASSED");
        return true;
    } else {
        console.log("❌ Clear functionality test FAILED");
        return false;
    }
}

// Test message handling
function testClearMessage() {
    console.log("=== Testing Clear Message Handler ===");
    
    if (typeof window.CaptionSaver === 'undefined') {
        console.error("❌ CaptionSaver not found. Make sure the extension is loaded.");
        return false;
    }
    
    const controller = window.CaptionSaver.Controller;
    const data = window.CaptionSaver.Data;
    
    // Add test data
    data.transcriptArray = [
        { Name: "Message Test", Text: "Test message handling", Time: "10:30:00", ID: "msgtest1" }
    ];
    
    console.log(`📊 Before message: ${data.transcriptArray.length} entries`);
    
    // Simulate the message handling
    const mockRequest = { message: "clear_transcript" };
    let responseReceived = false;
    let responseData = null;
    
    const mockSendResponse = (response) => {
        responseReceived = true;
        responseData = response;
        console.log("📨 Response received:", response);
    };
    
    // Call the message handler
    controller.handleMessage(mockRequest, null, mockSendResponse);
    
    console.log(`📊 After message: ${data.transcriptArray.length} entries`);
    
    const success = responseReceived && 
                   responseData && 
                   responseData.success && 
                   data.transcriptArray.length === 0;
    
    if (success) {
        console.log("✅ Clear message handler test PASSED");
        return true;
    } else {
        console.log("❌ Clear message handler test FAILED");
        return false;
    }
}

// Run all tests
function runAllClearTests() {
    console.log("🧪 Running all clear functionality tests...");
    
    const test1 = testClearFunctionality();
    const test2 = testClearMessage();
    
    if (test1 && test2) {
        console.log("🎉 All clear functionality tests PASSED!");
    } else {
        console.log("💥 Some clear functionality tests FAILED!");
    }
    
    return test1 && test2;
}

// Export for console use
window.testClearFunctionality = testClearFunctionality;
window.testClearMessage = testClearMessage;
window.runAllClearTests = runAllClearTests;

console.log("Clear functionality test script loaded. Run runAllClearTests() to test.");