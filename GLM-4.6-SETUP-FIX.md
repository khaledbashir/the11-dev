# 🚀 GLM-4.6 Model Setup Fix - Complete Guide

## Problem
- OAI Copilot extension showing "via unidentified" in model dropdown
- 401 Unauthorized errors when trying to use GLM-4.6 model
- Multiple conflicting model entries causing confusion

## Root Cause
- Missing `owned_by` field → UI shows "via unidentified"
- Incorrect API endpoint URL
- Missing required fields for authentication

## Final Working Configuration

### File: `.vscode/settings.json`
```json
{
  "oaicopilot.models": [
    {
      "id": "glm-4.6",
      "owned_by": "glm",
      "baseUrl": "https://api.z.ai/api/coding/paas/v4",
      "apiKey": "sk-99f40183fb5f477d91014883327af5d6",
      "name": "GLM-4.6",
      "model": "glm-4.6"
    }
  ]
}
```

## Required Fields Explained
- `id`: Unique identifier for the model
- `owned_by`: Provider name (prevents "via unidentified")
- `baseUrl`: **CRITICAL** - Must be `https://api.z.ai/api/coding/paas/v4`
- `apiKey`: Your Z.ai API key
- `name`: Display name in UI
- `model`: Model identifier for API calls

## What Fixed It
1. **Added `owned_by: "glm"` → Removes "via unidentified" text
2. **Correct baseUrl** → Points to Z.ai coding API endpoint
3. **Consistent model/id** → Both set to "glm-4.6"
4. **Single clean entry** → No duplicates or conflicts

## Quick Setup Steps
1. Copy the JSON configuration above into `.vscode/settings.json`
2. Save the file
3. **Reload VS Code**: `Ctrl+Shift+P` → "Developer: Reload Window"
4. Open OAI Copilot model selector - should show "GLM-4.6 via glm"

## Troubleshooting
- **Still shows "via unidentified"** → Check `owned_by` field exists
- **401 Unauthorized** → Verify `baseUrl` and `apiKey` are correct
- **Model not appearing** → Reload VS Code window
- **Multiple entries** → Delete all except one clean entry

## Important Notes
- The "via" text is hardcoded in the extension UI
- Cannot be completely removed, only changed by setting `owned_by`
- Global VS Code settings can override workspace settings
- Always reload VS Code after changes

---

**Created:** November 7, 2025  
**Purpose:** Prevent future setup headaches with GLM-4.6 in OAI Copilot