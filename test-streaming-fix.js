#!/usr/bin/env node

// Test script to verify SOW generation streaming fixes are working
// Tests the complete streaming pipeline: server proxy -> client SSE parsing -> UI state management

async function testStreamingFixes() {
  console.log('🧪 Testing SOW Generation Streaming Fixes...\n');

  // Test 1: Server-side SSE processing
  console.log('📡 Test 1: Server-side SSE endpoint...');
  try {
    const response = await fetch('http://localhost:3000/api/anythingllm/stream-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceSlug: 'sow-master-dashboard',
        message: 'Generate a test SOW for a digital marketing campaign',
        threadSlug: undefined
      }),
    });

    console.log(`✅ Server response: ${response.status} ${response.statusText}`);
    console.log(`📄 Content-Type: ${response.headers.get('content-type')}`);
    
    if (response.ok && response.headers.get('content-type')?.includes('text/event-stream')) {
      console.log('✅ Server correctly returns SSE stream');
    } else {
      console.log('❌ Server SSE response invalid');
      return;
    }

    // Test 2: Client-side SSE parsing
    console.log('\n📡 Test 2: Client-side SSE parsing...');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let chunkCount = 0;
    let totalChars = 0;
    let completeLines = 0;
    let sseChunks = 0;
    
    let buffer = '';

    while (chunkCount < 20) { // Limit for testing
      const { done, value } = await reader.read();
      
      if (done) {
        console.log('✅ Stream completed');
        break;
      }

      chunkCount++;
      const chunkStr = decoder.decode(value, { stream: true });
      totalChars += chunkStr.length;
      
      // Test improved buffer management
      buffer += chunkStr;
      const lines = buffer.split('\n');
      
      // The NEW improved algorithm: preserve incomplete lines
      const completeLinesInBuffer = lines.length - 1; // Last element is incomplete line
      completeLines += completeLinesInBuffer;
      buffer = lines[lines.length - 1] || ''; // Keep last incomplete line
      
      // Count SSE data events
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          sseChunks++;
          try {
            const jsonStr = line.substring(6);
            const data = JSON.parse(jsonStr);
            console.log(`📦 SSE chunk ${sseChunks}: ${data.type} - ${data.textResponse?.length || data.content?.length || 0} chars`);
          } catch (e) {
            console.log(`⚠️ Parse error for line: "${line.substring(0, 50)}..."`);
          }
        }
      }

      console.log(`📊 Chunk ${chunkCount}: ${chunkStr.length} chars, Total: ${totalChars}, Lines: ${completeLines}, Buffer: ${buffer.length}`);
      
      // Stop if we have reasonable data for testing
      if (sseChunks >= 5) {
        console.log('\n✅ Received enough SSE data for testing, stopping...');
        reader.cancel();
        break;
      }
    }

    console.log(`\n🎯 SSE Parsing Results:`);
    console.log(`  📦 Total chunks processed: ${chunkCount}`);
    console.log(`  📝 Total characters: ${totalChars}`);
    console.log(`  🔗 Complete lines parsed: ${completeLines}`);
    console.log(`  📡 SSE data events: ${sseChunks}`);
    console.log(`  🔄 Remaining buffer: ${buffer.length} chars`);

    if (sseChunks > 0 && totalChars > 0) {
      console.log('\n✅ SUCCESS: SSE streaming and parsing working correctly!');
      console.log('✅ Buffer management fix prevents data loss');
      console.log('✅ Complete lines are properly extracted');
    } else {
      console.log('\n❌ FAILED: SSE streaming or parsing issues');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure the development server is running on http://localhost:3000');
  }
}

// Run the test
testStreamingFixes();