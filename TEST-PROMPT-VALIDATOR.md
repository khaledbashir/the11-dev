# THE_WHAT_SAM_WANTS_CHECKLIST - Test Prompt & Validator

## 🎯 Master Test Prompt

Use this prompt to generate a SOW that tests ALL checklist items:

```
Generate a comprehensive Statement of Work for a client called "TechFlow Solutions" 
with a total budget of $75,000.

The project has THREE distinct phases that must be in separate scopes:

PHASE 1: DISCOVERY & STRATEGY (Budget: $20,000)
- Conduct stakeholder interviews and requirements gathering
- Create a detailed project roadmap
- Deliverables: Requirements document, Project roadmap, Stakeholder report

PHASE 2: DESIGN & PLANNING (Budget: $25,000)
- Design system architecture and user flows
- Create wireframes and design specifications
- Deliverables: Architecture diagram, Wireframes, Design specifications

PHASE 3: IMPLEMENTATION & DEPLOYMENT (Budget: $30,000)
- Build and integrate the system
- Deploy to production
- Deliverables: Working system, Integration documentation, Deployment guide

Include all mandatory roles in each phase:
- Tech - Head Of - Senior Project Management (5-8 hours per phase)
- Tech - Delivery - Project Coordination (3-5 hours per phase)
- Account Management - Senior Account Manager (4-6 hours per phase)

Apply a 10% discount to the total.
```

---

## ✅ VALIDATION CHECKLIST

After generating the SOW, validate against these items:

### 1️⃣ MULTI-SCOPE STRUCTURE
**Requirement:** Three separate scopes with distinct titles, descriptions, and financial tables

**Validation Steps:**
- [ ] SOW contains exactly 3 scopes (Discovery, Design, Implementation)
- [ ] Each scope has its own title (e.g., "Phase 1: Discovery & Strategy")
- [ ] Each scope has its own description paragraph
- [ ] Each scope has its own pricing table with role allocations
- [ ] Scopes are clearly separated and easy to distinguish

**Pass Criteria:** All 3 scopes present with distinct sections ✅

---

### 2️⃣ FINANCIAL ACCURACY & SUMMARY
**Requirement:** All calculations must be 100% accurate, including discount and GST

**Validation Steps:**
- [ ] Phase 1 subtotal = sum of all roles × hours × rates
- [ ] Phase 2 subtotal = sum of all roles × hours × rates
- [ ] Phase 3 subtotal = sum of all roles × hours × rates
- [ ] Subtotal before discount = Phase 1 + Phase 2 + Phase 3
- [ ] Discount amount = Subtotal × 10% (should be ~$7,500)
- [ ] Subtotal after discount = Subtotal - Discount
- [ ] GST amount = Subtotal after discount × 10%
- [ ] Grand Total = Subtotal after discount + GST
- [ ] Grand Total ≈ $75,000 (within $1 tolerance)

**Pass Criteria:** All calculations correct, Grand Total = $75,000 ✅

**Example Calculation:**
```
Phase 1: $20,000
Phase 2: $25,000
Phase 3: $30,000
Subtotal: $75,000
Discount (10%): -$7,500
After Discount: $67,500
GST (10%): +$6,750
GRAND TOTAL: $74,250
```

---

### 3️⃣ DATA INTEGRITY
**Requirement:** All roles must exist in OFFICIAL_RATE_CARD, summary must match details

**Validation Steps:**
- [ ] Every role in Phase 1 pricing table exists in rate card
- [ ] Every role in Phase 2 pricing table exists in rate card
- [ ] Every role in Phase 3 pricing table exists in rate card
- [ ] Summary table lists all 3 phases with correct subtotals
- [ ] Summary table Grand Total matches detailed calculations
- [ ] No roles appear that aren't in the rate card

**Valid Roles (from rate card):**
- ✅ Tech - Head Of - Senior Project Management ($365/hr)
- ✅ Tech - Delivery - Project Coordination ($110/hr)
- ✅ Account Management - Senior Account Manager ($210/hr)

**Pass Criteria:** All roles valid, summary matches details ✅

---

### 4️⃣ SCOPE & PRICE OVERVIEW
**Requirement:** High-level summary table at beginning showing all scopes + Grand Total

