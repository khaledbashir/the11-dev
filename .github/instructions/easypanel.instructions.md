---
applyTo: '**'
---
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

### PDF Export System Architecture (CRITICAL - Updated Nov 2025)

**There are TWO PDF export buttons with DIFFERENT behaviors:**

#### Button 1: "Export PDF" (Legacy/Simple)
- **Location**: Document toolbar
- **What it does**: Converts current editor content to HTML → sends to backend
- **Backend endpoint**: `/generate-pdf` (simple HTML passthrough)
- **Use case**: Quick exports, non-multi-scope documents
- **Template**: Uses `SOW_TEMPLATE` in `backend/main.py`

#### Button 2: "Export Professional PDF" (Multi-Scope)
- **Location**: Document actions menu
- **What it does**: Uses structured v4.1 JSON data → professional multi-scope rendering
- **Backend endpoints**: 
  - `/generate-professional-pdf` (for multi-scope with structured data)
  - Falls back to `/generate-pdf` (if no multi-scope data available)
- **Use case**: Multi-phase/multi-scope SOWs with separate pricing tables
- **Template**: Uses `multiscope_template.html` (Jinja2 template)

### How Multi-Scope PDF Generation Works

**Frontend Flow** (`/frontend/app/page.tsx`):
1. AI generates v4.1 JSON with `scopes` array
2. `extractPricingJSON()` detects and extracts scopes
3. Stores in `multiScopePricingData` state:
   ```typescript
   {
     scopes: [{scope_name, scope_description, role_allocation}],
     discount: 10,
     projectTitle: "...",
     extractedAt: timestamp
   }
   ```
4. `handleExportNewPDF()` checks if scopes exist
5. `transformScopesToPDFFormat()` converts v4.1 → backend format
6. Sends to `/api/generate-professional-pdf`

**API Route** (`/frontend/app/api/generate-professional-pdf/route.ts`):
- Detects if `body.scopes` exists
- **Multi-scope**: Routes to backend `/generate-professional-pdf`
- **Simple**: Routes to backend `/generate-pdf`

**Backend** (`/backend/main.py`):
- `/generate-pdf`: Simple HTML → PDF (lines 370-437)
- `/generate-professional-pdf`: Structured data → Jinja2 template → PDF (lines 548-595)

**Template** (`/backend/multiscope_template.html`):
- Iterates over scopes array
- Creates separate pricing table per scope
- Generates Investment Overview table
- Calculates Financial Summary (Subtotal, Discount, GST, Total)

### The Architect Prompt Versions (CRITICAL)

**Current Active Version: V4.1** (Self-Contained Multi-Scope)
- **Location**: `/frontend/lib/knowledge-base.ts` → `THE_ARCHITECT_V4_PROMPT`
- **Features**:
  - Embedded 82-role official rate card (no RAG needed)
  - 6-step financial reasoning protocol
  - Multi-scope JSON output format
- **JSON Format**:
  ```json
  {
    "scopes": [
      {
        "scope_name": "Phase 1: Strategy",
        "scope_description": "...",
        "deliverables": ["..."],
        "assumptions": ["..."],
        "role_allocation": [
          {"role": "Tech - Sr. Consultant - Strategy", "hours": 10}
        ]
      }
    ],
    "discount": 10
  }
  ```

**How Prompt Gets Injected**:
- File: `/frontend/lib/anythingllm.ts`
- Function: `setWorkspacePrompt()` (lines 641-680)
- **CRITICAL**: Line 5 imports `THE_ARCHITECT_V4_PROMPT`
- Called when: Creating NEW SOW workspace
- **Does NOT update existing workspaces** (AnythingLLM stores prompt per workspace)

**Testing Multi-Scope MUST Use NEW Documents**:
- Existing documents have old V2 prompt cached
- Click "New Document" → Select "SOW" type
- This creates new workspace with V4.1 prompt
- Verify console shows: `🎯 [PROMPT INJECTION VERIFICATION]`

### PDF Export Troubleshooting

**Problem**: PDF shows single consolidated pricing table
- **Cause**: Frontend not detecting multi-scope data OR backend using wrong endpoint
- **Fix**: 
  1. Check console for: `✅ Stored multi-scope pricing data: X scopes`
  2. Check console for: `✅ [PDF Export] Using multi-scope professional format`
  3. If missing, document was created before V4.1 deployment

**Problem**: PDF missing Financial Summary
- **Cause**: Backend using simple template instead of `multiscope_template.html`
- **Fix**: Verify frontend sends `scopes` array in request body

