# ✅ Phase 1 Testing Checklist

## 🧪 Manual Testing Guide

### Pre-Test Setup
```bash
cd /root/the11/novel-editor-demo/apps/web
pnpm dev
# Open http://localhost:3002
```

---

## Test Suite 1: Context Detection ✅

### Test 1.1: Short Paragraph
- [ ] Highlight 2-3 sentences (~30 words)
- [ ] AI Selector opens
- [ ] **Expected**: Badge shows "~30 words | ~10 sec read | tone | Readability"
- [ ] **Expected**: Suggests "Expand Details", "Fix Grammar"

### Test 1.2: Long Document
- [ ] Highlight 5+ paragraphs (>150 words)
- [ ] **Expected**: Badge shows correct word count
- [ ] **Expected**: Suggests "Summarize", "Executive Summary"

### Test 1.3: List with Numbers
- [ ] Highlight bullet list with prices/numbers
- [ ] **Expected**: Detects "list" type
- [ ] **Expected**: Suggests "Format as Table", "Add Pricing Table"

### Test 1.4: Professional Tone
- [ ] Highlight business document with words like "deliverable", "stakeholder"
- [ ] **Expected**: Badge shows "professional" tone
- [ ] **Expected**: Suggests SOW-related templates

### Test 1.5: Casual Tone
- [ ] Highlight text with contractions (don't, won't, can't)
- [ ] **Expected**: Badge shows "casual" tone
- [ ] **Expected**: Suggests "Make Professional"

---

## Test Suite 2: Smart Suggestions ✅

### Test 2.1: Click Suggestion
- [ ] Highlight any text
- [ ] Click one of the suggested action buttons
- [ ] **Expected**: Prompt input fills with template text
- [ ] **Expected**: Generation starts automatically
- [ ] **Expected**: Toast shows "Template selected: [Name]"

### Test 2.2: Multiple Suggestions
- [ ] Highlight different text types
- [ ] **Expected**: Always shows 2-5 suggestions
- [ ] **Expected**: Suggestions are relevant to context
- [ ] **Expected**: Icons and descriptions display correctly

### Test 2.3: No Suggestions
- [ ] Highlight 1-2 words only
- [ ] **Expected**: May show fewer suggestions or generic ones
- [ ] **Expected**: Still able to type custom prompt

---

## Test Suite 3: Loading States ✅

### Test 3.1: Staged Loading
- [ ] Enter any prompt and generate
- [ ] **Expected**: See 4 stages in order:
  1. 🧠 "Understanding your request..." (purple)
  2. 🪄 "Generating content..." (blue)
  3. ✨ "Formatting response..." (green)
  4. 🎯 "Almost done..." (indigo)
- [ ] **Expected**: Each stage has 3 bouncing dots
- [ ] **Expected**: Smooth transitions between stages

### Test 3.2: Loading Timing
- [ ] Generate with fast model (Gemini)
- [ ] **Expected**: Stages appear briefly but visible
- [ ] Generate with slow model (Claude)
- [ ] **Expected**: Stages last longer, clear progress indication

---

## Test Suite 4: Success & Error Handling ✅

### Test 4.1: Success Animation
- [ ] Generate any content successfully
- [ ] **Expected**: Green checkmark appears
- [ ] **Expected**: Message: "Content generated successfully!"
- [ ] **Expected**: Sparkle icon on right
- [ ] **Expected**: Auto-dismisses after 2 seconds
- [ ] **Expected**: Content displayed below

### Test 4.2: Error Display
- [ ] Disconnect internet OR use invalid API key
- [ ] Try to generate
- [ ] **Expected**: Red error box appears
- [ ] **Expected**: Shows error message
- [ ] **Expected**: "Try Again" button present
- [ ] **Expected**: "X" dismiss button present

### Test 4.3: Error Retry
- [ ] Cause an error (see Test 4.2)
- [ ] Click "Try Again" button
- [ ] **Expected**: Error clears
- [ ] **Expected**: Generation attempts again

### Test 4.4: Error Dismiss
- [ ] Cause an error
- [ ] Click "X" button
- [ ] **Expected**: Error dismisses
- [ ] **Expected**: Can try new prompt

---

## Test Suite 5: Keyboard Shortcuts ✅

### Test 5.1: Help Modal
- [ ] Press `?` key
- [ ] **Expected**: Keyboard shortcuts modal opens
- [ ] **Expected**: Shows all shortcuts organized by category
- [ ] **Expected**: Platform-aware (⌘ on Mac, Ctrl on Windows)
- [ ] Press `Escape`
- [ ] **Expected**: Modal closes

### Test 5.2: Generate Shortcut
- [ ] Type a prompt
- [ ] Press `Ctrl+Enter` (or `Cmd+Enter` on Mac)
- [ ] **Expected**: Generation starts
- [ ] **Expected**: Same as clicking generate button

### Test 5.3: Cancel Shortcut
- [ ] While generating, press `Escape`
- [ ] **Expected**: (Future: cancel request)
- [ ] When showing completion, press `Escape`
- [ ] **Expected**: Completion clears
- [ ] When idle, press `Escape`
- [ ] **Expected**: Selector closes

### Test 5.4: Focus Input Shortcut
- [ ] Click outside input field
- [ ] Press `/` key
- [ ] **Expected**: Input field focuses
- [ ] **Expected**: Cursor ready to type

### Test 5.5: Keyboard Icon Button
- [ ] Click keyboard icon in header
- [ ] **Expected**: Help modal opens
- [ ] **Expected**: Same as pressing `?`

---

## Test Suite 6: Model Selection ✅

### Test 6.1: Model Picker
- [ ] Click model selector button
- [ ] **Expected**: Dropdown opens with model list
- [ ] **Expected**: Shows count "X models"
- [ ] **Expected**: Current model highlighted

### Test 6.2: Model Search
- [ ] Open model picker
- [ ] Type "claude" in search
- [ ] **Expected**: Filters to Claude models only
- [ ] Clear search
- [ ] **Expected**: All models shown

### Test 6.3: Free Filter
- [ ] Open model picker
- [ ] Click "Show Free Models" button
- [ ] **Expected**: Button turns blue
- [ ] **Expected**: Only free models shown (with "FREE" badge)
- [ ] **Expected**: Filter persists (localStorage)

### Test 6.4: Model Switch
- [ ] Open model picker
- [ ] Click different model
- [ ] **Expected**: Picker closes
- [ ] **Expected**: Toast: "Switched to [Model Name]"
- [ ] **Expected**: Model persists (localStorage)

---

## Test Suite 7: UI Polish ✅

### Test 7.1: Header Display
- [ ] Open AI Selector
- [ ] **Expected**: Header shows "⚡ AI Assistant"
- [ ] **Expected**: Gradient background (purple → blue)
- [ ] **Expected**: Keyboard icon button present
- [ ] **Expected**: Close button present

### Test 7.2: Context Badges
- [ ] Highlight text with good readability (>60)
- [ ] **Expected**: Badge shows green/positive indicator
- [ ] Highlight complex text (<50 readability)
- [ ] **Expected**: Badge shows warning color
- [ ] Hover over "Readability: X/100"
- [ ] **Expected**: Tooltip shows level (e.g., "Standard (8-9th grade)")

### Test 7.3: Responsive Layout
- [ ] Resize browser window
- [ ] **Expected**: Smart suggestions grid adapts
- [ ] **Expected**: All content remains readable
- [ ] **Expected**: No horizontal scroll

### Test 7.4: Auto-Focus
- [ ] Open AI Selector
- [ ] **Expected**: Input field auto-focused
- [ ] **Expected**: Can immediately start typing

---

## Test Suite 8: Templates ✅

### Test 8.1: SOW Template
- [ ] Highlight project notes
- [ ] Click "📋 Convert to SOW"
- [ ] **Expected**: Generates full SOW with sections:
  - Executive Summary
  - Objectives
  - Scope
  - Deliverables
  - Timeline
  - Pricing
  - Payment Terms

### Test 8.2: Pricing Template
- [ ] Highlight list of services
- [ ] Click "💰 Add Pricing Table"
- [ ] **Expected**: Generates markdown table with:
  - Service column
  - Description column
  - Hours/Rate columns
  - Subtotal, GST, Total

### Test 8.3: Grammar Template
- [ ] Highlight text with typos
- [ ] Click "✏️ Fix Grammar"
- [ ] **Expected**: Only fixes errors, minimal changes

### Test 8.4: Summarize Template
- [ ] Highlight long article (>200 words)
- [ ] Click "📄 Summarize"
- [ ] **Expected**: Returns 2-3 sentence summary

---

## Test Suite 9: Edge Cases ✅

### Test 9.1: Empty Selection
- [ ] Don't highlight anything
- [ ] Open AI Selector
- [ ] **Expected**: Still opens, no context info
- [ ] **Expected**: Generic suggestions or none
- [ ] **Expected**: Can still type custom prompt

### Test 9.2: Very Long Text
- [ ] Highlight entire document (1000+ words)
- [ ] **Expected**: Context analysis works
- [ ] **Expected**: Shows correct word count
- [ ] **Expected**: May take longer to generate

### Test 9.3: Special Characters
- [ ] Highlight text with emoji, symbols, code
- [ ] **Expected**: Analysis handles gracefully
- [ ] **Expected**: Generation works normally

### Test 9.4: Rapid Clicks
- [ ] Click suggestion button multiple times quickly
- [ ] **Expected**: Only generates once
- [ ] **Expected**: Button disabled while loading

---

## Test Suite 10: Integration ✅

### Test 10.1: Insert to Editor
- [ ] Generate content successfully
- [ ] Click "Insert" button
- [ ] **Expected**: Content inserted at cursor position
- [ ] **Expected**: AI Selector closes
- [ ] **Expected**: Editor shows new content

### Test 10.2: Discard
- [ ] Generate content
- [ ] Click "Discard" button
- [ ] **Expected**: Content removed
- [ ] **Expected**: AI Selector closes
- [ ] **Expected**: No changes to editor

### Test 10.3: Multiple Generations
- [ ] Generate content
- [ ] Clear prompt
- [ ] Type new prompt
- [ ] Generate again
- [ ] **Expected**: Old content replaced
- [ ] **Expected**: Success animation shows each time

---

## Performance Tests ⚡

### Test P.1: Initial Load
- [ ] Open AI Selector
- [ ] **Expected**: Opens in <100ms
- [ ] **Expected**: Smooth animation
- [ ] **Expected**: No lag

### Test P.2: Context Analysis Speed
- [ ] Highlight large text (500+ words)
- [ ] **Expected**: Analysis completes in <50ms
- [ ] **Expected**: Badges appear immediately

### Test P.3: Streaming Performance
- [ ] Generate large content
- [ ] **Expected**: Content streams smoothly
- [ ] **Expected**: No stuttering
- [ ] **Expected**: 60fps animations

---

## Accessibility Tests ♿

### Test A.1: Screen Reader
- [ ] Use screen reader (NVDA/JAWS/VoiceOver)
- [ ] **Expected**: Loading states announced
- [ ] **Expected**: Button labels clear
- [ ] **Expected**: Navigation logical

### Test A.2: Keyboard-Only Navigation
- [ ] Use only keyboard (no mouse)
- [ ] Tab through all elements
- [ ] **Expected**: Focus visible
- [ ] **Expected**: All actions accessible
- [ ] **Expected**: Logical tab order

### Test A.3: Focus Management
- [ ] Open AI Selector
- [ ] **Expected**: Focus trapped in modal
- [ ] Press Tab repeatedly
- [ ] **Expected**: Cycles through modal elements only
- [ ] Press Escape
- [ ] **Expected**: Focus returns to editor

---

## Browser Compatibility Tests 🌐

### Test B.1: Chrome
- [ ] All tests pass in Chrome
- [ ] Shortcuts work with Ctrl
- [ ] Animations smooth

### Test B.2: Firefox
- [ ] All tests pass in Firefox
- [ ] Shortcuts work
- [ ] CSS Grid layout correct

### Test B.3: Safari
- [ ] All tests pass in Safari
- [ ] Shortcuts work with Cmd (⌘)
- [ ] Webkit-specific styles work

### Test B.4: Edge
- [ ] All tests pass in Edge
- [ ] Chromium features work
- [ ] Performance good

---

## Regression Tests 🔄

### Test R.1: Existing Features
- [ ] Normal text generation still works
- [ ] Model switching still works
- [ ] Free filter still works
- [ ] Model search still works

### Test R.2: No Breaking Changes
- [ ] Old completion display works
- [ ] Insert/Discard buttons work
- [ ] Editor integration intact
- [ ] localStorage persistence works

---

## Console Checks 📊

### During Testing, Check Console For:
- [ ] No red errors
- [ ] Clear logging messages:
  - "📊 Text analysis:"
  - "💡 Smart suggestions:"
  - "🚀 Generating with:"
  - "✅ Generation complete:"
- [ ] No memory leaks
- [ ] No unnecessary re-renders

---

## Final Checklist ✅

Before marking Phase 1 complete:
- [ ] All Test Suites passed
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Accessibility working
- [ ] Cross-browser tested
- [ ] Documentation complete
- [ ] Code reviewed
- [ ] Types correct
- [ ] User feedback positive

---

## Known Issues (Track Here)

_Document any issues found during testing:_

1. 
2. 
3. 

---

## Sign-Off

**Tester**: _______________
**Date**: _______________
**Status**: [ ] Pass [ ] Fail [ ] Pass with Issues

**Notes**:
_________________
_________________
_________________

---

Ready to test! 🚀

Run through each test suite systematically. Report any issues found.
