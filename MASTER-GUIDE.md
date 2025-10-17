# 📘 MASTER DEVELOPMENT GUIDE - THE ONLY DOC YOU NEED

**⚠️ IMPORTANT FOR AI ASSISTANTS:**  
**DO NOT CREATE NEW DOCS. EDIT THIS ONE.**  
This is the single source of truth. Update this file as the project evolves.  
No new markdown files. Just maintain this one. Keep it organized.
Very importnant to spend only 10% documenting and 90% actualy working 
---

## 🚀 QUICK START (30 SECONDS)

### Development (Dev Mode)
```bash
cd /root/the11
./dev.sh
```

**Frontend runs on:** http://localhost:3333 ✅ (Default dev port)  
**Backend runs on:** http://localhost:8000

**Why 3333?** Port 3000 is commonly in use, so Next.js uses 3333 as the default alternative.

### Production Build (Local Testing)
```bash
cd /root/the11/frontend
pnpm build         # Creates optimized .next folder
pnpm start         # Runs production build
```

**Frontend runs on:** http://localhost:3000 ✅ (Default prod port)

### Production Deployment
```bash
# Set production env vars
export NODE_ENV=production
export NEXT_PUBLIC_BASE_URL=https://yourdomain.com

# Build and run with PM2
cd /root/the11/frontend
pnpm build
pm2 start "pnpm start" --name sow-frontend
```

**Will run on:** Port 3000 (or configure in production)

---

## 📝 Dev vs Production Port Explanation

| Environment | Port | Command | When to Use |
|------------|------|---------|------------|
| **Dev Mode** | 3333 | `./dev.sh` or `PORT=3333 pnpm dev` | During development |
| **Production Build (Local)** | 3000 | `pnpm start` | Testing prod locally |
| **Production (Server)** | 80/443 | Docker or PM2 | Live server |

**Why different ports?**
- Port 3000: Standard Node.js default (used in production)
- Port 3333: Alternative dev port (when 3000 is taken)
- The `dev.sh` script explicitly sets `PORT=3333` to avoid conflicts

**If port 3333 is taken:**
```bash
# Next.js will automatically find next available port
# You'll see output like: "⚠ Port 3333 is in use, trying 3001 instead"
# To fix it, kill the process:
lsof -ti:3333 | xargs kill -9
./dev.sh
```

**You'll see:**
- ✅ Clear startup messages for backend & frontend
- ✅ Next.js compilation output (errors show here!)
- ✅ "Ready in Xs" when app is ready
- ✅ Hot reload notifications

**Opens:**
- Frontend: http://localhost:3333
- Backend: http://localhost:8000

**Check Status Anytime:**
```bash
./status.sh  # Shows what's running, what's not
```

**Stop Everything:**
- Press `Ctrl+C` (kills both frontend & backend)

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

### ✅ FIXED: Adjustable Drag Handles for Sidebar & AI (Left/Right Resize)
**Issue:** 
- Left drag handle (sidebar) wasn't working - dragging resized middle editor instead
- Right drag handle (AI chat) wasn't working - dragging also resized middle editor
- Tailwind classes were conflicting with react-resizable-panels library

**Root Cause:**
- Complex Tailwind `hover:` and `active:` states conflicting with library's data attributes
- No dedicated CSS file for panel styling
- Missing `touch-action: none` on resize handles

**Solution Applied:**

1. **Simplified ResizableLayout component** ✅
   - Removed conflicting Tailwind classes from PanelResizeHandle
   - Added import for dedicated CSS file
   - Cleaned up JSX to use simple class names (`resize-handle`, `resize-handle-icon`)

2. **Created `/frontend/styles/resizable-panels.css`** ✅
   - Dedicated CSS for all panel styling
   - Proper cursor, hover, and active states
   - Added `touch-action: none` to prevent browser interference
   - Icons only show on hover with smooth transitions

3. **Removed conflicting CSS from globals.css** ✅
   - Removed `@layer components` with conflicting panel rules
   - Removed `@apply` statements that were causing issues

**Files Changed:**
- `/frontend/components/tailwind/resizable-layout.tsx` - Simplified component
- `/frontend/styles/resizable-panels.css` - New dedicated CSS file (created)
- `/frontend/styles/globals.css` - Removed conflicting CSS rules