**Problem**: Empty PDF or placeholder content
- **Cause**: HTML conversion failed OR data format mismatch
- **Fix**: 
  1. Check frontend logs: `🔄 [PDF Export] Converted HTML length`
  2. Check backend logs: `=== DEBUG: Professional PDF Generation Request ===`
  3. Verify `scopes[].items` has `role`, `hours`, `cost` properties

**Problem**: Role rates are wrong
- **Cause**: Using cached rates OR role name doesn't match official rate card
- **Fix**: 
  1. Import `getRateForRole` from `/frontend/lib/rateCard.ts`
  2. Official rate card has 88 roles with exact names
  3. Check console: AI should use exact names from `[OFFICIAL_RATE_CARD]`

**Problem**: PDF generation returns 404 "Not Found" error (CRITICAL - Nov 8, 2025)
- **Error**: `❌ [PDF Service] Multi-scope error response: {"detail":"Not Found"}`
- **Cause**: Backend on EasyPanel not running latest code with `/generate-professional-pdf` endpoint
- **How to diagnose**:
  ```bash
  # Check backend health
  curl https://ahmad-socialgarden-backend.840tjq.easypanel.host/health
  
  # Check which branch you're on
  git branch
  
  # Verify endpoint exists in code
  grep -n "generate-professional-pdf" backend/main.py
  ```
- **Fix**: Trigger EasyPanel backend redeploy
  ```bash
  # Switch to backend branch
  git checkout backend-service
  
  # Create empty commit to trigger redeploy
  git commit --allow-empty -m "chore: trigger backend redeploy"
  
  # Push to trigger EasyPanel auto-deploy
  git push origin backend-service
  
  # Wait 5-10 minutes for deployment
  ```
- **Verify fix**: Check backend logs in EasyPanel UI for "generate-professional-pdf" route registration

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
  /app
    /page.tsx                              # Main editor (4800+ lines)
    /api/generate-professional-pdf/route.ts  # PDF API proxy
  /lib
    /knowledge-base.ts                     # THE_ARCHITECT_V4_PROMPT
    /anythingllm.ts                        # AI integration, prompt injection
    /rateCard.ts                           # Official 88-role rate card
    
/backend      # FastAPI (backend-service branch)
  /main.py                                 # PDF endpoints
  /multiscope_template.html                # Multi-scope Jinja2 template
  
/.github/instructions/easypanel.instructions.md  # THIS FILE
```

## 🎯 Key Functions & Their Roles

### Frontend (`/frontend/app/page.tsx`)

**JSON Parsing**:
- `extractPricingJSON()` (lines 138-200): Detects v4.1 scopes array
- `extractBudgetAndDiscount()` (lines 86-135): Extracts from user prompt
- `transformScopesToPDFFormat()` (lines 128-178): Converts v4.1 → backend schema

**Content Conversion**:
- `convertMarkdownToNovelJSON()` (lines 273-750): AI markdown → TipTap editor JSON
- `convertNovelToHTML()` (lines 2820-3140): TipTap JSON → HTML for PDF
- Tracks `currentScopeTitle` from H2 headings for scope organization

**PDF Export**:
- `handleExportNewPDF()` (lines 2708-2820): Main export handler
  - Checks `multiScopePricingData` state
  - Calls `transformScopesToPDFFormat()` if scopes exist
  - Routes to appropriate backend endpoint

**State Management**:
- `multiScopePricingData` (line 1073): Stores extracted scopes for PDF generation
- `structuredSow` (line 1070): Structured SOW data (Architect JSON)
- `latestEditorJSON` (line 929): Current editor content

### Frontend (`/frontend/lib/anythingllm.ts`)

**Workspace Management**:
- `setWorkspacePrompt()` (lines 641-680): Injects system prompt
  - **CRITICAL**: Uses `THE_ARCHITECT_V4_PROMPT` for SOW workspaces
  - Logs verification: `🎯 [PROMPT INJECTION VERIFICATION]`
  - Shows prompt length, markers, rate card presence

**Chat Integration**:
- `streamChatResponse()`: Handles streaming AI responses
- `getOrCreateMasterDashboard()`: Creates central dashboard workspace

### Backend (`/backend/main.py`)

**PDF Endpoints**:
- `/generate-pdf` (lines 370-437):
  - Input: `{html_content, filename, projectTitle}`
  - Uses: `SOW_TEMPLATE` (simple HTML wrapper)
  - For: Quick exports, legacy documents
  
- `/generate-professional-pdf` (lines 548-595):
  - Input: `{projectTitle, scopes, discount, clientName, company, ...}`
  - Uses: `multiscope_template.html` (Jinja2)
  - For: Multi-scope SOWs with proper structure

**Data Models**:
- `PDFRequest` (lines 34-40): Simple HTML-based request
- `ProfessionalPDFRequest` (lines 535-546): Structured multi-scope request
  - Requires: `scopes` array with `title`, `description`, `deliverables`, `items`
  - Optional: `discount`, `budgetNotes`, `company`

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

## 🧪 Testing Multi-Scope PDF (Step-by-Step)

### Prerequisites
1. Deployment completed (wait 5-10 minutes after push)
2. Frontend accessible at `https://sow.qandu.me`
3. Backend healthy at `https://ahmad-socialgarden-backend.840tjq.easypanel.host/health`

