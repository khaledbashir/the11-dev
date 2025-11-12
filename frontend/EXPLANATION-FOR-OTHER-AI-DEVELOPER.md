# SOW Pipeline Explanation for Other AI Developers

## Quick Summary

We have a **Statement of Work (SOW) generation system** that:
1. Uses AI (The Architect V4) to generate SOW documents
2. Renders them in a TipTap/Novel editor with interactive pricing tables
3. Exports to PDF with structured JSON format

**The Problem We Just Fixed:**
The `[PRICING_JSON]` tag was appearing as raw text in SOWs instead of being converted to interactive pricing tables.

---

## The Three Key Documents

### 1. **SOW-PIPELINE-TECHNICAL-EXPLANATION.md**
**For:** Understanding the complete flow
**Contains:**
- Visual flow diagram from AI generation → PDF export
- 8 stages of the pipeline
- Key files involved
- Current status and what needs verification

**Read this first** to understand the big picture.

---

### 2. **SOW-DATA-TRANSFORMATION-WALKTHROUGH.md**
**For:** Understanding data transformations
**Contains:**
- Real example: HubSpot Integration project
- Stage-by-stage data transformations
- Input/output at each stage
- Before/after comparison of the bug fix

**Read this** to see exactly how data flows through the system.

---

### 3. **PDF-EXPORT-STRUCTURED-JSON-FORMAT.md**
**For:** Understanding PDF export structure
**Contains:**
- Root structure of PDF JSON output
- Page structure and fields
- Block types: SectionHeader, Text, Table, PageFooter
- Coordinate system (polygon, bbox)
- Pricing table HTML structure
- Multi-page example

**Read this** to understand the final PDF output format.

---

## The Bug We Fixed

### Problem
```
User generates SOW → AI outputs [PRICING_JSON] block
→ Frontend extracts JSON but leaves [PRICING_JSON] tag
→ Tag appears as literal text in rendered SOW
→ Pricing tables don't render
```

### Root Cause
In `frontend/app/page.tsx`, the code was:
1. Finding JSON blocks with regex: `/```json\s*([\s\S]*?)\s*```/gi`
2. Appending text BEFORE the JSON block (which included `[PRICING_JSON]` tag)
3. Replacing JSON block with `[editablePricingTable]` placeholder
4. **But the `[PRICING_JSON]` tag remained in the text**

### Solution
Added logic to detect and remove the `[PRICING_JSON]` tag before the JSON block:

```typescript
let textBeforeBlock = filteredContent.slice(lastIndex, start);
const pricingJsonTagMatch = textBeforeBlock.match(/\[PRICING[\/_]JSON\]\s*$/i);
if (pricingJsonTagMatch) {
  textBeforeBlock = textBeforeBlock.slice(0, -pricingJsonTagMatch[0].length);
}
rebuilt += textBeforeBlock;
```

Applied this fix in **4 different code paths** to ensure consistency.

---

## Key Technical Concepts

### [PRICING_JSON] Block
AI output format containing role allocation data:
```json
[PRICING_JSON]
```json
{
  "role_allocation": [
    { "role": "Tech - Specialist", "hours": 21, "rate": 180 },
    { "role": "Project Manager", "hours": 11, "rate": 180 }
  ],
  "discount": 5
}
```
```

### [editablePricingTable] Placeholder
Markdown placeholder that gets converted to TipTap pricing table node:
```markdown
# SOW Document

[editablePricingTable]

More content...
```

### TipTap JSON Node
Editor format for pricing table:
```json
{
  "type": "pricingTable",
  "attrs": {
    "roles": [...],
    "discount": 5,
    "total": 5760
  }
}
```

### PDF Export Structure
Backend generates structured JSON with positioning data:
```json
{
  "children": [
    {
      "id": "/page/0/Page/5",
      "block_type": "Page",
      "bbox": [0, 0, 1587, 2243],
      "children": [
        {
          "id": "/page/0/Table/4",
          "block_type": "Table",
          "html": "<table>...</table>",
          "bbox": [141, 689, 1435, 1927]
        }
      ]
    }
  ],
  "block_type": "Document"
}
```

---

## Files to Review

**Main Implementation:**
- `frontend/app/page.tsx` - Lines 3540-4080 (the fix)
- `frontend/lib/export-utils.ts` - HTML conversion
- `frontend/app/api/generate-pdf/route.ts` - PDF API endpoint

**Backend:**
- `backend/services/pdf_service.py` - WeasyPrint PDF rendering

**Documentation:**
- `frontend/PRICING-TABLE-RENDERING-FIX-COMPLETE.md` - Fix details
- `frontend/SOW-PIPELINE-TECHNICAL-EXPLANATION.md` - Complete flow
- `frontend/SOW-DATA-TRANSFORMATION-WALKTHROUGH.md` - Data transformations
- `frontend/PDF-EXPORT-STRUCTURED-JSON-FORMAT.md` - PDF structure

---

## What's Working Now

✅ AI generates SOW with [PRICING_JSON] block
✅ Frontend removes [PRICING_JSON] tag
✅ Pricing tables render in editor
✅ User can edit roles, hours, rates
✅ PDF export generates structured JSON
✅ No raw text appears in SOW

---

## What Needs Verification

When user clicks "Export to PDF":
1. Does pricing table render as proper `<table>` HTML in PDF?
2. Are all block positioning data (bbox, polygon) calculated correctly?
3. Are page breaks handled properly for multi-page SOWs?
4. Does the structured JSON output match the expected format?

---

## Questions to Ask

1. **Is the PDF export generating the structured JSON correctly?**
   - Check if backend is returning the format shown in PDF-EXPORT-STRUCTURED-JSON-FORMAT.md

2. **Are pricing tables converting to HTML tables properly?**
   - Verify the `html` field in Table blocks contains full `<table>` markup

3. **Are coordinates accurate?**
   - Check if bbox and polygon values match actual element positions

4. **Is multi-page pagination working?**
   - Verify page breaks are correct for long SOWs

---

## Next Steps

1. Read the three documentation files in order
2. Review the fix in `frontend/app/page.tsx` (lines 3540-4080)
3. Test PDF export with a sample SOW
4. Verify the structured JSON output format
5. Check if pricing tables render correctly in PDF


