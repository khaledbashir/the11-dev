# PDF Export Structured JSON Format

## Overview

When a user clicks "Export to PDF", the backend WeasyPrint service generates a structured JSON output that describes the PDF layout with precise positioning data. This format is used for:
- PDF generation
- Content analysis
- Layout verification
- Accessibility metadata

---

## ROOT STRUCTURE

```json
{
  "children": [
    { "Page 0 object" },
    { "Page 1 object" },
    { "Page N object" }
  ],
  "block_type": "Document"
}
```

---

## PAGE STRUCTURE

```json
{
  "id": "/page/0/Page/5",
  "block_type": "Page",
  "html": "<content-ref src='/page/0/SectionHeader/0'></content-ref><content-ref src='/page/0/Table/4'></content-ref>",
  "polygon": [[0, 0], [1587, 0], [1587, 2243], [0, 2243]],
  "bbox": [0, 0, 1587, 2243],
  "children": [
    { "SectionHeader block" },
    { "Text block" },
    { "Table block" },
    { "PageFooter block" }
  ],
  "section_hierarchy": {},
  "images": null,
  "page": 0
}
```

### Page Fields Explained

| Field | Type | Purpose |
|-------|------|---------|
| `id` | string | Unique identifier: `/page/{pageNum}/Page/{blockNum}` |
| `block_type` | string | Always "Page" for page containers |
| `html` | string | Content references to child blocks |
| `polygon` | array | 4 corner coordinates: `[[x1,y1], [x2,y2], [x3,y3], [x4,y4]]` |
| `bbox` | array | Bounding box: `[minX, minY, maxX, maxY]` |
| `children` | array | Child blocks (headers, text, tables, footers) |
| `page` | number | Page number (0-indexed) |

---

## BLOCK TYPES

### 1. SectionHeader

```json
{
  "id": "/page/0/SectionHeader/0",
  "block_type": "SectionHeader",
  "html": "<h1>SOCIALGARDEN</h1>",
  "polygon": [[452, 162], [1122, 162], [1122, 232], [452, 232]],
  "bbox": [452, 162, 1122, 232],
  "children": null,
  "section_hierarchy": {},
  "images": {},
  "page": 0
}
```

**Used for:** Headings (h1, h2, h3)

---

### 2. Text

```json
{
  "id": "/page/0/Text/3",
  "block_type": "Text",
  "html": "<p>Client: BBUBU</p>",
  "polygon": [[141, 602], [342, 602], [342, 635], [141, 635]],
  "bbox": [141, 602, 342, 635],
  "children": null,
  "section_hierarchy": {},
  "images": {},
  "page": 0
}
```

**Used for:** Paragraphs, body text

---

### 3. Table (PRICING TABLE)

```json
{
  "id": "/page/0/Table/4",
  "block_type": "Table",
  "html": "<table><thead><tr><th>ITEMS</th><th>ROLE</th><th>HOURS</th><th>TOTAL COST + GST</th></tr></thead><tbody><tr><td colspan=\"4\"><strong>Scope 1: HubSpot Integration Setup</strong></td></tr><tr><td>Handle HubSpot setup, workflow configuration, and integration testing.</td><td>Tech - Specialist - Integration Configuration</td><td>21</td><td>$3,780</td></tr><tr><td>Coordinate setup, client communications, and milestone reviews.</td><td>Project Management - (Account Manager)</td><td>11</td><td>$1,980</td></tr><tr><td colspan=\"4\"><strong>Deliverables:</strong></td></tr><tr><td colspan=\"4\"><ul><li>HubSpot account setup and basic CRM configuration</li></ul></td></tr></tbody></table>",
  "polygon": [[141, 689], [1435, 689], [1435, 1927], [141, 1927]],
  "bbox": [141, 689, 1435, 1927],
  "children": [],
  "section_hierarchy": {},
  "images": null,
  "page": 0
}
```

**Used for:** Pricing tables, scope tables, summary tables

**Key Points:**
- `html` contains full `<table>` markup
- Includes all rows: headers, data rows, deliverables, assumptions
- Pricing data embedded in table cells
- Colspan used for section headers and multi-line content

