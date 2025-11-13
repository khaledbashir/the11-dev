import { NextRequest } from 'next/server';
import { AnythingLLMService } from '@/lib/anythingllm';

// 🎯 DATA INTEGRITY: JSON Schema validation and retry logic for AI responses
interface StrictJSONSchema {
  type: 'object';
  properties: {
    scopeItems?: any;
    pricing?: any;
    suggestedRoles?: any;
    [key: string]: any;
  };
  required?: string[];
}

// JSON Schema for SOW generation responses
const SOW_RESPONSE_SCHEMA: StrictJSONSchema = {
  type: 'object',
  properties: {
    scopeItems: { type: 'array' },
    pricing: {
      type: 'object',
      properties: {
        role_allocation: { type: 'array' },
        discount: { type: 'number' },
        project_details: { type: 'object' }
      }
    },
    suggestedRoles: { type: 'array' },
    markdownContent: { type: 'string' },
    financialReasoning: { type: 'string' }
  }
};

// Data integrity validation function
function validateJSONStructure(data: any, schema: StrictJSONSchema): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  try {
    if (typeof data !== 'object' || data === null) {
      errors.push('Response must be a valid JSON object');
      return { isValid: false, errors };
    }

    // Check for required fields based on schema
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in data)) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }

    // Validate structure for SOW responses
    if (data.scopeItems && !Array.isArray(data.scopeItems)) {
      errors.push('scopeItems must be an array');
    }
    
    if (data.pricing && typeof data.pricing !== 'object') {
      errors.push('pricing must be an object');
    }
    
    if (data.suggestedRoles && !Array.isArray(data.suggestedRoles)) {
      errors.push('suggestedRoles must be an array');
    }

    return { isValid: errors.length === 0, errors };
  } catch (error) {
    errors.push(`Validation error: ${error}`);
    return { isValid: false, errors };
  }
}

// Enhanced message preparation for strict JSON output
function prepareStrictJSONMessage(originalMessage: string, retryCount: number = 0): string {
  const baseInstruction = `
You are "The Architect" AI for SOW generation. CRITICAL: You MUST output ONLY valid JSON.

JSON OUTPUT REQUIREMENTS:
- Output ONLY valid JSON - no markdown, no explanations, no additional text
- Structure: {"scopeItems": [...], "pricing": {...}, "markdownContent": "...", "financialReasoning": "..."}
- All property names MUST be quoted
- All strings MUST be properly escaped
- No trailing commas
- No unquoted property names

${retryCount > 0 ? `RETRY ATTEMPT ${retryCount}: Previous response was invalid JSON. Please ensure strict JSON formatting.` : ''}

Client Request: ${originalMessage}

Respond with ONLY valid JSON in the specified structure.`;
  
  return baseInstruction;
}

// Validate and retry AI requests with strict JSON enforcement
async function fetchWithJSONValidation(
  endpoint: string,
  message: string,
  apiKey: string,
  retryCount: number = 0
): Promise<{ response: Response; rawContent: string; isValidJSON: boolean }> {
  const maxRetries = 3;
  
  try {
    // Prepare message with strict JSON requirements
    const strictMessage = retryCount === 0 ?
      prepareStrictJSONMessage(message, 0) :
      prepareStrictJSONMessage(message, retryCount);
    
    console.log(`🔄 [DATA INTEGRITY] Attempt ${retryCount + 1}/${maxRetries + 1} - Sending strict JSON request`);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: strictMessage,
        mode: 'chat',
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Collect the entire response for validation
    let rawContent = '';
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        rawContent += decoder.decode(value, { stream: true });
      }
    } else {
      // Fallback for non-streaming responses
      rawContent = await response.text();
    }

    console.log(`📋 [DATA INTEGRITY] Raw response length: ${rawContent.length} characters`);
    console.log(`📋 [DATA INTEGRITY] Response preview: ${rawContent.substring(0, 200)}...`);

    // Validate JSON structure
    let isValidJSON = false;
    try {
      const parsed = JSON.parse(rawContent);
      const validation = validateJSONStructure(parsed, SOW_RESPONSE_SCHEMA);
      isValidJSON = validation.isValid;
      
      if (!isValidJSON) {
        console.warn(`⚠️ [DATA INTEGRITY] JSON validation failed: ${validation.errors.join(', ')}`);
      } else {
        console.log('✅ [DATA INTEGRITY] JSON validation passed');
      }
    } catch (parseError) {
      console.warn(`⚠️ [DATA INTEGRITY] JSON parse failed: ${parseError}`);
      isValidJSON = false;
    }

    // Retry if invalid and we haven't exceeded max retries
    if (!isValidJSON && retryCount < maxRetries) {
      console.log(`🔄 [DATA INTEGRITY] Retrying with enhanced JSON enforcement (attempt ${retryCount + 1})`);
      return await fetchWithJSONValidation(endpoint, message, apiKey, retryCount + 1);
    }

    return { response, rawContent, isValidJSON };
    
  } catch (error) {
    console.error(`❌ [DATA INTEGRITY] Fetch failed on attempt ${retryCount + 1}:`, error);
    
    if (retryCount >= maxRetries) {
      throw new Error(`Failed after ${maxRetries} retries: ${error}`);
    }
    
    // Exponential backoff before retry
    await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
    return await fetchWithJSONValidation(endpoint, message, apiKey, retryCount + 1);
  }
}

