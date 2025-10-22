# EasyPanel Build Timeout - Troubleshooting & Workaround (Oct 22, 2025)

## Problem

Build keeps getting canceled at: `RUN pnpm build` phase  
**Error**: `Canceled: context canceled`  
**Cause**: EasyPanel build timeout (likely 10-15 min limit) during Next.js compilation

---

## Solutions (Try in Order)

### Solution 1: Check if Build Actually Succeeded ✅ (TRY FIRST)

Even though the build log says "CANCELED", the deployment might have worked.

**Test**:
1. Go to https://sow.qandu.me
2. Try the app
3. If it works → Build succeeded, just bad logging
4. If it shows old version → Build failed, need retry

---

### Solution 2: Manually Set Environment Variables First

Sometimes builds timeout because they can't access env vars properly.

**Do this BEFORE retrying build**:

1. Go to EasyPanel → sow-frontend → **Environment Variables**
2. Add all variables from `EASYPANEL-ENV-VARS-READY-TO-COPY.md`
3. **Save** (don't deploy yet)
4. Then go to **Code** section
5. Click **Redeploy** 
6. Wait for build

---

### Solution 3: Reduce Build Timeout (EasyPanel Setting)

If builds keep failing after env vars:

1. Go to EasyPanel → sow-frontend → **Settings**
2. Look for "Build Timeout" or "Build Time Limit"
3. Increase if possible (some plans allow custom timeouts)
4. If not available, contact EasyPanel support

---

### Solution 4: Use Pre-built Docker Image (Alternative)

If builds keep timing out, use pre-built image instead:

1. Build locally (if you have Docker):
   ```bash
   cd /root/the11-dev/frontend
   docker build -t sow-frontend:latest .
   docker tag sow-frontend:latest YOUR-DOCKER-USERNAME/sow-frontend:latest
   docker push YOUR-DOCKER-USERNAME/sow-frontend:latest
   ```

2. On EasyPanel:
   - Click **Change Image**
   - Use: `YOUR-DOCKER-USERNAME/sow-frontend:latest`
   - Deploy

---

## What to Check If Still Failing

1. **Is the code actually building locally?**
   ```bash
   cd /root/the11-dev/frontend
   pnpm install
   pnpm build
   ```
   If this fails locally, fix the code first before retrying EasyPanel.

2. **Check EasyPanel Build Logs for Errors**
   - Go to sow-frontend → **Build Logs**
   - Scroll to find the actual error (not just "CANCELED")
   - May be a TypeScript error or missing dependency

3. **Check Service Status**
   - Go to sow-frontend → **Status**
   - Is it showing "Running" despite build failure?
   - If yes, old version is still running

---

## Immediate Action: Check If Site Works Now

The most likely scenario: Build succeeded despite the log saying "CANCELED"

**Test Right Now**:
```
1. Go to https://sow.qandu.me
2. Open DevTools (F12)
3. Go to Network tab
4. Try creating a workspace
5. Look for /api/v1/workspace/ request
6. Should be 200/201, not 404
```

If you see `/api/v1/workspace/333/update` working (not 404), then:
- ✅ Build succeeded
- ✅ Code deployed
- ⏳ Just need to set env vars (Step 2 in checklist)

---

## Why This Happens

Next.js builds are **HEAVY**:
- Full TypeScript compilation
- Full ESLint checking
- Full bundling & optimization
- Can take 5-15+ minutes depending on code size

EasyPanel's build environment has limited resources, so:
- Builds take long
- If exceeding time limit → automatic cancel
- But sometimes code is already deployed anyway

---

## Next Steps

1. **Check if site works** (test https://sow.qandu.me)
2. **If working**: Skip build, just add env vars
3. **If not working**: Try retry with env vars set first
4. **If still failing**: Share the detailed build log error

---

## TL;DR

**Most likely**: Build actually worked, just bad logging  
**Test**: Go to https://sow.qandu.me and try creating a workspace  
**If works**: Just add env vars from EASYPANEL-ENV-VARS-READY-TO-COPY.md and you're done  
**If doesn't work**: Retry deploy after setting env vars first
