// Data precedence controller - enforces business rule hierarchy
// User-defined values ALWAYS override AI-generated values

import { UserBusinessRules } from "./prompt-parser";

export interface AIGeneratedData {
    discount?: number;
    scopes?: SOWScope[];
    grand_total_pre_gst?: number;
    gst_amount?: number;
    grand_total?: number;
    [key: string]: any;
}

export interface SOWScope {
    id: number;
    scope_name: string;
    scope_description: string;
    deliverables: string[];
    assumptions: string[];
    role_allocation: RoleAllocation[];
    discount?: number;
}

export interface RoleAllocation {
    role: string;
    hours: number;
    rate: number;
    cost: number;
}

/**
 * Applies data precedence hierarchy - user rules override AI values
 * This is the core architectural component that prevents AI hallucinations
 * from overriding explicit user business requirements
 */
export function applyDataPrecedence(
    userRules: UserBusinessRules,
    aiData: AIGeneratedData,
    userPrompt: string = "",
): AIGeneratedData {
    console.log("🔧 [Data Precedence] Starting precedence application...");
    console.log("🔧 [Data Precedence] User rules:", userRules);
    console.log("🔧 [Data Precedence] AI data discount:", aiData.discount);

    const result = { ...aiData };
    let precedenceApplied = false;

    // PRIORITY 1: MULTI-SERVICE SCOPE DETECTION
    // Detect if this is a multi-service SOW (e.g., HubSpot + website)
    if (userPrompt) {
        const services = extractServicesFromPrompt(userPrompt);
        if (services.length > 1) {
            console.log(
                `🔧 [Data Precedence] MULTI-SERVICE DETECTED: ${services.join(", ")}`,
            );

            // Ensure each scope has unique deliverables
            if (result.scopes && result.scopes.length >= services.length) {
                result.scopes = ensureUniqueScopes(result.scopes, services);
                precedenceApplied = true;
            }
        }
    }

    // RULE 1: User discount ALWAYS overrides AI discount
    if (userRules.discount !== undefined) {
        const originalDiscount = result.discount;
        result.discount = userRules.discount;
        precedenceApplied = true;

        console.log(
            `🔧 [Data Precedence] DISCOUNT OVERRIDE: User (${userRules.discount}%) overrides AI (${originalDiscount}%)`,
        );

        // Recalculate financial totals with correct discount
        if (result.scopes) {
            result = recalculateFinancials(result, userRules.discount);
        }
    }

    // RULE 2: User budget constraint overrides AI totals
    if (userRules.budget !== undefined) {
        const originalTotal = result.grand_total || 0;

        if (originalTotal > userRules.budget) {
            console.log(
                `🔧 [Data Precedence] BUDGET CONSTRAINT: Target $${userRules.budget}, AI generated $${originalTotal}`,
            );
            result = adjustToBudget(
                result,
                userRules.budget,
                userRules.gstApplicable,
            );
            precedenceApplied = true;
        }
    }

    // RULE 3: User GST preference overrides AI assumption
    if (userRules.gstApplicable !== undefined) {
        // Recalculate GST based on user preference
        result = recalculateGST(result, userRules.gstApplicable);
        precedenceApplied = true;
        console.log(
            `🔧 [Data Precedence] GST OVERRIDE: User preference (${userRules.gstApplicable}) applied`,
        );
    }

    if (precedenceApplied) {
        console.log("✅ [Data Precedence] Business rules successfully applied");
        console.log("✅ [Data Precedence] Final discount:", result.discount);
        console.log("✅ [Data Precedence] Final total:", result.grand_total);
    } else {
        console.log(
            "ℹ️ [Data Precedence] No user overrides needed, using AI values",
        );
    }

    return result;
}

/**
 * Recalculates all financial totals with the correct discount percentage
 */
function recalculateFinancials(
    data: AIGeneratedData,
    discountPercent: number,
): AIGeneratedData {
    const result = { ...data };

    if (!result.scopes || !Array.isArray(result.scopes)) {
        return result;
    }

    // Calculate subtotal from all scopes
    let subtotal = 0;
    result.scopes.forEach((scope) => {
        if (scope.role_allocation && Array.isArray(scope.role_allocation)) {
            const scopeTotal = scope.role_allocation.reduce(
                (sum, role) => sum + (role.cost || 0),
                0,
            );
            subtotal += scopeTotal;
        }
    });

    // Apply discount
    const discountAmount = subtotal * (discountPercent / 100);
    const totalAfterDiscount = subtotal - discountAmount;

    // Calculate GST (10% on post-discount amount)
    const gstAmount = totalAfterDiscount * 0.1;
    const finalTotal = totalAfterDiscount + gstAmount;

    result.grand_total_pre_gst = totalAfterDiscount;
    result.gst_amount = gstAmount;
    result.grand_total = finalTotal;

    console.log(`🔧 [Financial Recalc] Subtotal: $${subtotal.toFixed(2)}`);
    console.log(
        `🔧 [Financial Recalc] Discount (${discountPercent}%): -$${discountAmount.toFixed(2)}`,
    );
    console.log(
        `🔧 [Financial Recalc] After Discount: $${totalAfterDiscount.toFixed(2)}`,
    );
    console.log(`🔧 [Financial Recalc] GST: $${gstAmount.toFixed(2)}`);
    console.log(`🔧 [Financial Recalc] Final Total: $${finalTotal.toFixed(2)}`);

    return result;
}