### Test Procedure

**Step 1: Create NEW Document**
- Click "New Document" → Select "SOW" type
- **Why NEW**: Existing documents have old V2 prompt cached in AnythingLLM

**Step 2: Verify Prompt Injection**
- Open browser console (F12)
- Look for: `🎯 [PROMPT INJECTION VERIFICATION]`
- Should show:
  ```
  Contains "[FINANCIAL_REASONING]": true
  Contains "[OFFICIAL_RATE_CARD]": true
  Contains "v4.1 - Self-Contained Multi-Scope": true
  ```

**Step 3: Generate Multi-Scope SOW**
Use this test prompt:
```
Create a SOW for landing page development with a budget of $15,000 AUD including GST.
Apply a 10% discount.

The project has three phases:
- Phase 1: Strategy & Research (discovery, competitor analysis, user research)
- Phase 2: Design & Content (wireframes, visual design, copywriting)
- Phase 3: Development & Testing (build, QA, deployment)
```

**Step 4: Verify JSON Extraction**
Console should show:
```
🎯 [V4.1 MULTI-SCOPE] Found 3 scopes
✅ Stored multi-scope pricing data: 3 scopes, 10% discount
```

**Step 5: Export PDF**
- Click "Export Professional PDF" button
- Console should show:
  ```
  ✅ [PDF Export] Using multi-scope professional format (3 scopes)
  ```

**Step 6: Validate PDF Output**
PDF must contain:
- ✅ **Separate pricing table for each scope** (Strategy, Design, Development)
- ✅ **Investment Overview table** showing cost per scope
- ✅ **Financial Summary**:
  - Subtotal (before discount)
  - Discount (10% of subtotal)
  - Subtotal (after discount)
  - GST (10% of discounted subtotal)
  - Total (should be close to $15,000)

### Expected PDF Structure
```
═══════════════════════════════════════════════════════════
SOW: LANDING PAGE DEVELOPMENT
═══════════════════════════════════════════════════════════

PHASE 1: STRATEGY & RESEARCH
───────────────────────────────────────────────────────────
Description: Discovery, competitor analysis, user research

Deliverables:
• Research findings document
• Competitor analysis report
• User persona definitions

Pricing Table:
Role                                    Hours    Cost
Tech - Sr. Consultant - Strategy        8        $2,360
Content - Keyword Research (Onshore)    6        $900
Tech - Specialist - Research            10       $1,800
───────────────────────────────────────────────────────────
Scope Total: $5,060

PHASE 2: DESIGN & CONTENT
───────────────────────────────────────────────────────────
[Similar structure]

PHASE 3: DEVELOPMENT & TESTING
───────────────────────────────────────────────────────────
[Similar structure]

═══════════════════════════════════════════════════════════
INVESTMENT OVERVIEW
═══════════════════════════════════════════════════════════
Scope                              Cost
Phase 1: Strategy & Research       $5,060
Phase 2: Design & Content          $4,820
Phase 3: Development & Testing     $4,650
───────────────────────────────────────────────────────────
SUBTOTAL:                          $14,530

═══════════════════════════════════════════════════════════
FINANCIAL SUMMARY
═══════════════════════════════════════════════════════════
Subtotal (before discount):        $14,530
Discount (10%):                    -$1,453
Subtotal (after discount):         $13,077
GST (10%):                         $1,308
───────────────────────────────────────────────────────────
TOTAL PROJECT VALUE:               $14,385
═══════════════════════════════════════════════════════════
```

### Troubleshooting Test Failures

**Console shows: "No multi-scope data"**
- Document was created before V4.1 deployment
- Create NEW document after deployment completes

