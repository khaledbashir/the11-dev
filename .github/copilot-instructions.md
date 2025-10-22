<!-- Copilot instructions for contributors and AI assistants -->
# Quick Onboard: the11-dev (Social Garden SOW Generator)

This file is the **single source of truth** for understanding this codebase. Reference `ARCHITECTURE-SINGLE-SOURCE-OF-TRUTH.md` for comprehensive architectural details.

## Architecture (Big Picture)

**Multi-layer system with THREE distinct AI subsystems:**

- **Frontend:** Next.js 15.1 app (`frontend/app/`) - React + TipTap rich editor for SOW authoring. UI routes at `frontend/app/*`, API routes at `frontend/app/api/*`.
- **Backend PDF service:** FastAPI (`backend/main.py`) - renders HTML → PDF via WeasyPrint. Port 8000. Jinja2 templates + Social Garden brand CSS.
- **Persistence:** MySQL 8.0 (`database/schema.sql`) - SOW documents, activity tracking, AnythingLLM metadata.
- **AI Integration:** AnythingLLM (workspaces + embeddings) + OpenRouter (inline editor).

**Key concept:** `frontend/lib/anythingllm.ts` orchestrates multi-workspace AI strategy. One workspace per client + one master dashboard workspace for cross-client analytics.

## Three AI Systems (CRITICAL)

Before editing ANY AI-related code, understand this architecture:

| System | Purpose | Backend | Endpoint | Status |
|--------|---------|---------|----------|--------|
| **Dashboard AI** | Query all SOWs across workspaces | AnythingLLM master workspace | `/api/anythingllm/stream-chat` | ⚠️ 401 error |
| **Gen AI** | Generate new SOWs (The Architect) | AnythingLLM gen-the-architect workspace | `/api/anythingllm/stream-chat` | ⚠️ 401 error |
| **Inline Editor AI** | Inline text generation in editor | OpenRouter (direct) | `/api/generate` | ✅ Working |

**Key files:**
- `frontend/lib/anythingllm.ts` — workspace + embedding orchestration
- `frontend/app/api/anythingllm/stream-chat/route.ts` — chat endpoint (has 401 debug logging)
- `frontend/app/api/generate/route.ts` — OpenRouter streaming (inline AI)
- `ARCHITECTURE-SINGLE-SOURCE-OF-TRUTH.md` — exhaustive system docs (READ FIRST)

## Deployment Architecture

**⚠️ CRITICAL: Deployment Status (October 2025)**

| Component | Current | Target | Status |
|-----------|---------|--------|--------|
| **Frontend (Next.js)** | EasyPanel (sow.qandu.me) | EasyPanel | ✅ Done |
| **Backend (FastAPI)** | PM2 (port 8000) | EasyPanel | 🚀 IN PROGRESS |
| **AnythingLLM** | EasyPanel (ahmad-anything-llm.840tjq.easypanel.host) | EasyPanel | ✅ Done |
| **MySQL** | Remote (168.231.115.219) | Remote | ✅ Done |

**Why move Backend to EasyPanel?**
- ✅ Matches frontend architecture (consistency)
- ✅ Auto-restart on crash
- ✅ Centralized logs + monitoring dashboard
- ✅ Easy env var management via UI
- ✅ Git push → auto-deploy (no SSH needed)
- ✅ Team scaling without SSH access
- ⚠️ Cost: ~$30/mo extra (vs $0 for PM2)

---

## Developer Workflows & Commands

**Local dev (one command):**
```bash
./dev.sh  # Kills containers, starts backend:8000 + frontend:3333 with hot reload
```

**Manual start:**
- Frontend: `cd frontend && pnpm install && pnpm dev`
- Backend: `cd backend && source venv/bin/activate && pip install -r requirements.txt && uvicorn main:app --reload --host 0.0.0.0 --port 8000`

**Production via PM2 (LEGACY - moving to EasyPanel):**
- `pm2 start ecosystem.config.js` — starts sow-frontend (3001) + sow-backend (8000)
- `pm2 restart sow-frontend --update-env` — apply new env vars

## Critical Data Flows

