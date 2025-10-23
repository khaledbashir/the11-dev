# Quick Reference: Dashboard Chat Implementation

## 🎯 For Developers

### What Changed?
The dashboard now uses stateful chat with database persistence instead of stateless chat.

**Old Flow**: Dashboard → EnhancedDashboard (no persistence)  
**New Flow**: Dashboard → StatefulDashboardChat (full persistence with state management)

---

## 📁 Key Files

### API Endpoints (Backend)
```
frontend/app/api/dashboard/
├── conversations/route.ts          # GET all, POST new
├── conversations/[id]/route.ts     # GET messages, PATCH rename, DELETE
└── conversations/[id]/messages/route.ts  # POST send message
```

### React Components (Frontend)
```
frontend/components/tailwind/
├── conversation-history-panel.tsx  # Sidebar with conversation list
├── message-display-panel.tsx       # Chat window
└── stateful-dashboard-chat.tsx     # State management container
```

### Integration Point
```
frontend/app/page.tsx               # viewMode='dashboard' → StatefulDashboardChat
```

---

## 🔌 API Endpoints Quick Reference

### 1. List All Conversations
```bash
GET /api/dashboard/conversations
Header: x-user-id: [user-id]

Response:
{
  success: true,
  conversations: [
    {
      id: "uuid",
      user_id: "user-id",
      title: "Conversation Title",
      created_at: "timestamp",
      updated_at: "timestamp",
      message_count: 5
    }
  ]
}
```

### 2. Create New Conversation
```bash
POST /api/dashboard/conversations
Header: x-user-id: [user-id]
Body: {}

Response:
{
  success: true,
  conversation: {
    id: "uuid",
    title: "New Conversation",
    created_at: "timestamp",
    updated_at: "timestamp"
  }
}
```

### 3. Get Messages for Conversation
```bash
GET /api/dashboard/conversations/[id]
Header: x-user-id: [user-id]

Response:
{
  success: true,
  conversation_id: "uuid",
  message_count: 3,
  messages: [
    {
      id: "uuid",
      conversation_id: "uuid",
      role: "user",
      content: "Hello",
      created_at: "timestamp"
    },
    {
      id: "uuid",
      conversation_id: "uuid",
      role: "assistant",
      content: "Hi there!",
      created_at: "timestamp"
    }
  ]
}
```

### 4. Send Message & Get Response
```bash
POST /api/dashboard/conversations/[id]/messages
Header: x-user-id: [user-id]
Body: { message: "What do you recommend?" }

Response:
{
  success: true,
  user_message: {
    id: "uuid",
    role: "user",
    content: "What do you recommend?",
    created_at: "timestamp"
  },
  assistant_message: {
    id: "uuid",
    role: "assistant",
    content: "I recommend...",
    created_at: "timestamp"
  }
}
```

### 5. Rename Conversation
```bash
PATCH /api/dashboard/conversations/[id]
Header: x-user-id: [user-id]
Body: { title: "New Title" }

Response:
{
  success: true,
  message: "Conversation renamed successfully"
}
```

### 6. Delete Conversation
```bash
DELETE /api/dashboard/conversations/[id]
Header: x-user-id: [user-id]

Response:
{
  success: true,
  message: "Conversation deleted successfully"
}
```

---

## 🧠 Component State Management

### StatefulDashboardChat State
```typescript
// Main state variables
conversations: Conversation[]           // All user's conversations
activeConversationId: string | null     // Currently selected
messages: Message[]                     // Messages in active conversation

// Loading states
isLoadingConversations: boolean         // Fetching conversation list
isLoadingMessages: boolean              // Fetching message history
isSendingMessage: boolean               // Sending new message

// User context
userId: string                          // From x-user-id header
```

### State Flow
```
Mount
  ↓
fetchConversations()          // Load all conversations
  ↓
User selects conversation
  ↓
activeConversationId changes  // Triggers useEffect
  ↓
fetchMessages(id)             // Load conversation messages
  ↓
User types and sends message
  ↓
handleSendMessage(text)       // POST to API, get response
  ↓
Add both messages to state
  ↓
Update conversation list (updated_at)
```

---

## 🐛 Common Issues & Solutions

### Issue: Messages not persisting
**Check**: 
- Are database tables created? `SELECT * FROM dashboard_conversations;`
- Is connection working? Test with simple SELECT query
- Are foreign keys properly set up?

**Solution**: Run database migration if tables missing

### Issue: AI responses not appearing
**Check**:
- Is AnythingLLM running? Check workspace `sow-master-dashboard`
- Are streaming responses being parsed? Check console logs
- Is `x-user-id` header being sent?

**Solution**: Verify AnythingLLM URL and API key in environment

### Issue: Conversations not loading
**Check**:
- Is `x-user-id` header being sent from frontend?
- Are there SQL errors in server logs?
- Is the userId correctly formatted?

**Solution**: Add console.log to verify user_id is passed correctly

### Issue: TypeError when switching conversations
**Check**:
- Is `activeConversationId` being set correctly?
- Does the selected conversation exist in database?
- Are you accessing the correct conversation ID?

**Solution**: Add error boundary around message display

---

## 🚀 Testing Checklist

