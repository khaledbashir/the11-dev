# 🏗️ SOW Tagging System - Architecture & Data Flow

**Visual Guide to Understanding the Implementation**

---

## 🗺️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SOCIAL GARDEN SOW GENERATOR                 │
│                          (Frontend: Next.js)                    │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACE LAYER                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  Main Dashboard                                                    │    │
│  │  ┌──────────────────────────────────────────────────────────────┐ │    │
│  │  │  Left Sidebar: SOW List (NEW - WITH TAGS)                  │ │    │
│  │  │  ┌──────────────────────────────────────────────────────┐   │ │    │
│  │  │  │ 📁 My Folder                                       │   │ │    │
│  │  │  │   📄 Acme Corp Setup     [+ Vertical] [+ Service]  │   │ │    │
│  │  │  │   📄 Beta Finance        🏢 Finance   📱 Consulting │   │ │    │
│  │  │  │   📄 Gamma Healthcare    🏥 Healthcare 🎓 Training  │   │ │    │
│  │  │  └──────────────────────────────────────────────────────┘   │ │    │
│  │  │                                                             │ │    │
│  │  │  Center: SOW Editor                                         │ │    │
│  │  │  Right: AI Chat (AnythingLLM)                              │ │    │
│  │  │  Bottom Right: BI Dashboard Widgets (ENABLED NOW)          │ │    │
│  │  │    - SOWs by Vertical                                      │ │    │
│  │  │    - SOWs by Service Line                                  │ │    │
│  │  │    - Revenue Distribution                                  │ │    │
│  │  └──────────────────────────────────────────────────────────┘ │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                            API LAYER                                         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────┐  ┌────────────────────────┐                 │
│  │ GET /api/sow/list         │  │ GET /api/admin/        │                 │
│  │ (Load SOWs with tags)     │  │ backfill-tags          │                 │
│  │                           │  │ (One-time migration)   │                 │
│  │ Returns:                  │  │                        │                 │
│  │ - id                      │  │ Fetches: NULL tags     │                 │
│  │ - title                   │  │ AI: Analyze title+     │                 │
│  │ - status                  │  │      content           │                 │
│  │ - vertical ⭐ NEW        │  │ Updates: vertical,     │                 │
│  │ - service_line ⭐ NEW    │  │          service_line  │                 │
│  └───────────────────────────┘  │                        │                 │
│                                 │ Model: GPT-3.5-Turbo   │                 │
│  ┌────────────────────────────────────────────────────┐ │                 │
│  │ PUT /api/sow/[id]                                  │ │                 │
│  │ (Auto-save tag selection)                          │ │                 │
│  │                                                    │ │                 │
│  │ Request:                     └────────────────────────┘                 │
│  │ {                                                   │                 │
│  │   "vertical": "technology",                         │                 │
│  │   "serviceLine": "crm-implementation"               │                 │
│  │ }                                                   │                 │
│  └────────────────────────────────────────────────────┘                 │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                          DATABASE LAYER (MySQL)                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  sows table:                                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │ id   │ title            │ vertical          │ service_line      │        │
│  ├─────────────────────────────────────────────────────────────────┤        │
│  │ s-1  │ Acme Corp        │ technology ✅     │ crm-impl ✅       │        │
│  │ s-2  │ Beta Finance     │ finance ✅        │ consulting ✅     │        │
│  │ s-3  │ Gamma Healthcare │ healthcare ✅     │ training ✅       │        │
│  │ s-4  │ New SOW (unset)  │ NULL ❌           │ NULL ❌           │        │
│  │ s-5  │ Draft SOW        │ NULL ❌           │ NULL ❌           │        │
│  └─────────────────────────────────────────────────────────────────┘        │
│                                                                              │
│  ENUM Values (Pre-defined):                                                  │
│  Vertical: property | education | finance | healthcare | retail |            │
│            hospitality | professional-services | technology | other           │
│                                                                              │
│  Service Line: crm-implementation | marketing-automation | revops-strategy│ │
│                managed-services | consulting | training | other             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                       EXTERNAL AI SERVICE LAYER                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────┐        │
│  │ OpenRouter API (Backfill Only)                                 │        │
│  │                                                                │        │
│  │ Input: SOW title + content excerpt (first 2000 chars)         │        │
│  │ Model: gpt-3.5-turbo (fast, cheap)                            │        │
│  │ Prompt: "Classify this SOW into vertical and service_line"   │        │
│  │                                                                │        │
│  │ Output: { vertical, service_line, confidence, reasoning }     │        │
│  │                                                                │        │
│  │ Cost: ~$0.01-0.02 per 32 SOWs                                 │        │
│  │ Time: ~15-30 seconds for ~32 SOWs                             │        │
│  └────────────────────────────────────────────────────────────────┘        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Diagrams

