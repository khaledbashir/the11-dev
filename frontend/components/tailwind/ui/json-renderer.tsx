"use client";

import React, { useMemo } from "react";

interface JsonRendererProps {
    content: string;
    className?: string;
}

/**
 * Renders JSON content as formatted tables if it contains SOW data,
 * otherwise renders as regular markdown code block
 */
export function JsonRenderer({ content, className = "" }: JsonRendererProps) {
    const { isSowJson, formattedContent } = useMemo(() => {
        try {
            // Try to parse as JSON
            const parsed = JSON.parse(content);

            // Check if this looks like SOW data - supporting multiple formats
            const isSowData =
                parsed.scopeItems ||
                parsed.pricing ||
                parsed.markdownContent || // Original format
                parsed.scopes ||
                parsed.currency || // New pricing format
                parsed.scope_name ||
                parsed.scope_description; // Scope format with asterisks

            if (isSowData) {
                return {
                    isSowJson: true,
                    formattedContent: formatSowJson(parsed),
                };
            }

            // Regular JSON - format with syntax highlighting
            return {
                isSowJson: false,
                formattedContent: (
                    <pre
                        className={`${className} text-xs font-mono whitespace-pre-wrap break-all overflow-hidden bg-[#0a0a0a] p-3 rounded border border-[#1b5e5e]`}
                    >
                        <code className="block w-full text-[#20e28f] overflow-x-auto">
                            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-[#1b5e5e] scrollbar-track-transparent">
                                {JSON.stringify(parsed, null, 2)}
                            </div>
                        </code>
                    </pre>
                ),
            };
        } catch {
            // Not valid JSON, return as regular text
            return {
                isSowJson: false,
                formattedContent: content,
            };
        }
    }, [content, className]);

    return <>{formattedContent}</>;
}

/**
 * Format SOW JSON data into readable tables
 */
function formatSowJson(data: any) {
    // Helper function to get value with multiple possible keys (asterisk vs underscore naming)
    const getValue = (obj: any, keys: string[]) => {
        for (const key of keys) {
            if (obj[key] !== undefined) return obj[key];
        }
        return undefined;
    };

    // Normalize data structure to handle both formats
    const normalizeData = (raw: any) => {
        // Handle new format with scopes array and asterisk naming
        if (raw.scopes && Array.isArray(raw.scopes)) {
            const normalizedScopes = raw.scopes.map((scope: any) => ({
                scope_name: getValue(scope, ["scope_name", "scope*name"]),
                scope_total: getValue(scope, ["scope_total", "scope*total"]),
                roles:
                    getValue(scope, [
                        "roles",
                        "role_allocation",
                        "role*allocation",
                    ]) || [],
            }));

            return {
                scopeItems: normalizedScopes,
                pricing: {
                    currency: getValue(raw, ["currency"]),
                    gst_rate: getValue(raw, ["gst_rate", "gst*rate"]),
                    grand_total_pre_gst: getValue(raw, [
                        "grand_total_pre_gst",
                        "grand*total*pre*gst",
                    ]),
                    gst_amount: getValue(raw, ["gst_amount", "gst*amount"]),
                    grand_total: getValue(raw, ["grand_total", "grand*total"]),
                },
            };
        }

        // Handle scope object format
        if (raw.scope_name || raw.scope_name) {
            return {
                scopeItems: [
                    {
                        scope_name: getValue(raw, ["scope_name", "scope_name"]),
                        scope_total: getValue(raw, [
                            "scope_total",
                            "scope_total",
                        ]),
                        roles:
                            getValue(raw, [
                                "roles",
                                "role_allocation",
                                "role_allocation",
                            ]) || [],
                    },
                ],
                pricing: {
                    currency: getValue(raw, ["currency"]),
                    gst_rate: getValue(raw, ["gst_rate", "gst_rate"]),
                    grand_total_pre_gst: getValue(raw, [
                        "grand_total_pre_gst",
                        "grand_total_pre_gst",
                    ]),
                    gst_amount: getValue(raw, ["gst_amount", "gst_amount"]),
                    grand_total: getValue(raw, ["grand_total", "grand_total"]),
                },
            };
        }

        // Handle original format
        return raw;
    };

    const normalizedData = normalizeData(data);

    if (normalizedData.scopeItems && Array.isArray(normalizedData.scopeItems)) {
        return (
            <div className="space-y-4">
                {/* Scope Items Table */}
                <div>
                    <h4 className="text-sm font-semibold mb-2 text-white">
                        Scope Breakdown
                    </h4>
                    <div className="overflow-x-auto max-w-full">
                        <table className="min-w-full text-xs border border-[#0E2E33] max-w-full table-fixed">
                            <thead>
                                <tr className="bg-[#0E2E33]">
                                    <th className="p-2 text-left text-white w-1/3">
                                        Scope
                                    </th>
                                    <th className="p-2 text-left text-white w-1/4">
                                        Total
                                    </th>
                                    <th className="p-2 text-left text-white w-5/12">
                                        Roles
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {normalizedData.scopeItems.map(
                                    (scope: any, idx: number) => (
                                        <tr
                                            key={idx}
                                            className="border-t border-[#0E2E33]"
                                        >
                                            <td className="p-2 text-gray-300 break-words overflow-wrap-anywhere">
                                                {scope.scope_name || "N/A"}
                                            </td>
                                            <td className="p-2 text-gray-300 break-words overflow-wrap-anywhere">
                                                {scope.scope_total
                                                    ? `$${scope.scope_total.toLocaleString()}`
                                                    : "N/A"}
                                            </td>
                                            <td className="p-2 text-gray-300">
                                                {Array.isArray(scope.roles) &&
                                                scope.roles.length > 0 ? (
                                                    scope.roles.map(
                                                        (
                                                            role: any,
                                                            roleIdx: number,
                                                        ) => (
                                                            <div
                                                                key={roleIdx}
                                                                className="text-xs break-words overflow-wrap-anywhere"
                                                            >
                                                                <div className="font-medium">
                                                                    {role.role}
                                                                </div>
                                                                <div className="text-gray-400">
                                                                    {role.hours}
                                                                    h @ $
                                                                    {role.rate}
                                                                    /hr = $
                                                                    {role.cost?.toLocaleString()}
                                                                </div>
                                                            </div>
                                                        ),
                                                    )
                                                ) : (
                                                    <div className="text-xs text-gray-500">
                                                        No role allocation
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ),
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pricing Summary */}
                {normalizedData.pricing && (
                    <div>
                        <h4 className="text-sm font-semibold mb-2 text-white">
                            Pricing Summary
                        </h4>
                        <div className="bg-[#0E2E33] p-3 rounded border border-[#1b5e5e]">
                            <div className="space-y-1 text-xs">
                                {normalizedData.pricing.grand_total_pre_gst && (
                                    <div className="flex justify-between text-gray-300">
                                        <span>Subtotal:</span>
                                        <span>
                                            $
                                            {normalizedData.pricing.grand_total_pre_gst.toLocaleString()}
                                        </span>
                                    </div>
                                )}
                                {normalizedData.pricing.gst_rate &&
                                    normalizedData.pricing.gst_amount && (
                                        <div className="flex justify-between text-gray-300">
                                            <span>
                                                GST (
                                                {
                                                    normalizedData.pricing
                                                        .gst_rate
                                                }
                                                %):
                                            </span>
                                            <span>
                                                $
                                                {normalizedData.pricing.gst_amount.toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                {normalizedData.pricing.grand_total && (
                                    <div className="flex justify-between text-white font-semibold border-t border-[#1b5e5e] pt-1">
                                        <span>
                                            Total (
                                            {normalizedData.pricing.currency ||
                                                "AUD"}
                                            ):
                                        </span>
                                        <span>
                                            $
                                            {normalizedData.pricing.grand_total.toLocaleString()}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Markdown Content */}
                {normalizedData.markdownContent && (
                    <div>
                        <h4 className="text-sm font-semibold mb-2 text-white">
                            SOW Content
                        </h4>
                        <div className="bg-[#0E2E33] p-3 rounded border border-[#1b5e5e] text-xs text-gray-300 whitespace-pre-wrap">
                            {normalizedData.markdownContent}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Fallback for other JSON structures
    return (
        <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-all overflow-hidden bg-[#0a0a0a] p-3 rounded border border-[#1b5e5e] max-w-full">
            <code className="block w-full text-[#20e28f] overflow-x-auto">
                <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-[#1b5e5e] scrollbar-track-transparent">
                    {JSON.stringify(data, null, 2)}
                </div>
            </code>
        </pre>
    );
}
