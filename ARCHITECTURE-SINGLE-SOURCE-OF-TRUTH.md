# 🏗️ ARCHITECTURE: Single Source of Truth

**🚨 CRITICAL: This document is the ONLY authoritative source for architecture. Always read it fully before making changes.**

**Last Updated**: October 22, 2025  
**Status**: In Development / Being Fixed  
**Environment**: VPS self-hosted on port 3000 (`localhost:3000`)

---

## 📋 ACTIVE ISSUES & FEATURES CHECKLIST

**Use this section to track current work. Check items as they're completed.**

### Current Sprint Issues
- [ ] **Issue**: 401 Unauthorized on Dashboard Chat
  - **Status**: ⏳ Pending investigation
  - **Description**: Dashboard chat endpoint returns 401 when user clicks "Send"
  - **Last Updated**: Oct 22, 2025
  - **Assigned**: TBD
  - **Next Step**: Deploy to EasyPanel and monitor browser console

- [ ] **Issue**: EasyPanel Build Timeout
  - **Status**: ⏳ Build canceled, needs retry
  - **Description**: EasyPanel build was canceled mid-build during `next build` step
  - **Cause**: Likely Next.js build timeout (Docker build has memory/time limits)
  - **Fix**: Click "Redeploy" on EasyPanel service page to retry
  - **Estimated Time**: 2-3 minutes to complete
  - **Last Updated**: Oct 22, 2025 20:33 UTC
  - **Next Step**: Monitor deployment, then test chat functionality

- [ ] **Issue**: Backend Migration to EasyPanel
  - **Status**: 📋 Documented, ready to execute
  - **Description**: Move FastAPI from PM2 to EasyPanel Docker for consistency
  - **Time Estimate**: ~30 minutes
  - **Steps**: 5-step Docker build/push/deploy process outlined below
  - **Next Step**: User approval + Docker Hub account setup

### Recent Fixes (October 22)
- [x] **FIXED**: Workspace Embedding Issue
  - **What was wrong**: Knowledge base embedded on empty workspaces immediately
  - **How fixed**: Removed premature embedding from `createOrGetClientWorkspace()`
  - **Commit**: `6bd8166`
  - **Result**: Clean workspace creation, no wasted API calls

- [x] **FIXED**: Chat Messages Disappearing + 400 Errors
  - **What was wrong**: Threads created in client workspace but accessed from gen-the-architect
  - **How fixed**: 3 critical code changes to workspace routing in `page.tsx`
  - **Commit**: `f854863`
  - **Files Modified**:
    - Line 683: Load chat from SOW's actual workspace
    - Line 1356: Create threads in client workspace
    - Line 2340: Route chat to SOW workspace
  - **Result**: Messages persist, no duplicate threads, 400 errors eliminated

### Planned Features
- [ ] **Feature**: API Response Caching
  - **Status**: 🔵 Not started
  - **Description**: Cache AnythingLLM API responses to reduce latency
  - **Priority**: Medium

---

## 🚀 DEPLOYMENT & NEXT STEPS

**Current Status:**
- ✅ Frontend: EasyPanel (sow.qandu.me)
- ✅ AnythingLLM: EasyPanel (ahmad-anything-llm.840tjq.easypanel.host)
- ⚠️ Backend: PM2 (needs to move to EasyPanel)
- ✅ MySQL: Remote (168.231.115.219)

**NEXT TASK: Migrate Backend to EasyPanel**

Backend Dockerfile exists at `/root/the11-dev/backend/Dockerfile` and is production-ready.

**5-Step Process (~30 min):**

```bash
# Step 1: Build Docker image
cd /root/the11-dev/backend
docker build -t socialgarden-backend:latest .

# Step 2: Push to Docker Hub (need account)
docker tag socialgarden-backend:latest YOUR-USERNAME/socialgarden-backend:latest
docker push YOUR-USERNAME/socialgarden-backend:latest

# Step 3: In EasyPanel UI
# Create new Docker service:
# - Image: YOUR-USERNAME/socialgarden-backend:latest
# - Port: 8000
# - Env vars: Copy from /root/the11-dev/backend/.env
# - Click Deploy (wait 3 min)

# Step 4: Get backend URL from EasyPanel
# Example: https://sow-backend.840tjq.easypanel.host

# Step 5: Update frontend
# Edit: frontend/.env.production
# NEXT_PUBLIC_PDF_SERVICE_URL=https://sow-backend.840tjq.easypanel.host
# Redeploy frontend (automatic via GitHub)
```

