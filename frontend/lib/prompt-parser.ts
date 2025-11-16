// Enhanced prompt parsing for business rules extraction
// This module ensures user-defined business rules take precedence over AI-generated values

export interface UserBusinessRules {
  discount?: number;
  budget?: number;
  currency?: string;
  gstApplicable?: boolean;
  clientName?: string;
  projectTitle?: string;
}

/**
 * Extracts business rules from user prompt with high precision
 * These values will override any conflicting AI-generated values
 */
export function extractBusinessRulesFromPrompt(prompt: string): UserBusinessRules {
  const rules: UserBusinessRules = {};

  if (!prompt || typeof prompt !== 'string') {
    return rules;
  }

  const cleanPrompt = prompt.toLowerCase().trim();

  // Extract discount patterns with multiple variations
  const discountPatterns = [
    /(\d+(?:\.\d+)?)%\s*discount/i,
    /discount\s*(?:of\s*)?(\d+(?:\.\d+)?)%?/i,
    /apply\s*(?:a\s*)?(\d+(?:\.\d+)?)%?\s*discount/i,
    /(\d+(?:\.\d+)?)%\s*off/i,
    /give\s*(?:them\s*)?(?:a\s*)?(\d+(?:\.\d+)?)%?\s*discount/i,
    /discount\s*(?:them\s*)?(\d+(?:\.\d+)?)%?/i
  ];

  for (const pattern of discountPatterns) {
    const match = prompt.match(pattern);
    if (match && match[1]) {
      const discountValue = parseFloat(match[1]);
      if (discountValue >= 0 && discountValue <= 100) {
        rules.discount = discountValue;
        console.log(`🔍 [Prompt Parser] Extracted discount: ${discountValue}%`);
        break;
      }
    }
  }

  // Extract budget patterns with currency handling
  const budgetPatterns = [
    /budget\s*(?:is\s*|of\s*)?[\$]?([0-9,]+(?:\.[0-9]{2})?)/i,
    /[\$]([0-9,]+(?:\.[0-9]{2})?)\s*budget/i,
    /total\s*(?:of\s*|is\s*)?[\$]?([0-9,]+(?:\.[0-9]{2})?)/i,
    /maximum\s*(?:of\s*)?[\$]?([0-9,]+(?:\.[0-9]{2})?)/i,
    /up\s*to\s*[\$]?([0-9,]+(?:\.[0-9]{2})?)/i,
    /not\s*more\s*than\s*[\$]?([0-9,]+(?:\.[0-9]{2})?)/i,
    /within\s*[\$]?([0-9,]+(?:\.[0-9]{2})?)/i
  ];

  for (const pattern of budgetPatterns) {
    const match = prompt.match(pattern);
    if (match && match[1]) {
      const budgetValue = parseFloat(match[1].replace(/,/g, ''));
      if (budgetValue > 0 && budgetValue < 10000000) { // Reasonable budget range
        rules.budget = budgetValue;
        console.log(`🔍 [Prompt Parser] Extracted budget: $${budgetValue}`);
        break;
      }
    }
  }

  // Extract client/company name patterns
  const clientPatterns = [
    /\bfor\s+([A-Z][A-Za-z0-9&\s]+(?:Corp|Corporation|Inc|LLC|Ltd|Company|Co|Group|Agency|Services|Solutions|Technologies)?)/i,
    /\bclient:\s*([A-Z][A-Za-z0-9&\s]+)/i,
    /\b([A-Z][A-Za-z0-9&\s]+(?:Corp|Corporation|Inc|LLC|Ltd|Company|Co|Group))\s+(?:needs|wants|requires)/i,
    /\b([A-Z][A-Za-z0-9&\s]{2,30})\s+(?:integration|website|project|campaign|sow)/i,
  ];

  for (const pattern of clientPatterns) {
    const match = prompt.match(pattern);
    if (match && match[1]) {
      let name = match[1].trim();
      // Clean up the match
      name = name.replace(/\s+(integration|website|project|campaign|sow|needs|wants|requires)$/i, '');
      if (name.length > 2 && name.length < 50) {
        rules.clientName = name;
        console.log(`🔍 [Prompt Parser] Extracted client name: ${name}`);
        break;
      }
    }
  }

  // Extract project title patterns
  const titlePatterns = [
    /(?:project|sow)\s*(?:title|name):\s*([^.\n]+)/i,
    /(?:title|name):\s*([^.\n]+)/i,
    /create\s*(?:a\s*)?sow\s*for\s*([^.\n]+)/i
  ];

  for (const pattern of titlePatterns) {
    const match = prompt.match(pattern);
    if (match && match[1]) {
      const title = match[1].trim();
      if (title.length > 3 && title.length < 100) {
        rules.projectTitle = title;
        console.log(`🔍 [Prompt Parser] Extracted project title: ${title}`);
        break;
      }
    }
  }

  // Detect currency (default to AUD for Social Garden)
  if (prompt.includes('USD') || prompt.includes('$USD')) {
    rules.currency = 'USD';
  } else if (prompt.includes('EUR') || prompt.includes('€')) {
    rules.currency = 'EUR';
  } else {
    rules.currency = 'AUD'; // Default for Social Garden
  }

  // Detect GST applicability (default true for Australian clients)
  if (cleanPrompt.includes('no gst') || cleanPrompt.includes('without gst') || cleanPrompt.includes('gst exempt')) {
    rules.gstApplicable = false;
  } else if (cleanPrompt.includes('international') || cleanPrompt.includes('overseas') || rules.currency !== 'AUD') {
    rules.gstApplicable = false;
  } else {
    rules.gstApplicable = true; // Default for Australian clients
  }

  return rules;
}

/**
 * Validates extracted business rules for consistency
 */
export function validateBusinessRules(rules: UserBusinessRules): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (rules.discount !== undefined) {
    if (rules.discount < 0 || rules.discount > 100) {
      errors.push(`Invalid discount: ${rules.discount}%. Must be between 0% and 100%.`);
    }
  }

  if (rules.budget !== undefined) {
    if (rules.budget <= 0) {
      errors.push(`Invalid budget: $${rules.budget}. Must be greater than 0.`);
    }
    if (rules.budget > 10000000) {
      errors.push(`Invalid budget: $${rules.budget}. Exceeds reasonable maximum.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Formats business rules for logging and debugging
 */
export function formatBusinessRules(rules: UserBusinessRules): string {
  const parts: string[] = [];

  if (rules.discount !== undefined) {
    parts.push(`Discount: ${rules.discount}%`);
  }

  if (rules.budget !== undefined) {
    parts.push(`Budget: $${rules.budget.toLocaleString()}`);
  }

  if (rules.clientName) {
    parts.push(`Client: ${rules.clientName}`);
  }

  if (rules.projectTitle) {
    parts.push(`Title: ${rules.projectTitle}`);
  }

  if (rules.currency) {
    parts.push(`Currency: ${rules.currency}`);
  }

  if (rules.gstApplicable !== undefined) {
    parts.push(`GST: ${rules.gstApplicable ? 'Applicable' : 'Exempt'}`);
  }

  return parts.length > 0 ? parts.join(', ') : 'No business rules extracted';
}
