# Easypanel Deployment Environment Configuration Guide

## Overview

The Easypanel Docker deployment uses environment variables instead of `.env` files. This guide shows how to configure them in Easypanel.

## Environment Variables for Easypanel

Set these in the Easypanel UI under "Environment Variables":

### Database Configuration
```
DB_HOST=168.231.115.219
DB_PORT=3306
DB_USER=sg_sow_user
DB_PASSWORD=SG_sow_2025_SecurePass!
DB_NAME=socialgarden_sow
```

### Backend & PDF Service (Points to Host)
```
NEXT_PUBLIC_PDF_SERVICE_URL=http://168.231.115.219:8000
NEXT_PUBLIC_BACKEND_URL=http://168.231.115.219:8000
```

### Base URL (Easypanel Subdomain)
```
NEXT_PUBLIC_BASE_URL=https://ahmad-sow-qandu-me.840tjq.easypanel.host
```

### AnythingLLM Integration
```
NEXT_PUBLIC_ANYTHINGLLM_URL=https://ahmad-anything-llm.840tjq.easypanel.host
ANYTHINGLLM_API_KEY=0G0WTZ3-6ZX4D20-H35VBRG-9059WPA
ANYTHINGLLM_WORKSPACE_SLUG=pop
```

### OpenRouter API (for AI Writing Assistant)
```
OPENROUTER_API_KEY=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
```

### Google OAuth Integration
```
GOOGLE_OAUTH_CLIENT_ID=<oauth-client-id>
GOOGLE_OAUTH_CLIENT_SECRET=<oauth-client-secret>
GOOGLE_OAUTH_REDIRECT_URI=https://ahmad-sow-qandu-me.840tjq.easypanel.host/api/oauth/callback
```

### Google Sheets Integration (Service Account)
```
GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL=<service-email>
GOOGLE_SHEETS_PROJECT_ID=<project-id>
GOOGLE_SHEETS_PRIVATE_KEY_ID=<key-id>
GOOGLE_SHEETS_AUTO_SHARE_EMAIL=ahmad.basheer@socialgarden.com.au
```

## Step-by-Step Instructions for Easypanel

### 1. Access Easypanel Dashboard
- Go to: https://dashboard.easypanel.io
- Navigate to your project: `ahmad-sow-qandu-me`

### 2. Edit Service Configuration
1. Click on the service: `ahmad_sow-qandu-me` (the frontend container)
2. Click "Edit"
3. Scroll to "Environment Variables" section

### 3. Add All Variables
Copy and paste each variable from the sections above into the Environment Variables field. Format:
```
KEY=VALUE
KEY2=VALUE2
```

### 4. Save and Redeploy
1. Click "Save"
2. Wait for container to rebuild and restart
3. Test the application at: https://ahmad-sow-qandu-me.840tjq.easypanel.host

## Important Notes

### Backend URL Resolution
- The Docker container runs on Easypanel servers
- The backend (FastAPI on port 8000) runs on the host machine (168.231.115.219)
- Use `168.231.115.219:8000` to reach the backend from the Docker container
- **NOT** `127.0.0.1:8000` (that would be localhost inside the container)

### Secrets Management
- Never commit `.env` files to GitHub
- Store all secrets in Easypanel UI
- Use the `.env.local` file for local development only
- GitHub Actions should use GitHub Secrets, not `.env` files

### Multi-Environment Setup
If you need multiple environments:
- **Development**: Use `.env.local` with localhost URLs
- **Staging**: Use Easypanel environment variables with staging URLs
- **Production**: Use Easypanel environment variables with production URLs

## Verification After Deployment

After setting environment variables and redeploying:

1. **Check Folders Load**:
   ```javascript
   // Browser console
   // Should see: "Loaded folders from database: 45"
   ```

2. **Test PDF Export**:
   - Open a SOW
   - Click "Export PDF"
   - Should generate PDF from backend at port 8000

3. **Test Google Sheets**:
   - Click "GSheet" button
   - Should redirect to Google OAuth
   - Should create sheet in workspace

4. **Test AnythingLLM**:
   - Should load Gardners from AnythingLLM
   - Should see "Loaded 8 Gardners" in console

## Troubleshooting

### "Cannot connect to 127.0.0.1:8000"
**Solution**: Backend URL in environment is set to localhost. Update to `168.231.115.219:8000`

### "Failed to get authorization URL" (OAuth)
**Solution**: Check that `GOOGLE_OAUTH_REDIRECT_URI` matches the Easypanel domain exactly

### "Cannot reach AnythingLLM"
**Solution**: Verify `NEXT_PUBLIC_ANYTHINGLLM_URL` is set to the correct Easypanel subdomain

### Database connection refused
**Solution**: Verify `DB_HOST`, `DB_USER`, and `DB_PASSWORD` are correct in environment variables

## Current Deployment Status

✅ **Frontend Docker**: Deployed to Easypanel
✅ **Backend (FastAPI)**: Running on host at port 8000
✅ **Database**: MySQL on 168.231.115.219:3306
✅ **Folders API**: Working (direct database access)
⚠️ **Environment Variables**: Need to be updated in Easypanel UI

---

**Last Updated**: October 20, 2024
**Status**: Ready for Easypanel environment variable configuration
