import { NextRequest } from 'next/server';

// Prefer secure server-side env vars; fallback to NEXT_PUBLIC for flexibility in current deployments
const ANYTHINGLLM_URL = process.env.ANYTHINGLLM_URL || process.env.NEXT_PUBLIC_ANYTHINGLLM_URL;
const ANYTHINGLLM_API_KEY = process.env.ANYTHINGLLM_API_KEY || process.env.NEXT_PUBLIC_ANYTHINGLLM_API_KEY;

export async function POST(request: NextRequest) {
  try {
    // Require server-side configuration
    if (!ANYTHINGLLM_URL || !ANYTHINGLLM_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'AnythingLLM is not configured on the server. Set ANYTHINGLLM_URL and ANYTHINGLLM_API_KEY.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. Read the user's SOW request message from the incoming POST request body
    const requestBody = await request.json();
    const { message, workspaceSlug = 'generate' } = requestBody;

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'message field is required and must be a string' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Create the planner prompt
    const plannerPrompt = `You are SOWcial Garden AI, the senior AI Proposal Specialist for Social Garden. Your primary function is to analyze client requirements and create detailed budget breakdowns and role allocations.

CRITICAL: You must ONLY return a valid JSON object. No prose, no explanations, no markdown formatting. Just pure JSON.

Based on the user's SOW request, analyze the requirements and return a JSON object with this exact structure:

{
  "client": "Client Name",
  "projectTitle": "Project Title",
  "totalBudget": 85000,
  "timelineWeeks": 16,
  "plan": [
    {
      "scopeName": "Scope Name",
      "description": "Brief description",
      "allocated_budget": 45000,
      "required_roles": [
        {
          "role": "EXACT Role from Rate Card",
          "hours": 80,
          "rate": 180.00
        }
      ]
    }
  ]
}

Use EXACT role names from this Rate Card only:
Account Management - Head Of: $365/hr
Account Management - Director: $295/hr
Account Management - Senior Account Manager: $210/hr
Account Management - Account Manager: $180/hr
Account Management - Account Coordinator: $120/hr
Project Management - Head Of: $295/hr
Project Management - Senior Project Manager: $210/hr
Project Management - Project Manager: $180/hr
Tech - Head Of - Customer Success: $365/hr
Tech - Head Of - Program Strategy: $365/hr
Tech - Head Of - Senior Project Management: $365/hr
Tech - Head Of - Systems: $365/hr
Tech - Delivery - Project Coordination: $110/hr
Tech - Integrations: $170/hr
Tech - Integrations (Senior): $295/hr
Tech - Keyword Research: $120/hr
Tech - Landing Page - (Offshore): $120/hr
Tech - Landing Page - (Onshore): $210/hr
Tech - Website Optimisation: $120/hr
Tech - Producer - Admin: $120/hr
Tech - Producer - Campaign Orchestration: $120/hr
Tech - Producer - Chat Bot Build: $120/hr
Tech - Producer - Copywriting: $120/hr
Tech - Producer - Deployment: $120/hr
Tech - Producer - Design: $120/hr
Tech - Producer - Development: $120/hr
Tech - Producer - Documentation: $120/hr
Tech - Producer - Email: $120/hr
Tech - Producer - Field Marketing: $120/hr
Tech - Producer - Integration: $120/hr
Tech - Producer - Landing Page: $120/hr
Tech - Producer - Lead Management: $120/hr
Tech - Producer - Reporting: $120/hr
Tech - Producer - Services: $120/hr
Tech - Producer - SMS Setup: $120/hr
Tech - Producer - Support & Monitoring: $120/hr
Tech - Producer - Testing: $120/hr
Tech - Producer - Training: $120/hr
Tech - Producer - Web Optimisation: $120/hr
Tech - Producer - Workflow: $120/hr
Tech - SEO Producer: $120/hr
Tech - SEO Strategy: $180/hr
Tech - Specialist - Admin: $180/hr
Tech - Specialist - Campaign Orchestration: $180/hr
Tech - Specialist - Complex Workflow: $180/hr
Tech - Specialist - Database Management: $180/hr
Tech - Specialist - Email: $180/hr
Tech - Specialist - Integration: $180/hr
Tech - Specialist - Integration (Snr): $190/hr
Tech - Specialist - Lead Management: $180/hr
Tech - Specialist - Program Strategy: $180/hr
Tech - Specialist - Reporting: $180/hr
Tech - Specialist - Services: $180/hr
Tech - Specialist - Testing: $180/hr
Tech - Specialist - Training: $180/hr
Tech - Specialist - Workflow: $180/hr
Tech - Sr. Architect - App Development: $365/hr
Tech - Sr. Architect - Consultation: $365/hr
Tech - Sr. Architect - Data Migration: $365/hr
Tech - Sr. Architect - Integration Strategy: $365/hr
Tech - Sr. Consultant - Advisory & Consultation: $295/hr
Tech - Sr. Consultant - Analytics: $295/hr
Tech - Sr. Consultant - Audit: $295/hr
Tech - Sr. Consultant - Campaign Strategy: $295/hr
Tech - Sr. Consultant - CRM Strategy: $295/hr
Tech - Sr. Consultant - Data Migration: $295/hr
Tech - Sr. Consultant - Field Marketing: $295/hr
Tech - Sr. Consultant - Services: $295/hr
Tech - Sr. Consultant - Solution Design: $295/hr
Tech - Sr. Consultant - Technical: $295/hr
Tech - Sr. Consultant - Strategy: $295/hr
Tech - Specialist - Research: $180/hr
Content - Campaign Strategy: $180/hr
Content - Keyword Research: $120/hr
Content - Keyword Research (Senior): $150/hr
Content - Optimisation: $150/hr
Content - Reporting (Offshore): $120/hr
Content - Reporting (Onshore): $150/hr
Content - SEO Copywriting: $150/hr
Content - SEO Strategy: $210/hr
Content - Website Optimisation: $120/hr
Content - Copywriter: $150/hr
Copywriting (Offshore): $120/hr
Copywriting (Onshore): $180/hr
Design - Digital Asset (Offshore): $140/hr
Design - Digital Asset (Onshore): $190/hr
Design - Email (Offshore): $120/hr
Design - Email (Onshore): $295/hr
Design - Landing Page (Onshore): $190/hr
Design - Landing page (Offshore): $120/hr
Dev (or Tech) - Landing Page (Offshore): $120/hr
Dev (or Tech) - Landing Page (Onshore): $210/hr

User's SOW Request: ${message}`;

    // 3. Make fetch request to AnythingLLM stream-chat
    const endpoint = `${ANYTHINGLLM_URL}/api/v1/workspace/${workspaceSlug}/stream-chat`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANYTHINGLLM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: plannerPrompt,
        mode: 'chat'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ AnythingLLM API error:', response.status, errorText);
      return new Response(
        JSON.stringify({
          error: `AnythingLLM API error: ${response.statusText}`,
          details: errorText.substring(0, 500)
        }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Receive the complete response and accumulate content
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      return new Response(
        JSON.stringify({ error: 'No response body from AnythingLLM' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let accumulatedContent = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue;

        try {
          const jsonStr = line.substring(6);
          const parsed = JSON.parse(jsonStr);
          const chunks = Array.isArray(parsed) ? parsed : [parsed];

          for (const data of chunks) {
            const content = data.textResponse || data.content || data.message || data.text || '';
            if (content && typeof content === 'string') {
              accumulatedContent += content;
            }

            if (data.close === true) {
              break;
            }
          }
        } catch (parseError) {
          console.error('❌ Failed to parse SSE data:', parseError);
        }
      }
    }

    // 5. Extract and parse the JSON part
    const jsonMatch = accumulatedContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ error: 'No JSON found in AI response', response: accumulatedContent }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const jsonString = jsonMatch[0];

    let plannerObject;
    try {
      plannerObject = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('❌ Failed to parse planner JSON:', parseError);
      return new Response(
        JSON.stringify({
          error: 'Invalid JSON in AI response',
          parseError: parseError.message,
          jsonString: jsonString
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. Console.log the parsed planner object
    console.log('✅ Parsed planner object:', plannerObject);

    // Writer step: Generate prose and JSON for each scope
    const completedScopes = [];

    for (const scope of plannerObject.plan) {
      // 3. Create writer prompt for this scope
      const writerPrompt = `You are SOWcial Garden AI. Generate detailed SOW content for this specific scope only.

Scope: ${scope.scopeName}
Description: ${scope.description}
Allocated Budget: $${scope.allocated_budget}
Required Roles: ${JSON.stringify(scope.required_roles)}

Generate a professional SOW section with:
1. Detailed prose description of the deliverables and approach
2. A JSON block with the exact structure for this scope

Return format:
[Start with the prose content]

\`\`\`json
{
  "scope_name": "${scope.scopeName}",
  "scope_description": "${scope.description}",
  "deliverables": ["detailed", "list", "of", "deliverables"],
  "assumptions": ["any", "assumptions"],
  "role_allocation": ${JSON.stringify(scope.required_roles)},
  "scope_subtotal": ${scope.allocated_budget},
  "discount_percent": 0,
  "gst_percent": 10
}
\`\`\``;

      // 4. Make fetch request for this scope
      const scopeResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ANYTHINGLLM_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: writerPrompt,
          mode: 'chat'
        }),
      });

      if (!scopeResponse.ok) {
        const errorText = await scopeResponse.text();
        console.error('❌ Scope generation error:', scopeResponse.status, errorText);
        continue; // Skip this scope but continue with others
      }

      // Accumulate scope response
      const scopeReader = scopeResponse.body?.getReader();
      if (!scopeReader) continue;

      let scopeContent = '';
      let scopeBuffer = '';

      while (true) {
        const { done, value } = await scopeReader.read();
        if (done) break;

        scopeBuffer += decoder.decode(value, { stream: true });
        const lines = scopeBuffer.split('\n');
        scopeBuffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          try {
            const jsonStr = line.substring(6);
            const parsed = JSON.parse(jsonStr);
            const chunks = Array.isArray(parsed) ? parsed : [parsed];

            for (const data of chunks) {
              const content = data.textResponse || data.content || data.message || data.text || '';
              if (content && typeof content === 'string') {
                scopeContent += content;
              }
            }
          } catch (parseError) {
            console.error('❌ Failed to parse scope SSE data:', parseError);
          }
        }
      }

      // 5. Extract prose and JSON from scope response
      const jsonMatch = scopeContent.match(/```json\s*([\s\S]*?)\s*```/);
      let prose = scopeContent;
      let jsonData = null;

      if (jsonMatch) {
        prose = scopeContent.replace(/```json[\s\S]*?```/, '').trim();
        try {
          jsonData = JSON.parse(jsonMatch[1]);
        } catch (parseError) {
          console.error('❌ Failed to parse scope JSON:', parseError);
        }
      }

      // Push structured object to completedScopes
      completedScopes.push({
        scopeName: scope.scopeName,
        prose: prose,
        jsonData: jsonData
      });
    }

    // 6. Console.log the completedScopes array
    console.log('✅ Completed scopes:', completedScopes);

    // 7. Return completedScopes array
    return new Response(JSON.stringify(completedScopes), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-sow endpoint:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}