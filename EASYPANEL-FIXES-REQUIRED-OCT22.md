# EasyPanel Production Fixes Required (October 22, 2025)

**Status**: Code fixes complete ✅. Now need EasyPanel env var + workspace reset.

## Issues Fixed in Code

✅ **Auto-Navigation After Workspace Creation** (Commit: `1cf8bf4`)
- After creating new SOW workspace, automatically navigates to `/portal/sow/{sowId}` editor
- No more staying on dashboard
- Users get fresh blank SOW with chat ready for generation

## Issues Remaining (Action Required on EasyPanel)

### 1️⃣ Missing ANYTHINGLLM_URL Environment Variable

**Error**: `/undefined/api/v1/workspace/333/update` → 404

**Cause**: `NEXT_PUBLIC_ANYTHINGLLM_URL` not set in EasyPanel frontend env vars

**Fix**:
1. Go to EasyPanel dashboard: https://control.easypanel.io
2. Open **sow-frontend** service
3. Go to **Environment Variables** tab
4. Add or verify these are set:
   ```
   NEXT_PUBLIC_ANYTHINGLLM_URL=https://ahmad-anything-llm.840tjq.easypanel.host
   NEXT_PUBLIC_PDF_SERVICE_URL=http://168.231.115.219:8000
   NEXT_PUBLIC_API_URL=http://168.231.115.219:8000
   NEXT_PUBLIC_BASE_URL=http://168.231.115.219:3333
   ```
5. Click **Deploy** to apply changes
6. Wait 3-5 minutes for rebuild

### 2️⃣ Dashboard Empty Response (0 content length)

**Symptom**: Dashboard AI returns empty responses

**Root Cause**: Old `sow-master-dashboard` workspace still has old config

**Fix**:
1. Go to AnythingLLM: https://ahmad-anything-llm.840tjq.easypanel.host
2. Navigate to **Workspaces** section
3. Find workspace named: `sow-master-dashboard` or `SOW Master Dashboard`
4. **Delete the entire workspace** (click ⋮ → Delete)
5. Don't worry - it will auto-recreate with new analytics prompt on next dashboard load
6. Refresh frontend at sow.qandu.me
7. Dashboard should now return actual data

### 3️⃣ SOW Creation Returns 500 Error

**Symptom**: After creating workspace, SOW creation fails

**Likely Cause**: Database connection issue or missing parameters

**What to Check**:
- Backend logs on EasyPanel (if backend service exists)
- Verify `DB_HOST=168.231.115.219` is accessible from backend
- Check MySQL user credentials in backend `.env`

**Status**: Check backend deployment status first

---

## Deployment Summary

| Issue | Status | Fix Location | Action Required |
|-------|--------|---|---|
| Auto-navigate after workspace creation | ✅ FIXED | Code (page.tsx) | Deployed to main branch |
| Missing ANYTHINGLLM_URL | ❌ PENDING | EasyPanel env vars | Update frontend env vars + redeploy |
| Master dashboard empty response | ⚠️ WORKAROUND | AnythingLLM workspace | Delete old workspace to reset |
| SOW creation 500 error | ❌ PENDING | Database/Backend | Investigate MySQL connection |

---

## Next Steps

1. **Update EasyPanel Frontend Env Vars** (Required - 5 min)
   - Add NEXT_PUBLIC_ANYTHINGLLM_URL
   - Redeploy frontend
   
2. **Reset Master Dashboard Workspace** (Required - 2 min)
   - Delete sow-master-dashboard in AnythingLLM
   - Let it auto-recreate
   
3. **Test Workspace Creation Flow** (5 min)
   - Create new workspace
   - Should auto-navigate to SOW editor
   - Dashboard should show data

4. **Debug SOW Creation 500** (If still failing)
   - Check backend connectivity to MySQL
   - Verify database credentials

---

## Git Commits This Session

- `1cf8bf4` - feat: Auto-navigate to new SOW editor after workspace creation
- `3837a91` - fix: Update master dashboard prompt to be analytics/query focused
- `172903a` - fix: Add temperature and history settings to master dashboard prompt
- `2b14c54` - feat: Add complete 82-role rate card to Architect prompt
- `370546d` - fix: Update onCreateWorkspace interface signature
- `9b05592` - feat: Add workspace type selector to creation modal
- `01c8a4d` - fix: Route dashboard to AnythingLLM workspace
- `6bd8166` - fix: Don't embed knowledge base on workspace creation
- `f854863` - fix: Route chat messages to correct workspace
