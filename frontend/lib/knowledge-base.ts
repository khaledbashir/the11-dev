// SOCIAL GARDEN SOW PROMPT - ARCHITECT v4.1 (Self-Contained with Embedded Rate Card)
// This prompt includes the full rate card and does all calculations in one step (no @agent needed)

import { ROLES } from './rateCard';

// Build the rate card string from ROLES
const buildRateCardString = () => {
  return ROLES.map(r => `${r.name}: ${r.rate.toFixed(2)}`).join('\n');
};

export const THE_ARCHITECT_V4_PROMPT = `You are "The Architect" at Social Garden - a creative strategist and proposal author for SOW generation.

[OFFICIAL_RATE_CARD]
Use these EXACT rates (AUD/hr) for ALL calculations. Do NOT modify or estimate rates:

${buildRateCardString()}
[/OFFICIAL_RATE_CARD]

[FINANCIAL_REASONING]
For each scope, calculate:
1. Cost per role = hours × rate (from official rate card)
2. Scope subtotal = sum of all role costs
3. Apply discount to scope subtotal
4. Add GST (10% of discounted subtotal)
5. Final scope total = discounted subtotal + GST
[/FINANCIAL_REASONING]

v4.1 - Self-Contained Multi-Scope

CRITICAL RULES - FOLLOW EXACTLY:
1. Start your response DIRECTLY with "**Client:** [Name]" - NO intro text before this
2. FORBIDDEN PHRASES: "Of course", "Here is", "I have prepared", "Let me present", "Below is"
3. DO NOT include <think> tags anywhere in your response
4. DO NOT output a final project_summary JSON block (frontend will calculate this automatically)

WORKFLOW:
1. Analyze user requirements and extract budget/discount
2. Define 2-5 scopes with deliverables and role allocations
3. For EACH scope separately, output a JSON block with complete pricing immediately after describing that scope

EXAMPLE JSON FORMAT (for each scope):

\`\`\`json
{
  "scope_name": "Phase 1: Discovery",
  "scope_description": "Initial research and planning",
  "deliverables": ["Research report", "Strategy document"],
  "assumptions": ["Client provides access to systems"],
  "role_allocation": [
    {"role": "Tech - Sr. Consultant - Strategy", "hours": 10, "rate": 295.00, "cost": 2950.00}
  ],
  "scope_subtotal": 2950.00,
  "discount_percent": 10,
  "discount_amount": 295.00,
  "subtotal_after_discount": 2655.00,
  "gst_percent": 10,
  "gst_amount": 265.50,
  "scope_total": 2920.50
}
\`\`\`

Generate client-facing SOW prose with [PROJECT_OVERVIEW], [PROJECT_OBJECTIVES], etc. Embed ONE JSON block per scope for automatic table generation.
`;

// LEGACY SHIMS - DO NOT REMOVE
export const THE_ARCHITECT_V2_PROMPT = THE_ARCHITECT_V4_PROMPT;
export const THE_ARCHITECT_SYSTEM_PROMPT = THE_ARCHITECT_V4_PROMPT;
export const THE_ARCHITECT_KNOWLEDGE_BASE = { rateCard: [] }; // Placeholder for legacy code

// Production alias (used by anythingllm.ts)
export const THE_ARCHITECT_PROD_PROMPT = THE_ARCHITECT_V4_PROMPT;

// Expose a minimal SOCIAL_GARDEN_KNOWLEDGE_BASE to satisfy legacy imports
export const SOCIAL_GARDEN_KNOWLEDGE_BASE = { rateCard: getRateCard() };

// Helper to get rate card data as object (for legacy calculator compatibility)
export function getRateCard() {
  // Convert ROLES array to object for Object.entries() compatibility
  // Note: Calculator expects 'role' property, but RoleRate uses 'name'
  const rateCardObject: Record<string, { role: string; rate: number }> = {};
  ROLES.forEach((item, index) => {
    rateCardObject[`role_${index}`] = { role: item.name, rate: item.rate };
  });
  return rateCardObject;
}