### Flow 1: Backfill (One-Time Migration)

```
┌─────────────────┐
│  Admin User     │
│ Calls Backfill  │
│  GET /api/      │
│  admin/         │
│  backfill-tags  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Backend: backfill-tags route        │
│                                     │
│ 1. SELECT * FROM sows              │
│    WHERE vertical IS NULL           │
│                                     │
│    Result: [s1, s2, s3, ...]       │
└────────┬────────────────────────────┘
         │
         ▼ (for each SOW)
┌─────────────────────────────────────┐
│ AI Analysis Loop                    │
│                                     │
│ For each untagged SOW:              │
│ 1. Extract title + content          │
│ 2. Call OpenRouter API              │
│ 3. Parse AI response                │
│ 4. Get: {vertical, service_line}   │
│ 5. UPDATE database                  │
│ 6. Add to results array             │
│ 7. Wait 500ms (rate limit)          │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Database Updated                    │
│                                     │
│ UPDATE sows SET                     │
│   vertical = ?,                     │
│   service_line = ?                  │
│ WHERE id = ?                        │
│                                     │
│ Result: All 32 SOWs now tagged ✅  │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ API Response to Admin               │
│                                     │
│ {                                   │
│   "success": true,                  │
│   "updated_sows": 32,               │
│   "message": "..."                  │
│ }                                   │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Dashboard Widgets Enabled ✅         │
│ (Now have data to display)          │
└─────────────────────────────────────┘
```

---

### Flow 2: New SOW Tagging (Daily Workflow)

```
┌──────────────────────┐
│  User Creates SOW    │
│  in Editor           │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────┐
│ SOW Saved to Database        │
│                              │
│ INSERT INTO sows             │
│   vertical: NULL             │
│   service_line: NULL         │
│                              │
│ id: 'sow-new-12345'         │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│ Sidebar Loads SOW List                   │
│                                          │
│ GET /api/sow/list                        │
│ Response includes: vertical, service_line│
│                                          │
│ For this SOW: {                          │
│   id: 'sow-new-12345',                  │
│   vertical: null,                        │
│   service_line: null                    │
│ }                                        │
└──────────┬───────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│ SOWTagSelector Component Renders        │
│                                          │
│ State: UNTAGGED                          │
│ Display:                                 │
│   📄 My SOW                              │
│   [+ Vertical] [+ Service Line]          │
│   ▼ (dropdowns available)                │
└──────────┬───────────────────────────────┘
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
┌────────┐  ┌──────────────┐
│ User   │  │ No Action    │
│ Clicks │  │ = No Tags    │
│ Drop- ─┤  │ (OK for now) │
│ down   │  └──────────────┘
└────┬───┘
     │
     ▼
┌──────────────────────────────────────────┐
│ Dropdown Opens: Vertical Options         │
│                                          │
│ [ 🏠 Property                ]           │
│ [ 🎓 Education               ]           │
│ [ 💰 Finance                 ]           │
│ [ 💻 Technology (selected)   ] ◄──────┐  │
│ [ 🏨 Hospitality             ]           │
│ [ ❓ Other                   ]           │
└──────────┬───────────────────────────────┘
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
┌────────┐  ┌──────────────────────────┐
│ User   │  │ Selection               │
│ Clicks │  │ "Technology" Selected   │
│        │  │                        │
│ (set   │  │ Frontend State:        │
│  state)│  │ vertical = "technology"│
└────┬───┘  └──────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────┐
│ PUT /api/sow/sow-new-12345               │
│ {                                        │
│   vertical: "technology",                │
│   serviceLine: "crm-implementation"      │
│ }                                        │
│                                          │
│ (Auto-save triggered)                    │
└──────────┬───────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│ Backend Updates Database                 │
│                                          │
│ UPDATE sows SET                          │
│   vertical = "technology",               │
│   service_line = "crm-implementation"    │
│ WHERE id = "sow-new-12345"              │
│                                          │
│ Success ✅                                │
└──────────┬───────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│ Frontend Response                        │
│                                          │
│ Component State Updated                  │
│ Toast: "Tags updated"                    │
│                                          │
│ UI Transforms:                           │
│ [+ Vertical] → [💻 Technology]           │
│ [+ Service Line] → [🔧 CRM Impl]         │
└──────────┬───────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│ Page Refresh                             │
│ (or manual check)                        │
│                                          │
│ Sidebar shows:                           │
│ 📄 My SOW                                │
│    💻 Technology   🔧 CRM Implementation │
│    (as persistent badges)                │
│                                          │
│ Persistence ✅ Verified                  │
└──────────────────────────────────────────┘
```

