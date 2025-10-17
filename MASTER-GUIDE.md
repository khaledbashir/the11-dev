# 📘 MASTER DEVELOPMENT GUIDE - THE ONLY DOC YOU NEED

**⚠️ IMPORTANT FOR AI ASSISTANTS:**  
**DO NOT CREATE NEW DOCS. EDIT THIS ONE.**  
This is the single source of truth. Update this file as the project evolves.  
No new markdown files. Just maintain this one. Keep it organized.

---

## 🚀 QUICK START (30 SECONDS)

```bash
cd /root/the11
./dev.sh
```

**Opens:**
- Frontend: http://localhost:3333
- Backend: http://localhost:8000

**That's it.** Hot reload works. Start coding.

---

## 📦 HOW TO BUILD FOR PRODUCTION

### Option 1: Using Docker (Recommended)
```bash
cd /root/the11
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

### Option 2: Manual Build
```bash
# Build Frontend
cd /root/the11/frontend
pnpm install
pnpm build
# Output: /root/the11/frontend/.next/

# Build Backend (no build needed - Python)
cd /root/the11/backend
source venv/bin/activate
pip install -r requirements.txt
```

### Option 3: Production Deployment
```bash
# Frontend (with PM2)
cd /root/the11/frontend
pm2 start "pnpm start" --name sow-frontend

# Backend (with PM2)  
cd /root/the11/backend
pm2 start "uvicorn main:app --host 0.0.0.0 --port 8000" --name sow-backend
```

---

## 🏗️ PROJECT STRUCTURE

```
/root/the11/
├── frontend/              ← Next.js 15 (React 18, TypeScript)
│   ├── app/               ← Pages (App Router)
│   ├── components/        ← React components
│   ├── lib/               ← Utils, DB connections, AI logic
│   ├── public/            ← Static assets
│   └── package.json       ← Dependencies
│
├── backend/               ← FastAPI (Python)
│   ├── main.py            ← PDF generation API
│   ├── requirements.txt   ← Python packages
│   └── venv/              ← Virtual environment
│
├── database/              ← MySQL schemas
│   ├── schema.sql         ← Full database schema (12 tables)
│   └── init.sql           ← Initial setup
│
├── docs/                  ← Additional documentation
│   └── archive/           ← Old session notes (ignore)
│
├── dev.sh                 ← Start development (ONE COMMAND)
├── .env.example           ← Environment variables template
├── .gitignore             ← Git ignore rules
└── README.md              ← Quick reference
```

---

## 🔧 ENVIRONMENT SETUP

### 1. Copy Environment Variables
```bash
cp .env.example .env
```

### 2. Configure .env File
```bash
# Database (Remote MySQL)
DB_HOST=168.231.115.219
DB_USER=sg_sow_user
DB_PASSWORD=SG_sow_2025_SecurePass!
DB_NAME=socialgarden_sow
DB_PORT=3306

# AnythingLLM (AI Chat Integration)
ANYTHINGLLM_URL=https://ahmad-anything-llm.840tjq.easypanel.host
ANYTHINGLLM_API_KEY=0G0WTZ3-6ZX4D20-H35VBRG-9059WPA

# OpenAI/OpenRouter (For AI Features)
OPENROUTER_API_KEY=your_key_here
# OR
OPENAI_API_KEY=your_key_here

# App URLs
NEXT_PUBLIC_BASE_URL=http://localhost:3333
NEXT_PUBLIC_API_URL=http://localhost:8000
FRONTEND_PORT=3333
```

### 3. Install Dependencies

**Frontend:**
```bash
cd /root/the11/frontend
pnpm install
```

**Backend:**
```bash
cd /root/the11/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## 🐛 CURRENT ISSUES & FIXES

### ❌ Issue: API Errors (500, 404, 405)
**Errors seen:**
```
Failed to load resource: 500 (Internal Server Error)
/api/folders
/api/dashboard/stats

Failed to load resource: 404 (Not Found)
/api/agents/architect

Failed to load resource: 405 (Method Not Allowed)
/api/preferences/current_agent_id
```

**Root Cause:** API routes missing or not properly connected to database.

**Fix Needed:**
1. Check `/frontend/app/api/folders/route.ts` exists
2. Check `/frontend/app/api/dashboard/stats/route.ts` exists
3. Verify database connection in `lib/db.ts`
4. Check MySQL credentials are correct

**Quick Test:**
```bash
# Test database connection
mysql -h 168.231.115.219 -u sg_sow_user -p'SG_sow_2025_SecurePass!' socialgarden_sow -e "SHOW TABLES;"

# Should show 12 tables
```

### ❌ Issue: Console.log Debug Spam
**Errors seen:**
```
🔍 [AgentSidebar] onInsertToEditor prop: Available ✅
🔍 [AgentSidebar] Chat messages count: 0
page.tsx:365 🔍 useEffect running, mounted: false
```

**Fix:** Remove debug logs from production code.

