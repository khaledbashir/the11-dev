# VALIDATION CHECKLIST - Go Through One By One

## 1. MULTI-SCOPE STRUCTURE
**What we're checking:** Are there 2 separate phases with their own sections?

- [ ] Phase 1 (Setup & Config) has its own section
- [ ] Phase 2 (Training & Handoff) has its own section
- [ ] Each phase has its own pricing table
- [ ] Phases are clearly separated

**PASS / FAIL:** ___________

**Notes:** 

---

## 2. FINANCIAL ACCURACY
**What we're checking:** Do all the numbers add up correctly?

- [ ] Phase 1 subtotal is correct (add up all roles × hours × rates)
- [ ] Phase 2 subtotal is correct (add up all roles × hours × rates)
- [ ] Total before discount = Phase 1 + Phase 2 = $50,000
- [ ] Discount is 10% = $5,000
- [ ] Total after discount = $45,000
- [ ] GST is 10% of $45,000 = $4,500
- [ ] GRAND TOTAL = $49,500

**PASS / FAIL:** ___________

**Actual Grand Total:** $___________

**Notes:** 

---

## 3. DATA INTEGRITY
**What we're checking:** Are all the roles real? Do they match the rate card?

- [ ] Tech - Head Of - Senior Project Management ($365/hr) ✓ in rate card
- [ ] Tech - Delivery - Project Coordination ($110/hr) ✓ in rate card
- [ ] Account Management - Senior Account Manager ($210/hr) ✓ in rate card
- [ ] All 3 roles appear in Phase 1
- [ ] All 3 roles appear in Phase 2
- [ ] No fake roles used
- [ ] Summary table matches the detailed tables

**PASS / FAIL:** ___________

**Notes:** 

---

## 4. SCOPE & PRICE OVERVIEW
**What we're checking:** Is there a summary table at the top showing all phases?

- [ ] Summary table exists at the beginning
- [ ] Shows "Phase 1: Setup & Config" with subtotal
- [ ] Shows "Phase 2: Training & Handoff" with subtotal
- [ ] Shows GRAND TOTAL = $49,500
- [ ] Summary numbers match the detailed sections

**PASS / FAIL:** ___________

**Notes:** 

---

## 5. LOGICAL COHERENCE
**What we're checking:** Does it make sense? Do the roles fit the work?

- [ ] Phase 1 description talks about setup/config
- [ ] Phase 1 roles make sense for setup work
- [ ] Phase 2 description talks about training/handoff
- [ ] Phase 2 roles make sense for training work
- [ ] Deliverables make sense for each phase
- [ ] No weird contradictions

**PASS / FAIL:** ___________

**Notes:** 

---

## 6. PROMPT ADHERENCE
**What we're checking:** Did the AI do what we asked?

- [ ] Client is "Acme Corp"
- [ ] Total budget is $50,000
- [ ] Has 2 phases (not 1, not 3)
- [ ] Phase 1 is "Setup & Config"
- [ ] Phase 2 is "Training & Handoff"
- [ ] 10% discount applied
- [ ] All 3 mandatory roles in each phase
- [ ] Nothing extra added that we didn't ask for

**PASS / FAIL:** ___________

**Notes:** 

---

## FINAL RESULT

**Total Checkpoints:** 6

**Passed:** ___/6

**Overall:** 
- ✅ PASS (all 6 passed)
- ⚠️ PARTIAL (some failed)
- ❌ FAIL (multiple failed)

**Which ones failed (if any):**

1. ___________
2. ___________
3. ___________

**What needs to be fixed:**

___________________________________________________________________________

___________________________________________________________________________

___________________________________________________________________________

---

## QUICK REFERENCE - Expected Numbers

```
Phase 1 Budget: ~$20,000
Phase 2 Budget: ~$30,000
Subtotal: $50,000
Discount (10%): -$5,000
After Discount: $45,000
GST (10%): +$4,500
GRAND TOTAL: $49,500
```

---

## CONSOLE LOGS TO LOOK FOR

Open F12 → Console and look for:

✅ `✅ [MANDATORY ROLES] All 3 required roles present`
✅ `🎯 [V4.1 MULTI-SCOPE] Found 2 scopes`
✅ `📊 [PRICING_JSON] Block Detected - V4.1 Multi-Scope Format`

If you see these = good sign ✓

