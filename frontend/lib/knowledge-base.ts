// Clean minimal knowledge-base module
// Provides the Architect prompts used by the frontend AnythingLLM integration.

import { ROLES, RATE_CARD_MAP } from './rateCard';

export const THE_ARCHITECT_V4_PROMPT = "v4.1 - Self-Contained Multi-Scope Architect Prompt (placeholder).";

export const THE_ARCHITECT_PROD_PROMPT = THE_ARCHITECT_V4_PROMPT;

export default THE_ARCHITECT_V4_PROMPT;

// Provide a lightweight SOCIAL_GARDEN_KNOWLEDGE_BASE object expected by UI components.
// This derives a `rateCard` map from the authoritative `rateCard.ts` so components can
// read role names and rates via SOCIAL_GARDEN_KNOWLEDGE_BASE.rateCard.
export const SOCIAL_GARDEN_KNOWLEDGE_BASE = {
	rateCard: ROLES.reduce((acc: Record<string, { role: string; rate: number }>, r) => {
		acc[r.name] = { role: r.name, rate: r.rate };
		return acc;
	}, {}),
	// minimal metadata (UI may expect other fields in other contexts)
	meta: {
		source: 'rateCard.ts',
		lastUpdated: new Date().toISOString(),
	}
};

export { SOCIAL_GARDEN_KNOWLEDGE_BASE as defaultKnowledgeBase };


// === LEGACY SHIM EXPORTS - DO NOT EDIT ===
// Temporary bridge for broken imports. Run build after adding.
export const THE_ARCHITECT_V2_PROMPT = ""; 
export const THE_ARCHITECT_SYSTEM_PROMPT = THE_ARCHITECT_V4_PROMPT;
export const THE_ARCHITECT_KNOWLEDGE_BASE = SOCIAL_GARDEN_KNOWLEDGE_BASE;
// Add any other missing symbols from build errors below this line