---

### 4. PageFooter

```json
{
  "id": "/page/0/PageFooter/5",
  "block_type": "PageFooter",
  "html": "",
  "polygon": [[565, 1980], [1016, 1980], [1016, 2002], [565, 2002]],
  "bbox": [565, 1980, 1016, 2002],
  "children": null,
  "section_hierarchy": {},
  "images": {},
  "page": 0
}
```

**Used for:** Page numbers, footers

---

## COORDINATE SYSTEM

### Polygon (4 corners)
```
[[x1, y1], [x2, y2], [x3, y3], [x4, y4]]

Example: [[141, 689], [1435, 689], [1435, 1927], [141, 1927]]

Visual:
(141, 689) ─────────────────── (1435, 689)
   │                                │
   │                                │
   │                                │
(141, 1927) ─────────────────── (1435, 1927)

Width: 1435 - 141 = 1294 pixels
Height: 1927 - 689 = 1238 pixels
```

### Bounding Box (min/max)
```
[minX, minY, maxX, maxY]

Example: [141, 689, 1435, 1927]

Same as polygon but in compact form
```

---

## MULTI-PAGE EXAMPLE

```json
{
  "children": [
    {
      "id": "/page/0/Page/5",
      "page": 0,
      "children": [
        { "SectionHeader with title" },
        { "Text with project overview" },
        { "Table with pricing for Scope 1" }
      ]
    },
    {
      "id": "/page/1/Page/7",
      "page": 1,
      "children": [
        { "Table continuation from page 0" },
        { "SectionHeader: Scope & Price Overview" },
        { "Table with scope summary" },
        { "SectionHeader: Project Overview" },
        { "Text with project description" },
        { "SectionHeader: Budget Notes" },
        { "Text with budget explanation" }
      ]
    }
  ],
  "block_type": "Document"
}
```

---

## PRICING TABLE HTML STRUCTURE

The `html` field in Table blocks contains:

```html
<table>
  <thead>
    <tr>
      <th>ITEMS</th>
      <th>ROLE</th>
      <th>HOURS</th>
      <th>TOTAL COST + GST</th>
    </tr>
  </thead>
  <tbody>
    <!-- Scope header -->
    <tr>
      <td colspan="4"><strong>Scope 1: HubSpot Integration Setup</strong></td>
    </tr>
    
    <!-- Scope description -->
    <tr>
      <td colspan="4">
        <p><i>This scope covers the initial configuration...</i></p>
      </td>
    </tr>
    
    <!-- Role rows -->
    <tr>
      <td>Handle HubSpot setup, workflow configuration...</td>
      <td>Tech - Specialist - Integration Configuration</td>
      <td>21</td>
      <td>$3,780</td>
    </tr>
    
    <!-- Deliverables section -->
    <tr>
      <td colspan="4"><strong>Deliverables:</strong></td>
    </tr>
    <tr>
      <td colspan="4">
        <ul>
          <li>HubSpot account setup and basic CRM configuration</li>
          <li>Integration of HubSpot forms and tracking code</li>
        </ul>
      </td>
    </tr>
    
    <!-- Assumptions section -->
    <tr>
      <td colspan="4"><strong>Assumptions:</strong></td>
    </tr>
    <tr>
      <td colspan="4">
        <ul>
          <li>Client will provide access to HubSpot account</li>
        </ul>
      </td>
    </tr>
  </tbody>
</table>
```

---

## GENERATION FLOW

```
TipTap JSON (Editor)
        ↓
    tiptapToHTML()
        ↓
HTML String
        ↓
WeasyPrint Backend
        ↓
PDF + Structured JSON
        ↓
User Downloads PDF
```

---

## VERIFICATION CHECKLIST

When PDF exports, verify:

- [ ] All pricing tables have `block_type: "Table"`
- [ ] Table `html` contains full `<table>` markup
- [ ] Coordinates (bbox, polygon) are accurate
- [ ] All pages have correct `page` number
- [ ] Content references in page `html` match child block IDs
- [ ] No [PRICING_JSON] tags in output
- [ ] All roles and hours are present in table HTML
- [ ] Totals are calculated correctly


