# Backend Deployment Handover - Critical Issue

## Current State
- **Frontend**: Working at https://sow.qandu.me (Next.js on EasyPanel)
- **Backend**: NOT WORKING - serves Next.js 404 instead of FastAPI
- **Database**: Working (ahmad-mysql-database on EasyPanel)
- **AnythingLLM**: Working
- **Issue**: PDF export fails because backend returns Next.js HTML instead of running FastAPI

## The Problem
EasyPanel socialgarden-backend service is configured incorrectly. It's building/running the frontend (Next.js) instead of the backend (FastAPI).

### What We Know
1. Root cause: EasyPanel has multiple Dockerfiles and picks the wrong one
2. Correct backend Dockerfile: `/backend/Dockerfile` (Python 3.11, FastAPI, uvicorn, port 8000)
3. Wrong Dockerfiles: `/Dockerfile`, `/Dockerfile.frontend`, `/frontend/Dockerfile` (all Node.js/Next.js)
4. Git repo has two branches:
   - `enterprise-grade-ux` = frontend code with latest fixes
   - `backend-service` = backend code with FastAPI

## What Needs to Happen

### Option 1: Fix EasyPanel Service Configuration (RECOMMENDED)
1. In EasyPanel → socialgarden-backend service
2. Source: **GitHub**
3. Settings:
   - Owner: `khaledbashir`
   - Repository: `the11-dev`
   - Branch: `backend-service`
   - Build Path: `/backend`
   - **CRITICAL**: Ensure it explicitly uses `/backend/Dockerfile`
4. Verify it runs: `curl https://ahmad-socialgarden-backend.840tjq.easypanel.host/docs`
   - Should return FastAPI Swagger UI (JSON), NOT 404 HTML

### Option 2: Clean Up Git Repo
If EasyPanel keeps picking wrong Dockerfile:
1. On `backend-service` branch, delete these files (they confuse EasyPanel):
   - `/Dockerfile` (the root one that builds frontend)
   - `/Dockerfile.frontend`
   - `/frontend/Dockerfile`
2. Only keep: `/backend/Dockerfile`
3. Push changes
4. Trigger redeploy in EasyPanel

## Environment Variables (Already Set)
```
DB_HOST=ahmad-mysql-database
DB_PORT=3306
DB_USER=sg_sow_user
DB_PASSWORD=SG_sow_2025_SecurePass!
DB_NAME=socialgarden_sow
ANYTHINGLLM_URL=https://ahmad-anything-llm.840tjq.easypanel.host
ANYTHINGLLM_API_KEY=0G0WTZ3-6ZX4D20-H35VBRG-9059WPA
OPENROUTER_API_KEY=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
```

## Expected Behavior (After Fix)
- Backend returns Swagger UI at `/docs`
- Backend accepts POST to `/generate-pdf` with HTML content
- PDF exports work in frontend
- No more 404 errors

## Test Command
```bash
curl https://ahmad-socialgarden-backend.840tjq.easypanel.host/docs
```
Should return HTML with Swagger UI, not 404 page.

## Git Repos & Branches
- Frontend branch: `enterprise-grade-ux` (working)
- Backend branch: `backend-service` (has FastAPI code but EasyPanel misconfigured)
- Both are in: https://github.com/khaledbashir/the11-dev

## Key Files
- **Backend FastAPI app**: `/backend/main.py`
- **Backend Dockerfile**: `/backend/Dockerfile`
- **Backend dependencies**: `/backend/requirements.txt`
- **Frontend**: `/frontend/` directory

---

**The issue is NOT with the code. The issue is EasyPanel misconfiguration - it's building the wrong Dockerfile.**