**Files to clean:**
- `/frontend/app/page.tsx` - 20+ console.logs
- `/frontend/components/tailwind/agent-sidebar-clean.tsx` - 7 console.logs
- `/frontend/lib/anythingllm.ts` - 20+ console.logs

**Command to find all console.logs:**
```bash
cd /root/the11/frontend
grep -rn "console.log" app/ components/ lib/ | grep -v node_modules
```

**Status:** TODO - Will clean in production build

---

### ✅ FIXED: TipTap Build Error
**Error seen:**
```
Attempted import error: '__serializeForClipboard' is not exported from '@tiptap/pm/view'
```

**Root Cause:** The `novel` package dependency `tiptap-extension-global-drag-handle@0.1.16` was incompatible with TipTap 2.11.2.

**Solution Applied:**
Added pnpm override in `package.json` to replace the problematic package:
```json
"pnpm": {
  "overrides": {
    "tiptap-extension-global-drag-handle": "npm:@tiptap/extension-bubble-menu@^2.11.2"
  }
}
```

**Commands used:**
```bash
cd /root/the11/frontend
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

**Result:** ✅ Build works, app starts successfully

---

## ✅ FEATURES IMPLEMENTED

### Core Features
- ✅ **Rich Text Editor** - TipTap/ProseMirror
- ✅ **Pricing Tables** - 82 roles, drag-drop, auto calculations
- ✅ **AI Chat** - Streaming responses, The Architect agent
- ✅ **PDF Export** - WeasyPrint with Social Garden branding
- ✅ **Excel Export** - Pricing data to .xlsx
- ✅ **Folder Management** - Organize SOWs in folders
- ✅ **Database Persistence** - MySQL storage
- ✅ **Client Portal** - Share SOWs with clients
- ✅ **AnythingLLM Integration** - AI workspace per client

### Database Tables (12 tables)
```sql
folders                  -- Folder hierarchy
documents                -- SOW documents with full content
sows                     -- Client-facing SOW metadata
agents                   -- AI agent configurations
ai_conversations         -- Chat history
chat_messages            -- Message details
sow_activities           -- Client engagement tracking
sow_comments             -- Client comments on SOWs
sow_acceptances          -- Digital signatures
sow_rejections           -- Rejection tracking
user_preferences         -- User settings
active_sows_dashboard    -- Dashboard aggregated view
```

---

## 📝 DEVELOPMENT WORKFLOW

### Daily Development
```bash
# 1. Start services
cd /root/the11
./dev.sh

# 2. Edit files (changes appear instantly)
# - Frontend: /root/the11/frontend/
# - Backend: /root/the11/backend/

# 3. Check logs if needed
tail -f /tmp/frontend.log
tail -f /tmp/backend.log

# 4. Stop services
Ctrl+C
```

### Git Workflow
```bash
# Check status
git status

# Add changes
git add -A

# Commit
git commit -m "feat: description of changes"

# Push
git push origin streaming-reasoning-model-feature
```

---

## 🔍 TROUBLESHOOTING

### Port Already in Use
```bash
# Kill processes on port 3333
lsof -ti:3333 | xargs kill -9

# Kill processes on port 8000
lsof -ti:8000 | xargs kill -9

# Restart
./dev.sh
```

### Database Connection Errors
```bash
# Test connection
mysql -h 168.231.115.219 -u sg_sow_user -p'SG_sow_2025_SecurePass!' socialgarden_sow -e "SELECT 1;"

# Check credentials in .env
cat /root/the11/frontend/.env | grep DB_
```

### Frontend Not Loading
```bash
# Check if Next.js is running
ps aux | grep next-server

# Check logs
tail -f /tmp/frontend.log

# Clear cache and restart
cd /root/the11/frontend
rm -rf .next
pnpm dev
```

### Backend Not Responding
```bash
# Check if uvicorn is running
ps aux | grep uvicorn

# Check logs
tail -f /tmp/backend.log

# Restart backend
cd /root/the11/backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### API Errors (500, 404, 405)
```bash
# Check API routes exist
ls /root/the11/frontend/app/api/

# Verify database connection
cd /root/the11/frontend
grep -r "createPool" lib/

# Test API endpoint directly
curl http://localhost:3333/api/folders
curl http://localhost:8000/health
```

---

## 🎯 TODO CHECKLIST

### Phase 1: Fix Current Issues ⏳
- [ ] Remove all console.log debug statements
- [ ] Fix `/api/folders` 500 error
- [ ] Fix `/api/dashboard/stats` 500 error
- [ ] Fix `/api/agents/architect` 404 error
- [ ] Fix `/api/preferences/current_agent_id` 405 error
- [ ] Verify database connection working
- [ ] Test all features end-to-end

### Phase 2: Production Hardening 📦
- [ ] Add error boundaries to React components
- [ ] Add API error handling
- [ ] Add loading states for all async operations
- [ ] Add health check endpoints
- [ ] Configure monitoring/logging
- [ ] Add rate limiting
- [ ] Security audit