**Test:**
```bash
curl https://sow-backend.840tjq.easypanel.host/docs
# Should show FastAPI docs (not 500 error)
```

---

/root/the11-dev/frontend/app/api/sow/create/ANYTHINGAPI   is the source of truth anythingllm intergation
---

## 📋 Table of Contents

1. [Quick Overview](#quick-overview)
2. [3 AI Systems](#3-ai-systems)
3. [Embedding Flow](#embedding-flow)
4. [Master Dashboard Architecture](#master-dashboard-architecture)
5. [Known Issues & Fixes](#known-issues--fixes)
6. [API Routes & Auth](#api-routes--auth)

---

## Quick Overview

**Social Garden SOW Generator** has THREE distinct AI systems:

| System | Purpose | Backend | Endpoint | Model |
|--------|---------|---------|----------|-------|
| **Dashboard AI** | Query all SOWs across all workspaces | AnythingLLM (Master Workspace) | `/api/anythingllm/stream-chat` | `anythingllm` |
| **Gen AI** | Generate new SOWs (The Architect) | AnythingLLM (gen-the-architect workspace) | `/api/anythingllm/stream-chat` | `anythingllm` |
| **Inline Editor AI** | Inline text generation in SOW editor | OpenRouter (direct) | `/api/generate` | Various (Gemini, Claude, etc) |

---

## 3 AI Systems

### System 1️⃣: Dashboard AI (Master Workspace)

**Purpose**: Client talks to "everything" - asks questions about ALL SOWs across ALL workspaces  
**Main Job**: Analytics, cross-client queries, "How many clients do we have?", "What's the budget for TTT?"

**Architecture**:
```
User → Dashboard View
  ↓
Dashboard AI Component (right sidebar)
  ↓
/api/anythingllm/stream-chat
  ↓
AnythingLLM: sow-master-dashboard workspace
  ↓
Contains EMBEDDED copies of EVERY SOW from ALL workspaces
  ↓
AI responds with insights across all data
```

**Key Details**:
- **Workspace**: `sow-master-dashboard` (slug: `sow-master-dashboard`)
- **System Prompt**: "You are a helpful AI assistant for the Social Garden SOW Generator platform..."
- **Documents**: Contains embedded copies of ALL SOWs (with `[WORKSPACE]` prefix for context)
- **Thread**: Workspace-level chats (NOT thread-based, no per-SOW thread)
- **Model**: Uses AnythingLLM default model configured in workspace

**When It Gets Updated**:
- Every time a new SOW is created
- Every time a SOW is edited/saved
- See [Embedding Flow](#embedding-flow) below

**Current Issue**: ⚠️ 401 Unauthorized on chat send
- Symptom: Dashboard chat opens, but sending message returns 401
- Suspected Cause: Auth token not being sent with request OR token invalid
- Needs Investigation: Check `frontend/app/api/anythingllm/stream-chat/route.ts`

---

### System 2️⃣: Gen AI (gen-the-architect Workspace)

**Purpose**: Generate new SOWs, edit SOW content  
**Main Job**: Professional SOW generation with system prompt optimized for SOW creation

**Architecture**:
```
User → SOW Editor View
  ↓
Clicks "Create New SOW" OR opens existing SOW
  ↓
1. Creates/gets THREAD in gen-the-architect workspace (thread = SOW)
2. Thread slug = SOW ID (e.g., `sow-mh2d9qa6-37m3q`)
3. SOW embedded in BOTH:
   - gen-the-architect workspace (for generation AI access)
   - sow-master-dashboard workspace (for analytics AI access)
  ↓
User chats in editor → messages go to THIS thread
  ↓
/api/anythingllm/stream-chat
  ↓
AnythingLLM: gen-the-architect workspace → thread: sow-xyz
  ↓
AI responds with generation help
```

**Key Details**:
- **Workspace**: `gen-the-architect` (slug: `gen-the-architect`)
- **Thread**: Per-SOW thread (thread slug = SOW ID)
- **System Prompt**: Optimized for SOW generation (in workspace config on AnythingLLM)
- **Documents**: Only THAT SOW is embedded in thread context
- **Model**: Uses AnythingLLM default model configured in workspace

**When It Gets Updated**:
- When user creates a new SOW → creates thread in gen-the-architect
- When user saves SOW → embeds SOW in gen-the-architect + master dashboard
- See [Embedding Flow](#embedding-flow) below

**Current Status**: 
- ✅ Thread creation works (auto-creates on first chat if missing)
- ⚠️ 401 error when sending messages (same as Dashboard AI)

---

### System 3️⃣: Inline Editor AI (OpenRouter Direct)

**Purpose**: Inline text generation (rewrite, expand, etc) while editing SOW  
**Main Job**: Quick inline suggestions WITHOUT using AnythingLLM

**Architecture**:
```
User → In SOW editor, selects text
  ↓
Clicks AI action (e.g., "Expand", "Rewrite")
  ↓
/api/generate
  ↓
Frontend calls `/api/generate` with:
- prompt: user's AI command
- option: "zap" (inline generation)
- model: selected model (from dropdown)
- text: selected text in editor
  ↓
Backend streams response from OpenRouter API directly
  ↓
Response inserted inline in editor
```

**Key Details**:
- **Backend**: OpenRouter API (NOT AnythingLLM)
- **Endpoint**: `/frontend/app/api/generate/route.ts`
- **Models**: User can select from OpenRouter models (Claude, Gemini, GPT-4, etc) NOTHING coded it should be fetched
- **Auth**: Uses `OPENROUTER_API_KEY` environment variable
- **NOT a workspace**: Does NOT use AnythingLLM workspaces
- **NOT embedded**: Doesn't embed SOW content

**When It's Used**:
- User highlights text in editor
- Clicks AI action from toolbar
- Gets instant response without context of other SOWs

**Current Status**: 
- ✅ Working (no 401 errors reported)
- Uses separate auth (OpenRouter API key)

---

## Embedding Flow

**🔑 CRITICAL: Every SOW must be embedded in BOTH workspaces**

### What is "Embedding"?

In AnythingLLM, "embedding" = uploading a document into a workspace so the AI can reference it.

Flow:
1. **Create document** → Convert SOW HTML to text
2. **Upload to AnythingLLM** → `/api/v1/document/raw-text` → Get `documentLocation`
3. **Embed in workspace** → `/api/v1/workspace/{slug}/update-embeddings` → Add to workspace

### When SOW is Created

```
1. User creates new SOW
2. Frontend: `/frontend/app/page.tsx` → `handleCreateSOW()`
   ├─ Create thread in gen-the-architect workspace
   ├─ Save SOW to database
   └─ Call: anythingLLM.embedSOWInBothWorkspaces()
3. embedSOWInBothWorkspaces():
   ├─ Embed in gen-the-architect workspace
   │  └─ Thread context knows about this SOW
   ├─ Get or create master dashboard workspace
   └─ Embed in master dashboard with [WORKSPACE] prefix
4. Result:
   ✅ Dashboard AI can see it
   ✅ Gen AI can generate with it
```

### When SOW is Saved/Updated

```
1. User edits SOW and auto-saves
2. Frontend: `/frontend/app/page.tsx` → auto-save triggers
3. Call: anythingLLM.embedSOWInBothWorkspaces()
4. Same flow as creation
```

### Code Location

**File**: `/root/the11-dev/frontend/lib/anythingllm.ts`

**Key Functions**:
- `embedSOWDocument()` (lines 155-230): Upload + embed ONE SOW in ONE workspace
- `embedSOWInBothWorkspaces()` (lines 918-967): Embed in BOTH workspaces (main entry point)
- `getOrCreateMasterDashboard()` (lines 821-863): Ensure master dashboard workspace exists

**Implementation Details**:

```typescript
// Step 1: Convert SOW to text document
const enrichedContent = `# ${sowTitle}\n\n${textContent}...`;

// Step 2: Upload to AnythingLLM
POST /api/v1/document/raw-text
{
  textContent: enrichedContent,
  metadata: {
    title: sowTitle,
    docAuthor: 'Social Garden',
    docSource: 'SOW Generator'
  }
}
// Returns: { documents: [{ location: "custom-documents/..." }] }

// Step 3: Embed in workspace
POST /api/v1/workspace/{workspaceSlug}/update-embeddings
{
  adds: ["custom-documents/..."]
}
```

---

## Master Dashboard Architecture

### Purpose
Single workspace that contains copy of EVERY SOW from ALL workspaces. Enables dashboard AI to have full context.

### Workspace Details

| Property | Value |
|----------|-------|
| **Name** | SOW Master Dashboard |
| **Slug** | `sow-master-dashboard` |
| **Type** | Central Knowledge Base |
| **Created By** | Frontend on first dashboard load |
| **Documents** | All SOWs (with `[WORKSPACE]` prefix) |

### Document Naming in Master Dashboard

When SOW is embedded in master dashboard, it's prefixed with workspace name for context:

```
Gen AI creates: "Budget Planning SOW"
In gen-the-architect: [GEN-THE-ARCHITECT] Budget Planning SOW

Dashboard AI sees it as: [GEN-THE-ARCHITECT] Budget Planning SOW
Knows it came from "gen-the-architect" workspace
```

### Workflow

```
SOW Created in gen-the-architect workspace
  ↓
Step 1: Embed in gen-the-architect (for Gen AI to use)
  ↓
Step 2: Also embed in master dashboard with [GEN-THE-ARCHITECT] prefix
  ↓
Dashboard AI queries master dashboard
  ↓
Can see: "[GEN-THE-ARCHITECT] Budget Planning SOW"
         "[TTT-WORKSPACE] Property Estimate"
         "[UUUIIUI-WORKSPACE] Another SOW"
  ↓
Can answer: "How many SOWs in TTT workspace?" ✅
           "What's total budget across all?" ✅
           "Show me all real estate SOWs" ✅
```

---

## Known Issues & Fixes

### ✅ FIXED #1: Workspace Embedding (October 22, 2025)

**Problem**: When creating a new workspace, the system was immediately embedding the knowledge base into an EMPTY workspace.

**Fix Applied**:
- Removed `embedCompanyKnowledgeBase()` from `createOrGetClientWorkspace()` function
- Knowledge base now ONLY embeds when first SOW is created
- Master dashboard STILL embeds knowledge base (for analytics)

**Code Change**: `frontend/lib/anythingllm.ts` lines 93-109

**Result**: Clean workspace creation flow with no unnecessary API calls

---

### ✅ FIXED #2: Chat Messages Disappearing + 400 Errors (October 22, 2025)

**Root Cause**: Workspace routing mismatch - threads were created in client workspace (e.g., "hello") but then accessed from gen-the-architect workspace.

**What was happening**:
1. Create SOW in "hello" workspace → thread created in "hello" ✅
2. Open SOW for chat → code forced workspace to "gen-the-architect" ❌
3. Try to fetch chat from "gen-the-architect" → 400 (thread doesn't exist) 
4. Auto-create NEW thread in wrong workspace
5. Messages go to wrong thread → disappear

**Fixes Applied**:
1. **Line 683** (`frontend/app/page.tsx`): Load chat from SOW's actual workspace, not hardcoded gen-the-architect
2. **Line 1356** (`frontend/app/page.tsx`): Create SOW threads in CLIENT WORKSPACE, not gen-the-architect
3. **Line 2340** (`frontend/app/page.tsx`): Route SOW editor chat to SOW's workspace, not gen-the-architect

**Code Changes**:
- Use `doc.workspaceSlug` instead of hardcoded workspace name
- Create threads in `workspace.workspace_slug` (client workspace)
- Route chat requests to correct workspace based on SOW properties

**Result**: 
- ✅ Chat messages now persist
- ✅ No duplicate threads created in wrong workspace
- ✅ 400 errors eliminated
- ✅ SOW chat works consistently

---

### ⚠️ Issue #3: 401 Unauthorized on Dashboard Chat (Pending Investigation)

**Symptoms**:
- Dashboard AI: Opens, but "Send" button returns 401
- Gen AI (SOW editor): Chat works for some, fails with 401 for others
- Console: `Response Status: 401`

**Root Cause** (Suspected):
- AnythingLLM API key not being sent in request headers
- OR token is invalid/expired
- OR auth middleware in Next.js route handler is blocking

**Location**:
- Endpoint: `/frontend/app/api/anythingllm/stream-chat/route.ts`
- Caller: `/frontend/app/page.tsx` lines 2300-2450

**Next Steps**:
- Deploy to production and test dashboard chat
- Check browser console for auth debug output
- Verify token is valid in AnythingLLM settings

---

## API Routes & Auth

### AnythingLLM Routes (All Need Auth)

| Endpoint | Purpose | Auth Header |
|----------|---------|-------------|
| `POST /api/v1/document/raw-text` | Upload SOW text | `Bearer {ANYTHINGLLM_API_KEY}` |
| `POST /api/v1/workspace/{slug}/update-embeddings` | Embed in workspace | `Bearer {ANYTHINGLLM_API_KEY}` |
| `POST /api/v1/workspace/{slug}/stream-chat` | Chat in workspace | `Bearer {ANYTHINGLLM_API_KEY}` |
| `GET /api/v1/workspace/{slug}/thread/{threadSlug}/chats` | Get thread messages | `Bearer {ANYTHINGLLM_API_KEY}` |
| `POST /api/v1/workspace/{slug}/thread/{threadSlug}/chat` | Message in thread | `Bearer {ANYTHINGLLM_API_KEY}` |
| `POST /api/v1/workspace/{slug}/thread/new` | Create thread | `Bearer {ANYTHINGLLM_API_KEY}` |

### Frontend Routes That Call AnythingLLM

| Frontend Route | Calls | Purpose |
|---|---|---|
| `/api/anythingllm/stream-chat` | `/v1/workspace/{slug}/stream-chat` | Dashboard/Gen AI chat |
| `/api/anythingllm/chat` | `/v1/workspace/{slug}/chat` | Non-streaming chat |
| `/api/generate` | OpenRouter (NOT AnythingLLM) | Inline editor |

### Environment Variables Required

```bash
# AnythingLLM Access
ANYTHINGLLM_URL=https://ahmad-anything-llm.840tjq.easypanel.host
ANYTHINGLLM_API_KEY=0G0WTZ3-6ZX4D20-H35VBRG-9059WPA

# OpenRouter (for inline editor)
OPENROUTER_API_KEY=your-key-here

# Next.js Public
NEXT_PUBLIC_PDF_SERVICE_URL=http://localhost:8000
```

---

## Handover Notes

### What Works ✅
- ✅ SOW creation → thread auto-creates
- ✅ SOW embedding in both workspaces
- ✅ Inline editor AI (OpenRouter)
- ✅ Dashboard view loads
- ✅ Gen AI workspace exists
- ✅ Master dashboard auto-creates

### What's Broken ❌
- ❌ Dashboard AI chat (401 on send)
- ❌ Gen AI chat might have same 401 issue
- ❌ Chat messages not persisting (thread exists but 401 blocks load)

### Next Steps
1. **Debug 401 Error**: Add logging to `/api/anythingllm/stream-chat/route.ts`
2. **Verify Auth Token**: Check if `ANYTHINGLLM_API_KEY` is valid
3. **Test AnythingLLM**: Direct curl to AnythingLLM to verify it's accessible
4. **Fix Auth**: Ensure all AnythingLLM requests include Bearer token
5. **Retest**: Both Dashboard AI and Gen AI chat

---

## Key Files Reference

| File | Purpose | Status |
|------|---------|--------|
| `/frontend/lib/anythingllm.ts` | AnythingLLM API wrapper | ✅ Embedding works |
| `/frontend/app/page.tsx` | Main app component, SOW creation | ✅ Creation works |
| `/frontend/app/api/anythingllm/stream-chat/route.ts` | Chat endpoint (ISSUE HERE) | ❌ 401 error |
| `/frontend/components/tailwind/agent-sidebar-clean.tsx` | Dashboard AI UI | ✅ UI works |
| `/frontend/components/tailwind/generative/ai-selector.tsx` | Inline editor AI | ✅ Works |

---

**LAST UPDATE**: October 22, 2025, 2:30 AM UTC  
**NEXT REVIEW**: After 401 error is fixed
