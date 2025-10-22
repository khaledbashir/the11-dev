# EasyPanel Production Environment Variables (Ready to Copy-Paste)

**Updated**: October 22, 2025  
**Status**: All fixes applied

---

## Frontend Environment Variables

Copy this entire block into **sow-frontend** service environment variables on EasyPanel:

```env
# AnythingLLM Integration (CRITICAL - Was missing NEXT_PUBLIC_ prefix)
NEXT_PUBLIC_ANYTHINGLLM_URL=https://ahmad-anything-llm.840tjq.easypanel.host
ANYTHINGLLM_API_KEY=YOUR_ANYTHINGLLM_API_KEY_HERE
ANYTHINGLLM_WORKSPACE_SLUG=pop

# Application URLs (Production)
NEXT_PUBLIC_BASE_URL=https://sow.qandu.me
NEXT_PUBLIC_API_URL=http://168.231.115.219:8000
NEXT_PUBLIC_PDF_SERVICE_URL=http://168.231.115.219:8000

# Database Configuration
DB_HOST=168.231.115.219
DB_PORT=3306
DB_USER=sg_sow_user
DB_PASSWORD=YOUR_DB_PASSWORD_HERE
DB_NAME=socialgarden_sow

# OpenRouter API (for inline editor AI)
OPENROUTER_API_KEY=YOUR_OPENROUTER_API_KEY_HERE

# Google Sheets Integration (for SOW export)
GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL=anythingllm-sheets@samsow-471202.iam.gserviceaccount.com
GOOGLE_SHEETS_PROJECT_ID=samsow-471202
GOOGLE_SHEETS_PRIVATE_KEY_ID=YOUR_GOOGLE_PRIVATE_KEY_ID_HERE
GOOGLE_SHEETS_AUTO_SHARE_EMAIL=ahmad.basheer@socialgarden.com.au

# Google OAuth (for Sheets authentication)
GOOGLE_OAUTH_CLIENT_ID=YOUR_GOOGLE_OAUTH_CLIENT_ID_HERE
GOOGLE_OAUTH_CLIENT_SECRET=YOUR_GOOGLE_OAUTH_CLIENT_SECRET_HERE
GOOGLE_OAUTH_REDIRECT_URI=https://sow.qandu.me/api/oauth/callback
```

---

## Steps to Update on EasyPanel

### 1. Go to EasyPanel Control Panel
- URL: https://control.easypanel.io
- Login with your credentials

### 2. Open sow-frontend Service
- Click on **sow-frontend** in your services list
- Look for the **Environment Variables** or **Variables** section

### 3. Replace All Variables
- **Clear existing variables** (or update them)
- **Paste the entire block above** into the environment variables editor

### 4. Deploy Changes
- Click **Save** or **Apply**
- Click **Deploy** or **Redeploy**
- Wait 3-5 minutes for the rebuild to complete

### 5. Verify Deployment
- Go to https://sow.qandu.me
- Open browser DevTools (F12) → Network tab
- Create a new workspace
- Should see `/api/v1/workspace/...` requests succeed (200-201, not 404)

---

## What Changed

| Variable | Old | New | Why |
|----------|-----|-----|-----|
| `NEXT_PUBLIC_ANYTHINGLLM_URL` | Missing | Added | Critical - was causing `/undefined/` 404 errors |
| `NEXT_PUBLIC_BASE_URL` | `http://168.231.115.219:3333` | `https://sow.qandu.me` | Production HTTPS URL |
| All others | Same | Same | No changes needed |

---

## After Deployment

Once EasyPanel redeploys with new variables:

1. ✅ **Workspace creation will work** (no more 404 on `/api/v1/workspace/333/update`)
2. ✅ **New workspaces auto-navigate to SOW editor** (not staying on dashboard)
3. ⏳ **Then delete old master dashboard workspace** in AnythingLLM to fix empty responses

See: `EASYPANEL-FIXES-REQUIRED-OCT22.md` for complete guide

---

## Quick Troubleshooting

**After deployment, still seeing `/undefined/` errors?**
- Hard refresh: `Ctrl+F5` (Clear browser cache)
- Or open in incognito window

**Still getting 404 on workspace update?**
- Check that `NEXT_PUBLIC_ANYTHINGLLM_URL` was actually saved
- Verify URL spelling: `https://ahmad-anything-llm.840tjq.easypanel.host` (no trailing slash)

**Workspace creation crashes?**
- Check DevTools Network tab → `/api/sow/create` → see detailed error
- May need to verify MySQL database is accessible from backend

---

**Status**: Ready to deploy! 🚀
