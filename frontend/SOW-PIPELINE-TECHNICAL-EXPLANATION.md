# SOW Generation & PDF Export Pipeline - Technical Explanation

## Overview
This document explains how Statement of Work (SOW) documents flow through the system from AI generation → editor rendering → PDF export with structured JSON format.

---

## 1. THE COMPLETE FLOW

```
┌─────────────────────────────────────────────────────────────────┐
│ USER REQUEST: "Generate SOW for HubSpot integration project"    │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ AI GENERATION (THE_ARCHITECT_V4_PROMPT)                         │
│ - Generates markdown with narrative text                        │
│ - Outputs [PRICING_JSON] block with role_allocation data       │
│ - Wraps reasoning in <think> tags (hidden from user)           │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND PROCESSING (handleInsertContent in page.tsx)           │
│ 1. Strip <think> tags                                           │
│ 2. Extract [PRICING_JSON] block                                 │
│ 3. Remove [PRICING_JSON] tag (CRITICAL FIX)                    │
│ 4. Replace JSON block with [editablePricingTable] placeholder   │
│ 5. Convert markdown to TipTap/Novel JSON format                │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ EDITOR RENDERING (convertMarkdownToNovelJSON)                   │
│ - Detects [editablePricingTable] placeholder                    │
│ - Creates pricing table node with role_allocation data          │
│ - User sees interactive pricing tables in editor                │
│ - User can edit, add/remove roles, adjust hours/rates           │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ USER CLICKS "EXPORT TO PDF"                                     │
│ - Converts editor content to HTML                               │
│ - Extracts pricing data from tables                             │
│ - Prepares SOW data structure                                   │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ PDF GENERATION (Backend WeasyPrint Service)                     │
│ - Receives HTML + SOW data                                      │
│ - Renders PDF with proper layout                                │
│ - Generates structured JSON with block_type, bbox, polygon      │
│ - Returns PDF file to user                                      │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ USER DOWNLOADS PDF                                              │
│ - Professional BBUBU-style format                               │
│ - Pricing tables rendered as HTML tables                        │
│ - All content properly paginated                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. AI OUTPUT FORMAT

**The Architect V4 generates:**

```markdown
# HubSpot Integration and Custom Landing Page Development

[PRICING_JSON]
```json
{
  "role_allocation": [
    {
      "role": "Tech - Specialist - Integration Configuration",
      "hours": 21,
      "rate": 180,
      "cost": 3780
    },
    {
      "role": "Project Management - (Account Manager)",
      "hours": 11,
      "rate": 180,
      "cost": 1980
    }
  ],
  "discount": 5
}
```

Project overview text...
Deliverables...
Assumptions...
```

---

## 3. FRONTEND PROCESSING PIPELINE

### Step 1: Content Cleaning (page.tsx:3500-3550)
```typescript
// Remove <think> tags
filteredContent = filteredContent.replace(/<think>[\s\S]*?<\/think>/gi, '');

// Extract JSON blocks
const jsonBlocks = Array.from(
  filteredContent.matchAll(/```json\s*([\s\S]*?)\s*```/gi)
);
```

### Step 2: JSON Extraction & Tag Removal (CRITICAL FIX)
```typescript
// For each JSON block found:
let textBeforeBlock = filteredContent.slice(lastIndex, start);

// CRITICAL: Remove [PRICING_JSON] tag
const pricingJsonTagMatch = textBeforeBlock.match(/\[PRICING[\/_]JSON\]\s*$/i);
if (pricingJsonTagMatch) {
  textBeforeBlock = textBeforeBlock.slice(0, -pricingJsonTagMatch[0].length);
}

rebuilt += textBeforeBlock;
// Replace JSON block with placeholder
rebuilt += '\n[editablePricingTable]\n';
```

### Step 3: Markdown to TipTap JSON Conversion
```typescript
// convertMarkdownToNovelJSON() detects placeholder:
if (line.trim() === '[editablePricingTable]') {
  // Create pricing table node with extracted role_allocation data
  insertPricingTable();
}
```

---

## 4. EDITOR RENDERING

**TipTap Node Structure for Pricing Table:**
```json
{
  "type": "pricingTable",
  "attrs": {
    "roles": [
      {
        "role": "Tech - Specialist - Integration Configuration",
        "hours": 21,
        "rate": 180,
        "cost": 3780
      }
    ],
    "discount": 5,
    "total": 5760
  }
}
```

User sees interactive table with:
- Add/remove role buttons
- Editable hours and rates
- Auto-calculated totals
- Discount percentage input

---

## 5. PDF EXPORT FLOW

### Frontend (page.tsx:2850-2870)
```typescript
// Convert editor content to HTML
const editorHTML = tiptapToHTML(currentDoc.content);

// Call backend PDF service
const response = await fetch('/api/generate-pdf', {
  method: 'POST',
  body: JSON.stringify({
    html_content: editorHTML,
    filename: filename,
    show_pricing_summary: true,
    content: currentDoc.content,
    final_investment_target_text: finalPriceTargetText
  })
});
```

### Backend (WeasyPrint Service)
```python
# Receives HTML + SOW data
# Renders PDF with proper layout
# Generates structured JSON output:

{
  "children": [
    {
      "id": "/page/0/Page/5",
      "block_type": "Page",
      "html": "<content-ref src='/page/0/SectionHeader/0'></content-ref>...",
      "bbox": [0, 0, 1587, 2243],
      "polygon": [[0,0], [1587,0], [1587,2243], [0,2243]],
      "children": [
        {
          "id": "/page/0/Table/4",
          "block_type": "Table",
          "html": "<table><thead>...</thead><tbody>...</tbody></table>",
          "bbox": [141, 689, 1435, 1927],
          "polygon": [[141,689], [1435,689], [1435,1927], [141,1927]]
        }
      ]
    }
  ],
  "block_type": "Document"
}
```

---

## 6. KEY FILES

| File | Purpose |
|------|---------|
| `frontend/app/page.tsx` | Main editor, AI integration, PDF export trigger |
| `frontend/lib/export-utils.ts` | TipTap to HTML conversion |
| `frontend/lib/sow-pdf-utils.ts` | SOW data preparation |
| `frontend/app/api/generate-pdf/route.ts` | PDF generation API endpoint |
| `frontend/app/api/generate-professional-pdf/route.ts` | Multi-scope PDF endpoint |
| `backend/services/pdf_service.py` | WeasyPrint PDF rendering |

---

## 7. CURRENT STATUS

✅ **FIXED**: [PRICING_JSON] tag removal - no longer appears as raw text
✅ **WORKING**: Pricing table rendering in editor
✅ **WORKING**: PDF export with structured JSON format
⏳ **VERIFY**: Pricing tables convert correctly to HTML tables in PDF

---

## 8. WHAT NEEDS VERIFICATION

When user clicks "Export to PDF":
1. Does the pricing table render as proper `<table>` HTML in PDF?
2. Are all block positioning data (bbox, polygon) calculated correctly?
3. Are page breaks handled properly for multi-page SOWs?
4. Does the structured JSON output match the expected format?