**How It Works Now:**
- **Left handle (Sidebar):** Drag to resize sidebar ↔ editor
- **Right handle (AI Chat):** Drag to resize editor ↔ AI panel
- **Visual feedback:** Handles turn blue on hover, white grip icon appears
- **Smooth interaction:** No jank, properly constrained min/max sizes

**Result:** ✅ Both drag handles now work correctly - sidebar and AI can be resized independently

---

### ✅ FIXED: Database Table Name Mismatches
**Errors seen:**
```
Table 'socialgarden_sow.sow_folders' doesn't exist
Table 'socialgarden_sow.statements_of_work' doesn't exist  
Table 'socialgarden_sow.agent_messages' doesn't exist
```

**Root Cause:** Code was using old table names, but actual database tables have different names.

**Solution Applied:**
Fixed 3 API routes to match actual database schema:

| API Route | Issue | Fix |
|-----------|-------|-----|
| `/api/folders` | Used `sow_folders` table, tried to insert `description` column | Use `folders` table, only insert `name` (no description column exists) |
| `/api/dashboard/stats` | Used `statements_of_work` table | Use `sows` table |
| `/api/agents/[id]/messages` | Used `agent_messages` table, tried to insert into `message` column | Use `chat_messages` table with `content` column and `timestamp` (bigint) |

**Actual Table Schema:**
```sql
-- folders table
id (varchar36), name, created_at, updated_at, anythingllm_workspace_slug

-- sows table  
(various SOW metadata columns)

-- chat_messages table
id, agent_id, role (enum), content (longtext), timestamp (bigint), created_at
```

**Files Changed:**
- `/frontend/app/api/folders/route.ts` - Fixed column names
- `/frontend/app/api/dashboard/stats/route.ts` - Fixed table name
- `/frontend/app/api/agents/[agentId]/messages/route.ts` - Fixed table and column names

**Result:** ✅ All database schema mismatches resolved

### ✅ FIXED: AI Generate 401 Unauthorized Error (Endpoint Issue)
**Error seen:**
```
Error: API error: 401 Unauthorized
Source: components/tailwind/generative/ai-selector.tsx (271:15)
```

**Root Cause:** Two issues:
1. OpenRouter was misconfigured (invalid API key)
2. AnythingLLM endpoint was wrong - using `/chat` with `mode: 'query'` instead of `/stream-chat`

**Solution Applied:**
Switched to AnythingLLM with the CORRECT streaming endpoint:

1. **Updated `/frontend/.env`:**
   - Removed: `OPENROUTER_API_KEY`
   - Added: `ANYTHINGLLM_API_KEY`, `ANYTHINGLLM_WORKSPACE_SLUG=pop`

2. **Rewrote `/frontend/app/api/generate/route.ts`:**
   - **OLD (WRONG):** `POST /api/v1/workspace/pop/chat` with `mode: 'query'` → Returns non-streaming response
   - **NEW (CORRECT):** `POST /api/v1/workspace/pop/stream-chat` → Returns Server-Sent Events (SSE) stream ✅
   - Properly parses SSE format with `data: ` prefix
   - Extracts `textResponse` field from JSON responses
   - Handles [DONE] marker correctly

3. **Files Changed:**
   - `/frontend/.env` - Added AnythingLLM workspace config
   - `/frontend/app/api/generate/route.ts` - Fixed endpoint to `/stream-chat`

**Configuration:**
```bash
# .env
NEXT_PUBLIC_ANYTHINGLLM_URL=https://ahmad-anything-llm.840tjq.easypanel.host
ANYTHINGLLM_API_KEY=0G0WTZ3-6ZX4D20-H35VBRG-9059WPA
ANYTHINGLLM_WORKSPACE_SLUG=pop
```

**API Endpoints Available (from AnythingLLM Docs):**
- `POST /v1/workspace/{slug}/chat` - Non-streaming chat (blocks until response)
- `POST /v1/workspace/{slug}/stream-chat` - Streaming chat (returns SSE) ✅ **We use this**
- `POST /v1/workspace/{slug}/vector-search` - Vector search only

**Result:** ✅ AI text generation now works with AnythingLLM "pop" workspace using correct streaming endpoint