/**
 * Adjusts scope hours/costs to meet user's budget constraint
 */
function adjustToBudget(
    data: AIGeneratedData,
    targetBudget: number,
    gstApplicable: boolean = true,
): AIGeneratedData {
    const result = { ...data };

    if (!result.scopes || !Array.isArray(result.scopes)) {
        return result;
    }

    // Calculate target pre-GST amount
    const targetPreGST = gstApplicable ? targetBudget / 1.1 : targetBudget;

    // Calculate current subtotal
    let currentSubtotal = 0;
    result.scopes.forEach((scope) => {
        if (scope.role_allocation && Array.isArray(scope.role_allocation)) {
            const scopeTotal = scope.role_allocation.reduce(
                (sum, role) => sum + (role.cost || 0),
                0,
            );
            currentSubtotal += scopeTotal;
        }
    });

    // Apply any existing discount
    const discountPercent = result.discount || 0;
    const currentAfterDiscount = currentSubtotal * (1 - discountPercent / 100);

    if (currentAfterDiscount <= targetPreGST) {
        // Already within budget - recalculate totals with correct discount
        return recalculateFinancials(result, discountPercent);
    }

    // Calculate scaling factor to meet budget
    const scalingFactor = targetPreGST / currentAfterDiscount;

    console.log(
        `🔧 [Budget Adjustment] Scaling factor: ${scalingFactor.toFixed(3)}`,
    );
    console.log(
        `🔧 [Budget Adjustment] Target pre-GST: $${targetPreGST.toFixed(2)}`,
    );

    // Scale down all role hours proportionally
    result.scopes.forEach((scope) => {
        if (scope.role_allocation && Array.isArray(scope.role_allocation)) {
            scope.role_allocation.forEach((role) => {
                const originalHours = role.hours;
                role.hours = Math.round(role.hours * scalingFactor * 4) / 4; // Round to nearest 0.25 hours
                role.cost = role.hours * role.rate;

                console.log(
                    `🔧 [Budget Adjustment] ${role.role}: ${originalHours}h → ${role.hours}h`,
                );
            });
        }
    });

    // Recalculate totals with adjusted hours
    const adjustedResult = recalculateFinancials(result, discountPercent);

    // Double-check we're within budget
    const adjustedPreGST = gstApplicable ? targetBudget / 1.1 : targetBudget;
    const finalTotal = adjustedResult.grand_total || 0;
    const finalPreGST = adjustedResult.grand_total_pre_gst || 0;

    if (finalPreGST > adjustedPreGST) {
        console.warn(
            `⚠️ [Budget Adjustment] Still over budget after scaling. Adjusting discount.`,
        );
        // If still over budget, apply additional discount
        const extraDiscountPercent = Math.min(
            20,
            ((finalPreGST - adjustedPreGST) / finalPreGST) * 100,
        );
        return recalculateFinancials(
            adjustedResult,
            discountPercent + extraDiscountPercent,
        );
    }

    return adjustedResult;
}

/**
 * Recalculates GST based on user preference
 */
function recalculateGST(
    data: AIGeneratedData,
    gstApplicable: boolean,
): AIGeneratedData {
    const result = { ...data };

    const preGSTTotal = result.grand_total_pre_gst || 0;

    if (gstApplicable) {
        result.gst_amount = preGSTTotal * 0.1;
        result.grand_total = preGSTTotal + result.gst_amount;
    } else {
        result.gst_amount = 0;
        result.grand_total = preGSTTotal;
    }

    // Log for debugging
    console.log(`🔧 [GST Recalculation] GST Applicable: ${gstApplicable}`);
    console.log(
        `🔧 [GST Recalculation] Pre-GST Total: $${preGSTTotal.toFixed(2)}`,
    );
    console.log(
        `🔧 [GST Recalculation] GST Amount: $${result.gst_amount.toFixed(2)}`,
    );
    console.log(
        `🔧 [GST Recalculation] Final Total: $${result.grand_total.toFixed(2)}`,
    );

    return result;
}

/**
 * Extracts distinct services from user prompt to identify multi-service SOWs
 */
export function extractServicesFromPrompt(prompt: string): string[] {
    const services: string[] = [];
    const lowerPrompt = prompt.toLowerCase();

    // Common service patterns
    const servicePatterns = [
        { pattern: /\bhubspot\b/i, name: "HubSpot" },
        {
            pattern: /\bwebsite\b.*\b(build|development|creation)\b/i,
            name: "Website",
        },
        { pattern: /\bmigration\b/i, name: "Migration" },
        { pattern: /\bintegration\b/i, name: "Integration" },
        { pattern: /\bseo\b/i, name: "SEO" },
        { pattern: /\bsocial\s*media\b/i, name: "Social Media" },
        { pattern: /\bcontent\s*(marketing|creation)\b/i, name: "Content" },
    ];

    servicePatterns.forEach(({ pattern, name }) => {
        if (pattern.test(lowerPrompt)) {
            services.push(name);
        }
    });

    return [...new Set(services)]; // Remove duplicates
}

