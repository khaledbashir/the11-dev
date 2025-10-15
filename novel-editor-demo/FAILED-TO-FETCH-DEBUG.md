# 🔧 "Failed to Fetch" Error - Debugging

## Error
```
TypeError: Failed to fetch
```

## Possible Causes

### 1. Network/CORS Issue
- Browser can't reach the API
- CORS headers missing
- Dev server not running on expected port

### 2. Request Format Issue  
- AI SDK sends data in specific format
- API expects different format
- Mismatch causing request to fail

### 3. SSL/HTTPS Issue
- Mixed content error
- Certificate issue

## Fixes Applied

### 1. Better Error Handling
Added detailed logging:
```typescript
onError: (e) => {
  console.error("AI Error:", e);
  toast.error(e.message || "Failed to connect to AI. Check if server is running.");
}
```

### 2. Request Logging
Added logging to see what's being sent:
```typescript
console.log("🚀 Generating with:", { 
  selectedText: selectedText.substring(0, 50), 
  command: prompt,
  model: selectedModel 
});
```

## How to Debug

### Check Browser Console

Look for these logs:

**When you press Enter**:
```
🚀 Generating with: { selectedText: "...", command: "...", model: "..." }
AI Response status: 200
```

**If it fails**:
```
❌ Generation error: TypeError: Failed to fetch
AI Error: Failed to fetch
```

### Check Network Tab

1. Open DevTools (F12)
2. Go to Network tab
3. Try generating
4. Look for `/api/generate` request
5. Check:
   - Status code
   - Request headers
   - Request payload
   - Response

### Test API Directly

```bash
curl -X POST http://localhost:3002/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "test text",
    "option": "zap",
    "command": "make it funny",
    "model": "anthropic/claude-3.5-sonnet"
  }'
```

## Common Issues

### Server Not Running
```bash
# Check if running
ps aux | grep "next dev"

# Start if needed
cd /root/the11/novel-editor-demo/apps/web
pnpm dev
```

### Wrong Port
- Check if server is on port 3002
- Browser trying different port
- Update URL if needed

### API Key Missing
- Check `.env.local` has `OPENROUTER_API_KEY`
- Restart server after adding

### CORS Issue
- Usually not an issue in Next.js dev
- But check browser console for CORS errors

## Next Steps

1. **Open browser console**
2. **Try generating** (highlight text, type command, press Enter)
3. **Share the console output** - look for:
   - 🚀 Generating with: ...
   - Any error messages
   - Network tab request details

This will tell us exactly what's failing!
