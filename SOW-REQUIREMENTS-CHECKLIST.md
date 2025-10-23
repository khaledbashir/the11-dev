# ✅ SOW Finalization Requirements Checklist

**Date Created:** October 25, 2025  
**Status:** In Progress  
**Session:** Portal UI Cleanup + SOW Requirements Verification  

---

## 📋 Critical Requirements (MUST HAVE)

### 1. Modal Styling (UI/Theme) 🎨
- [ ] Modal background: `#0E0F0F` (dark background)
- [ ] Modal text: White color (`#FFFFFF`)
- [ ] Logo display in modal
- [ ] Apply Social Garden theme colors
- [ ] Smooth animations
- **File:** `frontend/components/tailwind/workspace-creation-progress.tsx`
- **Priority:** HIGH - User-facing, visible immediately
- **Status:** NOT STARTED

---

### 2. Scope Assumptions Section 📝
- [ ] Section exists in generated SOW
- [ ] Positioned AFTER Outcomes, BEFORE Phases
- [ ] Contains: General assumptions, capped hours, timeline dependencies
- [ ] Not buried in other sections
- [ ] Clearly labeled with "Scope Assumptions" heading
- **File:** `frontend/lib/knowledge-base.ts` (THE_ARCHITECT_SYSTEM_PROMPT)
- **Current Status:** ✅ PARTIALLY DONE (prompt updated but visibility verification needed)
- **Action:** Verify it's visible and prominent in generated SOWs

---

### 3. Discount Presentation Logic 💰
- [ ] Discount field visible in pricing display
- [ ] Shows: Original price, discount amount, final price
- [ ] Discount control slider functional
- [ ] Can adjust discount percentage 0-50%
- [ ] Recalculates totals on discount change
- **File:** `frontend/app/portal/sow/[id]/page.tsx` (Pricing section)
- **Current Status:** ✅ IMPLEMENTED (need to verify visibility)
- **Action:** Check if discount section is obvious/visible

---

### 4. Total Price Toggle Feature 💵
- [ ] Button/toggle to hide/show grand total
- [ ] Label: "Hide Grand Total" or similar
- [ ] Works in pricing calculator
- [ ] State persists while viewing
- **File:** `frontend/app/portal/sow/[id]/page.tsx` (Pricing section)
- **Current Status:** ✅ IMPLEMENTED (need to verify UI prominence)
- **Action:** Make toggle button more obvious

---

### 5. Deliverables Location & Ordering 📍
- [ ] "Detailed Deliverables" section BEFORE "Project Phases"
- [ ] Positioned after "Scope Overview" section
- [ ] Clear visual separation from phases
- [ ] Deliverables listed as bullet points with `+` prefix
- [ ] No paragraph format, always structured list
- **File:** `frontend/lib/knowledge-base.ts` (prompt structure)
- **Current Status:** ✅ PARTIALLY (prompt updated, need to check generated output)
- **Action:** Verify in actual SOW output

---

### 6. Mandatory Management Roles ✅
- [ ] Tech-Head Of Senior Project Management (role exists)
- [ ] Tech-Delivery - Project Coordination (role exists)
- [ ] Account Management (role exists)
- [ ] All three roles in EVERY SOW
- [ ] Minimum hours allocated to each
- [ ] Clearly visible in pricing table
- **File:** `frontend/lib/knowledge-base.ts` (rate card in prompt)
- **Current Status:** ✅ IMPLEMENTED (need to verify enforcement)
- **Action:** Confirm roles appear and are validated

---

### 7. Role Ordering in Pricing Table 📊
- [ ] Account Management roles appear LAST (bottom of table)
- [ ] Technical roles appear first/middle
- [ ] Designer roles grouped together
- [ ] Developer roles grouped together
- [ ] Order is consistent across all SOWs
- **File:** `frontend/components/sow/EditablePricingTable.tsx` or similar
- **Current Status:** ⏳ NEEDS VERIFICATION
- **Action:** Check if roles are sortable and ordering persists

---

### 8. Drag-Drop Functionality (Role Reordering) 🔄
- [ ] Roles can be dragged and dropped
- [ ] Drag handle visible (:: icon)
- [ ] Smooth animation when dragging
- [ ] Drop zones clearly indicated
- [ ] Changes persist until save
- [ ] No "buggy" behavior reported
- **File:** `frontend/components/sow/EditablePricingTable.tsx`
- **Current Status:** ⏳ NEEDS TESTING
- **Action:** Test drag-drop, fix if buggy

---

### 9. Explicit Management Services Listing 📋
- [ ] Account & Project Management Services section visible
- [ ] Lists: Kick-Off, Project Status Updates, Internal Briefing
- [ ] Not buried in pricing table
- [ ] Clearly labeled as separate component
- [ ] Included in "What's Included" or new section
- **File:** `frontend/lib/knowledge-base.ts` (prompt structure)
- **Current Status:** ❌ NOT IMPLEMENTED
- **Action:** Add to prompt, verify in output

---

