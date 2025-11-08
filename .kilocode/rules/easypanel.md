# EasyPanel Deployment Configuration & Setup Guide

## 🏗️ **CRITICAL: Architecture Overview**

This is a **monorepo** (single GitHub repo) with **MULTIPLE independent services** deployed separately on EasyPanel:

### Services Configuration

#### 1. **FRONTEND Service**
- **Repository**: `khaledbashir/the11-dev`
- **Branch**: `enterprise-grade-ux`
- **Build Path**: `/` (root)
- **Dockerfile**: `/frontend/Dockerfile`
- **Build Output**: Next.js application on port 3333
- **Production URL**: `https://sow.qandu.me`
- **Instance**: `ahmad-socialgarden-frontend` (or similar)

#### 2. **BACKEND Service**
- **Repository**: `khaledbashir/the11-dev`
- **Branch**: `backend-service` ⚠️ **DIFFERENT BRANCH!**
- **Build Path**: `/backend`
- **Dockerfile**: `/backend/Dockerfile`
- **Build Output**: FastAPI service on port 8000
- **Internal URL**: `https://ahmad-socialgarden-backend.840tjq.easypanel.host`
- **Instance**: `ahmad-socialgarden-backend` (or similar)
- **Purpose**: PDF generation, Google Sheets creation, OAuth handling

#### 3. **DATABASE Service**
- **Type**: MySQL 8.0
- **Hostname**: `ahmad-mysql-database` (internal EasyPanel network only)
- **Port**: 3306
- **Credentials**: See environment variables below

#### 4. **ANYTHINGLLM Instance** (External)
- **URL**: `https://ahmad-anything-llm.840tjq.easypanel.host`
- **API Key**: Configured in both frontend & backend
- **Purpose**: AI chat, document embedding, workspace management
- **Managed separately** (not part of this repo)

---

## ⚙️ **CRITICAL ENVIRONMENT VARIABLES**

### Frontend Environment (`NEXT_PUBLIC_*` variables are exposed to browser)

```bash
# These MUST be set in EasyPanel Frontend service environment:

# AnythingLLM Integration (PUBLIC - visible to browser)
NEXT_PUBLIC_ANYTHINGLLM_URL=https://ahmad-anything-llm.840tjq.easypanel.host
NEXT_PUBLIC_ANYTHINGLLM_API_KEY=0G0WTZ3-6ZX4D20-H35VBRG-9059WPA

# PDF Service (PUBLIC - frontend needs to call backend)
NEXT_PUBLIC_PDF_SERVICE_URL=https://ahmad-socialgarden-backend.840tjq.easypanel.host

# Base URLs (PUBLIC)
NEXT_PUBLIC_BASE_URL=https://sow.qandu.me
NEXT_PUBLIC_API_URL=https://sow.qandu.me

# Database (PRIVATE - frontend backend server needs this)
DB_HOST=ahmad-mysql-database
DB_PORT=3306
DB_USER=sg_sow_user
DB_PASSWORD=SG_sow_2025_SecurePass!
DB_NAME=socialgarden_sow

# API Keys
OPENROUTER_API_KEY=<YOUR_OPENROUTER_API_KEY>
GROQ_API_KEY=<YOUR_GROQ_API_KEY>
```

### Backend Environment

```bash
# Database (PRIVATE - backend service needs this)
DB_HOST=ahmad-mysql-database
DB_PORT=3306
DB_USER=sg_sow_user
DB_PASSWORD=SG_sow_2025_SecurePass!
DB_NAME=socialgarden_sow

# AnythingLLM Integration
ANYTHINGLLM_URL=https://ahmad-anything-llm.840tjq.easypanel.host
ANYTHINGLLM_API_KEY=0G0WTZ3-6ZX4D20-H35VBRG-9059WPA

# API Keys
OPENROUTER_API_KEY=<YOUR_OPENROUTER_API_KEY>
```

---

## 🔄 **DEPLOYMENT WORKFLOW**

### When You Push Code

1. **Push to GitHub**
   ```bash
   git push origin enterprise-grade-ux  # Frontend changes
   git push origin backend-service      # Backend changes
   ```

2. **EasyPanel Auto-Detection** ⚡
   - Detects commits on watched branches
   - Automatically triggers builds for each service
   - **NO manual trigger needed** (if webhooks are configured)

3. **Build Process** (per service)
   - Pulls code from specified branch
   - Uses Dockerfile at specified path
   - Builds Docker image
   - Deploys container
   - Logs available in EasyPanel UI

4. **Expected Timeline**
   - Frontend build: ~3-5 minutes
   - Backend build: ~2-3 minutes
   - Total deployment time: ~10 minutes

### Backend Branch ⚠️ CRITICAL