### Manual Test Flow
1. [ ] Navigate to Dashboard (click "Dashboard" in sidebar)
2. [ ] Click "+New Chat" button
3. [ ] See new conversation appear in list
4. [ ] Type a message in input field
5. [ ] Press Enter or click Send
6. [ ] See message appear immediately
7. [ ] See "Loading..." indicator
8. [ ] See AI response appear
9. [ ] Refresh page (F5)
10. [ ] See all messages still there
11. [ ] Create another conversation
12. [ ] Switch between conversations
13. [ ] Verify different messages show
14. [ ] Rename a conversation
15. [ ] Verify title updates
16. [ ] Delete a conversation
17. [ ] Verify it's removed from list

### Browser DevTools Checks
- [ ] No TypeScript errors in console
- [ ] No network 4xx/5xx errors
- [ ] Messages appearing in correct order
- [ ] Timestamps formatted correctly
- [ ] Loading spinners showing appropriately

### Database Checks
```sql
-- Check conversations created
SELECT COUNT(*) FROM dashboard_conversations;

-- Check messages created
SELECT COUNT(*) FROM dashboard_messages;

-- Check cascade delete works
DELETE FROM dashboard_conversations WHERE id = '[test-id]';
SELECT COUNT(*) FROM dashboard_messages WHERE conversation_id = '[test-id]';
-- Should be 0
```

---

## 📝 TypeScript Interfaces

### Conversation
```typescript
interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}
```

### Message
```typescript
interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}
```

### API Response
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```

---

## 🔐 Security Notes

### Current Implementation
- Uses `x-user-id` header for user identification
- All queries use parameterized statements (SQL injection safe)
- Database has foreign key constraints (referential integrity)
- No cross-user data access without verification

### TODO: Production Security
- [ ] Replace `x-user-id` with actual authentication (Clerk, Auth0, etc.)
- [ ] Add rate limiting on message sending
- [ ] Validate message content length
- [ ] Add CORS policy
- [ ] Log all database access for audit trail
- [ ] Add request signing/verification

---

## 🎨 Styling Notes

### Color Scheme
- **Primary**: Emerald-600 (buttons, active states)
- **Background**: Dark (slate-800, slate-900)
- **Text**: Light gray for contrast
- **Hover**: Emerald-600/30 for backgrounds

### Component Structure
```
StatefulDashboardChat (w-full h-full)
├── Left Sidebar (w-64)
│   └── ConversationHistoryPanel
├── Center (flex-1)
│   └── MessageDisplayPanel
└── Right Sidebar (w-96)
    └── EnhancedDashboard (stats)
```

---

## 🔄 Integration with Existing Systems

### AnythingLLM
- Workspace: `sow-master-dashboard`
- Purpose: Multi-user shared knowledge base for SOW queries
- Connection: Via `/api/dashboard/conversations/[id]/messages` endpoint
- Streaming: Supports text/event-stream responses

### Database
- Tables: `dashboard_conversations`, `dashboard_messages`
- Connection: Via `/lib/db.ts` query utility
- Pool: mysql2/promise with connection pooling

### Authentication
- Current: Placeholder `x-user-id` header
- Future: Should integrate with main auth system
- Scope: All endpoints check user_id for isolation

---

## 📊 Performance Tips

### For Large Conversation Lists
```typescript
// TODO: Implement pagination
// GET /api/dashboard/conversations?limit=20&offset=0
```

### For Long Message History
```typescript
// TODO: Implement message pagination
// GET /api/dashboard/conversations/[id]?limit=50&offset=0
```

### Database Optimization
```sql
-- Add index for common queries
CREATE INDEX idx_conversations_user_updated 
ON dashboard_conversations(user_id, updated_at DESC);

CREATE INDEX idx_messages_conversation_created 
ON dashboard_messages(conversation_id, created_at ASC);
```

---

## 🆘 Quick Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| "No conversation selected" | activeConversationId is null | Click a conversation in sidebar |
| Messages not saving | Database not connected | Check DB_HOST, DB_USER in .env |
| AI not responding | AnythingLLM offline | Check ANYTHINGLLM_URL |
| Page reload loses messages | Old code issue | Refresh browser cache (Ctrl+Shift+R) |
| "Cannot read property id" | Conversation deleted while open | Create new conversation |

---

## 📖 Documentation Links

- **Full Architecture**: `ARCHITECTURE-SINGLE-SOURCE-OF-TRUTH.md`
- **Phase 2 Details**: `PHASE-2-DASHBOARD-CHAT-COMPLETE.md`
- **Session Summary**: `SESSION-COMPLETE-PHASES-1-2.md`
- **Database Schema**: See `database/migrations/add-dashboard-chat-schema.sql`

---

## ✅ Ready to Deploy?

- ✅ All code compiled without errors
- ✅ TypeScript fully typed
- ✅ Error handling comprehensive
- ✅ Database schema in place
- ✅ API endpoints tested
- ✅ React components verified
- ⏳ E2E testing scenario results pending

**Status**: Ready for staging environment testing

---

Last Updated: October 23, 2025  
Maintained By: Engineering Team  
Questions? Check issue tracker or review component source code