### ✅ FIXED: SOWs Now Saving to Database
**What Was Wrong:**
- SOWs (documents) were being saved to **localStorage** instead of database
- Folders were in database ✅ but SOWs were not ❌
- Data was lost on browser refresh
- Users couldn't see SOWs in MySQL

**The Fix - 4 Changes Made:**

**1. Created GET /api/sow/list endpoint** ✅
- File: `/frontend/app/api/sow/list/route.ts`
- Returns all SOWs from database, optionally filtered by `?folderId=`
- Supports sorting and pagination ready

**2. Load SOWs from Database on App Start** ✅
- File: `/frontend/app/page.tsx` line ~370
- Changed from: `localStorage.getItem("documents")`
- Changed to: `fetch('/api/sow/list')` 
- All SOWs now load from database on app load

**3. Save New SOWs to Database** ✅
- File: `/frontend/app/page.tsx` line ~540-620 (handleNewDoc)
- Added: `fetch('/api/sow/create', {method: 'POST', ...})`
- New SOWs are now created in database before being added to UI state

**4. Auto-Save SOW Content to Database** ✅
- File: `/frontend/app/page.tsx` line ~420 (new useEffect)
- Added debounced auto-save (2 seconds of inactivity)
- Calls: `PUT /api/sow/{id}` with content when editing
- Content persists on every auto-save

**5. Delete SOWs from Database** ✅
- File: `/frontend/app/page.tsx` line ~665-695 (handleDeleteDoc)
- Added: `fetch('/api/sow/{id}', {method: 'DELETE'})`
- SOWs are now deleted from database when removed from UI

**6. Removed localStorage Auto-Save** ✅
- Removed: `useEffect(() => { localStorage.setItem("documents", ...) })`
- No more confusing dual persistence (localStorage vs database)
- Single source of truth: Database

**Result:** ✅ SOWs now persist across browser refreshes via MySQL database

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

### ✅ FIXED: Native Prompt() Replaced with Custom Modal for New SOW

**Issue Identified:** 
Creating a new SOW inside a workspace triggered an ugly, native browser `window.prompt()` box. This jarring UX break confused users and looked unprofessional compared to the sleek custom modal for creating workspaces.

**Root Cause:** 
The sidebar-nav.tsx component used JavaScript's native `prompt()` function instead of a styled modal dialog component.

**Solution Applied:**

