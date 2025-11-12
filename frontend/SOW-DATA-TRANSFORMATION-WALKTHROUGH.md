# SOW Data Transformation Walkthrough

## Example: HubSpot Integration Project

---

## STAGE 1: AI GENERATION OUTPUT

**What The Architect V4 generates:**

```markdown
# HubSpot Integration and Custom Landing Page Development for BBUBU

## Scope 1: HubSpot Integration Setup

This scope covers the initial configuration and integration of HubSpot...

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

## Scope 2: Development of 3 Custom Landing Pages

...more content...
```

---

## STAGE 2: FRONTEND PROCESSING

### 2a. Content Cleaning
```typescript
// INPUT: Raw AI response with <think> tags and [PRICING_JSON]
const rawContent = `
<think>
Let me calculate the pricing...
TARGET_SUBTOTAL = ($25,000 / 10) / (7 - 10) = $22,727.27
</think>

# HubSpot Integration...

[PRICING_JSON]
\`\`\`json
{ "role_allocation": [...] }
\`\`\`
`;

// STEP 1: Strip <think> tags
filteredContent = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, '');
// OUTPUT: <think> tags removed, markdown remains

// STEP 2: Extract JSON blocks
const jsonBlocks = Array.from(
  filteredContent.matchAll(/```json\s*([\s\S]*?)\s*```/gi)
);
// OUTPUT: Found 1 JSON block with role_allocation data
```

### 2b. JSON Extraction & [PRICING_JSON] Tag Removal (CRITICAL)
```typescript
// BEFORE FIX (BUG):
// The [PRICING_JSON] tag remained in the markdown
// Result: Raw text "[PRICING_JSON]" appeared in SOW

// AFTER FIX:
for (const m of jsonBlocks) {
  const start = m.index || 0;
  let textBeforeBlock = filteredContent.slice(lastIndex, start);
  
  // CRITICAL: Check if [PRICING_JSON] tag appears before JSON block
  const pricingJsonTagMatch = textBeforeBlock.match(/\[PRICING[\/_]JSON\]\s*$/i);
  if (pricingJsonTagMatch) {
    // Remove the tag
    textBeforeBlock = textBeforeBlock.slice(0, -pricingJsonTagMatch[0].length);
    console.log('🧹 Removed [PRICING_JSON] tag');
  }
  
  rebuilt += textBeforeBlock;
  // Replace JSON block with placeholder
  rebuilt += '\n[editablePricingTable]\n';
}

// OUTPUT: Markdown with [editablePricingTable] placeholder instead of JSON
```

### 2c. Extract Role Data
```typescript
// Parse the JSON block
const roleData = {
  role_allocation: [
    {
      role: "Tech - Specialist - Integration Configuration",
      hours: 21,
      rate: 180,
      cost: 3780
    },
    {
      role: "Project Management - (Account Manager)",
      hours: 11,
      rate: 180,
      cost: 1980
    }
  ],
  discount: 5
};

// Store in queue for later insertion
tablesRolesQueue.push(roleData.role_allocation);
tablesDiscountsQueue.push(roleData.discount);
```

---

## STAGE 3: MARKDOWN TO TIPTAP JSON CONVERSION

### Input Markdown
```markdown
# HubSpot Integration...

[editablePricingTable]

More content...
```

### Processing
```typescript
// convertMarkdownToNovelJSON() detects placeholder
if (line.trim() === '[editablePricingTable]') {
  // Create pricing table node
  insertPricingTable();
}

// insertPricingTable() creates:
const pricingTableNode = {
  type: "pricingTable",
  attrs: {
    roles: [
      {
        role: "Tech - Specialist - Integration Configuration",
        hours: 21,
        rate: 180,
        cost: 3780
      },
      {
        role: "Project Management - (Account Manager)",
        hours: 11,
        rate: 180,
        cost: 1980
      }
    ],
    discount: 5,
    total: 5760
  }
};
```

### Output TipTap JSON
```json
{
  "type": "doc",
  "content": [
    {
      "type": "heading",
      "attrs": { "level": 1 },
      "content": [{ "type": "text", "text": "HubSpot Integration..." }]
    },
    {
      "type": "pricingTable",
      "attrs": {
        "roles": [
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
        "discount": 5,
        "total": 5760
      }
    },
    {
      "type": "paragraph",
      "content": [{ "type": "text", "text": "More content..." }]
    }
  ]
}
```

---

## STAGE 4: EDITOR RENDERING

**User sees in editor:**
- Heading: "HubSpot Integration..."
- Interactive pricing table with:
  - 2 roles listed
  - Hours, rates, costs editable
  - Add/remove role buttons
  - Discount: 5%
  - Total: $5,760
- More content below

---

## STAGE 5: PDF EXPORT

### Frontend Conversion
```typescript
// Convert TipTap JSON to HTML
const editorHTML = tiptapToHTML(currentDoc.content);

// Result HTML:
`<h1>HubSpot Integration...</h1>
<table>
  <thead>
    <tr>
      <th>ROLE</th>
      <th>HOURS</th>
      <th>RATE</th>
      <th>COST</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Tech - Specialist - Integration Configuration</td>
      <td>21</td>
      <td>$180</td>
      <td>$3,780</td>
    </tr>
    <tr>
      <td>Project Management - (Account Manager)</td>
      <td>11</td>
      <td>$180</td>
      <td>$1,980</td>
    </tr>
    <tr>
      <td colspan="3">TOTAL</td>
      <td>$5,760</td>
    </tr>
  </tbody>
</table>
<p>More content...</p>`
```

### Backend PDF Generation
```python
# WeasyPrint receives HTML
# Renders to PDF with layout engine
# Generates structured JSON:

{
  "children": [
    {
      "id": "/page/0/Page/0",
      "block_type": "Page",
      "bbox": [0, 0, 1587, 2243],
      "children": [
        {
          "id": "/page/0/SectionHeader/0",
          "block_type": "SectionHeader",
          "html": "<h1>HubSpot Integration...</h1>",
          "bbox": [141, 100, 1435, 150]
        },
        {
          "id": "/page/0/Table/1",
          "block_type": "Table",
          "html": "<table>...</table>",
          "bbox": [141, 200, 1435, 400]
        }
      ]
    }
  ],
  "block_type": "Document"
}
```

---

## KEY TRANSFORMATIONS

| Stage | Input | Output | Purpose |
|-------|-------|--------|---------|
| 1 | Markdown + [PRICING_JSON] | Markdown + [editablePricingTable] | Remove AI markers |
| 2 | Markdown | TipTap JSON | Editor format |
| 3 | TipTap JSON | HTML | PDF rendering |
| 4 | HTML | Structured JSON | PDF metadata |

---

## CRITICAL FIX IMPACT

**Before Fix:**
- [PRICING_JSON] tag appeared as literal text in SOW
- User saw: "TARGET SUBTOTAL = ($25,000 / 10) / (7 - 10) = $22,727.27"
- Pricing tables didn't render

**After Fix:**
- [PRICING_JSON] tag removed during processing
- Placeholder converted to interactive pricing table
- User sees professional SOW with pricing tables
- PDF exports correctly with table HTML