---

### Flow 3: Component Interaction

```
┌─────────────────────────────────────┐
│ sidebar-nav.tsx (Parent)            │
│ - Loads SOW list from API           │
│ - Renders SortableSOWItem for each  │
│ - Passes vertical/service_line      │
└──────────────┬──────────────────────┘
               │
               ▼
    ┌────────────────────────┐
    │ SortableSOWItem        │
    │ (Drag-drop wrapper)    │
    │                        │
    │ ┌────────────────────┐ │
    │ │ SOW Name + Buttons│ │
    │ │ [Rename] [Delete]│ │
    │ └────────────────────┘ │
    │                        │
    │ ┌────────────────────┐ │
    │ │ SOWTagSelector ◄───┼─┼─ Receives:
    │ │ (NEW)              │ │   - sowId
    │ │                    │ │   - sowTitle
    │ │ ┌─────────────────┐│ │   - currentVertical
    │ │ │ Untagged State: ││ │   - currentServiceLine
    │ │ │ [+ Vertical]    ││ │
    │ │ │ [+ Service Line]││ │
    │ │ └─────────────────┘│ │
    │ │                    │ │
    │ │ ┌─────────────────┐│ │
    │ │ │ Tagged State:   ││ │
    │ │ │ [Badge1] [Badge2]
    │ │ └─────────────────┘│ │
    │ └────────────────────┘ │
    └────────────────────────┘
               │
       ┌───────┴───────────────────┐
       │                           │
       ▼ (Dropdown Open)           ▼ (Badge Click)
    ┌──────────────┐          ┌──────────────┐
    │ Dropdown     │          │ Tag Selected │
    │ Menu Visible │          │ Show Dropdown│
    │              │          │ Allow Edit   │
    │ Options:     │          └──────────────┘
    │ - Property   │
    │ - Education  │
    │ - ...        │ (Selection triggers)
    │ - Other      │          ▼
    └──────────────┘    ┌──────────────────┐
                        │ Auto-Save        │
                        │ PUT /api/sow/id  │
                        │ {vertical, sl}   │
                        └──────────────────┘
```

---

## 📊 State Diagram (SOWTagSelector)

```
    ┌─────────────────────────┐
    │  Initial: UNTAGGED      │
    │  vertical: null         │
    │  service_line: null     │
    └────────────┬────────────┘
                 │
    ┌────────────┴────────────┐
    │                         │
    ▼                         ▼
┌─────────────────┐  ┌──────────────────┐
│ Vertical NOT    │  │ Service Line NOT │
│ Selected        │  │ Selected         │
│                 │  │                  │
│ [+ Vertical]    │  │ [+ Service Line] │
│ Dropdown Open   │  │ Dropdown Open    │
└────────┬────────┘  └────────┬─────────┘
         │                    │
         │ (user selects)     │ (user selects)
         ▼                    ▼
┌─────────────────────────────────────────┐
│ BOTH SELECTED                           │
│ vertical: 'technology'                  │
│ service_line: 'crm-implementation'      │
│                                         │
│ Auto-save triggered:                    │
│ PUT /api/sow/id {vertical, serviceLine} │
└────────┬────────────────────────────────┘
         │
         ▼ (After success)
┌─────────────────────────────────────────┐
│ TAGGED (Display Mode)                   │
│                                         │
│ [💻 Technology] [🔧 CRM Implementation] │
│ (Badges displayed)                      │
│                                         │
│ Click badge → Back to dropdown edit     │
└─────────────────────────────────────────┘
```

