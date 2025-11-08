# GitHub Copilot Instructions for the11-dev Project

## 🚨 CRITICAL: Read This First

You are working on a **monorepo with multiple services** deployed separately on EasyPanel. **DO NOT** assume this is a single application!

### Services Overview
- **Frontend**: Next.js app (runs on `enterprise-grade-ux` branch)
- **Backend**: FastAPI service (runs on `backend-service` branch)
- **Database**: MySQL (EasyPanel managed, internal hostname only)
- **AnythingLLM**: External AI service (separate instance)

## 🔀 Branch Management (CRITICAL)

### Frontend Changes
- **ALWAYS** commit to `enterprise-grade-ux` branch
- **NEVER** commit frontend changes to `backend-service` branch
- Frontend code lives in `/frontend` directory

### Backend Changes
- **ALWAYS** commit to `backend-service` branch
- **NEVER** commit backend changes to `enterprise-grade-ux` branch
- Backend code lives in `/backend` directory

### How to Switch Branches
```bash
# For frontend work
git checkout enterprise-grade-ux

# For backend work
git checkout backend-service
```

## 🌐 Environment Variables (CRITICAL)

### Frontend Environment (Browser-visible)
```bash
NEXT_PUBLIC_ANYTHINGLLM_URL=https://ahmad-anything-llm.840tjq.easypanel.host
NEXT_PUBLIC_PDF_SERVICE_URL=https://ahmad-socialgarden-backend.840tjq.easypanel.host
NEXT_PUBLIC_BASE_URL=https://sow.qandu.me
NEXT_PUBLIC_API_URL=https://sow.qandu.me
```

### Database Connection (Internal Only)
```bash
DB_HOST=ahmad-mysql-database  # NOT localhost!
DB_PORT=3306
DB_USER=sg_sow_user
DB_PASSWORD=SG_sow_2025_SecurePass!
DB_NAME=socialgarden_sow
```

## 🚀 Deployment Workflow

1. **Push to correct branch** → EasyPanel auto-detects → rebuilds → deploys
2. **Frontend**: `https://sow.qandu.me`
3. **Backend**: `https://ahmad-socialgarden-backend.840tjq.easypanel.host`
4. **Wait 5-10 minutes** for deployment

## 🐛 Common Issues & Fixes

### PDF Export Button Not Working
- Frontend calls: `NEXT_PUBLIC_PDF_SERVICE_URL/generate-pdf`
- Backend has: `/generate-pdf` endpoint (NOT `/generate-professional-pdf`)
- Check backend logs if PDF generation fails

### Database Connection Issues
- **ALWAYS** use `ahmad-mysql-database` (internal hostname)
- **NEVER** use `localhost` or external IPs
- Port is `3306`

### CORS Errors
- Backend allows all origins: `allow_origins=["*"]`
- Should work from any domain

### Service Communication
```
Frontend → Backend: https://ahmad-socialgarden-backend.840tjq.easypanel.host
Frontend → Database: ahmad-mysql-database:3306
Backend → Database: ahmad-mysql-database:3306
```

## 📁 File Structure
```
/frontend     # Next.js (enterprise-grade-ux branch)
/backend      # FastAPI (backend-service branch)
/.kilocode/rules/easypanel.md  # Detailed deployment guide
```

## 🔧 Development Commands

### Frontend (in /frontend directory)
```bash
npm install
npm run dev    # Local development
npm run build  # Production build
```

### Backend (in /backend directory)
```bash
source venv/bin/activate
pip install -r requirements.txt
python main.py  # Local development
```

## ✅ Verification After Deployment

```bash
# Frontend health
curl https://sow.qandu.me

# Backend health
curl https://ahmad-socialgarden-backend.840tjq.easypanel.host/health
# Should return: {"status": "healthy", "service": "Social Garden PDF Service"}
```

## 📝 Commit Message Format
```
feat: add new PDF export feature
fix: resolve database connection issue
docs: update deployment instructions
```

## 🚨 REMINDERS
- **Branch matters!** Frontend ≠ Backend
- **Environment variables are set in EasyPanel UI** (not auto-synced)
- **Database hostname is `ahmad-mysql-database`** (internal only)
- **Push triggers auto-deployment** (no manual steps needed)
- **Check EasyPanel logs** if deployment fails