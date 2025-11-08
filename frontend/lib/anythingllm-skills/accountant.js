// Accountant Skill - Deterministic financial calculator
// Receives JSON with scopes[{role_allocation[{role,hours}]}] and discount
// Validates roles against official rate card and returns enriched financials

const RATE_CARD = require('../rateCard.json'); // Fallback if we place a JSON copy
// If rateCard.json doesn't exist, you can generate one from rateCard.ts during build.

function buildRateMap(card) {
  const map = {};
  (card.roles || []).forEach(r => { map[r.name || r.role] = r.rate; });
  return map;
}

const rateMap = buildRateMap(RATE_CARD);

function validateAndEnrich(input) {
  if (!input || typeof input !== 'object') throw new Error('Invalid input payload');
  const discount = Number(input.discount || 0);
  const scopes = Array.isArray(input.scopes) ? input.scopes : [];
  if (scopes.length === 0) throw new Error('No scopes provided');

  const enrichedScopes = scopes.map((scope, scopeIdx) => {
    const alloc = Array.isArray(scope.role_allocation) ? scope.role_allocation : [];
    if (alloc.length === 0) throw new Error(`Scope ${scopeIdx} has no role_allocation entries`);
    let scopeTotal = 0;
    const items = alloc.map(item => {
      const roleName = item.role;
      if (!rateMap[roleName]) {
        throw new Error(`Unrecognized role: ${roleName}`);
      }
      const hours = Number(item.hours || 0);
      const rate = Number(rateMap[roleName]);
      const cost = +(hours * rate).toFixed(2);
      scopeTotal += cost;
      return { role: roleName, hours, rate, cost };
    });
    return {
      scope_name: scope.scope_name,
      scope_description: scope.scope_description,
      deliverables: scope.deliverables || [],
      assumptions: scope.assumptions || [],
      items,
      scope_total: +scopeTotal.toFixed(2)
    };
  });

  const subtotal = +enrichedScopes.reduce((sum, s) => sum + s.scope_total, 0).toFixed(2);
  const discount_amount = +(subtotal * (discount / 100)).toFixed(2);
  const total_after_discount = +(subtotal - discount_amount).toFixed(2);
  const gst_amount = +(total_after_discount * 0.10).toFixed(2); // Always assume GST applicable here; upstream can adjust
  const final_total = +(total_after_discount + gst_amount).toFixed(2);

  return {
    version: '4.2-financial',
    discount,
    scopes: enrichedScopes,
    financials: {
      subtotal,
      discount_amount,
      total_after_discount,
      gst_amount,
      final_total
    }
  };
}

module.exports = {
  name: 'Accountant',
  description: 'Deterministic financial calculator for SOW scope JSON',
  execute: async function(params) {
    try {
      const payload = params.json || params.payload || params;
      const result = validateAndEnrich(payload);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};
/**
 * Accountant Skill
 * Deterministic financial calculator for multi-scope SOWs.
 * Responsibilities:
 *  - Validate incoming roles against official rate card
 *  - Reject unknown/hallucinated roles
 *  - Apply discount and GST logic
 *  - Return enriched scopes with rates & costs + financial summary
 *
 * Input JSON Spec (from Architect via @accountant call):
 * {
 *   projectTitle: string,
 *   clientName: string,
 *   discount?: number (0-100),
 *   gstApplicable?: boolean,
 *   scopes: [
 *     { scope_name, scope_description, deliverables[], assumptions[], role_allocation: [{ role, hours }] }
 *   ]
 * }
 */

const RATE_CARD = require('../rateCard.json'); // We'll create a JSON snapshot for runtime use

function getRateMap() {
  const map = {};
  for (const r of RATE_CARD.roles) {
    map[r.role] = r.rate;
  }
  return map;
}

function validateAndEnrichScopes(scopes, rateMap) {
  const errors = [];
  const enriched = scopes.map((s, idx) => {
    const items = (s.role_allocation || []).map((ra) => {
      if (!rateMap.hasOwnProperty(ra.role)) {
        errors.push(`Unknown role: '${ra.role}' in scope '${s.scope_name}'`);
        return { ...ra, rate: 0, cost: 0, valid: false };
      }
      const rate = rateMap[ra.role];
      const hours = Number(ra.hours || 0);
      const cost = +(hours * rate).toFixed(2);
      return { role: ra.role, hours, rate, cost, valid: true };
    });
    const scope_total = +items.reduce((sum, i) => sum + i.cost, 0).toFixed(2);
    return {
      id: idx + 1,
      title: s.scope_name,
      description: s.scope_description || '',
      deliverables: s.deliverables || [],
      assumptions: s.assumptions || [],
      items,
      scope_total
    };
  });
  return { enriched, errors };
}

function computeFinancials(enrichedScopes, discount = 0, gstApplicable = true) {
  const subtotal = +enrichedScopes.reduce((sum, s) => sum + s.scope_total, 0).toFixed(2);
  const discount_amount = +(subtotal * (discount / 100)).toFixed(2);
  const total_after_discount = +(subtotal - discount_amount).toFixed(2);
  const gst_amount = gstApplicable ? +(total_after_discount * 0.1).toFixed(2) : 0;
  const final_total = +(total_after_discount + gst_amount).toFixed(2);
  return { subtotal, discount, discount_amount, total_after_discount, gst_amount, final_total };
}

module.exports = {
  name: 'Accountant Skill',
  slug: 'accountant',
  description: 'Deterministic financial calculator for multi-scope Statements of Work.',
  execute: async function(params) {
    try {
      if (!params || typeof params !== 'object') {
        return { success: false, error: 'Invalid params: expected JSON object.' };
      }
      const { scopes, discount = 0, gstApplicable = true, projectTitle = '', clientName = '' } = params;
      if (!Array.isArray(scopes) || scopes.length === 0) {
        return { success: false, error: 'Scopes array is required with at least one scope.' };
      }

      const rateMap = getRateMap();
      const { enriched, errors } = validateAndEnrichScopes(scopes, rateMap);

      if (errors.length) {
        return { success: false, error: 'Role validation failed', details: errors };
      }

      const financials = computeFinancials(enriched, discount, gstApplicable);

      return {
        success: true,
        data: {
          meta: { projectTitle, clientName, generatedAt: new Date().toISOString() },
          scopes: enriched,
          financials
        }
      };
    } catch (e) {
      return { success: false, error: e.message || 'Unknown error' };
    }
  }
};