// Prefer secure server-side env vars; fallback to NEXT_PUBLIC for flexibility in current deployments
const ANYTHINGLLM_URL = process.env.ANYTHINGLLM_URL || process.env.NEXT_PUBLIC_ANYTHINGLLM_URL;
const ANYTHINGLLM_API_KEY = process.env.ANYTHINGLLM_API_KEY || process.env.NEXT_PUBLIC_ANYTHINGLLM_API_KEY;

/**
 * Fetch live analytics data for the Analytics Assistant
 * This ensures the AI always has access to current database information
 */
async function getLiveAnalyticsData(): Promise<string> {
  try {
    // Use internal API call (server-to-server)
    // In Docker: use NEXT_PUBLIC_BASE_URL, in dev: localhost
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/data/analytics-summary`, {
      cache: 'no-store',
    });
    
    if (!response.ok) {
      console.error('❌ [Analytics] Failed to fetch:', response.status);
      return '[Analytics data temporarily unavailable]';
    }

    const data = await response.json();
    
    // Format the data in a way the AI can easily parse
    return `
[LIVE DATABASE SNAPSHOT - ${new Date().toLocaleString()}]

OVERVIEW:
- Total SOWs: ${data.overview.total_sows}
- Total Investment Value: $${data.overview.total_investment.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
- Average SOW Value: $${data.overview.average_investment.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
- Unique Clients: ${data.overview.unique_clients}

STATUS BREAKDOWN:
${Object.entries(data.status_breakdown || {}).map(([status, count]) => `- ${status}: ${count}`).join('\n')}

TOP 5 CLIENTS BY VALUE:
${data.top_clients.map((c: any, i: number) => 
  `${i + 1}. ${c.client_name}: ${c.sow_count} SOW${c.sow_count > 1 ? 's' : ''}, $${c.total_value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} total`
).join('\n')}

ALL CLIENTS (sorted by value):
${data.all_clients.map((c: any) => 
  `- ${c.client_name}: ${c.sow_count} SOW${c.sow_count > 1 ? 's' : ''}, $${c.total_value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} total, avg $${c.avg_value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
).join('\n')}

[END LIVE DATA]
`;
  } catch (error: any) {
    console.error('❌ [Analytics] Exception:', error);
    return '[Analytics data temporarily unavailable - database error]';
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require server-side configuration only
    if (!ANYTHINGLLM_URL || !ANYTHINGLLM_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'AnythingLLM is not configured on the server. Set ANYTHINGLLM_URL and ANYTHINGLLM_API_KEY.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    // ============================================================================
    // CRITICAL DEBUG: INCOMING /stream-chat PAYLOAD
    // ============================================================================
    const requestBody = await request.json();
<<<<<<< HEAD
    // Sanitize messages by removing any injected system prompts
    const sanitizedForLog = {
      ...requestBody,
      messages: Array.isArray(requestBody.messages)
        ? requestBody.messages.filter((m: any) => m && m.role !== 'system')
        : requestBody.messages,
    };
    const removedSystems = Array.isArray(requestBody.messages)
      ? requestBody.messages.filter((m: any) => m && m.role === 'system').length
      : 0;
    
    console.log('//////////////////////////////////////////////////');
    console.log('// CRITICAL DEBUG: INCOMING /stream-chat PAYLOAD //');
    console.log('//////////////////////////////////////////////////');
    console.log('FULL REQUEST BODY (sanitized: system messages removed from log):');
    console.log(JSON.stringify(sanitizedForLog, null, 2));
    console.log('');
    if (removedSystems > 0) {
      console.log(`WARN: Detected and ignored ${removedSystems} system message(s) in incoming payload.`);
    }
    console.log('KEY FIELDS:');
    console.log('  workspace:', sanitizedForLog.workspace);
    console.log('  workspaceSlug:', sanitizedForLog.workspaceSlug);
    console.log('  threadSlug:', sanitizedForLog.threadSlug);
    console.log('  mode:', sanitizedForLog.mode);
    console.log('  model:', sanitizedForLog.model);
    console.log('  messages.length:', sanitizedForLog.messages?.length);
    if (sanitizedForLog.messages && sanitizedForLog.messages.length > 0) {
      console.log('  messages[0].role:', sanitizedForLog.messages[0].role);
      console.log('  messages[0].content (first 200 chars):', sanitizedForLog.messages[0].content?.substring(0, 200));
      console.log('  messages[messages.length-1].role:', sanitizedForLog.messages[sanitizedForLog.messages.length - 1].role);
      console.log('  messages[messages.length-1].content (first 200 chars):', sanitizedForLog.messages[sanitizedForLog.messages.length - 1].content?.substring(0, 200));
    }
    console.log('//////////////////////////////////////////////////');
    // ============================================================================
    
  const body = requestBody;
  let { messages, workspaceSlug, workspace, threadSlug, mode = 'chat', model } = body;
    // Guard: strip any system messages from actual processing
    if (Array.isArray(messages)) {
      messages = messages.filter((m: any) => m && m.role !== 'system');
    }
    
    // Use 'workspace' if provided, otherwise fall back to 'workspaceSlug'
    const effectiveWorkspaceSlug = workspace || workspaceSlug;
    
    console.log('');
    console.log('=== WORKSPACE RESOLUTION ===');
    console.log('workspace param:', workspace);
    console.log('workspaceSlug param:', workspaceSlug);
    console.log('effectiveWorkspaceSlug:', effectiveWorkspaceSlug);
    console.log('');
    
    if (!effectiveWorkspaceSlug) {
      const errorMsg = 'No workspace specified. Must provide workspace or workspaceSlug parameter.';
=======
    console.log('🔍 [DEBUG] Raw request body:', JSON.stringify(requestBody));
    const { workspaceSlug, threadSlug, message } = requestBody;
    console.log('🔍 [DEBUG] Extracted values:', {
      workspaceSlug: typeof workspaceSlug + ': ' + workspaceSlug,
      threadSlug: typeof threadSlug + ': ' + threadSlug,
      message: typeof message + ': ' + (typeof message === 'string' ? message.substring(0, 50) + '...' : JSON.stringify(message).substring(0, 50) + '...')
    });

    // CRITICAL: Validate that message is a primitive string, reject any objects
    if (!workspaceSlug || typeof workspaceSlug !== 'string') {
      console.error('❌ [Perfect Mirror] Invalid workspaceSlug:', typeof workspaceSlug);
>>>>>>> acc30a0 (fix: Replace placeholder THE_ARCHITECT_V6_PROMPT with working SOWcial Garden AI prompt)
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      const errorMsg = 'No messages provided. Must provide messages array.';
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
  // Get the last user message
  const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      const errorMsg = 'No user message provided. Last message must be from user.';
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 🔧 CRITICAL FIX: Parse JSON message content for SOW generation
    // Frontend sends messages in format: {"prompt": "actual message", "discount": 0}
    let messageToSend: string = typeof lastMessage.content === 'string' ? lastMessage.content : '';
    
    // Try to parse as JSON and extract the prompt field
    try {
      const parsedContent = JSON.parse(messageToSend);
      if (parsedContent && typeof parsedContent.prompt === 'string') {
        messageToSend = parsedContent.prompt;
        console.log('📝 Extracted prompt from JSON:', messageToSend.substring(0, 100) + '...');
      }
    } catch (e) {
      // Not JSON, use as-is
      console.log('📝 Message is plain text, using as-is');
    }
    
    if (!messageToSend || typeof messageToSend !== 'string') {
      const errorMsg = 'Message content must be a non-empty string.';
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 🔧 CRITICAL FIX: Use workspace chat endpoint instead of OpenAI-compatible
    // The OpenAI endpoint requires different permissions
    let endpoint: string;
    if (effectiveWorkspaceSlug === 'generate' && threadSlug) {
      // Thread-based streaming chat for SOW generation (saves to thread)
      endpoint = `${ANYTHINGLLM_URL}/api/v1/workspace/${effectiveWorkspaceSlug}/thread/${threadSlug}/stream-chat`;
      console.log('🔧 Using thread-based endpoint for SOW generation');
    } else if (threadSlug) {
      // Thread-based streaming chat (saves to SOW's thread)
      endpoint = `${ANYTHINGLLM_URL}/api/v1/workspace/${effectiveWorkspaceSlug}/thread/${threadSlug}/stream-chat`;
    } else {
      // Workspace-level streaming chat (legacy behavior)
      endpoint = `${ANYTHINGLLM_URL}/api/v1/workspace/${effectiveWorkspaceSlug}/stream-chat`;
    }

<<<<<<< HEAD
    // 🎯 CRITICAL: For master dashboard workspace, inject live analytics data
    // This ensures the AI has access to the SAME data the UI shows
    const isMasterDashboard = effectiveWorkspaceSlug === 'sow-master-dashboard';
    
    if (isMasterDashboard) {
      console.log('📊 [Master Dashboard] Fetching live analytics data to inject...');
      const liveData = await getLiveAnalyticsData();
      
      // Prepend the live data to the user's message
      // The AI will see this data as context for every question
      messageToSend = `${liveData}\n\nUser Question: ${messageToSend}`;
      
      console.log('✅ [Master Dashboard] Live data injected into message');
=======
    // CRITICAL: Reject only if the ENTIRE message is a valid JSON object or array
    const rawMessage = message.trim();
    
    // Check if the entire message is a valid JSON object or array
    // We need to be more careful here - only reject if it's actually valid JSON
    // not just text that happens to start with { or [
    let isValidJSON = false;
    try {
      const parsed = JSON.parse(rawMessage);
      // Only consider it valid JSON if it's an object or array (not strings, numbers, etc.)
      isValidJSON = (parsed !== null && typeof parsed === 'object') || Array.isArray(parsed);
    } catch (e) {
      // If it can't be parsed as JSON, it's not valid JSON
      isValidJSON = false;
    }
    
    if (isValidJSON) {
      console.error('❌ [Perfect Mirror] Rejecting valid JSON object/array in message field:', rawMessage.substring(0, 100));
      return new Response(
        JSON.stringify({ error: 'message must be plain text, not JSON objects or arrays' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
>>>>>>> acc30a0 (fix: Replace placeholder THE_ARCHITECT_V6_PROMPT with working SOWcial Garden AI prompt)
    }

    // 🔧 CRITICAL FIX: Handle message content properly
    let finalMessage = messageToSend;
    
    // First, check if it's a JSON object with prompt field
    try {
      const parsed = JSON.parse(messageToSend);
      if (parsed && typeof parsed === 'object' && parsed.prompt) {
        finalMessage = parsed.prompt;
        console.log('📝 Extracted prompt from JSON:', finalMessage.substring(0, 200));
      }
    } catch (e) {
      // Not JSON, use as-is
    }
    
    // Then, check if it's double-encoded JSON (common issue in the logs)
    try {
      const doubleParsed = JSON.parse(finalMessage);
      if (doubleParsed && typeof doubleParsed === 'object' && doubleParsed.prompt) {
        finalMessage = doubleParsed.prompt;
        console.log('📝 Extracted prompt from double-encoded JSON:', finalMessage.substring(0, 200));
      }
    } catch (e) {
      // Not double-encoded, continue with current message
    }
    
    const requestStartTime = Date.now();
    console.log('');
    console.log('=== ABOUT TO SEND TO ANYTHINGLLM ===');
    console.log('⏱️ Request Start Time:', new Date(requestStartTime).toISOString());
    console.log('Endpoint:', endpoint);
    console.log('Workspace:', effectiveWorkspaceSlug);
    console.log('Mode:', mode);
    console.log('ThreadSlug:', threadSlug);
    console.log('');
    console.log('⚠️  CRITICAL: The system prompt for this workspace is configured in AnythingLLM.');
    console.log('⚠️  This route does NOT inject prompts - it relies on workspace configuration.');
    console.log('⚠️  If responses are generic, check the workspace settings in AnythingLLM admin.');
    console.log('');
    console.log('Message to send (first 500 chars):');
    console.log(finalMessage.substring(0, 500));
    console.log('...');
    console.log('=== END DEBUG ===');
    console.log('');
    
    const fetchStartTime = Date.now();
    console.log(`⏱️ [TIMING] Fetch started at ${new Date(fetchStartTime).toISOString()}`);

    // 🔧 LLM provider is configured in AnythingLLM UI - no override here
    // The workspace uses the provider/model set in AnythingLLM admin

    // 🎯 DATA INTEGRITY: Use enhanced fetch with JSON validation and retry logic
    console.log('🔄 [DATA INTEGRITY] Starting enhanced AI request with validation...');
    
    const validationResult = await fetchWithJSONValidation(
      endpoint,
      finalMessage,
      ANYTHINGLLM_API_KEY,
      0
    );
    
    // Recreate response object for stream processing (since we collected the content)
    const response = new Response(
      new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          // Stream the validated content back as SSE
          const lines = validationResult.rawContent.split('\n');
          for (const line of lines) {
            if (line.trim()) {
              controller.enqueue(encoder.encode(line + '\n'));
            }
          }
          controller.close();
        }
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
        }
      }
    );
    
    // Log validation results
    if (validationResult.isValidJSON) {
      console.log('✅ [DATA INTEGRITY] AI response passed JSON validation');
    } else {
      console.warn('⚠️ [DATA INTEGRITY] AI response failed JSON validation but proceeding with retry logic');
    }

    const fetchEndTime = Date.now();
    console.log(`⏱️ [TIMING] Fetch completed in ${fetchEndTime - fetchStartTime}ms`);

    // 🎯 DATA INTEGRITY: Enhanced error handling for validation system
    if (!response.ok) {
      console.error('❌ ❌ ❌ ANYTHINGLLM ERROR ❌ ❌ ❌');
      console.error('Status:', response.status, response.statusText);
      console.error('Endpoint:', endpoint);
      console.error('Workspace:', effectiveWorkspaceSlug);
      console.error('Thread Slug:', threadSlug);
      console.error('Mode:', mode);
      console.error('❌ ❌ ❌ END ERROR ❌ ❌ ❌');
      
      return new Response(
        JSON.stringify({
          error: `AnythingLLM API error: ${response.statusText}`,
          details: `Request failed after data integrity validation attempts`,
          status: response.status,
          endpoint: endpoint,
          workspace: effectiveWorkspaceSlug,
          threadSlug: threadSlug,
          dataIntegrityEnabled: true
        }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Return the SSE stream directly to the client
    // Set up proper SSE headers
    const headers = new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    // Create a TransformStream to pass through the SSE data
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Start reading from AnythingLLM stream and writing to our stream
    (async () => {
      try {
        if (!response.body) {
          console.error('❌ [STREAM] No response body from AnythingLLM');
          await writer.close();
          return;
        }

        const streamStartTime = Date.now();
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let totalChunks = 0;
        let totalBytes = 0;
        let firstChunkTime: number | null = null;

        console.log(`🌊 [STREAM] Starting to read from AnythingLLM at ${new Date(streamStartTime).toISOString()}...`);

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            const streamEndTime = Date.now();
            console.log(`✅ [STREAM] Complete - ${totalChunks} chunks, ${totalBytes} bytes total, took ${streamEndTime - streamStartTime}ms`);
            if (firstChunkTime) {
              console.log(`⏱️ [TIMING] First chunk received after ${firstChunkTime - streamStartTime}ms`);
            }
            await writer.close();
            break;
          }

          if (!firstChunkTime) {
            firstChunkTime = Date.now();
            console.log(`⏱️ [TIMING] First chunk received after ${firstChunkTime - streamStartTime}ms`);
          }

          totalChunks++;
          totalBytes += value.length;

          // Decode the chunk with better error handling
          let chunk;
          try {
            chunk = decoder.decode(value, { stream: true });
          } catch (decodeError) {
            console.warn('⚠️ [STREAM] Decode error, using replacement:', decodeError);
            chunk = decoder.decode(value, { stream: false });
          }

          // Add to buffer
          buffer += chunk;

          // Process complete SSE lines (more efficient than splitting)
          let lineEndIndex;
          while ((lineEndIndex = buffer.indexOf('\n')) !== -1) {
            const line = buffer.substring(0, lineEndIndex);
            buffer = buffer.substring(lineEndIndex + 1);

            if (line.trim()) {
              // Log first few chunks for debugging
              if (totalChunks <= 3) {
                console.log(`📦 [STREAM] Chunk ${totalChunks}: ${line.substring(0, 100)}...`);
              }
              // Forward SSE line to client immediately (no batching)
              await writer.write(encoder.encode(line + '\n'));
            }
          }
        }
      } catch (error) {
        console.error('❌ [STREAM] Error:', error);
        await writer.abort(error);
      }
    })();

    return new Response(readable, { headers });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