**Validation Steps:**
- [ ] SOW begins with a summary/overview table
- [ ] Summary table lists "Phase 1: Discovery & Strategy" with subtotal
- [ ] Summary table lists "Phase 2: Design & Planning" with subtotal
- [ ] Summary table lists "Phase 3: Implementation & Deployment" with subtotal
- [ ] Summary table shows Grand Total at bottom
- [ ] Summary table subtotals match detailed scope tables

**Expected Summary Table:**
```
| Scope | Subtotal |
|-------|----------|
| Phase 1: Discovery & Strategy | $20,000 |
| Phase 2: Design & Planning | $25,000 |
| Phase 3: Implementation & Deployment | $30,000 |
| GRAND TOTAL | $74,250 |
```

**Pass Criteria:** Summary table present and accurate ✅

---

### 5️⃣ LOGICAL COHERENCE
**Requirement:** Descriptions align with roles, deliverables make sense

**Validation Steps:**
- [ ] Phase 1 description mentions "discovery" and "strategy"
- [ ] Phase 1 roles (PM, Coordination, Account Mgmt) make sense for discovery
- [ ] Phase 2 description mentions "design" and "planning"
- [ ] Phase 2 roles make sense for design work
- [ ] Phase 3 description mentions "implementation" and "deployment"
- [ ] Phase 3 roles make sense for implementation
- [ ] Deliverables align with phase descriptions
- [ ] No contradictions (e.g., "Design Phase" shouldn't have mostly Backend Developer hours)

**Pass Criteria:** All descriptions and roles logically aligned ✅

---

### 6️⃣ PROMPT ADHERENCE
**Requirement:** SOW matches the original request exactly

**Validation Steps:**
- [ ] Client name is "TechFlow Solutions"
- [ ] Total budget is $75,000 (before discount/GST)
- [ ] All 3 phases are included
- [ ] All 3 mandatory roles appear in each phase
- [ ] 10% discount is applied
- [ ] All requested deliverables are mentioned
- [ ] No extra scopes or deliverables added

**Pass Criteria:** SOW matches request exactly ✅

---

## 📊 FINAL VALIDATION RESULT

**Total Checkpoints:** 6
**Checkpoints Passed:** ___/6

### Result:
- ✅ **PASS** - All 6 checkpoints validated
- ⚠️ **PARTIAL PASS** - Some checkpoints failed (list which ones)
- ❌ **FAIL** - Multiple checkpoints failed (list which ones)

---

## 🔍 DEBUGGING GUIDE

If validation fails, check:

1. **Multi-Scope Structure fails:**
   - Are all 3 phases present in the JSON?
   - Does each phase have `role_allocation` array?
   - Check console: `🎯 [V4.1 MULTI-SCOPE] Found X scopes`

2. **Financial Accuracy fails:**
   - Recalculate manually: (hours × rate) for each role
   - Check for rounding errors
   - Verify discount is exactly 10%
   - Verify GST is exactly 10%

3. **Data Integrity fails:**
   - Check each role against rate card
   - Verify summary table matches detailed tables
   - Look for typos in role names

4. **Scope & Price Overview fails:**
   - Check if summary table exists at beginning
   - Verify all 3 phases listed
   - Check Grand Total calculation

5. **Logical Coherence fails:**
   - Read narrative descriptions
   - Verify roles match phase type
   - Check deliverables make sense

6. **Prompt Adherence fails:**
   - Compare SOW against original request
   - Check for missing scopes
   - Check for extra scopes

---

## 📋 Console Logs to Monitor

When running this test, watch for:

```
✅ [MANDATORY ROLES] All 3 required roles present
🎯 [V4.1 MULTI-SCOPE] Found 3 scopes
📊 [PRICING_JSON] Block Detected - V4.1 Multi-Scope Format
💰 Financial Summary from AI:
   Subtotal (before discount): $75,000
   Discount: $7,500
   Subtotal (after discount): $67,500
   GST: $6,750
   FINAL TOTAL: $74,250
```

---

## ✨ How to Use This Validator

1. Copy the **Master Test Prompt** above
2. Paste into SOW Generator chat
3. Wait for SOW to generate
4. Go through each of the 6 checkpoints
5. Mark ✅ or ❌ for each
6. Report results with any failures