**SOW Creation → Dual Embedding → AI Access:**
1. User creates SOW in editor (TipTap JSON)
2. Auto-save triggers `embedSOWInBothWorkspaces(clientSlug, title, content)` in `frontend/lib/anythingllm.ts`
3. Step 1: Upload to AnythingLLM via `/api/v1/document/raw-text` → get `documentLocation`
4. Step 2: Embed in client workspace via `/api/v1/workspace/{client-slug}/update-embeddings`
5. Step 3: Ensure `sow-master-dashboard` exists (created lazily)
6. Step 4: Embed same SOW in master dashboard with `[CLIENT-SLUG]` prefix for tracking
7. **Result:** Dashboard AI can query ALL SOWs across ALL workspaces. Gen AI has context for that workspace.

**PDF Export (Requires WeasyPrint-safe HTML):**
1. Frontend: `frontend/app/api/generate-pdf/route.ts` receives TipTap JSON
2. Convert via `generateHTML(content, defaultExtensions)` from `frontend/components/tailwind/extensions.ts`
3. POST HTML to backend `/generate-pdf` (60s timeout)
4. Backend renders Jinja2 template, injects embedded CSS from `DEFAULT_CSS` constant
5. WeasyPrint renders → returns PDF bytes

**Inline AI Chat (No Document Context):**
- User selects text in editor → clicks "Expand"/"Rewrite" action
- POST to `/api/generate` with selected text + command + model (from OpenRouter dropdown)
- Frontend streams response directly from OpenRouter (NOT AnythingLLM)
- Response inserted inline in editor

## Project-Specific Patterns

**TipTap → HTML Conversion (Critical for PDF):**
- Schema in `frontend/components/tailwind/extensions.ts` defines ProseMirror nodes
- On PDF export: MUST call `generateHTML(content, defaultExtensions)` to produce WeasyPrint-safe HTML
- Constraints: no CSS variables, no remote fonts, no JavaScript, tables must use `<table>/<tr>/<td>`
- If adding new TipTap nodes, ensure they convert to plain HTML

**Embedding Strategy (One SOW → Two Workspaces):**
- Every SOW is embedded in BOTH: client workspace + master dashboard
- Master dashboard slug: `sow-master-dashboard` (created automatically)
- Document naming in master: `[CLIENT-WORKSPACE-NAME] SOW Title` (prefix for tracking)
- Function: `AnythingLLMService.embedSOWInBothWorkspaces()` handles dual-embedding atomically
- If client workspace embed fails: whole operation fails. If master dashboard embed fails: operation succeeds (logs warning)

**Environment Variables:**
- `DB_HOST, DB_USER, DB_PASSWORD, DB_NAME` — MySQL
- `NEXT_PUBLIC_PDF_SERVICE_URL` — frontend→backend endpoint (default: `http://localhost:8000`)
- `ANYTHINGLLM_URL, ANYTHINGLLM_API_KEY` — workspace/thread management
- `OPENROUTER_API_KEY` — inline editor AI

## Project-Specific Patterns

**TipTap → HTML Conversion:**
- TipTap JSON schema defined in `frontend/components/tailwind/extensions.ts` (ProseMirror nodes: Paragraph, Heading, BulletList, OrderedList, Table, Image, Link, CodeBlock, etc.)
- On PDF export, **must** call `generateHTML(content, defaultExtensions)` to produce WeasyPrint-safe HTML
- Avoid client-side CSS features in generated HTML: no CSS variables, no remote fonts (use system fonts), no JavaScript
- Example: tables must be `<table>` tags with `<tr>/<td>`, not div-based layouts

