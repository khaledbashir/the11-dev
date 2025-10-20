# 🌱 Social Garden SOW Generator - Easypanel Deployment Guide

## Quick Start (Easypanel)

This project is Easypanel-ready! Deploy in 5 minutes:

### Step 1: Prepare Environment
1. Copy `.env.example` to `.env`
2. Fill in all required values:
   - Database credentials
   - Google OAuth credentials
   - Google Sheets configuration
   - API keys (OpenRouter, AnythingLLM)

### Step 2: Deploy via Easypanel
1. Open Easypanel: http://168.231.115.219:3000
2. Go to **Projects** → **Add New** → **Deploy from Git**
3. Paste this GitHub URL: `https://github.com/khaledbashir/the11-dev`
4. Select branch: `production-latest`
5. Easypanel will auto-detect the Dockerfile
6. Configure environment variables from `.env`
7. Click **Deploy**

### Step 3: Verify
- Frontend: https://sow.qandu.me
- Backend API: http://168.231.115.219:8000

---

## What's Included

### Dockerfiles
- `Dockerfile.frontend` - Next.js 15 + React 18 + TipTap editor
- `Dockerfile.backend` - FastAPI + WeasyPrint + Google Sheets API

### Docker Compose
- `docker-compose.yml` - Production setup with Traefik labels for SSL

### Configuration
- `.env.example` - All required environment variables documented
- `docker-compose.yml` - Services with proper networking

---

## Environment Variables

### Frontend (.env - NEXT_PUBLIC_* are client-side)
```env
NEXT_PUBLIC_ANYTHINGLLM_URL=https://ahmad-anything-llm.840tjq.easypanel.host
NEXT_PUBLIC_PDF_SERVICE_URL=http://backend:8000
NEXT_PUBLIC_BACKEND_URL=http://backend:8000
NEXT_PUBLIC_BASE_URL=https://sow.qandu.me
DB_HOST=your_db_host
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=socialgarden_sow
```

### Backend
```env
GOOGLE_OAUTH_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your_secret
GOOGLE_OAUTH_REDIRECT_URI=https://sow.qandu.me/api/oauth/callback
GOOGLE_SHEETS_FOLDER_ID=your_folder_id
```

---

## Local Development

### Prerequisites
- Node.js 18+
- Python 3.11+
- pnpm (package manager)

### Setup
```bash
# Frontend
cd frontend
pnpm install
pnpm dev  # Runs on http://localhost:3001

# Backend (in new terminal)
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Build Docker Images (Local Testing)
```bash
docker build -f Dockerfile.frontend -t sow-frontend .
docker build -f Dockerfile.backend -t sow-backend .
docker-compose up
```

---

## Features

### SOW Generator
- ✅ Rich text editing (TipTap editor with custom extensions)
- ✅ AI-powered suggestions (via AnythingLLM/OpenRouter)
- ✅ PDF export with custom styling
- ✅ Multi-select workspace management
- ✅ Client collaboration

### Google Sheets Integration
- ✅ OAuth2 authentication (user's workspace account)
- ✅ Auto-share sheets with email
- ✅ Professional formatting and branding

### AI Features
- ✅ Real-time AI text generation
- ✅ Streaming responses for long-form content
- ✅ Client analysis via AnythingLLM

---

## Troubleshooting

### 502 Bad Gateway
- Check backend is running: `curl http://localhost:8000/docs`
- Verify environment variables are set correctly
- Check PM2 logs: `pm2 logs sow-backend`

### OAuth Redirect URI Mismatch
- Ensure `GOOGLE_OAUTH_REDIRECT_URI` matches exactly in Google Cloud Console
- For domain: `https://sow.qandu.me/api/oauth/callback`
- For localhost: `http://localhost:3001/api/oauth/callback`

### PDF Export Fails
- Verify backend has system dependencies installed
- Check WeasyPrint logs in backend console
- Ensure fonts can be downloaded (no firewall block)

---

## Production Checklist

- [ ] Environment variables all set
- [ ] Database backed up
- [ ] SSL certificate valid (should auto-renew via Easypanel)
- [ ] Domain DNS pointing to server IP
- [ ] Google OAuth credentials added to Google Cloud
- [ ] API rate limits configured
- [ ] Monitoring and logging setup

---

## Architecture

```
┌─────────────────────────┐
│  Browser (Client)       │
└───────────┬─────────────┘
            │ HTTPS
┌───────────▼─────────────────────────┐
│  Traefik (Easypanel Reverse Proxy)  │
│  sow.qandu.me → frontend:3001       │
└───────────┬─────────────────────────┘
            │
┌───────────▼──────────┬─────────────────────┐
│  Frontend (Next.js)  │  Backend (FastAPI)  │
│  :3001               │  :8000              │
│                      │                     │
│ - TipTap Editor      │ - OAuth Handler     │
│ - AI Integration     │ - PDF Generation    │
│ - PDF Export UI      │ - Google Sheets API │
└──────────────────────┴─────────────────────┘
            │                    │
            └────────┬───────────┘
                     │
          ┌──────────▼──────────┐
          │ MySQL Database      │
          │ 168.231.115.219:3306│
          └─────────────────────┘
```

---

## Support

For issues or questions:
1. Check the logs: `docker-compose logs -f`
2. Read the copilot-instructions.md for architecture details
3. Refer to DEV_SETUP.md for local development

---

**Ready to deploy!** 🚀
