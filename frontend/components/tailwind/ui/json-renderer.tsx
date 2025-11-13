"use client";

import React, { useMemo } from 'react';

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
      
      // Check if this looks like SOW data
      const isSowData = parsed.scopeItems || parsed.pricing || parsed.markdownContent;
      
      if (isSowData) {
        return {
          isSowJson: true,
          formattedContent: formatSowJson(parsed)
        };
      }
      
      // Regular JSON - format with syntax highlighting
      return {
        isSowJson: false,
        formattedContent: (
          <pre className={`${className} text-sm overflow-x-auto`}>
            <code>{JSON.stringify(parsed, null, 2)}</code>
          </pre>
        )
      };
    } catch {
      // Not valid JSON, return as regular text
      return {
        isSowJson: false,
        formattedContent: content
      };
    }
  }, [content, className]);

  return <>{formattedContent}</>;
}

/**
 * Format SOW JSON data into readable tables
 */
function formatSowJson(data: any) {
  if (data.scopeItems) {
    return (
      <div className="space-y-4">
        {/* Scope Items Table */}
        <div>
          <h4 className="text-sm font-semibold mb-2 text-white">Scope Breakdown</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border border-[#0E2E33]">
              <thead>
                <tr className="bg-[#0E2E33]">
                  <th className="p-2 text-left text-white">Scope</th>
                  <th className="p-2 text-left text-white">Total</th>
                  <th className="p-2 text-left text-white">Roles</th>
                </tr>
              </thead>
              <tbody>
                {data.scopeItems.map((scope: any, idx: number) => (
                  <tr key={idx} className="border-t border-[#0E2E33]">
                    <td className="p-2 text-gray-300">{scope.scope_name}</td>
                    <td className="p-2 text-gray-300">${scope.scope_total?.toLocaleString()}</td>
                    <td className="p-2 text-gray-300">
                      {scope.roles?.map((role: any) => (
                        <div key={role.role} className="text-xs">
                          <div className="font-medium">{role.role}</div>
                          <div className="text-gray-400">{role.hours}h @ ${role.rate}/hr = ${role.cost?.toLocaleString()}</div>
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pricing Summary */}
        {data.pricing && (
          <div>
            <h4 className="text-sm font-semibold mb-2 text-white">Pricing Summary</h4>
            <div className="bg-[#0E2E33] p-3 rounded border border-[#1b5e5e]">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-gray-300">
                  <span>Subtotal:</span>
                  <span>${data.pricing.grand_total_pre_gst?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>GST ({data.pricing.gst_rate}%):</span>
                  <span>${data.pricing.gst_amount?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-white font-semibold border-t border-[#1b5e5e] pt-1">
                  <span>Total ({data.pricing.currency}):</span>
                  <span>${data.pricing.grand_total?.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Markdown Content */}
        {data.markdownContent && (
          <div>
            <h4 className="text-sm font-semibold mb-2 text-white">SOW Content</h4>
            <div className="bg-[#0E2E33] p-3 rounded border border-[#1b5e5e] text-xs text-gray-300 whitespace-pre-wrap">
              {data.markdownContent}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Fallback for other JSON structures
  return (
    <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-words overflow-x-auto">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}