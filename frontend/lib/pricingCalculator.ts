import { ROLES, RATE_CARD_MAP } from '@/lib/rateCard';

export type PricingRow = {
  role: string;
  description?: string;
  hours: number;
  rate: number;
};

const norm = (s: string) => (s || '')
  .toLowerCase()
  .replace(/\s*-\s*/g, '-')
  .replace(/\s+/g, ' ')
  .trim();

const findCanon = (name: string) => {
  const n = norm(name);
  return ROLES.find(r => norm(r.name) === n) || null;
};

const PM_HEAD_OF = 'Tech - Head Of- Senior Project Management'; // exact from rate card
const PM_DELIVERY = 'Tech - Delivery - Project Management';
const ROLE_ACCOUNT_MANAGER = 'Account Management - (Account Manager)';

export type CalcOptions = {
  // If true, include Project Coordination with a minimal fixed allocation when present in role names
  includeProjectCoordination?: boolean;
  // Minimum fixed AM hours
  accountManagementHours?: number;
  // Fixed PM hours for each PM tier
  pmHoursHeadOf?: number;
  pmHoursDelivery?: number;
  // Round hours to this decimal place (e.g., 0.5)
  hourGranularity?: number;
};

const DEFAULTS: Required<CalcOptions> = {
  includeProjectCoordination: true,
  accountManagementHours: 8,
  pmHoursHeadOf: 5,
  pmHoursDelivery: 5,
  hourGranularity: 0.5,
};

/**
 * Deterministically allocate hours to roles to meet a target budget (ex GST).
 * - Enforces single PM based on threshold: > 15000 => Head Of, else Delivery PM.
 * - Ensures Account Management present with minimum hours first.
 * - Subtracts PM + AM costs; distributes remaining budget evenly by budget share
 *   across other suggested roles (hours = share / rate).
 * - Returns rows ready for the editablePricingTable node.
 *
 * Assumptions:
 * - totalBudgetExGst is exclusive of GST.
 * - Role names provided should match the rate card exactly; we'll snap to canonical names if similar.
 */
export function calculatePricingTable(
  suggestedRoleNames: string[],
  totalBudgetExGst: number,
  opts: CalcOptions = {}
): PricingRow[] {
  const cfg = { ...DEFAULTS, ...opts };
  const budget = Math.max(0, Number(totalBudgetExGst) || 0);

  // Deduplicate and canonicalize incoming role names
  const uniqueNames = Array.from(new Set(
    (suggestedRoleNames || [])
      .map(r => String(r || '').trim())
      .filter(Boolean)
  ));

  const canonicalNames = uniqueNames.map(name => findCanon(name)?.name || name);

  // Decide PM role based on threshold
  const pmRoleName = budget > 15000 ? PM_HEAD_OF : PM_DELIVERY;
  const pmCanon = findCanon(pmRoleName)?.name || pmRoleName;
  const pmRate = RATE_CARD_MAP[pmCanon] || 0;
  const pmHours = budget > 15000 ? cfg.pmHoursHeadOf : cfg.pmHoursDelivery;

  // Always include AM
  const amCanon = findCanon(ROLE_ACCOUNT_MANAGER)?.name || ROLE_ACCOUNT_MANAGER;
  const amRate = RATE_CARD_MAP[amCanon] || 0;
  const amHours = cfg.accountManagementHours;

  // Base mandatory rows
  const rows: PricingRow[] = [
    { role: pmCanon, description: budget > 15000 ? 'Strategic oversight' : 'Project delivery management', hours: pmHours, rate: pmRate },
    { role: amCanon, description: 'Client comms & governance', hours: amHours, rate: amRate },
  ];

  // Remove any other PM/Head Of variants from the pool
  const filtered = canonicalNames.filter(name => {
    const n = norm(name);
    if (n.includes('head-of') || n.includes('head of')) return false;
    if (n.includes('project-management')) return false;
    return true;
  });

  // Exclude AM if already handled
  const rolePool = filtered.filter(name => norm(name) !== norm(amCanon));

  // Compute remaining budget after mandatory governance
  const baseCost = pmHours * pmRate + amHours * amRate;
  const remaining = Math.max(0, budget - baseCost);

  if (remaining <= 0 || rolePool.length === 0) {
    // Nothing to distribute; return mandatory rows only
    return rows;
  }

  // Evenly distribute budget across remaining roles
  const perRoleBudget = remaining / rolePool.length;

  for (const name of rolePool) {
    const canon = findCanon(name)?.name || name;
    const rate = RATE_CARD_MAP[canon] || 0;
    if (rate <= 0) continue; // skip invalid

    // Hours = budget share / rate, rounded to granularity
    let hours = perRoleBudget / rate;
    const g = cfg.hourGranularity;
    hours = Math.max(0, Math.round(hours / g) * g);

    rows.push({ role: canon, description: '', hours, rate });
  }

  // Tighten to budget target: scale non-governance hours to meet remaining budget closely without exceeding
  const isGov = (r: PricingRow) => norm(r.role).includes('head-of') || norm(r.role).includes('head of') || norm(r.role).includes('account management');
  const g = cfg.hourGranularity;
  const totalCost = (list: PricingRow[]) => list.reduce((s, r) => s + (r.hours * r.rate), 0);

  // Current costs
  let current = totalCost(rows);
  if (current < budget) {
    const nonGov = rows.filter(r => !isGov(r));
    const nonGovCost = totalCost(nonGov);
    const targetNonGov = Math.max(0, budget - (pmHours * pmRate + amHours * amRate));

    if (nonGov.length > 0 && nonGovCost > 0 && targetNonGov > 0) {
      const scale = targetNonGov / nonGovCost;
      // Scale and re-round
      for (const r of nonGov) {
        r.hours = Math.max(0, Math.round((r.hours * scale) / g) * g);
      }
      // Re-evaluate and trim if slightly over due to rounding
      current = totalCost(rows);
      if (current > budget) {
        // Reduce hours by small steps on the highest-rate roles first until within budget
        const sorted = nonGov.sort((a, b) => b.rate - a.rate);
        let idx = 0;
        let safety = 0;
        while (current > budget && safety < 10000) {
          const r = sorted[idx % sorted.length];
          if (r.hours > 0) {
            r.hours = Math.max(0, r.hours - g);
            current = totalCost(rows);
          }
          idx++;
          safety++;
        }
      } else {
        // If still significantly under, top-up incrementally to approach target without exceeding
        const tolerance = 0.03; // 3%
        const minAcceptable = budget * (1 - tolerance);
        const sorted = nonGov.sort((a, b) => b.rate - a.rate);
        let idx = 0;
        let safety = 0;
        while (current < minAcceptable && safety < 10000) {
          const r = sorted[idx % sorted.length];
          r.hours = r.hours + g;
          const next = totalCost(rows);
          if (next <= budget) {
            current = next;
          } else {
            // revert if it would exceed budget
            r.hours = Math.max(0, r.hours - g);
          }
          idx++;
          safety++;
        }
      }
    }
  }

  return rows;
}