**PDF Styling & Branding:**
- Brand colors: dark teal + social garden green
- All CSS embedded in `DEFAULT_CSS` constant in `backend/main.py` (WeasyPrint doesn't support external stylesheets)
- Social Garden logo: embedded as base64 in PDF header
- When updating PDF styles: test locally with `uvicorn main:app --reload`

**Integration Points & Gotchas**

**AnythingLLM Workspace Sync:**
- One workspace per client; created lazily on first embedding
- Workspace slug = `client_name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')`
- Master dashboard slug is always `sow-master-dashboard` (not per-client)
- If workspace creation fails, retry on next sync interval (30s)

**Database Schema (MySQL):**
- `sows` table: id, title, client_name, content, workspace_slug, status (draft/sent/viewed/accepted/declined)
- `sow_activities` table: event log (created, viewed, commented)
- `sow_comments` table: tracking client feedback
- Migrations: edit `database/schema.sql`, then run `mysql -u sg_sow_user -p socialgarden_sow < schema.sql`

**Frontend API Routes:**
- `/api/sow/create` — create new SOW
- `/api/sow/[id]` — fetch/update SOW
- `/api/generate-pdf` — POST with HTML → returns PDF blob
- `/api/anythingllm/*` — proxy to AnythingLLM API
- `/api/generate` — OpenRouter streaming (inline AI)

## Debugging Checklist

**❌ 401 Unauthorized on Dashboard/Gen AI Chat (CURRENT ISSUE):**
1. Affected: Dashboard AI (`/api/anythingllm/stream-chat`), Gen AI (same endpoint)
2. Works: Inline editor AI (`/api/generate` via OpenRouter)
3. Symptoms: Chat interface opens, "Send" button returns 401
4. Debug logging added in `frontend/app/api/anythingllm/stream-chat/route.ts` with label `🔑 [AnythingLLM Stream] Auth Debug`
5. Next steps: Deploy to VPS, test dashboard chat, check browser console for debug output
6. Known good: Token is valid (40+ chars), endpoint is accessible, problem is with auth header

**PDF Export Returns 500:**
1. Check frontend console for timeout or service error message
2. If timeout: increase `AbortController` timeout in `route.ts` (currently 60s)
3. If service error: curl backend directly `http://localhost:8000/generate-pdf` with same HTML
4. Backend issues: WeasyPrint can't render remote fonts → use system fonts only

**Frontend → Backend 500 with "fetch failed":**
1. Verify `NEXT_PUBLIC_PDF_SERVICE_URL` is set and backend running
2. Check port 8000: `lsof -i :8000` or `netstat -tuln | grep 8000`
3. If not listening: `pm2 restart sow-backend`

**AnythingLLM Embedding Fails:**
1. Check API key in `frontend/lib/anythingllm.ts`
2. Verify workspace exists: curl with Authorization header to `/api/v1/workspaces`
3. Document upload fails if workspace doesn't exist - create workspace first
4. Check `embedSOWInBothWorkspaces()` logs for specific step that failed

**Database Connection Errors:**
1. Check MySQL is running: `systemctl status mysql` or `docker ps`
2. Verify credentials in `.env`
3. Test: `mysql -h DB_HOST -u DB_USER -p DB_NAME`
4. Pool exhausted? Check: `SHOW PROCESSLIST;` in MySQL

## Key Files by Purpose

| File | Purpose |
|------|---------|
| `frontend/app/portal/sow/[id]/page.tsx` | SOW viewer, TipTap editor, PDF export UI |
| `frontend/app/api/generate-pdf/route.ts` | PDF generation endpoint (60s timeout, forwards to backend) |
| `frontend/lib/anythingllm.ts` | Workspace creation, document embedding, thread sync |
| `frontend/lib/db.ts` | MySQL connection pool (mysql2/promise) |
| `backend/main.py` | FastAPI server: PDF generation, Google Sheets export, OAuth |
| `database/schema.sql` | MySQL schema: sows, sow_activities, sow_comments, etc. |
| `ecosystem.config.js` | PM2 process config for prod deployment |

## Backend Migration to EasyPanel (NEXT TASK)

**Current**: FastAPI on PM2 (manual management)  
**Action**: Move to EasyPanel Docker (30 min)  

Steps:
1. Build Docker: `docker build -t socialgarden-backend:latest backend/`
2. Push to Docker Hub: `docker push YOUR-USERNAME/socialgarden-backend:latest`
3. In EasyPanel: Create Docker service, add env vars, deploy
4. Update frontend: `NEXT_PUBLIC_PDF_SERVICE_URL=https://sow-backend.easypanel.host`
5. Test: PDF export should work

See `ARCHITECTURE-SINGLE-SOURCE-OF-TRUTH.md` for complete migration guide.
