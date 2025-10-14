# CRITICAL FIXES NEEDED - Sam's Requirements

Based on Sam's conversation.md (lines 1600-2032), here are the CRITICAL issues that must be fixed:

## 🚨 CRITICAL BUGS (Blocking Production)

### 1. PDF Export Downloading Placeholder
**Issue**: PDF export is downloading placeholder HTML instead of actual SOW content
**Sam's Feedback**: "The export itself as a PDF looks good but..." (implies it's working in some tests but broken in others)
**Root Cause**: `convertNovelToHTML()` may not be properly serializing the editor content
**Fix Required**:
- Debug the `convertNovelToHTML` function
- Ensure it handles all node types (editablePricingTable, regular tables, etc.)
- Test with actual SOW content from editor
- Verify tempDiv has actual content before PDF generation

### 2. Duplicate "New SOW" Buttons
**Issue**: Two ways to create SOW (sidebar + header button) causing confusion
**Sam's Requirement**: ONE clear entry point
**Fix Required**:
- Remove duplicate button
- Keep only the most intuitive location (probably header)
- Ensure sidebar shows document history, not creation button

### 3. Document History Not Working
**Issue**: "My folder for Sam's Tests disappeared and i've lost previous scopes"
**Sam's Requirement**: Documents must persist, be accessible, renameable, deletable
**Fix Required**:
- AI should auto-rename documents based on client/project name
  - Example: "AssistedVIP - HubSpot Integration"
  - Not: "Untitled Document"
- Enable manual rename (right-click or inline edit)
- Enable delete with confirmation
- Fix localStorage persistence (documents keep disappearing)

### 4. Folder Drag-Drop Not Working
**Issue**: "FYI folder drag and drop didn't work to move scopes into folders"
**Sam's Requirement**: Drag documents into folders for organization
**Fix Required**:
- Implement @dnd-kit for document drag-drop
- Visual feedback during drag
- Drop zones on folders
- Persist folder structure properly
- Test folder expand/collapse

### 5. Budget Not Being Respected
**Issue**: "It's not listening to the budget I listed i.e. 10k for an email template it came back with a way over the top 35k S.O.W"
**Sam's Requirement**: AI MUST respect budget constraints strictly
**Fix Required**:
- Update THE_ARCHITECT_SYSTEM_PROMPT with stricter budget logic
- Add budget validation before generating SOW
- If budget too low, AI should:
  - Scope down deliverables
  - Use junior roles
  - Suggest phased approach
  - NOT just ignore the budget

### 6. Deliverables Format Wrong
**Issue**: Deliverables are coming out as paragraphs, not hierarchical bullets
**Sam's Example**:
```
HubSpot Implementation & Configuration Deliverables
1x Marketing, Service & Content Hub Implementation

Marketing Hub Enterprise Setup with 10,000 Marketing Contacts...

Initial Account Configuration
+ General settings setup & Multi-brand kit configuration
+ Testing sandbox setup if available
+ ERD diagram & data dictionary

Marketing Hub Implementation
+ Planning workshop
+ Set up website tracking
 – Example: Add to Google Tag Manager
 – Example: Client web team instructions
+ Domain validation process
```

**Fix Required**:
- Update AI prompt to generate hierarchical bullets
- Format: Parent (no bullet), Child (+), Sub-child (–)
- NOT paragraphs or simple bullet lists
- Update markdown-to-JSON converter to handle this format

### 7. Not Enough Role Detail
**Issue**: "The roles/tasks aren't being allocated correctly and there isn't enough of them shown"
**Sam's Example**: For a HubSpot project, needs:
- Project Manager
- Account Manager
- Senior Consultant (Advisory)
- Database Specialist
- Integration Specialist
- Producer (Support & Monitoring)
- Project Coordination
**Currently Getting**: Just 1-2 roles

**Fix Required**:
- Update AI prompt with role allocation examples
- Ensure multiple roles per phase
- Follow "Sam's Law" for mandatory PM/AM roles
- Add granular technical roles based on deliverables