/**
 * Ensures each scope has unique deliverables for multi-service SOWs
 */
export function ensureUniqueScopes(
    scopes: SOWScope[],
    services: string[],
): SOWScope[] {
    return scopes.map((scope, index) => {
        if (index < services.length) {
            // Create unique deliverables for each service
            const uniqueDeliverables = createServiceSpecificDeliverables(
                services[index],
                scope.scope_description || "",
            );

            return {
                ...scope,
                scope_name: `${services[index]} Implementation`,
                deliverables: uniqueDeliverables,
            };
        }
        return scope;
    });
}

/**
 * Creates service-specific deliverables based on service type
 */
function createServiceSpecificDeliverables(
    service: string,
    description: string,
): string[] {
    const baseDeliverables = [
        "Project kickoff and requirements gathering",
        "Regular progress updates and status reporting",
        "Final delivery and handover documentation",
    ];

    switch (service) {
        case "HubSpot":
            return [
                ...baseDeliverables,
                "HubSpot setup and configuration",
                "Data migration to HubSpot",
                "Custom property and workflow creation",
                "Team training and user onboarding",
            ];

        case "Website":
            return [
                ...baseDeliverables,
                "Website design mockups",
                "Frontend development",
                "Backend integration",
                "Content management system setup",
                "Responsive design implementation",
                "Testing and quality assurance",
            ];

        case "Migration":
            return [
                ...baseDeliverables,
                "Source system analysis and mapping",
                "Data extraction and cleansing",
                "Data transformation and validation",
                "Target system implementation",
                "Post-migration verification",
            ];

        default:
            return baseDeliverables;
    }
}

/**
 * Validates that precedence was applied correctly
 */
export function validatePrecedenceApplication(
    userRules: UserBusinessRules,
    finalData: AIGeneratedData,
): { valid: boolean; violations: string[] } {
    const violations: string[] = [];

    // Check discount precedence
    if (
        userRules.discount !== undefined &&
        finalData.discount !== userRules.discount
    ) {
        violations.push(
            `Discount precedence violation: Expected ${userRules.discount}%, got ${finalData.discount}%`,
        );
    }

    // Check budget constraint
    if (
        userRules.budget !== undefined &&
        finalData.grand_total &&
        finalData.grand_total > userRules.budget * 1.01
    ) {
        violations.push(
            `Budget constraint violation: Expected ≤$${userRules.budget}, got $${finalData.grand_total.toFixed(2)}`,
        );
    }

    // Check for content duplication in multi-service SOWs
    if (finalData.scopes && finalData.scopes.length > 1) {
        const duplicateDeliverables = findDuplicateDeliverables(
            finalData.scopes,
        );
        if (duplicateDeliverables.length > 0) {
            violations.push(
                `Content duplication detected across scopes: ${duplicateDeliverables.join(", ")}`,
            );
        }
    }

    return {
        valid: violations.length === 0,
        violations,
    };
}

/**
 * Finds deliverables that appear in multiple scopes (content duplication bug)
 */
function findDuplicateDeliverables(scopes: SOWScope[]): string[] {
    const allDeliverables: string[] = [];
    const duplicates: string[] = [];

    scopes.forEach((scope) => {
        if (scope.deliverables) {
            scope.deliverables.forEach((deliverable) => {
                const normalized = deliverable.toLowerCase().trim();
                if (allDeliverables.includes(normalized)) {
                    if (!duplicates.includes(normalized)) {
                        duplicates.push(normalized);
                    }
                } else {
                    allDeliverables.push(normalized);
                }
            });
        }
    });

    return duplicates;
}

/**
 * Logs precedence application for debugging
 */
export function logPrecedenceApplication(
    userRules: UserBusinessRules,
    originalAI: AIGeneratedData,
    finalData: AIGeneratedData,
): void {
    console.log("📊 [Data Precedence] Application Summary:");
    console.log("📊 [Data Precedence] User Rules:", userRules);
    console.log(
        "📊 [Data Precedence] Original AI Discount:",
        originalAI.discount,
    );
    console.log("📊 [Data Precedence] Final Discount:", finalData.discount);
    console.log(
        "📊 [Data Precedence] Original AI Total:",
        originalAI.grand_total,
    );
    console.log("📊 [Data Precedence] Final Total:", finalData.grand_total);

    const validation = validatePrecedenceApplication(userRules, finalData);
    if (validation.valid) {
        console.log(
            "✅ [Data Precedence] All business rules correctly applied",
        );
    } else {
        console.error(
            "❌ [Data Precedence] Violations detected:",
            validation.violations,
        );
    }
}
