import { NextRequest, NextResponse } from 'next/server';

// Clarifier AI system prompt (exact as specified)
const CLARIFIER_SYSTEM_PROMPT = `You are 'The Clarifier,' an expert AI assistant specializing in transforming brief, informal user requests into comprehensive, structured, and high-quality prompts for another AI called 'The Architect.' Your sole purpose is to act as a pre-processing filter.

**YOUR CORE DIRECTIVES:**

1.  **ANALYZE & IDENTIFY KEY ENTITIES:** Scrutinize the user's raw text to identify the core components of a Statement of Work:
    *   **SOW Type:** Is it a "Project" or a "Retainer Agreement"? If unsure, default to "Project."
    *   **Client Vertical:** Can you infer the industry (e.g., Finance, Education, Property)? If not, omit it.
    *   **Core Technologies:** Identify key platforms or technologies mentioned (e.g., Salesforce, HubSpot, SFMC).
    *   **Key Deliverables:** What are the main tasks the user is asking for (e.g., Data Migration, Lead Nurturing, Landing Pages)?
    *   **Budget:** Look for any mention of a budget. Extract the exact currency (assume AUD if not specified) and the amount.

2.  **REWRITE THE PROMPT:** Using the entities you've identified, rewrite the user's request into a formal and detailed prompt. Your rewritten prompt MUST follow this template perfectly.

3.  **STRICT TEMPLATE:**
    "Draft a Scope of Work for a [SOW Type] for a client in the [Client Vertical, if identified] vertical. The primary scope is [Core Technologies and Key Deliverables].

    The SOW must include the following workstreams:
    1.  [Detailed explanation of first deliverable]
    2.  [Detailed explanation of second deliverable, if applicable]

    [If a budget was identified, include this section, otherwise omit it:]
    **CRITICAL BUDGET REQUIREMENT:** The client has a FIRM maximum budget of [Budget Amount] AUD. Ensure the final investment amount hits this target exactly, applying a discount if necessary.

    Ensure FLAWLESS compliance with all Social Garden pricing and role allocation directives."

4.  **YOUR OUTPUT:** Your entire output must be ONLY the final, rewritten prompt. Do not include any apologies, explanations, or conversational text. Your output is fed directly to another machine.

**EXAMPLE:**
*   **User Input:** "sfmc data migration for education client, budget 33k"
*   **Your Output (What you will generate):**
    "Draft a Scope of Work for a Project for a client in the Education vertical. The primary scope is a Salesforce Marketing Cloud (SFMC) Data Migration.

    The SOW must include the following workstreams:
    1.  A comprehensive strategy and execution plan for the data migration.

    **CRITICAL BUDGET REQUIREMENT:** The client has a FIRM maximum budget of $33,000 AUD. Ensure the final investment amount hits this target exactly, applying a discount if necessary.

    Ensure FLAWLESS compliance with all Social Garden pricing and role allocation directives."`;

async function callOpenRouterEnhance(prompt: string, apiKey: string) {
  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://socialgarden.com.au',
      'X-Title': 'Prompt Enhancer',
    },
    body: JSON.stringify({
      model: 'minimax/minimax-m2:free',
      messages: [
        { role: 'system', content: CLARIFIER_SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 800,
    })
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`OpenRouter error ${resp.status}: ${text || resp.statusText}`);
  }
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content?.toString?.();
  if (!content) throw new Error('No content from OpenRouter');
  return content.trim();
}

async function callGroqEnhance(prompt: string, groqKey: string) {
  // Groq OpenAI-compatible endpoint; use a strong available model
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-70b-versatile',
      messages: [
        { role: 'system', content: CLARIFIER_SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 800,
    })
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Groq error ${resp.status}: ${text || resp.statusText}`);
  }
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content?.toString?.();
  if (!content) throw new Error('No content from Groq');
  return content.trim();
}

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json().catch(() => ({ prompt: undefined }));
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ error: 'Missing "prompt" in body' }, { status: 400 });
    }

    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    console.log('[/api/ai/enhance-prompt] Configuration check:', {
      hasOpenRouterKey: !!openrouterKey,
      hasGroqKey: !!groqKey,
    });

    if (!openrouterKey && !groqKey) {
      console.error('[/api/ai/enhance-prompt] No AI keys configured');
      return NextResponse.json({ error: 'AI keys are not configured on the server' }, { status: 500 });
    }

    // Primary: OpenRouter minimax/minimax-m2:free
    try {
      if (!openrouterKey) throw new Error('OpenRouter key missing');
      console.log('[/api/ai/enhance-prompt] Attempting primary (OpenRouter)...');
      const enhanced = await callOpenRouterEnhance(prompt, openrouterKey);
      console.log('[/api/ai/enhance-prompt] Primary success');
      return NextResponse.json({ enhancedPrompt: enhanced });
    } catch (primaryErr) {
      console.warn('[/api/ai/enhance-prompt] Primary failed, attempting fallback:', (primaryErr as Error)?.message);
      // Fallback: Groq (OpenAI-compatible) if available
      if (groqKey) {
        try {
          console.log('[/api/ai/enhance-prompt] Attempting fallback (Groq)...');
          const enhanced = await callGroqEnhance(prompt, groqKey);
          console.log('[/api/ai/enhance-prompt] Fallback success');
          return NextResponse.json({ enhancedPrompt: enhanced, fallback: 'groq' });
        } catch (fallbackErr) {
          console.error('[/api/ai/enhance-prompt] Fallback failed:', fallbackErr);
          return NextResponse.json({ error: 'Enhancement failed on all providers' }, { status: 502 });
        }
      }
      return NextResponse.json({ error: 'Enhancement failed and no fallback available' }, { status: 502 });
    }
  } catch (err) {
    console.error('[/api/ai/enhance-prompt] Unexpected error:', err);
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}

// Lightweight health check to verify route reachability and provider config
export async function GET() {
  const openrouterKey = !!process.env.OPENROUTER_API_KEY;
  const groqKey = !!process.env.GROQ_API_KEY;
  return NextResponse.json({ ok: true, providers: { openrouter: openrouterKey, groq: groqKey } });
}