1. **Created new reusable component:** `/frontend/components/tailwind/new-sow-modal.tsx` ✅
   - Identical styling to "New Workspace" modal
   - Input placeholder: "e.g., Q3 Marketing Campaign SOW"
   - Primary button text: "Create SOW" (brand green #1CBF79)
   - Cancel button for user control
   - Keyboard support (Enter to submit)

2. **Updated sidebar-nav.tsx** ✅
   - Imported new `NewSOWModal` component
   - Added state: `showNewSOWModal`, `newSOWWorkspaceId`
   - Replaced `prompt()` call with modal trigger
   - Modal passes workspace ID when creating SOW

**Files Changed:**
- `/frontend/components/tailwind/new-sow-modal.tsx` - New modal component (created)
- `/frontend/components/tailwind/sidebar-nav.tsx` - Integrated modal, removed prompt()

**Result:** ✅ Users now see a professional, branded modal instead of native browser prompt. Consistent UX throughout the app.

---

### ✅ FIXED: Knowledge Base Iframe Not Rendering

**Issue Identified:** 
Clicking the "Knowledge Base" link in the sidebar showed a blank white page. The iframe was present but not rendering properly, destroying user trust in the application.

**Root Cause:** 
- Iframe had conflicting CSS: `rounded-lg border border-gray-200 bg-white` (light theme CSS in dark app)
- Missing explicit width/height constraints
- Inline styles not overriding CSS classes

**Solution Applied:**

Updated `/frontend/components/tailwind/knowledge-base.tsx`:
1. Changed background to match dark theme: `bg-[#0e0f0f]` ✅
2. Removed light theme border and rounded corners ✅
3. Added explicit inline styles: `width: 100%, height: 100%, border: none, display: block` ✅
4. Removed unnecessary `overflow-hidden` that was conflicting with iframe sizing ✅

**Configuration:**
```tsx
<iframe
  src="https://ahmad-anything-llm.840tjq.easypanel.host/embed/dee07d93-59b9-4cb9-ba82-953cf79953a2"
  className="w-full h-full border-0"
  title="AnythingLLM Knowledge Base"
  allow="microphone; camera"
  style={{
    width: "100%",
    height: "100%",
    border: "none",
    display: "block",
  }}
/>
```

**Files Changed:**
- `/frontend/components/tailwind/knowledge-base.tsx` - Fixed iframe styling

**Result:** ✅ Knowledge Base iframe now renders correctly, filling 100% of the content area with dark theme styling.

---

### ✅ FIXED: Dashboard Visual Polish - Brand Colors Applied

**Issue Identified:** 
Dashboard was visually flat with no visual hierarchy. All elements had equal visual weight, and the design didn't leverage the brand's accent colors (#1CBF79) to guide user attention. The "Refresh" button was visually weak and hard to find.

**Root Cause:** 
Dashboard was using generic colors (emerald-600, blue-500, etc.) instead of the brand's primary green color (#1CBF79). Icons in stat cards were not prominent enough.

**Solution Applied:**

1. **Updated Refresh button styling** ✅
   - Old: `border-[#0e2e33] text-gray-300 hover:bg-[#1b1b1e]` (weak, barely visible)
   - New: `border-[#1CBF79] text-[#1CBF79] hover:bg-[#1CBF79]/10` (primary action button)
   - Now clearly signals the main action to refresh data

2. **Updated stat card icons to brand color** ✅
   - Changed all four metric cards: Total SOWs, Total Value, Active Proposals, This Month
   - Icon backgrounds: `bg-[#1CBF79]/20` (brand green with opacity)
   - Icon color: `text-[#1CBF79]` (brand green text)
   - Creates visual hierarchy and draws attention to key metrics

3. **Updated chat action buttons** ✅
   - "Show/Hide AI Chat" button: `bg-[#1CBF79] hover:bg-[#15a366]`
   - Chat send button: `bg-[#1CBF79] hover:bg-[#15a366]`
   - All interactive elements now use brand colors

**Files Changed:**
- `/frontend/components/tailwind/enhanced-dashboard.tsx` - Applied brand colors

**Result:** ✅ Dashboard now has clear visual hierarchy with brand colors guiding user attention to key actions and metrics. Professional and polished appearance.

---


The `dev.sh` script sets `PORT=3333`, but if that port is taken, Next.js will try 3334, 3335, etc.

**Port Reference:**
- **Dev:** 3333 (configured in dev.sh)
- **Prod Local:** 3000 (default pnpm start)
- **Prod Server:** 80/443 (via Docker or nginx)

---

### Q: Where are Delete and Rename buttons for SOWs in the sidebar?
**A:** They're there! They appear on hover.

**How to Use:**
1. **Hover over a SOW** in the left sidebar
2. **Two buttons appear:**
   - 🟡 **Edit (pencil icon)** - Rename the SOW
   - 🔴 **Delete (trash icon)** - Delete the SOW
3. **Click the edit button** → Type new name → Press Enter
4. **Click the delete button** → SOW is deleted from database and UI

**File Location:** `/frontend/components/tailwind/sidebar.tsx` lines 140-155
```typescript
<div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
  <button
    className="p-1 rounded hover:bg-yellow-100 text-yellow-600 transition-colors"
    onClick={(e)=>{e.stopPropagation();setRenamingId(doc.id);setRenameValue(doc.title);}}
    title="Rename document"
  >
    <Edit3 className="h-4 w-4" />  ← Rename button
  </button>
  <button
    className="p-1 rounded hover:bg-red-100 text-red-600 transition-colors"
    onClick={(e)=>{e.stopPropagation();onDelete(doc.id);}}
    title="Delete document"
  >
    <Trash2 className="h-4 w-4" />  ← Delete button
  </button>
</div>
```

**Features:**
- ✅ Rename appears on hover (yellow pencil icon)
- ✅ Delete appears on hover (red trash icon)
- ✅ Rename with inline editing (click → type → Enter to save)
- ✅ Delete removes from both database and UI immediately
- ✅ Drag & drop icons also visible on hover

---

### Q: What's the difference between dev.sh, pnpm dev, and pnpm start?
**A:**

| Command | What It Does | When to Use |
|---------|------------|-----------|
| `./dev.sh` | Starts backend + frontend together | **Most common** - Use this |
| `pnpm dev` | Starts only frontend with hot reload | Only if backend already running |
| `pnpm build` | Creates optimized production build | Before `pnpm start` |
| `pnpm start` | Runs production build (no hot reload) | Testing prod locally |
| `pnpm build && pnpm start` | Build + run production mode | Full production testing |

**Recommended workflow:**
```bash
# Development
./dev.sh                          # Start both services with hot reload

# Testing production locally
cd frontend
pnpm build                        # Create .next folder
pnpm start                        # Run as production (port 3000)

# Then test everything at http://localhost:3000 vs http://localhost:3333
```

---

### Q: How do I know which port my app is actually on?
**A:** Check the logs when the app starts:

```bash
# Dev mode (./dev.sh) will show:
✅ SERVICES RUNNING
🌐 Frontend: http://localhost:3333
🔌 Backend:  http://localhost:8000

# Or if port is taken:
⚠ Port 3333 is in use, trying 3001 instead.
  ▲ Next.js 15.1.4
  - Local: http://localhost:3001
```

**Command to find it:**
```bash
# Check which process is running
ps aux | grep "pnpm dev"
ps aux | grep "next-server"

# Check which port it's using
lsof -i :3000
lsof -i :3001
lsof -i :3333
```

---

### Q: Can I change the default port for dev mode?
**A:** Yes!

**Option 1: Modify dev.sh**
```bash
# In dev.sh, change this line:
PORT=3333 pnpm dev

# To:
PORT=3000 pnpm dev
```

**Option 2: Override on command line**
```bash
PORT=5000 pnpm dev
```

**Option 3: Use environment variable**
```bash
export PORT=4000
./dev.sh
```

---

### Q: SOW isn't deleted even though I clicked delete button?
**A:** Check these things:

```bash
# 1. Check if backend is running
curl http://localhost:8000/health

# 2. Test delete API manually
curl -X DELETE http://localhost:3001/api/sow/{SOW_ID}

# 3. Check backend logs
tail -f /tmp/backend.log

# 4. Check browser console for errors
# Press F12 → Console tab → Look for red errors

# 5. Verify database connection
mysql -h 168.231.115.219 -u sg_sow_user -p'SG_sow_2025_SecurePass!' socialgarden_sow
SELECT * FROM sows LIMIT 1;
```

---

### Q: Can I rename a SOW directly in the editor tab?
**A:** Not yet. You must:

1. Hover over SOW name in **left sidebar**
2. Click the **yellow pencil icon** that appears
3. Type new name
4. Press **Enter** to save

**This is a design choice** - prevents accidental renames while editing. The title is auto-updated in the database when you change it.

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
- [ ] **Fix SOW persistence: Save to database instead of localStorage**
  - [ ] Create `/api/sow/list` endpoint ← PRIORITY #1
  - [ ] Update `page.tsx` line ~370 to load from database
  - [ ] Update `page.tsx` line ~540 to save new SOWs to DB
  - [ ] Update `page.tsx` line ~820 to auto-save on content change
  - [ ] Update `page.tsx` line ~620 to delete from DB
- [ ] Create accordion UI (folders expandable, SOWs inside) ← PRIORITY #2
- [ ] Implement drag & drop (move SOWs between folders) ← PRIORITY #3
- [ ] Fix `/api/models` 400 error
- [ ] Fix `/api/preferences/current_agent_id` 405 error (needs PUT handler)
- [ ] Fix `/api/agents/architect` 404 error
- [ ] Remove all console.log debug statements (47+ logs to clean)
- [x] Fix `/api/folders` 500 error ✅ (table name: folders)
- [x] Fix `/api/dashboard/stats` 500 error ✅ (table name: sows)
- [x] Fix `/api/agents/[id]/messages` 500 error ✅ (table name: chat_messages)
- [x] Fix `/api/generate` 401 error ✅ (switched to AnythingLLM workspace "pop")
- [x] Verify database connection working ✅
- [ ] Add markdown rendering to AI chat responses (tables, formatting)
- [ ] Add floating action menu (Export PDF/Excel, Embed, Client Portal)
- [ ] Make Knowledge Base tab an iframe to AnythingLLM
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
## 🚢 DEPLOYMENT GUIDE

### Pre-Deployment Checklist
- [ ] All tests passing
- [ ] No console.log statements (use `debug()` from `/lib/logger.ts`)
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] SSL certificates ready
- [ ] Domain configured
- [ ] Monitoring setup

### Dev vs Prod: Key Differences

**Development Mode (`./dev.sh`):**
- ✅ Hot reload on file changes
- ✅ Console.logs visible (debug info)
- ✅ Slow but interactive
- ✅ Maps show source files

**Production Mode (`pnpm build && pnpm start`):**
- ✅ Optimized & minified
- ✅ Console.logs stripped (faster)
- ✅ No hot reload (restart needed)
- ✅ Faster startup

**Golden Rule:** Both should work identically. If they don't, you have a hydration or environment issue.

### Local Production Testing
```bash
cd /root/the11/frontend
pnpm build          # Creates optimized build
pnpm start          # Starts production server
# Test at http://localhost:3000

# Compare with dev
cd /root/the11
./dev.sh            # Test at http://localhost:3333
```

### Quick Test: SOW Persistence ✅
**Test that SOWs persist to database:**

```bash
# 1. Count SOWs before test
curl -s http://localhost:3001/api/sow/list | jq 'length'

# 2. Create a new SOW via API
curl -X POST http://localhost:3001/api/sow/create \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test SOW",
    "content": {"type":"doc","content":[]},
    "client_name": "Test Client",
    "client_email": "test@example.com",
    "total_investment": 5000
  }' | jq '.id'

# 3. Save the returned ID and verify it exists
curl http://localhost:3001/api/sow/{ID} | jq '.title'

# 4. Count SOWs after test
curl -s http://localhost:3001/api/sow/list | jq 'length'

# 5. Refresh browser and verify SOW still appears (database persistence ✅)
```

**UI Test:**
1. Open http://localhost:3001
2. Click "New SOW" button
3. Add title and content
4. Wait 2 seconds (auto-save)
5. Refresh page with F5
6. SOW should still be there with all content intact ✅

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
pm2 start "pnpm start" --name sow-frontend

# Backend (with PM2)  
cd /root/the11/backend
pm2 start "uvicorn main:app --host 0.0.0.0 --port 8000" --name sow-backend
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

## 🎨 CODE STYLE GUIDELINES - DEV TO PROD CONSISTENCY

### ✅ 5 Rules to Ensure Dev = Prod

#### 1. Use Safe Logging (Not Console.logs)
```typescript
// ❌ WRONG - Shows in dev but breaks in prod
console.log('Debug info:', value);

// ✅ RIGHT - Use the logger utility
import { debug, error } from '@/lib/logger';
debug('Debug info:', value);     // Only in dev ✅
error('Error occurred:', error); // Always logs ✅
```

#### 2. Use useEffect for Dynamic Values
```typescript
// ❌ WRONG - Hydration mismatch
const timestamp = Date.now();
const randomId = Math.random();

// ✅ RIGHT - Set in useEffect
const [timestamp, setTimestamp] = useState(0);
useEffect(() => setTimestamp(Date.now()), []);
```

#### 3. No Conditional Rendering in Render
```typescript
// ❌ WRONG - Server renders differently than client
if (typeof window !== 'undefined') {
  return <div>Client only</div>;
}

// ✅ RIGHT - Use useEffect
const [isClient, setIsClient] = useState(false);
useEffect(() => setIsClient(true), []);
if (!isClient) return null;
return <div>Client only</div>;
```

#### 4. Always Initialize Controlled Components
```typescript
// ❌ WRONG - Switches from uncontrolled to controlled
const [value, setValue] = useState(undefined);
return <input value={value} onChange={...} />;

// ✅ RIGHT - Initialize with default
const [value, setValue] = useState('');
return <input value={value} onChange={...} />;
```

#### 5. No HTML Nesting Violations
```typescript
// ❌ WRONG - Invalid HTML
return <p><div>Invalid nesting</div></p>;

// ✅ RIGHT - Valid HTML structure
return <div><p>Valid nesting</p></div>;
```

### How to Find Issues
```bash
# Search for console.logs
grep -rn "console\." frontend/app/ frontend/components/ frontend/lib/

# Build locally to catch hydration errors
cd frontend
pnpm build        # Shows hydration warnings here
pnpm start        # Test prod locally
```

### Files for Reference
- **Logger utility:** `/frontend/lib/logger.ts`
- **Dev-to-Prod guide:** `/DEV-TO-PROD-GUIDE.md`
- **Console cleanup:** Run `bash cleanup-console-logs.sh`

---

## 🎨 CODE STYLE GUIDELINES
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

### October 17, 2025 - Session 2
- ✅ Created MASTER-GUIDE.md as single source of truth
- ✅ Fixed TipTap build error (pnpm override for tiptap-extension-global-drag-handle)
- ✅ Fixed dev.sh backend startup (venv pip install logic)
- ✅ App running successfully on http://localhost:3333
- ✅ Fixed database table name mismatches:
  - `/api/folders`: sow_folders → folders
  - `/api/dashboard/stats`: statements_of_work → sows
  - `/api/agents/[id]/messages`: agent_messages → chat_messages
- ✅ Fixed undefined params causing SQL errors (added null fallbacks)

### October 17, 2025 - Session 3
- ✅ Fixed `/api/generate` 401 Unauthorized error (switched from OpenRouter → AnythingLLM)
  - Updated `/frontend/.env` to use AnythingLLM workspace "pop"
  - Rewrote `/frontend/app/api/generate/route.ts` for AnythingLLM API
  - Fixed endpoint: `/chat` with `mode: 'query'` → `/stream-chat` (correct)
- ✅ AI text generation now works with real-time streaming
- ✅ FIXED: SOWs not persisting to database
  - Created `/api/sow/list` endpoint for fetching all SOWs
  - Updated `handleNewDoc()` to save SOWs to database via POST
  - Added auto-save useEffect for content (2 second debounce)
  - Updated `handleDeleteDoc()` to delete from database via DELETE
  - Removed localStorage auto-save for documents (database is single source of truth)
  - SOWs now persist across browser refreshes ✅
- Next: Build accordion UI for folder/SOW hierarchy with drag & drop
- 🔍 Identified SOW persistence issue: Saving to localStorage instead of database
  - Created `/api/sow/list` endpoint to fetch all SOWs
  - Need to update `page.tsx` to use database APIs
- ⏳ **NEXT:** Fix SOW persistence, then build accordion UI with drag & drop

### October 17, 2025 - Session 4 (UX/UI Polish)
- ✅ FIXED: Native Prompt() replaced with custom modal for New SOW
  - Created `/frontend/components/tailwind/new-sow-modal.tsx` - reusable modal component
  - Updated `sidebar-nav.tsx` to use custom modal instead of `window.prompt()`
  - Modal now matches "New Workspace" design system (branded, professional)
  - Input placeholder: "e.g., Q3 Marketing Campaign SOW"
  - Button: "Create SOW" with brand green color (#1CBF79)
- ✅ FIXED: Knowledge Base iframe not rendering
  - Updated `knowledge-base.tsx` with proper dark theme styling
  - Changed background from light white to dark theme (#0e0f0f)
  - Added explicit inline styles for width/height (100%)
  - Removed conflicting CSS classes (light theme borders)
  - AnythingLLM Knowledge Base now renders correctly and fills entire content area
- ✅ FIXED: Dashboard visual polish with brand colors
  - Updated Refresh button: weak gray → prominent #1CBF79 (brand green)
  - Updated all 4 metric card icons: generic colors → brand green (#1CBF79)
  - Icon backgrounds: `bg-[#1CBF79]/20` for visual prominence
  - Updated chat buttons: `bg-[#1CBF79]` for consistency
  - Dashboard now has clear visual hierarchy guiding user attention
- 🎨 **UX Improvements:** Professional, branded, polished UI with consistent design system

---

**📝 REMEMBER: Edit this file. Don't create new docs. Keep it organized. Keep it updated.**

**Last Updated:** October 17, 2025 (Session 4 - UX/UI Polish)  
**Status:** ✅ Running with UI Polish Applied (Custom Modal, Knowledge Base Fixed, Dashboard Branded)  
**Version:** 1.0.2
