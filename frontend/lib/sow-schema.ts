import { z } from 'zod';

// v4.1 Canonical SOW Schema (hierarchical, multi-scope)
export const RoleAllocationSchema = z.object({
  role: z.string().min(1, 'role is required'),
  hours: z.number().nonnegative(),
  rate: z.number().nonnegative().optional(), // rate may be filled from rate card
  cost: z.number().nonnegative().optional(), // cost may be computed: hours * rate
});

export const ScopeSchema = z.object({
  id: z.number().int().nonnegative(),
  title: z.string().min(1),
  description: z.string().default(''),
  deliverables: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  role_allocation: z.array(RoleAllocationSchema).min(1, 'at least one role allocation is required'),
});

export const CanonicalSOWSchemaV41 = z.object({
  version: z.literal('4.1').default('4.1'),
  projectTitle: z.string().min(1),
  clientName: z.string().min(1),
  projectSubtitle: z.string().optional().default(''),
  projectOverview: z.string().optional().default(''),
  budgetNotes: z.string().optional().default(''),
  scopes: z.array(ScopeSchema).min(1),
  currency: z.string().default('AUD'),
  gstApplicable: z.boolean().default(true),
  generatedDate: z.string().default(() => new Date().toISOString().slice(0, 10)),
  discount: z.number().min(0).max(100).default(0),
});

export type RoleAllocation = z.infer<typeof RoleAllocationSchema>;
export type Scope = z.infer<typeof ScopeSchema>;
export type CanonicalSOWV41 = z.infer<typeof CanonicalSOWSchemaV41>;

// Normalization utilities: fill rate/cost, compute totals
export function normalizeSOW(input: CanonicalSOWV41, getRate?: (role: string) => number | undefined) {
  const scopes = input.scopes.map((scope) => {
    const items = scope.role_allocation.map((item) => {
      const rate = item.rate ?? getRate?.(item.role) ?? 0;
      const cost = item.cost ?? +(Number(item.hours) * Number(rate)).toFixed(2);
      return { ...item, rate, cost };
    });
    const total = +items.reduce((sum, i) => sum + (i.cost ?? 0), 0).toFixed(2);
    return { ...scope, role_allocation: items, total } as any;
  });

  const subtotal = +scopes.reduce((sum, s: any) => sum + (s.total ?? 0), 0).toFixed(2);
  const discountPercent = input.discount ?? 0;
  const discount_amount = +((subtotal * discountPercent) / 100).toFixed(2);
  const total_after_discount = +(subtotal - discount_amount).toFixed(2);
  const gst_amount = input.gstApplicable ? +(total_after_discount * 0.1).toFixed(2) : 0;
  const final_total = +(total_after_discount + gst_amount).toFixed(2);

  return {
    ...input,
    scopes,
    financials: {
      subtotal,
      discount: discountPercent,
      discount_amount,
      total_after_discount,
      gst_amount,
      final_total,
    },
  };
}
