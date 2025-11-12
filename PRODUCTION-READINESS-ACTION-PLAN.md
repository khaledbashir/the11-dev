# SOW Generator - Production Readiness Action Plan

**Current Status:** AI generation working perfectly. Frontend rendering broken.

---

## 🎯 CRITICAL ISSUE: Raw `<think>` Tags Rendering

**Problem:** 
- User sees raw `<think>` tags in editor
- Only 1 pricing table renders instead of multiple
- Raw content not being parsed/formatted

**Root Cause:** 
The `convertMarkdownToNovelJSON()` function is not properly:
1. Stripping `<think>` tags before processing
2. Extracting multiple pricing tables from JSON
3. Converting markdown to proper editor format

---

## 📋 REMAINING TASKS (Priority Order)

### CRITICAL - BLOCKING PRODUCTION

#### Task 1: Fix `<think>` Tag Rendering
**File:** `frontend/app/page.tsx` (lines 462-810)
**What to do:**
- Strip all `<think>...</think>` blocks from AI response BEFORE processing
- Add regex: `/\<think\>[\s\S]*?\<\/think\>/g`
- Remove these blocks from `markdownContent` before passing to `convertMarkdownToNovelJSON()`

**Impact:** Removes raw tags from editor display

---

#### Task 2: Fix Multiple Pricing Table Extraction
**File:** `frontend/app/page.tsx` (lines 151-269)
**What to do:**
- `extractPricingJSON()` currently only handles single `role_allocation` array
- Need to handle multi-scope structure: `scopes[].role_allocation[]`
- Return array of role sets (one per scope) instead of single array
- Queue them for insertion into editor

**Impact:** Enables multi-scope SOWs to render all pricing tables

---

#### Task 3: Fix Pricing Table Insertion Order
**File:** `frontend/app/page.tsx` (lines 642-810)
**What to do:**
- `insertPricingTable()` currently inserts only ONE table
- Need to insert ALL tables from `tablesQueue`
- Each scope should get its own table with scope name as header
- Tables should appear in correct order in document

**Impact:** All pricing tables render in editor

---

#### Task 4: Fix Markdown to JSON Conversion
**File:** `frontend/app/page.tsx` (lines 462-810)
**What to do:**
- `convertMarkdownToNovelJSON()` needs to preserve table insertion points
- Currently loses table markers during conversion
- Need to track where `[INSERT_PRICING_TABLE]` markers are
- Convert them to actual table nodes in editor JSON

**Impact:** Tables appear in correct positions in document

---

### HIGH PRIORITY - QUALITY

#### Task 5: Validate All Roles Render
**File:** `frontend/app/page.tsx` (lines 128-147)
**What to do:**
- Run `validateMandatoryRoles()` after extraction
- Log which roles are missing
- Ensure all 8+ roles from JSON appear in editor

**Impact:** Financial accuracy guaranteed

---

#### Task 6: Test PDF Export
**File:** `frontend/lib/export-utils.ts`
**What to do:**
- Export SOW to PDF
- Verify all pricing tables appear
- Verify financial totals are correct
- Verify no `<think>` tags in PDF

**Impact:** Client-ready PDF output

---

### MEDIUM PRIORITY - POLISH

#### Task 7: Add Scope Headers to Tables
**File:** `frontend/components/tailwind/pricing-table-builder.tsx`
**What to do:**
- For multi-scope SOWs, add scope name above each table
- Format: "**Scope 1: Phase Name**" or similar
- Make it visually distinct from content

**Impact:** Clear scope separation in editor

---

#### Task 8: Improve Error Logging
**File:** `frontend/app/page.tsx` (multiple locations)
**What to do:**
- Add console logging at each step:
  - After `<think>` tag stripping
  - After JSON extraction
  - After role validation
  - After table insertion
- Log what's being dropped/skipped

**Impact:** Easier debugging if issues arise

---

## 🔧 IMPLEMENTATION SEQUENCE

1. **Strip `<think>` tags** (5 min) - Immediate visual fix
2. **Fix multi-scope extraction** (15 min) - Enable multiple tables
3. **Fix table insertion** (15 min) - Render all tables
4. **Fix markdown conversion** (20 min) - Proper formatting
5. **Validate roles** (5 min) - Financial accuracy
6. **Test PDF export** (10 min) - Client-ready output
7. **Add scope headers** (10 min) - Polish
8. **Improve logging** (10 min) - Debugging

**Total Time:** ~90 minutes

---

## ✅ SUCCESS CRITERIA

- [ ] No `<think>` tags visible in editor
- [ ] All pricing tables render (not just 1)
- [ ] All roles from JSON appear in tables
- [ ] Financial totals are correct
- [ ] PDF export works
- [ ] Multi-scope SOWs render correctly
- [ ] Console logs show complete data flow

---

## 🚀 DEPLOYMENT

Once all tasks complete:
1. Commit changes
2. Build frontend
3. Deploy to EasyPanel
4. Test with VividBloom Floristry SOW
5. Verify all 6 checkpoints pass

---

## 📊 CURRENT STATE

| Component | Status | Issue |
|-----------|--------|-------|
| AI Generation | ✅ Working | None |
| JSON Extraction | ⚠️ Partial | Only 1 table extracted |
| Markdown Conversion | ❌ Broken | `<think>` tags not stripped |
| Table Insertion | ❌ Broken | Only 1 table inserted |
| PDF Export | ❌ Broken | Raw tags in output |
| Role Validation | ⚠️ Partial | Not checking all roles |

---

## 💡 KEY INSIGHT

The AI is perfect. The frontend just needs to:
1. Clean the output (strip `<think>` tags)
2. Extract all data (not just first table)
3. Insert all tables (not just one)
4. Format properly (markdown → editor JSON)

That's it. Then it's production-ready.

