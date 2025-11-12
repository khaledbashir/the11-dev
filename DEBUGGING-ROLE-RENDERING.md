# Debugging Role Rendering Failure

## 🎯 The Problem

The system is rendering only **3 roles** in the editor when the [PRICING_JSON] contains **8 roles**:

- ❌ Only 3 roles appear in pricing table
- ❌ Missing roles: Account Management, and 4 others
- ❌ Subtotal calculated from only 3 roles (A$8,140 instead of correct total)
- ❌ PDF export corrupted because it's based on incomplete data

## 🔍 Debugging Strategy

Added comprehensive logging at each step of the role flow:

### Step 1: JSON Extraction
**Console log:** `🔍 [ROLE EXTRACTION]`
- Shows each role being extracted from [PRICING_JSON]
- Format: `[1/8] Role Name | Hours: X | Rate: $Y | Cost: $Z`
- **Expected:** All 8 roles logged

### Step 2: Role Transformation
**Console log:** `🔍 [ROLE TRANSFORMATION]`
- Shows roles after being transformed to editor format
- Format: `[1/8] Role Name | Hours: X`
- **Expected:** All 8 roles logged

### Step 3: Insert Command
**Console log:** `🔍 [INSERT COMMAND]`
- Shows roles being passed to the insert command
- Format: `[1/8] Role Name | Hours: X`
- **Expected:** All 8 roles logged

### Step 4: Pricing Table Entry
**Console log:** `🔍 [INSERT PRICING TABLE]`
- Shows roles entering the pricing table insertion function
- Format: `[1/8] Role Name | Hours: X`
- **Expected:** All 8 roles logged

### Step 5: After Filtering
**Console log:** `🔍 [PRICING ROWS AFTER FILTER]`
- Shows roles after invalid ones are filtered out
- Format: `[1/8] Role Name | Hours: X`
- **Expected:** All 8 roles (or close to it)

### Step 6: Final Insertion
**Console log:** `✅ Inserting EditablePricingTable with X roles`
- Shows how many roles are actually being inserted
- **Expected:** 8 roles

---

## 📋 Testing Steps

1. **Generate a SOW** with a prompt that includes multiple roles
2. **Open browser console** (F12 → Console tab)
3. **Look for the logging sequence** above
4. **Compare numbers** at each step:
   - Step 1: 8 roles extracted
   - Step 2: 8 roles transformed
   - Step 3: 8 roles in insert command
   - Step 4: 8 roles entering pricing table
   - Step 5: 8 roles after filtering
   - Step 6: 8 roles inserted

---

## 🚨 Where Roles Are Being Dropped

### Scenario A: Dropped at Extraction
If Step 1 shows only 3 roles:
- **Problem:** AI is not generating complete [PRICING_JSON]
- **Fix:** Update THE_ARCHITECT_V4_PROMPT to ensure all roles are included

### Scenario B: Dropped at Transformation
If Step 1 shows 8 but Step 2 shows 3:
- **Problem:** Transformation logic is filtering roles
- **Fix:** Check `extractPricingJSON` function (lines 224-241)

### Scenario C: Dropped at Insert Command
If Step 2 shows 8 but Step 3 shows 3:
- **Problem:** Roles not being passed correctly to insert command
- **Fix:** Check where `suggestedRoles` is being set (line 3963)

### Scenario D: Dropped at Pricing Table Entry
If Step 3 shows 8 but Step 4 shows 3:
- **Problem:** Roles not being passed to `convertMarkdownToNovelJSON`
- **Fix:** Check function call parameters

### Scenario E: Dropped During Filtering
If Step 4 shows 8 but Step 5 shows 3:
- **Problem:** Filtering logic is removing valid roles
- **Fix:** Check filter conditions (lines 766-784)

### Scenario F: Dropped at Final Insertion
If Step 5 shows 8 but Step 6 shows 3:
- **Problem:** Pricing table insertion logic is dropping roles
- **Fix:** Check `insertPricingTable` function (lines 642-810)

---

## 🔧 Quick Fixes by Scenario

### If Scenario A (AI not generating all roles):
```
Update THE_ARCHITECT_V4_PROMPT to explicitly require:
- All 8 roles in [PRICING_JSON]
- Each role with hours, rate, cost
- Validation that all roles are present
```

### If Scenario B-F (Frontend rendering issue):
```
The logging will pinpoint exactly where roles are lost.
Then we can fix the specific function/filter causing the drop.
```

---

## 📊 Expected Console Output

```
📊 [PRICING_JSON] Block Detected - v3.1 Format
✅ Extracted 8 roles with validated hours/costs
🔍 [ROLE EXTRACTION] Detailed role list:
   [1/8] Tech - Head Of - Senior Project Management | Hours: 10 | Rate: $295 | Cost: $2950
   [2/8] Tech - Delivery - Project Coordination | Hours: 8 | Rate: $110 | Cost: $880
   [3/8] Account Management - Senior Account Manager | Hours: 6 | Rate: $180 | Cost: $1080
   [4/8] Design - Landing Page (Onshore) | Hours: 12 | Rate: $190 | Cost: $2280
   [5/8] Dev (or Tech) - Landing Page (Onshore) | Hours: 15 | Rate: $210 | Cost: $3150
   [6/8] Copywriting (Onshore) | Hours: 10 | Rate: $180 | Cost: $1800
   [7/8] Tech - Website Optimisation | Hours: 14 | Rate: $120 | Cost: $1680
   [8/8] Project Coordination | Hours: 3 | Rate: $110 | Cost: $330

🔍 [ROLE TRANSFORMATION] Transformed 8 roles for editor
   [1/8] Tech - Head Of - Senior Project Management | Hours: 10
   [2/8] Tech - Delivery - Project Coordination | Hours: 8
   [3/8] Account Management - Senior Account Manager | Hours: 6
   [4/8] Design - Landing Page (Onshore) | Hours: 12
   [5/8] Dev (or Tech) - Landing Page (Onshore) | Hours: 15
   [6/8] Copywriting (Onshore) | Hours: 10
   [7/8] Tech - Website Optimisation | Hours: 14
   [8/8] Project Coordination | Hours: 3

🔍 [INSERT COMMAND] Received 8 roles from extractPricingJSON
   [1/8] Tech - Head Of - Senior Project Management | Hours: 10
   ... (all 8 roles)

🔍 [INSERT PRICING TABLE] Received 8 roles
   [1/8] Tech - Head Of - Senior Project Management | Hours: 10
   ... (all 8 roles)

🔍 [PRICING ROWS AFTER FILTER] 8 roles:
   [1/8] Tech - Head Of - Senior Project Management | Hours: 10
   ... (all 8 roles)

✅ Inserting EditablePricingTable with 8 roles.
```

---

## 🚀 Next Steps

1. **Generate a test SOW** with multiple roles
2. **Check console logs** to see where roles are dropped
3. **Report which scenario** (A-F) matches your logs
4. **I'll fix the specific issue** based on the scenario

---

## 📝 Files Modified

- `frontend/app/page.tsx` - Added logging at 6 critical points
- Commit: `fe192f0`

---

## 💡 Key Insight

The logging will tell us **exactly** where the 5 missing roles are being dropped. Once we know the scenario, the fix is straightforward.