### 10. Branding & Aesthetics 🎨
- [ ] Social Garden logo visible in PDF
- [ ] Plus Jakarta Sans font enforced
- [ ] Dark theme colors (#0E0F0F, #1CBF79)
- [ ] Professional spacing and alignment
- [ ] Responsive on all devices
- **File:** `backend/main.py` (PDF generation)
- **Current Status:** ✅ IMPLEMENTED (verified in previous session)
- **Action:** No action needed

---

### 11. Role Granularity (Specific vs Generic) 👥
- [ ] Roles are specific (Designer, Developer, PM)
- [ ] NOT generic (Engineer, Contractor)
- [ ] Designer roles separated by type (UX/UI, Graphics)
- [ ] Developer roles separated by type (Frontend, Backend, Fullstack)
- [ ] Clear rate cards for each role
- **File:** `frontend/lib/knowledge-base.ts` (82-role rate card)
- **Current Status:** ✅ IMPLEMENTED
- **Action:** Verify in generated SOWs

---

### 12. Rounding Logic ($5K Increments) 💯
- [ ] Total investment rounds to nearest $5,000
- [ ] Applied to final quote
- [ ] Clear in UI that rounding applied
- [ ] Transparent to client
- **File:** `frontend/app/portal/sow/[id]/page.tsx` (pricing calculations)
- **Current Status:** ⏳ NEEDS VERIFICATION
- **Action:** Check if rounding logic present

---

### 13. Budget Adjustment Notes 📝
- [ ] Text field for budget adjustment notes
- [ ] Visible in pricing section
- [ ] Optional field (not required)
- [ ] Stored with SOW
- [ ] Shown to internal team
- [ ] Example: "Reduced hours for Phase 2 to meet budget"
- **File:** `frontend/app/portal/sow/[id]/page.tsx` (pricing section)
- **Current Status:** ✅ IMPLEMENTED
- **Action:** Verify visibility and storage

---

### 14. GST Display Rules 📊
- [ ] All pricing shows "+GST" suffix
- [ ] GST calculated as 10% of subtotal
- [ ] Grand total includes GST
- [ ] Clear breakdown: Subtotal, GST, Discount, Total
- **File:** `frontend/app/portal/sow/[id]/page.tsx`
- **Current Status:** ✅ IMPLEMENTED
- **Action:** Verify in portal pricing display

---

### 15. Folder Persistence 📁
- [ ] SOW folders persist across sessions
- [ ] Folder structure saved to database
- [ ] Can create/edit/delete folders
- [ ] Drag-drop files into folders
- [ ] Folder structure visible in sidebar
- **File:** `frontend/lib/db.ts` and folder management API
- **Current Status:** ⏳ NEEDS TESTING
- **Action:** Test folder creation and persistence

---

## 🎯 HIGH PRIORITY (Session Focus)

| # | Requirement | Status | Action |
|---|---|---|---|
| 1 | Modal colors (#0E0F0F, white text) | NOT STARTED | **FIRST** |
| 2 | Scope Assumptions visible | PARTIALLY | Verify & make obvious |
| 3 | Management Services listing | NOT STARTED | Add to prompt |
| 4 | Discount visibility | IMPLEMENTED | Verify prominent |
| 5 | Price toggle visibility | IMPLEMENTED | Verify obvious |

---

## 🔄 MEDIUM PRIORITY (Next Session)

| # | Requirement | Status | Action |
|---|---|---|---|
| 6 | Role ordering consistency | NEEDS TEST | Test & verify |
| 7 | Drag-drop functionality | NEEDS TEST | Test & fix bugs |
| 8 | Rounding logic | NEEDS VERIFY | Check implementation |
| 9 | Folder persistence | NEEDS TEST | Test create/save |

---

## ✅ LOW PRIORITY (Already Done)

| # | Requirement | Status | Note |
|---|---|---|---|
| 10 | Branding & PDF styling | DONE | Logo + font verified ✅ |
| 11 | Role granularity | DONE | 82-role card implemented ✅ |
| 12 | Budget adjustment notes | DONE | Field exists ✅ |
| 13 | GST display | DONE | Calculations correct ✅ |
| 14 | Deliverables as lists | DONE | Prompt updated ✅ |
| 15 | Mandatory roles | DONE | Prompt enforces ✅ |

---

## 📊 Progress Tracking

**Total Requirements:** 15  
**Completed:** 6 (40%)  
**In Progress:** 0  
**Not Started:** 4  
**Needs Verification:** 5  

**Current Session Goal:** Complete HIGH PRIORITY items (#1-5)

---

## 🚀 Execution Plan

### Session 1 (Today - October 25)
1. ✅ Modal styling colors - Fix #0E0F0F + white text
2. Scope Assumptions - Make more obvious in generated SOWs
3. Management Services - Add explicit listing to prompt

### Session 2
4. Test drag-drop functionality
5. Verify all UI elements visibility
6. Test folder persistence

### Session 3 (If Needed)
7. Fine-tune pricing display
8. Optimize role ordering
9. Client UAT testing

---

## 📝 Notes

- **Bold items** = User-facing, affects client experience
- **Italicized items** = Internal only, affects team operations
- Checkmarks only appear when **verified in production**
- If item says "IMPLEMENTED" but not visible, make it OBVIOUS
- Every fix gets committed individually with clear message

---

**Next Action:** Start with Modal Styling (#1)  
**Responsible:** Development Team  
**Review:** Sam (Product Manager)  

---

*Last updated: October 25, 2025*
