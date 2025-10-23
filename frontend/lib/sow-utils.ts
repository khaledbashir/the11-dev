// Utility functions for SOW handling

/**
 * Interface for pricing table rows in TipTap content
 */
interface PricingTableRow {
  role?: string;
  description?: string;
  hours?: number;
  rate?: number;
}

/**
 * Interface for TipTap nodes in the document structure
 */
interface TipTapNode {
  type: string;
  attrs?: {
    rows?: PricingTableRow[];
  };
  content?: TipTapNode[];
}

/**
 * Interface for TipTap document content
 */
interface TipTapContent {
  type: string;
  content?: TipTapNode[];
}

/**
 * Parses the SOW's TipTap JSON content to calculate the total investment value.
 * 
 * This function robustly sums the `hours * rate` for each line item in the first
 * pricing table found, ignoring any unreliable "Total" rows. This eliminates the
 * need for manual financial migrations by automatically calculating and storing
 * the financial data on every SOW update.
 *
 * Algorithm:
 * 1. Parse the JSON content
 * 2. Find the first editablePricingTable node
 * 3. For each row in the table:
 *    - Skip rows where role contains "total" (case-insensitive)
 *    - Skip rows where rate <= 0 (invalid pricing)
 *    - Sum: hours * rate for all valid line items
 * 4. Return the calculated sum, or 0 if no table found or error occurs
 *
 * @param contentJSON - The SOW content, expected as a JSON string
 * @returns The calculated total investment as a number (in the SOW's currency, typically AUD)
 *          Returns 0 if no pricing table is found, content is invalid, or on any error
 * 
 * @example
 * const totalInvestment = calculateTotalInvestment(sowContent);
 * // Returns 22000 (2.5 days × 40 hrs/day × $220/hr)
 */
export function calculateTotalInvestment(contentJSON: string): number {
  // Guard: empty or null content
  if (!contentJSON) {
    return 0;
  }

  try {
    const content: TipTapContent = JSON.parse(contentJSON);
    let totalInvestment = 0;

    // Guard: no content array
    if (!content.content || !Array.isArray(content.content)) {
      return 0;
    }

    // Iterate through top-level nodes to find the first pricing table
    for (const node of content.content) {
      // Check if this is a pricing table node
      if (node.type === 'editablePricingTable' && node.attrs?.rows) {
        const rows = node.attrs.rows;

        // Guard: rows is not an array
        if (!Array.isArray(rows)) {
          return 0;
        }

        // Sum the cost for each line item, excluding total rows
        for (const row of rows) {
          // Extract values with defaults to prevent NaN
          const hours = Number(row.hours) || 0;
          const rate = Number(row.rate) || 0;
          const role = String(row.role || '').toLowerCase();

          // Validation: Skip rows that don't represent actual billable line items
          // - rate must be > 0 (pricing must be valid)
          // - role must not contain "total" (skip the total row itself)
          if (rate > 0 && !role.includes('total')) {
            totalInvestment += hours * rate;
          }
        }

        // Once we've processed the first pricing table, we stop
        // (SOWs typically only have one pricing table at the top level)
        return totalInvestment;
      }
    }

    // No pricing table found in the document
    return 0;
  } catch (error) {
    // Log parsing errors for debugging without crashing
    console.error('[SOW Financial Calculation] Failed to parse SOW content:', {
      error: error instanceof Error ? error.message : String(error),
      contentLength: contentJSON?.length || 0
    });
    return 0; // Return 0 on any parsing error (safe default)
  }
}

export function formatInvestment(value: number) {
  // Stub implementation
  return `$${value.toLocaleString()}`;
}

export function cleanSOWContent(content: string) {
  // Stub implementation
  return content;
}