### Phase 3: Documentation 📚
- [ ] Update this doc with solutions to issues found
- [ ] Document all API endpoints
- [ ] Add architecture diagrams
- [ ] Create deployment runbook

### Phase 4: Testing 🧪
- [ ] Manual testing of all features
- [ ] Database stress testing
- [ ] PDF generation testing
- [ ] AI chat testing
- [ ] Client portal testing

---

## 📊 TECH STACK

### Frontend
- **Framework:** Next.js 15.1.4
- **UI Library:** React 18.2.0
- **Language:** TypeScript 5.4.2
- **Editor:** TipTap 2.11.2, ProseMirror
- **Styling:** Tailwind CSS 3.3.0
- **Components:** Radix UI
- **AI SDK:** OpenAI SDK, Vercel AI SDK
- **Database Client:** mysql2 3.6.5

### Backend
- **Framework:** FastAPI
- **Server:** Uvicorn
- **PDF Generation:** WeasyPrint
- **Templates:** Jinja2
- **Validation:** Pydantic

### Database
- **Database:** MySQL 8.0
- **Host:** 168.231.115.219:3306
- **Schema:** 12 tables, fully normalized

### External Services
- **AI Chat:** AnythingLLM (ahmad-anything-llm.840tjq.easypanel.host)
- **AI Models:** OpenAI GPT-4, Claude (via OpenRouter)

---

## 🔐 SECURITY NOTES

### Environment Variables
- Never commit `.env` file
- Use `.env.example` as template
- Rotate API keys regularly
- Use different keys for dev/prod

### Database
- Uses password authentication
- Remote MySQL server
- Connection pooling enabled
- SSL/TLS should be enabled (TODO)

### API Keys
- AnythingLLM API key: Rotate every 90 days
- OpenAI/OpenRouter keys: Monitor usage, set limits

---

## 🚢 DEPLOYMENT GUIDE

### Pre-Deployment Checklist
- [ ] All tests passing
- [ ] No console.log statements
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] SSL certificates ready
- [ ] Domain configured
- [ ] Monitoring setup

### Production Environment
```bash
# Set production env vars
export NODE_ENV=production
export NEXT_PUBLIC_BASE_URL=https://your-domain.com
export NEXT_PUBLIC_API_URL=https://api.your-domain.com

# Build
cd /root/the11/frontend
pnpm build

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Docker Deployment
```bash
# Build
docker-compose -f docker-compose.prod.yml build

# Deploy
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

---

## 📞 SUPPORT & CONTACTS

### Key Files for Reference
- **This file:** `/root/the11/MASTER-GUIDE.md` - Update this, not create new docs
- **README:** `/root/the11/README.md` - Quick reference only
- **Delivery Doc:** `/root/the11/DELIVERY-COMPLETE.md` - Handoff summary

### When Things Break
1. Check this doc's Troubleshooting section
2. Check logs: `/tmp/frontend.log` and `/tmp/backend.log`
3. Test database connection
4. Check if services are running: `ps aux | grep -E "next|uvicorn"`

---

## 🎨 CODE STYLE GUIDELINES

### Frontend (TypeScript/React)
- Use functional components with hooks
- TypeScript strict mode
- Prettier for formatting
- ESLint for linting
- Tailwind for styling (no CSS files)

### Backend (Python)
- Type hints everywhere
- FastAPI async/await
- Pydantic for validation
- Black for formatting

### Git Commits
```bash
feat: Add new feature
fix: Bug fix
docs: Documentation only
refactor: Code refactoring
chore: Maintenance tasks
```

---

## 📈 PERFORMANCE NOTES

### Frontend
- Next.js Image Optimization enabled
- Dynamic imports for heavy components
- React.memo for expensive renders
- Debounced search/input handlers

### Backend
- Async endpoints everywhere
- Connection pooling for database
- PDF generation in background tasks
- Response caching where appropriate

---

## 🔄 UPDATE LOG

### October 17, 2025 - Session 1
- ✅ Flattened project structure (removed nested monorepo)
- ✅ Consolidated 44 docs → 3 main docs
- ✅ Fixed git tracking (removed venv files)
- ✅ Created .env.example with all variables
- ✅ Updated dev.sh for new structure

### October 17, 2025 - Session 2 (Current)
- ✅ Created MASTER-GUIDE.md as single source of truth
- ✅ Fixed TipTap build error (pnpm override for tiptap-extension-global-drag-handle)
- ✅ Fixed dev.sh backend startup (venv pip install logic)
- ✅ App running successfully on http://localhost:3333
- ⏳ **CURRENT:** Testing API errors, need to verify database connection

### Next Update
- Will add: Solutions to API errors (folders, dashboard, agents)
- Will add: Console.log cleanup
- Will add: Production deployment checklist

---

**📝 REMEMBER: Edit this file. Don't create new docs. Keep it organized. Keep it updated.**

**Last Updated:** October 17, 2025  
**Status:** � Running (Fixing API errors)  
**Version:** 1.0.1
