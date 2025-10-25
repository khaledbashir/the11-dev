import { NextRequest } from 'next/server';

const ANYTHINGLLM_URL = process.env.ANYTHINGLLM_URL || 'https://ahmad-anything-llm.840tjq.easypanel.host';
const ANYTHINGLLM_API_KEY = process.env.ANYTHINGLLM_API_KEY || '0G0WTZ3-6ZX4D20-H35VBRG-9059WPA';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
  let { messages, workspaceSlug, workspace, threadSlug, mode = 'chat', model } = body;
    
    // Use 'workspace' if provided, otherwise fall back to 'workspaceSlug'
    const effectiveWorkspaceSlug = workspace || workspaceSlug;
    
    console.log('🔍 [AnythingLLM Stream] Chat Debug:', {
      receivedWorkspace: workspace,
      receivedWorkspaceSlug: workspaceSlug,
      effectiveWorkspaceSlug,
      threadSlug,
      mode,
      model,
      messagesCount: messages?.length,
      isThreadChat: !!threadSlug,
      bodyKeys: Object.keys(body)
    });
    
    if (!effectiveWorkspaceSlug) {
      const errorMsg = 'No workspace specified. Must provide workspace or workspaceSlug parameter.';
      console.error('❌ [AnythingLLM Stream]', errorMsg);
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      const errorMsg = 'No messages provided. Must provide messages array.';
      console.error('❌ [AnythingLLM Stream]', errorMsg, { messages });
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Get the system prompt (if provided)
    const systemMessage = messages.find((m: any) => m.role === 'system');
    const systemPrompt = systemMessage?.content || '';
    
    // Get the last user message
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      const errorMsg = 'No user message provided. Last message must be from user.';
      console.error('❌ [AnythingLLM Stream]', errorMsg, { lastMessage });
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

  // Build message to send
  let messageToSend = lastMessage.content;

    // Detect casual chat vs explicit SOW request to avoid forcing generation on greetings
    const isSowWorkspace = effectiveWorkspaceSlug && !effectiveWorkspaceSlug.includes('master-dashboard');
    const lower = (messageToSend || '').toLowerCase().trim();
    const isCasual = [
      'hi', 'hello', 'hey', 'yo', 'sup', 'wassup', 'how are you', 'who are you', 'help', 'what can you do', 'test'
    ].some(ph => lower === ph || lower.startsWith(ph + ' '));
    const explicitSowKeywords = [
      'generate sow', 'create sow', 'write sow', 'draft sow', 'scope of work', 'statement of work'
    ];
    const isExplicitSowRequest = explicitSowKeywords.some(k => lower.includes(k));

    // Enforce workspace-specific behavior with lightweight system overrides
    if (!isSowWorkspace) {
      // Master Dashboard: force analytics/query behavior and forbid SOW generation
      mode = 'query';
      messageToSend = [
        '[[DASHBOARD_SYSTEM_OVERRIDES]]',
        'You are in the Master Dashboard analytics workspace. You ONLY analyze existing embedded SOW knowledge to answer business/analytics questions. Never draft or generate a new SOW, proposal, or template. Keep answers concise, numeric where possible, and reference specific SOW titles when applicable.',
        '',
        '[[USER]]',
        messageToSend
      ].join('\n');
      console.log('🛡️ [AnythingLLM Stream] Dashboard guard applied (mode=query, forbid generation)');
    } else {
      // SOW workspaces: only load the heavy Architect context when explicitly asked
      if (systemPrompt && isExplicitSowRequest) {
        messageToSend = `[SYSTEM CONTEXT]\n${systemPrompt}\n\n[USER REQUEST]\n${messageToSend}`;
        console.log('🧠 [AnythingLLM Stream] Prepended Architect system prompt (explicit SOW request)');
      } else if (!isExplicitSowRequest) {
        // Add a soft safety rail to avoid accidental SOW drafting on casual prompts
        messageToSend = [
          '[[ARCHITECT_SAFETY_RAILS]]',
          'Only generate a SOW when the user explicitly requests it (e.g., "generate/create/draft a SOW" or provides a clear project brief). For greetings or general questions, respond briefly, explain what you can do, and ask clarifying questions. Do NOT output SOW structure unless explicitly asked.',
          '',
          '[[USER]]',
          messageToSend
        ].join('\n');
        console.log('�️ [AnythingLLM Stream] Architect safety rails applied (non-explicit request)');
      }
    }
    
    if (!messageToSend || typeof messageToSend !== 'string') {
      const errorMsg = 'Message content must be a non-empty string.';
      console.error('❌ [AnythingLLM Stream]', errorMsg, { messageToSend });
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Determine the endpoint based on whether this is thread-based chat
    let endpoint: string;
  if (threadSlug) {
      // Thread-based streaming chat (saves to SOW's thread)
      endpoint = `${ANYTHINGLLM_URL}/api/v1/workspace/${effectiveWorkspaceSlug}/thread/${threadSlug}/stream-chat`;
      console.log(`🧵 [AnythingLLM Stream] Sending to THREAD: ${effectiveWorkspaceSlug}/${threadSlug}`);
    } else {
      // Workspace-level streaming chat (legacy behavior)
      endpoint = `${ANYTHINGLLM_URL}/api/v1/workspace/${effectiveWorkspaceSlug}/stream-chat`;
      console.log(`💬 [AnythingLLM Stream] Sending to WORKSPACE: ${effectiveWorkspaceSlug}`);
    }

    console.log(`📨 [AnythingLLM Stream] Full URL: ${endpoint}`);
    console.log(`📨 [AnythingLLM Stream] User message:`, messageToSend.substring(0, 100));
    console.log(`📨 [AnythingLLM Stream] Request payload:`, {
      message: messageToSend.substring(0, 50) + '...',
      mode,
      messageLength: messageToSend.length
    });
    
    // 🔍 AUTH DEBUG: Log token details
    console.log(`🔑 [AnythingLLM Stream] Auth Debug:`, {
      hasToken: !!ANYTHINGLLM_API_KEY,
      tokenLength: ANYTHINGLLM_API_KEY?.length,
      tokenPrefix: ANYTHINGLLM_API_KEY?.substring(0, 5),
      anythingLLMUrl: ANYTHINGLLM_URL,
      endpoint: endpoint,
    });
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANYTHINGLLM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: messageToSend,
        mode, // 'chat' or 'query'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [AnythingLLM Stream] Error Response:', {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText.substring(0, 500),
        endpoint,
        workspace: effectiveWorkspaceSlug,
        threadSlug,
        authDebug: {
          tokenSent: !!ANYTHINGLLM_API_KEY,
          tokenLen: ANYTHINGLLM_API_KEY?.length,
        }
      });
      
      // Special logging for 401
      if (response.status === 401) {
        console.error('🚨 [AnythingLLM Stream] 401 UNAUTHORIZED - Possible causes:');
        console.error('   1. API key is invalid or expired');
        console.error('   2. AnythingLLM instance requires different auth method');
        console.error('   3. Token format is wrong (should be Bearer token)');
        console.error('   4. Workspace or thread doesn\'t exist with that access');
      }
      
      return new Response(
        JSON.stringify({ 
          error: `AnythingLLM API error: ${response.statusText}`,
          details: errorText.substring(0, 200),
          status: response.status
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
          console.error('❌ [AnythingLLM Stream] No response body');
          await writer.close();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let lineCount = 0;

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log(`✅ [AnythingLLM Stream] Stream complete - forwarded ${lineCount} lines`);
            await writer.close();
            break;
          }

          // Decode the chunk
          buffer += decoder.decode(value, { stream: true });
          
          // Split by newlines to handle SSE format
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep the last incomplete line in buffer

          for (const line of lines) {
            if (line.trim()) {
              // Forward the SSE line to the client
              lineCount++;
              if (lineCount <= 3 || lineCount % 10 === 0) {
                console.log(`📤 [AnythingLLM Stream] Forwarding line ${lineCount}:`, line.substring(0, 100));
              }
              await writer.write(encoder.encode(line + '\n'));
            }
          }
        }
      } catch (error) {
        console.error('❌ [AnythingLLM Stream] Error:', error);
        await writer.abort(error);
      }
    })();

    return new Response(readable, { headers });
  } catch (error) {
    console.error('❌ [AnythingLLM Stream] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