---

## 🔐 Security & Validation

```
┌──────────────────────────────────────┐
│ Input Validation Chain               │
├──────────────────────────────────────┤
│                                      │
│ 1. Frontend: Dropdown selection      │
│    ✓ Only enum values allowed        │
│    ✓ No free text entry              │
│                                      │
│ 2. Frontend: Before API call         │
│    ✓ Both fields required            │
│    ✓ No partial submissions          │
│                                      │
│ 3. Backend: API validation           │
│    ✓ Check vertical ∈ ENUM           │
│    ✓ Check serviceLine ∈ ENUM        │
│    ✓ Check SOW exists                │
│                                      │
│ 4. Database: Constraint check        │
│    ✓ MySQL ENUM constraint           │
│    ✓ No invalid values accepted      │
│    ✓ Foreign key validation          │
│                                      │
│ 5. Error Handling                    │
│    ✓ Any validation failure          │
│    ✓ → Graceful revert to previous   │
│    ✓ → Toast error notification      │
│    ✓ → Log for debugging             │
│                                      │
└──────────────────────────────────────┘
```

---

## 📈 Performance Characteristics

```
┌────────────────────────────────────────────┐
│ Operation         │ Time    │ Notes        │
├────────────────────────────────────────────┤
│ Backfill (32 SOWs)│ 15-30s  │ Includes AI  │
│ Load SOW List     │ 100-200ms
│ Tag Dropdown      │ <100ms  │ UI only      │
│ Auto-Save Tag     │ 300-500ms
│ API Response      │ 50-100ms│ DB write     │
│ Sidebar Render    │ <50ms   │ Fast        │
│ Badge Display     │ <10ms   │ UI swap      │
└────────────────────────────────────────────┘
```

---

## 🎯 Integration Points Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    Component Ecosystem                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  sidebar-nav.tsx                                            │
│  │                                                          │
│  ├─ Imports: SOWTagSelector                               │
│  ├─ Uses: vertical, service_line from SOW object          │
│  └─ Passes: sowId, currentVertical, currentServiceLine    │
│      │                                                     │
│      ▼                                                     │
│      SOWTagSelector Component                             │
│      │                                                     │
│      ├─ State: vertical, serviceLine, showDropdown        │
│      ├─ Calls: PUT /api/sow/[id]                          │
│      └─ Emits: onTagsUpdated callback                     │
│          │                                                 │
│          ▼                                                 │
│          PUT /api/sow/[id]                                │
│          │                                                │
│          └─ Database: UPDATE sows                         │
│             │                                              │
│             ▼                                              │
│             Response triggers:                            │
│             ├─ Toast notification                         │
│             ├─ UI state update                            │
│             └─ Callback to parent (if provided)           │
│                                                            │
│  Other Flows:                                              │
│  │                                                          │
│  page.tsx → api/sow/list → sidebar-nav ──┐               │
│                                            │               │
│                                            ▼               │
│                         SOW object includes tags           │
│                                                            │
│  Backfill Flow:                                            │
│  │                                                          │
│  curl /api/admin/backfill-tags → Loop                      │
│  │                                ├─ OpenRouter API        │
│  │                                └─ UPDATE database       │
│  │                                                         │
│  └─→ Response JSON with results                            │
│                                                            │
└─────────────────────────────────────────────────────────────┘
```

---

**This architecture ensures:**
- ✅ Clean separation of concerns
- ✅ One-time backfill works independently
- ✅ Daily tagging is frictionless
- ✅ Data flows consistently end-to-end
- ✅ Error handling is graceful throughout
- ✅ UI/UX encourages proper tagging