### 8. Dropdown Role Selector Not Working
**Issue**: "I used the drop down to select a different task/job for design and it didn't change or work"
**Fix Required**:
- Debug the editablePricingTable component
- Ensure role dropdown onChange updates state
- Rate should auto-populate when role selected
- Test all 82 roles

### 9. Drag-Drop Role Reordering Not Working
**Issue**: "I need to be able to move around the layout of the role's, i.e. drag and drop"
**Sam's Requirement**: Reorder roles to match service delivery sequence
**Fix Required**:
- Implement @dnd-kit/sortable in pricing table
- Draggable table rows
- Visual feedback during drag
- Persist order in table state

### 10. GST Display Format
**Issue**: "on the GST it should say +GST in the summary price on each not including at the bottom"
**Sam's Requirement**: Show "+GST" next to each line item, not just in summary
**Fix Required**:
- Update pricing table display to show "+GST" on individual costs
- Summary should also show GST calculation separately
- Example: "$1,200 +GST" for each role

### 11. Toggle Summary Price
**Issue**: "can there be a button to toggle on and off the summarised price"
**Sam's Use Case**: Showing 3 SOW options, don't want total of all 3
**Fix Required**:
- Add toggle button in editor toolbar
- Show/hide grand total section
- Keep individual SOW totals visible
- Persist toggle state

## 📊 PRIORITY ORDER

1. **PDF Export (Blocker)** - Can't deliver to clients
2. **Budget Adherence (Critical)** - Wrong pricing = lost deals
3. **Deliverables Format (Critical)** - Unprofessional output
4. **Role Allocation (Critical)** - Inaccurate scoping
5. **Document Persistence (High)** - Losing work
6. **Folder Drag-Drop (High)** - Organization needed
7. **Rename/Delete Docs (High)** - Basic functionality
8. **Dropdown Fixes (Medium)** - UX issue
9. **Role Reordering (Medium)** - Nice to have
10. **GST Format (Low)** - Display preference
11. **Toggle Summary (Low)** - Edge case

## 🎯 SAM'S ACTUAL WORKFLOW

From the conversation, Sam's ideal workflow is:

1. **Chat with AI**: "HubSpot integration for AssistedVIP, 3 landing pages, budget $4,000"
2. **AI Generates**: Professional SOW with:
   - Proper deliverable hierarchy
   - Multiple roles allocated correctly
   - Budget respected (not $35k when asked for $4k!)
   - Detailed line items
3. **Insert to Editor**: Click /inserttosow
4. **Edit Pricing Table**: Interactive, drag roles, adjust hours
5. **Export PDF**: Professional, branded, actual content (not placeholder!)
6. **Save & Organize**: Auto-named, in folders, easily findable

## 🔧 TECHNICAL DEBT

- Remove PricingTableBuilder standalone component (not needed)
- Fix convertNovelToHTML to handle all node types
- Update THE_ARCHITECT_SYSTEM_PROMPT with Sam's examples
- Implement document lifecycle (create → rename → organize → delete)
- Fix folder persistence in localStorage
- Add proper error handling and user feedback

## 📝 TESTING CHECKLIST

Use Sam's exact example:
```
"HubSpot integration for AssistedVIP and 3 landing pages budget is 4000"
```

Expected Output:
- Budget: ~$3,795 (within $4k)
- Roles: PM, AM, Integration Specialist, Producer (multiple roles)
- Deliverables: Hierarchical bullets with + and – formatting
- PDF: Professional, actual content, branded
- Saves as: "AssistedVIP - HubSpot Integration"
- Can drag into "Client Projects" folder
- Can export and send to client

## 🚀 NEXT ACTIONS

1. Fix PDF export (BLOCKER)
2. Update AI prompt with budget logic + deliverable format
3. Implement document rename/delete
4. Fix folder drag-drop
5. Test with Sam's example
6. Get Sam's approval before continuing