**Console shows: "hasValidSuggestedRoles=false"**
- AI didn't generate scopes array
- Check if workspace prompt was injected correctly
- Verify `THE_ARCHITECT_V4_PROMPT` is active

**PDF has single table instead of per-scope**
- Frontend not sending `scopes` array
- Check network tab: Request to `/api/generate-professional-pdf`
- Body should have `scopes` array, not `html_content`

**PDF missing Financial Summary**
- Backend using wrong template
- Check backend logs for: "Multi-scope professional PDF"
- Should use `multiscope_template.html`, not `SOW_TEMPLATE`

## 📊 Data Flow Diagram

```
User enters prompt with multi-phase requirements
              ↓
AnythingLLM processes with THE_ARCHITECT_V4_PROMPT
              ↓
AI generates [PRICING_JSON] with scopes array:
{
  "scopes": [
    {
      "scope_name": "Phase 1: Strategy",
      "scope_description": "...",
      "deliverables": ["..."],
      "role_allocation": [
        {"role": "Tech - Sr. Consultant - Strategy", "hours": 8}
      ]
    }
  ],
  "discount": 10
}
              ↓
Frontend: extractPricingJSON() detects scopes
              ↓
Stores in multiScopePricingData state
              ↓
User clicks "Export Professional PDF"
              ↓
handleExportNewPDF() checks for scopes
              ↓
transformScopesToPDFFormat() converts to backend schema:
{
  "scopes": [
    {
      "title": "Phase 1: Strategy",
      "items": [
        {"role": "...", "hours": 8, "rate": 295, "cost": 2360}
      ]
    }
  ]
}
              ↓
API route detects scopes array → routes to /generate-professional-pdf
              ↓
Backend loads multiscope_template.html
              ↓
Jinja2 iterates over scopes, creates separate tables
              ↓
WeasyPrint generates PDF with multi-scope structure
              ↓
User downloads professional multi-scope PDF
```

## 🔍 Debug Console Logs (What to Look For)

**Frontend Console Logs (Browser F12):**

**Good Flow (Multi-Scope Working)**:
```
🎯 [PROMPT INJECTION VERIFICATION] 
   Contains "v4.1 - Self-Contained Multi-Scope": true
   
📊 [PRICING_JSON] V4.1 Multi-Scope Format Detected
✅ Found 3 scopes

✅ Stored multi-scope pricing data: 3 scopes, 10% discount

📝 [PDF Export] Editor JSON: {...}
✅ [PDF Export] Using multi-scope professional format (3 scopes)

✅ [PDF Service] Using multi-scope professional endpoint (3 scopes)
✅ [PDF Service] Multi-scope professional PDF generated successfully
```

**Bad Flow (Falling Back to Simple)**:
```
⚠️ No [PROMPT INJECTION VERIFICATION] log
   → Document created before deployment

❌ CRITICAL ERROR: AI did not provide suggestedRoles JSON
   → Old prompt version, no scopes generated

📄 [PDF Export] Using standard HTML conversion (no multi-scope data)
   → Frontend didn't detect scopes

📄 [PDF Service] Using standard HTML-based endpoint
   → Backend using wrong template
```

**Backend Server Logs (Terminal/EasyPanel):**

**What to look for when debugging PDF issues:**
```bash
# Good - Multi-scope endpoint receiving request
🔍 [POST /api/generate-professional-pdf] Request received
📄 [POST /api/generate-professional-pdf] Request body: {
  projectTitle: 'Statement of Work',
  scopes: [ ... ]
}
✅ [PDF Service] Using multi-scope professional endpoint (3 scopes)

# Bad - 404 error means endpoint doesn't exist
❌ [PDF Service] Multi-scope error response: {"detail":"Not Found"}
   → Backend needs redeployment (see troubleshooting above)

# Bad - Pydantic validation errors mean missing required fields
❌ [PDF Service] Multi-scope error response: {"detail":[{"type":"missing","loc":["body","scopes",0,"id"]...
   → Frontend not sending complete data structure
   → Check transformScopesToPDFFormat() function
```

**How to read server logs:**
1. **Local development**: Check terminal where `npm run dev` or `python main.py` is running
2. **Production (EasyPanel)**: 
   - Login to EasyPanel
   - Select service (frontend or backend)
   - Click "Logs" tab
   - Look for errors around the time of PDF export

**Critical log patterns to search for:**
- `generate-professional-pdf` - Shows if endpoint is being called
- `Multi-scope error response` - Shows backend errors
- `PRICING_JSON` - Shows if frontend detected scopes
- `transformScopesToPDFFormat` - Shows if data transformation happened