- **Backend runs on `backend-service` branch** (NOT `enterprise-grade-ux`)
- Frontend runs on `enterprise-grade-ux` branch
- **DO NOT mix them up** - each branch has different code!
- When fixing backend issues, commit to `backend-service`
- When fixing frontend issues, commit to `enterprise-grade-ux`

---

## 🔗 **INTERNAL NETWORKING**

Within EasyPanel cluster, services communicate using internal hostnames:

```
Frontend → Backend:    https://ahmad-socialgarden-backend.840tjq.easypanel.host
Frontend → Database:   ahmad-mysql-database:3306
Frontend → AnythingLLM: https://ahmad-anything-llm.840tjq.easypanel.host
Backend → Database:    ahmad-mysql-database:3306
Backend → AnythingLLM: https://ahmad-anything-llm.840tjq.easypanel.host
```

**External access** (from browser):
- Frontend: `https://sow.qandu.me`
- Backend: `https://ahmad-socialgarden-backend.840tjq.easypanel.host`
- Database: NOT exposed (internal only)

---

## 🐛 **TROUBLESHOOTING CHECKLIST**

### PDF Export Button Not Working
1. ✅ Check frontend calling correct backend URL: `NEXT_PUBLIC_PDF_SERVICE_URL`
2. ✅ Verify backend has `/generate-pdf` endpoint (not `/generate-professional-pdf`)
3. ✅ Confirm `ahmad-socialgarden-backend` service is running
4. ✅ Check backend logs for PDF generation errors
5. ✅ Verify CORS headers allow the frontend domain

### Frontend Build Fails
1. Check build logs in EasyPanel UI
2. Common causes: Missing `NEXT_PUBLIC_*` env vars, TypeScript errors
3. Local test: `npm run build` in `/frontend`

### Backend Build Fails
1. Check build logs in EasyPanel UI
2. Common causes: Missing dependencies in `requirements.txt`, Python syntax errors
3. Verify Dockerfile is using correct Python version
4. Test locally: Try running `main.py` with same Python version

### Database Connection Issues
1. Verify hostname is `ahmad-mysql-database` (NOT localhost)
2. Verify credentials match MySQL service configuration
3. Test connection from backend logs

### Service Not Deploying
1. Check if GitHub webhook is configured in EasyPanel
2. Verify branch name matches exactly (case-sensitive)
3. Check if build path exists in repo (`/` for frontend, `/backend` for backend)

---

## 📝 **COMMON TASKS FOR AI**

### To fix a Frontend issue:
1. Switch to `enterprise-grade-ux` branch: `git checkout enterprise-grade-ux`
2. Make changes in `/frontend` directory
3. Test locally: `npm run dev` in `/frontend`
4. Commit and push: `git push origin enterprise-grade-ux`
5. Wait for EasyPanel to rebuild and deploy
6. Test at `https://sow.qandu.me`

### To fix a Backend issue:
1. Switch to `backend-service` branch: `git checkout backend-service`
2. Make changes in `/backend` directory
3. Test locally: `python main.py` in `/backend` (with venv activated)
4. Commit and push: `git push origin backend-service`
5. Wait for EasyPanel to rebuild and deploy
6. Test at `https://ahmad-socialgarden-backend.840tjq.easypanel.host`

### To add/update Environment Variables:
1. Update in EasyPanel UI (Settings → Environment)
2. Redeploy affected service (trigger rebuild)
3. Verify changes with: `docker exec <container> echo $VAR_NAME`

### To rollback a deployment:
1. In EasyPanel, find the service
2. Deploy button → Select previous working commit
3. Redeploy

---

## 🚀 **QUICK REFERENCE**

| Item | Frontend | Backend |
|------|----------|---------|
| **GitHub Branch** | `enterprise-grade-ux` | `backend-service` |
| **Build Path** | `/` | `/backend` |
| **Port** | 3333 | 8000 |
| **Technology** | Next.js (Node.js) | FastAPI (Python) |
| **Entry Point** | `next start` | `uvicorn main:app --host 0.0.0.0 --port 8000` |
| **Primary URL** | https://sow.qandu.me | https://ahmad-socialgarden-backend.840tjq.easypanel.host |

---

## ✅ **VERIFICATION COMMANDS**

After deployment, verify everything works:

```bash
# Check frontend is running
curl https://sow.qandu.me

# Check backend is running
curl https://ahmad-socialgarden-backend.840tjq.easypanel.host/health

# Should return: {"status": "healthy", "service": "Social Garden PDF Service"}
```

---

## 📚 **REFERENCE DOCS**
- See EASYPANEL-PRODUCTION-REFERENCE.md for advanced config
- See /backend/README.md for backend-specific setup
- See /frontend/README.md for frontend-specific setup
