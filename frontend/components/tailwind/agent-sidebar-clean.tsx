"use client";

// 🔧 Chat sidebar with thread management, attachments, and streaming support
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from 'sonner';
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Card } from "./ui/card";
import { Label } from "./ui/label";
import { ChevronRight, Send, Bot, Settings, Plus, Loader2, Zap } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { StreamingThoughtAccordion } from "./streaming-thought-accordion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cleanSOWContent } from "@/lib/export-utils";
import { EnhancedPromptButton } from "./enhanced-prompt-button";

interface Agent {
  id: string;
  name: string;
  systemPrompt: string;
  model: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface OpenRouterModel {
  id: string;
  name: string;
  pricing?: {
    prompt: string;
    completion: string;
  };
}

interface AgentSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  agents: Agent[];
  currentAgentId: string | null;
  onSelectAgent: (id: string) => void;
  onCreateAgent: (agent: Omit<Agent, 'id'>) => void;
  onUpdateAgent: (id: string, updates: Partial<Agent>) => void;
  onDeleteAgent: (id: string) => void;
  chatMessages: ChatMessage[];
  onSendMessage: (message: string, threadSlug?: string | null, attachments?: Array<{name: string; mime: string; contentString: string}>) => void;
  isLoading?: boolean;
  onInsertToEditor?: (content: string) => void;
  streamingMessageId?: string | null; // Track which message is streaming
  viewMode?: 'dashboard' | 'editor'; // NEW: Context awareness
  dashboardChatTarget?: string; // NEW: Workspace slug for dashboard mode
  onDashboardWorkspaceChange?: (slug: string) => void; // NEW: Handler for workspace selection
  availableWorkspaces?: Array<{slug: string, name: string}>; // NEW: Available workspaces
  onClearChat?: () => void; // NEW: Clear chat messages
  onReplaceChatMessages?: (messages: Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: number }>) => void; // NEW: Replace chat messages (e.g., when loading a thread)
  // Editor mode thread wiring
  editorWorkspaceSlug?: string; // workspace slug for the currently open SOW
  editorThreadSlug?: string | null; // current thread for the open SOW
  onEditorThreadChange?: (slug: string | null) => void; // notify parent when user creates/selects/deletes threads in editor mode
}

export default function AgentSidebar({
  isOpen,
  onToggle,
  agents,
  currentAgentId,
  onSelectAgent,
  onCreateAgent,
  onUpdateAgent,
  onDeleteAgent,
  chatMessages,
  onSendMessage,
  isLoading = false,
  onInsertToEditor,
  streamingMessageId,
  viewMode = 'editor', // Default to editor mode
  dashboardChatTarget = 'sow-master-dashboard', // Default to master dashboard
  onDashboardWorkspaceChange,
  availableWorkspaces = [{ slug: 'sow-master-dashboard', name: '🎯 All SOWs (Master)' }],
  onClearChat,
  onReplaceChatMessages,
  editorWorkspaceSlug,
  editorThreadSlug,
  onEditorThreadChange,
}: AgentSidebarProps) {
  const [chatInput, setChatInput] = useState("");
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [modelSearch, setModelSearch] = useState("");
  const [showFreeOnly, setShowFreeOnly] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [selectedModelForAgent, setSelectedModelForAgent] = useState("");
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [workspacePrompt, setWorkspacePrompt] = useState<string>("");
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  
  // 🧵 THREAD MANAGEMENT STATE
  const [threads, setThreads] = useState<Array<{ slug: string; name: string; id: number; createdAt: string }>>([]);
  const [currentThreadSlug, setCurrentThreadSlug] = useState<string | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [showThreadList, setShowThreadList] = useState(false);
  
  // 📎 ATTACHMENT STATE
  const [attachments, setAttachments] = useState<Array<{ name: string; mime: string; contentString: string }>>([]);
  const [uploading, setUploading] = useState(false);
  
  // ⚙️ ADVANCED FEATURES STATE
  const [showSlashCommands, setShowSlashCommands] = useState(false);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🔎 Utility: Split markdown into text and JSON code blocks for collapsible rendering
  const splitMarkdownJsonBlocks = (markdown: string): Array<{ type: 'text' | 'json'; content: string }> => {
    const segments: Array<{ type: 'text' | 'json'; content: string }> = [];
    const regex = /```\s*json\s*([\s\S]*?)```/gi;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(markdown)) !== null) {
      const matchStart = match.index;
      const matchEnd = regex.lastIndex;
      const before = markdown.slice(lastIndex, matchStart);
      if (before.trim()) segments.push({ type: 'text', content: before });
      const jsonBlock = match[1]?.trim() || '';
      if (jsonBlock) segments.push({ type: 'json', content: jsonBlock });
      lastIndex = matchEnd;
    }
    const after = markdown.slice(lastIndex);
    if (after.trim()) segments.push({ type: 'text', content: after });
    // If no json fences found, return as a single text segment
    if (segments.length === 0) return [{ type: 'text', content: markdown }];
    return segments;
  };

  // 🧼 Utility: Extract only non-JSON, non-code text for safe editor insertion
  const extractNonJsonText = (markdown: string): string => {
    // Remove fenced code blocks of any language, including json
    const withoutFences = markdown.replace(/```[\s\S]*?```/g, "");
    // Remove inline code ticks conservatively
    const withoutInline = withoutFences.replace(/`([^`]+)`/g, "$1");
    // Split by JSON fences if any remain and keep only text segments
    const segments = splitMarkdownJsonBlocks(withoutInline);
    const text = segments
      .filter(seg => seg.type === 'text')
      .map(seg => seg.content.trim())
      .filter(Boolean)
      .join("\n\n");
    return text.trim();
  };

  // 📦 Collapsible JSON viewer component
  const JsonCollapsible: React.FC<{ json: string; defaultOpen?: boolean }> = ({ json, defaultOpen = false }) => {
    const [open, setOpen] = useState(defaultOpen);
    let pretty = json;
    try {
      pretty = JSON.stringify(JSON.parse(json), null, 2);
    } catch {
      // keep original if not valid JSON
    }
    return (
      <div className="border border-[#1b5e5e] rounded-md bg-[#0E2E33]/40">
        <button
          className="w-full flex items-center justify-between px-3 py-2 text-left text-sm text-white hover:bg-[#0E2E33]"
          onClick={() => setOpen(o => !o)}
        >
          <span>Structured JSON</span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {open && (
          <pre className="max-h-64 overflow-auto text-xs p-3 text-green-200 bg-[#0b1c1c] rounded-b-md">
            {pretty}
          </pre>
        )}
      </div>
    );
  };

  // Debug: Log when onInsertToEditor is available (DISABLED for performance)
  // useEffect(() => {
  //   console.log('🔍 [AgentSidebar] onInsertToEditor prop:', onInsertToEditor ? 'Available ✅' : 'Missing ❌');
  //   console.log('🔍 [AgentSidebar] Chat messages count:', chatMessages.length);
  //   console.log('🔍 [AgentSidebar] Current agent ID:', currentAgentId);
  // }, [onInsertToEditor, chatMessages.length, currentAgentId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const loadThreads = async (workspaceSlug?: string) => {
    const ws = workspaceSlug || (isDashboardMode ? dashboardChatTarget : editorWorkspaceSlug);
    if (!ws) return;
    
    console.log('📂 Loading threads for workspace:', ws);
    setLoadingThreads(true);
    
    try {
      const response = await fetch(`/api/anythingllm/threads?workspace=${encodeURIComponent(ws)}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Failed to load threads:', {
          status: response.status,
          workspace: ws,
          error: errorData,
        });
        
        // Don't throw - just set empty threads and let the user continue
        setThreads([]);
        return;
      }

      const data = await response.json();
      const threadList = data?.threads || [];
      
      console.log('✅ Threads loaded:', {
        workspace: ws,
        count: threadList.length,
      });
      
      setThreads(threadList);
    } catch (error: any) {
      console.error('❌ Exception loading threads:', error);
      setThreads([]);
    } finally {
      setLoadingThreads(false);
    }
  };

  // 🧵 THREAD MANAGEMENT FUNCTIONS
  const handleNewThread = async (): Promise<string | null> => {
    // Provide immediate feedback if no workspace is selected
    const ws = isDashboardMode ? dashboardChatTarget : editorWorkspaceSlug;
    if (!ws) {
      console.warn('No workspace selected for thread creation');
      alert('No workspace selected. Please select a SOW or workspace before creating a new chat.');
      return null;
    }

    console.log('🆕 Creating new thread in workspace:', ws);
    setLoadingThreads(true);

    try {
      // Create via server-side proxy to protect credentials and ensure JSON
      const response = await fetch('/api/anythingllm/thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace: ws,
          name: `New Chat - ${new Date().toLocaleTimeString()}`,
        }),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        console.error('Create thread failed response body:', text);
        throw new Error(`Failed to create thread: ${response.status}`);
      }

      const data = await response.json();
      const newThread = {
        slug: data.thread?.slug || data.slug || `thread-${Date.now()}`,
        name: data.thread?.name || data.name || `New Chat - ${new Date().toLocaleTimeString()}`,
        id: data.thread?.id || data.id || Date.now(),
        createdAt: new Date().toISOString(),
      };

      // Update local thread list and select it
      setThreads(prev => [newThread, ...prev]);
      setCurrentThreadSlug(newThread.slug);
      
      // Auto-open thread list to show the new thread
      setShowThreadList(true);

      // Ask parent to clear chat messages if provided
      if (onClearChat) onClearChat();

      // In editor mode, notify parent so it persists threadSlug to SOW
      if (isEditorMode && onEditorThreadChange) {
        onEditorThreadChange(newThread.slug);
      }

      console.log('✅ Thread created:', newThread.slug);

      // Small delay to allow AnythingLLM to index the new thread, then reload
      if (ws) {
        await new Promise(resolve => setTimeout(resolve, 300));
        await loadThreads(ws);
      }

      return newThread.slug;
    } catch (error: any) {
      console.error('❌ Failed to create thread:', error?.message || error);
      // Surface more actionable error to the user
      alert(`Failed to create new thread: ${error?.message || 'unknown error'}`);
      return null;
    } finally {
      setLoadingThreads(false);
    }
  };

  // Toggle thread list with lazy loading and robust guards
  const handleToggleThreads = async () => {
    try {
      const opening = !showThreadList;
      // Determine workspace based on mode
      const ws = isDashboardMode ? dashboardChatTarget : editorWorkspaceSlug;
      if (!ws) {
        console.warn('[Threads] No workspace selected');
        alert('No workspace selected. Please select a SOW or workspace first.');
        return;
      }
      if (opening && threads.length === 0 && !loadingThreads) {
        setLoadingThreads(true);
        try {
          await loadThreads(ws);
        } catch (e) {
          console.error('[Threads] Failed to load threads on toggle:', e);
          alert('Failed to load threads. Check network or credentials.');
          return;
        } finally {
          setLoadingThreads(false);
        }
      }
      setShowThreadList(prev => !prev);
      console.log('[Threads] showThreadList ->', !showThreadList);
    } catch (err) {
      console.error('[Threads] Unexpected toggle error:', err);
      alert('Unexpected error while opening Threads.');
    }
  };

  const handleSelectThread = async (threadSlug: string) => {
    console.log('📂 Switching to thread:', threadSlug);
    setCurrentThreadSlug(threadSlug);
    setShowThreadList(false);
    setLoadingThreads(true);
    
    try {
      // Load thread chat history via server proxy
      const ws = isDashboardMode ? dashboardChatTarget : editorWorkspaceSlug;
      if (!ws) throw new Error('No workspace available for loading threads');
      const response = await fetch(`/api/anythingllm/thread?workspace=${encodeURIComponent(ws)}&thread=${encodeURIComponent(threadSlug)}`);

      if (!response.ok) {
        throw new Error('Failed to load thread history');
      }

      const data = await response.json();
      console.log('✅ Loaded thread history:', data.history?.length || 0, 'messages');
      
      // Convert and replace parent chat messages when available
      const mapped = (data.history || []).map((msg: any) => ({
        id: `msg-${msg.id || Date.now()}-${Math.random()}`,
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content || '',
        timestamp: new Date(msg.createdAt || Date.now()).getTime(),
      }));
      if (onReplaceChatMessages) {
        onReplaceChatMessages(mapped);
      }

      // In editor mode, sync thread selection up
      if (isEditorMode && onEditorThreadChange) {
        onEditorThreadChange(threadSlug);
      }
    } catch (error) {
      console.error('❌ Failed to load thread history:', error);
    } finally {
      setLoadingThreads(false);
    }
  };

  const handleDeleteThread = async (threadSlug: string) => {
    if (!confirm('Delete this chat? This cannot be undone.')) return;
    
    console.log('🗑️ Deleting thread:', threadSlug);
    
    try {
      // Determine correct workspace for deletion based on context
      const ws = isDashboardMode ? dashboardChatTarget : editorWorkspaceSlug;
      if (!ws) throw new Error('No workspace selected for thread deletion');

      // Delete via server proxy
      const response = await fetch(`/api/anythingllm/thread?workspace=${encodeURIComponent(ws)}&thread=${encodeURIComponent(threadSlug)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete thread');
      }

      // Remove from local state
      setThreads(prev => prev.filter(t => t.slug !== threadSlug));
      
      // If deleting current thread, switch to another or create new
      if (currentThreadSlug === threadSlug) {
        const remainingThreads = threads.filter(t => t.slug !== threadSlug);
        if (remainingThreads.length > 0) {
          handleSelectThread(remainingThreads[0].slug);
        } else {
          handleNewThread();
        }
      }

      // In editor mode, notify parent if current thread was deleted
      if (isEditorMode && onEditorThreadChange) {
        const stillExists = threads.some(t => t.slug === threadSlug);
        if (!stillExists) onEditorThreadChange(null);
      }
      
      console.log('✅ Thread deleted successfully');
    } catch (error) {
      console.error('❌ Failed to delete thread:', error);
      alert('Failed to delete thread. Please try again.');
    }
  };

  // 📎 FILE ATTACHMENT FUNCTIONS
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        console.log('📎 Processing file:', file.name, file.type);
        
        // Read file as base64 for attachments in chat
        const reader = new FileReader();
        reader.onload = (event) => {
          const contentString = event.target?.result as string;
          setAttachments(prev => [...prev, {
            name: file.name,
            mime: file.type,
            contentString,
          }]);
          console.log('✅ File ready for attachment:', file.name);
        };
        reader.readAsDataURL(file);
        
        // Optionally: Upload to AnythingLLM workspace for embedding
        // Uncomment if you want files to be embedded in the workspace knowledge base
        /*
        const formData = new FormData();
        formData.append('file', file);
        formData.append('addToWorkspaces', dashboardChatTarget);
        
        const uploadResponse = await fetch(`${process.env.NEXT_PUBLIC_ANYTHINGLLM_URL}/api/v1/document/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ANYTHINGLLM_API_KEY}`,
          },
          body: formData,
        });
        
        if (uploadResponse.ok) {
          console.log('✅ File uploaded to AnythingLLM workspace');
        }
        */
      }
    } catch (error) {
      console.error('❌ Error processing file:', error);
      alert('Failed to process file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // 🎯 SLASH COMMAND & @AGENT FUNCTIONS
  const insertText = (text: string) => {
    setChatInput(prev => prev + text);
    chatInputRef.current?.focus();
  };

  const slashCommands = [
    { command: '/reset', description: 'Clear chat history and begin a new chat' },
    { command: '/help', description: 'Show available commands' },
    { command: '/summarize', description: 'Summarize the current conversation' },
  ];

  useEffect(() => {
    if (currentAgentId) {
      chatInputRef.current?.focus();
    }
  }, [currentAgentId]);

  // ✨ No agent auto-selection — workspaces act as Generation AI; focus input instead
  useEffect(() => {
    if (viewMode === 'editor') {
      // Focus input when editor chat becomes available or thread changes
      setTimeout(() => chatInputRef.current?.focus(), 50);
    }
  }, [viewMode, editorThreadSlug]);

  useEffect(() => {
    fetchModels();
  }, []);

  // Load and display the active workspace system prompt (Architect v2) in editor mode
  useEffect(() => {
    const loadPrompt = async () => {
      if (!(viewMode === 'editor') || !editorWorkspaceSlug) return;
      setLoadingPrompt(true);
      try {
        const res = await fetch(`/api/anythingllm/workspace?slug=${encodeURIComponent(editorWorkspaceSlug)}`);
        if (!res.ok) {
          setWorkspacePrompt("");
          return;
        }
        const data = await res.json();
        const prompt = data?.workspace?.openAiPrompt || data?.workspace?.prompt || "";
        setWorkspacePrompt(prompt || "");
      } catch (e) {
        setWorkspacePrompt("");
      } finally {
        setLoadingPrompt(false);
      }
    };
    loadPrompt();
  }, [viewMode, editorWorkspaceSlug]);

  const fetchModels = async () => {
    setLoadingModels(true);
    try {
      const response = await fetch('/api/models');
      if (!response.ok) throw new Error('Failed to fetch models');
      const modelsData = await response.json();
      setModels(modelsData);
    } catch (error) {
      console.error("Failed to fetch models:", error);
      setModels([
        { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
        { id: 'openai/gpt-4o', name: 'GPT-4o' },
      ]);
    } finally {
      setLoadingModels(false);
    }
  };

  // Agents are deprecated for chat routing; workspace context drives behavior
  // Keeping props for compatibility, but not using currentAgent for gating
  
  const filteredModels = models.filter(model => {
    const matchesSearch = model.name.toLowerCase().includes(modelSearch.toLowerCase());
    const matchesFree = !showFreeOnly || !model.pricing?.prompt;
    return matchesSearch && matchesFree;
  });

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isLoading) return;

    // Ensure a thread exists in dashboard mode before sending (for persistence)
    let threadToUse = currentThreadSlug;
    if (isDashboardMode && !threadToUse) {
      const created = await handleNewThread();
      if (!created) return; // Abort send if thread creation failed
      threadToUse = created;
    }

    // Send message with thread context and attachments
    console.log('📤 Sending message:', {
      message: chatInput,
      threadSlug: threadToUse,
      attachments: attachments.length,
      workspaceSlug: isDashboardMode ? dashboardChatTarget : editorWorkspaceSlug,
      isDashboardMode,
    });

    onSendMessage(chatInput, threadToUse, attachments);
    setChatInput("");
    setAttachments([]); // Clear attachments after sending
  };

  // Enhance Only: calls server to rewrite prompt, then updates input (no send)
  const [enhancing, setEnhancing] = useState(false);
  const handleEnhanceOnly = async () => {
    if (!chatInput.trim() || isLoading || enhancing) return;
    try {
      setEnhancing(true);
      const resp = await fetch('/api/ai/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: chatInput })
      });
      if (!resp.ok) {
        const msg = await resp.text().catch(() => '');
        throw new Error(msg || `Enhancer error ${resp.status}`);
      }
      const data = await resp.json();
      const enhanced: string = (data?.enhancedPrompt || '').toString().trim();
      if (!enhanced) {
        toast.error('Enhancer returned empty text');
        return;
      }
      setChatInput(enhanced);
      toast.success('Prompt enhanced');
    } catch (e) {
      console.error('Enhance failed:', e);
      toast.error('Failed to enhance your prompt.');
    } finally {
      setEnhancing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  // Determine if this is dashboard mode (context-aware behavior)
  const isDashboardMode = viewMode === 'dashboard';
  const isEditorMode = viewMode === 'editor';

  // Get current workspace name for dashboard title
  const currentWorkspaceName = availableWorkspaces.find(w => w.slug === dashboardChatTarget)?.name || '🎯 All SOWs (Master)';
  const isMasterView = dashboardChatTarget === 'sow-master-dashboard';

  // Persona label logic
  const personaName = viewMode === 'dashboard'
    ? (isMasterView ? 'Analytics Assistant' : 'The Architect')
    : 'The Architect';
  const personaSubtitle = viewMode === 'dashboard'
    ? (isMasterView ? 'Master Dashboard' : 'Client Workspace')
    : 'SOW generation';

  // 🧵 LOAD THREADS ON MOUNT (Dashboard mode only)
  useEffect(() => {
    const ws = isDashboardMode ? dashboardChatTarget : editorWorkspaceSlug;
    if (ws) {
      loadThreads(ws);
      // Sync currentThreadSlug from prop when in editor mode
      if (isEditorMode && editorThreadSlug) setCurrentThreadSlug(editorThreadSlug);
    }
  }, [isDashboardMode, dashboardChatTarget, editorWorkspaceSlug, editorThreadSlug]);

  return (
    <div className="h-full w-full min-w-0 bg-[#0e0f0f] border-l border-[#0E2E33] overflow-hidden flex flex-col">
      <div className="p-4 border-b border-[#0E2E33] bg-[#0e0f0f] flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-white truncate">
            {isDashboardMode ? "Chat" : "Workspace Chat"}
          </h2>
          <div className="flex items-center gap-2 flex-shrink-0">
            {(isDashboardMode || isEditorMode) && (
              <>
                <Button
                  onClick={handleNewThread}
                  className="bg-[#15a366] hover:bg-[#10a35a] text-white text-xs h-6 px-2 flex-shrink-0"
                  size="sm"
                  title="New chat thread"
                >
                  <Plus className="h-3 w-3" />
                </Button>
                <Button
                  onClick={handleToggleThreads}
                  className="bg-[#1c1c1c] hover:bg-[#222] text-white text-xs h-6 px-2 border border-[#2a2a2a] flex-shrink-0"
                  size="sm"
                  title="View threads"
                >
                  📋
                </Button>
                {/* Hide Chat Button - Always Visible */}
                <Button
                  onClick={onToggle}
                  className="bg-[#1c1c1c] hover:bg-[#222] text-white text-xs h-6 px-2 border border-[#2a2a2a] flex-shrink-0"
                  size="sm"
                  title="Hide chat panel"
                  aria-label="Hide chat"
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </div>



  {/* No agent selection — workspace context only */}

        {isDashboardMode && (
          <div className="mt-3">
            <Select
              value={dashboardChatTarget}
              onValueChange={onDashboardWorkspaceChange}
              disabled={loadingThreads}
            >
              <SelectTrigger className="w-full bg-[#1c1c1c] border-[#2a2a2a] text-white h-8 text-xs">
                <SelectValue placeholder="Select workspace..." />
              </SelectTrigger>
              <SelectContent className="bg-[#1c1c1c] border-[#2a2a2a] text-white">
                {availableWorkspaces.map((workspace) => (
                  <SelectItem key={workspace.slug} value={workspace.slug}>
                    {workspace.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Thread List Dropdown - Outside header */}
      {(isDashboardMode || isEditorMode) && showThreadList && (
        <div className="bg-[#0E2E33] border-b border-[#0E2E33] max-h-48 overflow-y-auto">
          <div className="p-2 space-y-1">
            {threads.length === 0 ? (
              <div className="text-xs text-gray-300 px-2 py-3">
                No threads yet. Click "New Chat" to create one.
              </div>
            ) : threads.map(thread => (
              <div
                key={thread.slug}
                className={`group flex items-center gap-2 p-2 rounded text-xs transition-colors ${
                  currentThreadSlug === thread.slug 
                    ? 'bg-[#15a366] text-white' 
                    : 'text-gray-300 hover:bg-[#0e0f0f]'
                }`}
              >
                <button
                  onClick={() => handleSelectThread(thread.slug)}
                  className="flex-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span>{currentThreadSlug === thread.slug ? '●' : '○'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{thread.name}</div>
                      <div className="text-xs opacity-70">{formatTimestamp(new Date(thread.createdAt).getTime())}</div>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => handleDeleteThread(thread.slug)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-opacity"
                  title="Delete thread"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Context persona label (dashboard + editor) */}
      <div className="p-3 border-b border-[#0E2E33]">
        {(isDashboardMode || isEditorMode) && (
          <div className="flex items-center gap-2 bg-[#0E2E33] px-3 py-2 rounded-md">
            <Bot className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-white">{personaName}</span>
            <span className="ml-2 text-xs text-gray-400">{personaSubtitle}</span>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* DASHBOARD MODE: Simple dashboard chat interface */}
        {isDashboardMode ? (
            <>
              <ScrollArea className="flex-1">
                <div className="p-5 space-y-5">
                  {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-8">
                      <Bot className="h-16 w-16 text-gray-600 mb-3" />
                      <h3 className="text-xl font-semibold text-white mb-2">Master SOW Analytics</h3>
                      <p className="text-sm text-gray-400 text-center max-w-xs">
                        Query your embedded SOWs and get business insights. I cannot create new SOWs.
                      </p>
                    </div>
                  ) : (
                    chatMessages.map((msg) => {
                      // Remove internal-only tags from visible content; preserve JSON blocks
                      const cleaned = cleanSOWContent(msg.content);
                      const segments = msg.role === 'assistant' ? [] : [{ type: 'text' as const, content: msg.content }];
                      return (
                        <div key={msg.id} className={`flex min-w-0 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`relative w-full max-w-[85%] min-w-0 rounded-xl px-4 py-3 break-words whitespace-pre-wrap overflow-hidden ${
                            msg.role === 'user' 
                              ? 'bg-[#15a366] text-white' 
                              : 'bg-[#1b1b1e] text-white border border-[#0E2E33]'
                          }`}>
                            {msg.role === 'assistant' && (
                              <div className="mb-4">
                                <StreamingThoughtAccordion 
                                  content={msg.content}
                                  messageId={msg.id}
                                  isStreaming={streamingMessageId === msg.id}
                                  onInsertClick={onInsertToEditor ? (content) => onInsertToEditor(content) : undefined}
                                />
                              </div>
                            )}
                            <div className="space-y-3">
                              {segments.map((seg, i) => (
                                <div
                                  key={i}
                                  className="prose prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 break-words whitespace-pre-wrap prose-pre:whitespace-pre-wrap prose-pre:overflow-x-auto"
                                >
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {seg.content}
                                  </ReactMarkdown>
                                </div>
                              ))}
                            </div>
                            <div className="flex items-center gap-2 mt-2 sticky bottom-0 z-10 bg-[#1b1b1e]/80 backdrop-blur-sm px-2 py-1 rounded-md border-t border-[#0E2E33]">
                              <span className="text-xs opacity-60 flex-1">{formatTimestamp(msg.timestamp)}</span>
                              {/* NO INSERT BUTTON IN DASHBOARD MODE - Query only */}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>

              <div className="p-5 border-t border-[#0E2E33] bg-[#0e0f0f]">
                <div className="flex items-end gap-3">
                  <Textarea
                    ref={chatInputRef}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (chatInput.trim() && !isLoading) {
                          handleSendMessage();
                        }
                      }
                    }}
                    placeholder="Ask a question about an existing SOW..."
                    className="min-h-[80px] resize-none bg-[#1b1b1e] border-[#0E2E33] text-white placeholder:text-gray-500"
                    disabled={isLoading}
                  />
                  {/* Dashboard chat: Only send button, NO enhance */}
                  <Button 
                    onClick={() => {
                      if (chatInput.trim() && !isLoading) {
                        handleSendMessage();
                      }
                    }}
                    disabled={!chatInput.trim() || isLoading}
                    className="self-end bg-[#15a366] hover:bg-[#10a35a] text-white border-0"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </>
          ) : isEditorMode ? (
            /* EDITOR MODE: Full agent chat with all controls */
            <>
              <ScrollArea className="flex-1">
                <div className="p-5 space-y-5">
                  {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-8">
                      <Bot className="h-16 w-16 text-gray-600 mb-3" />
                      <p className="text-base text-gray-400">No messages yet</p>
                    </div>
                  ) : (
                    chatMessages.map(msg => {
                      const shouldShowButton = msg.role === 'assistant' && onInsertToEditor;
                      // Remove internal-only tags from visible content; preserve JSON blocks
                      const cleaned = cleanSOWContent(msg.content);
                      const segments = msg.role === 'assistant' ? [] : [{ type: 'text' as const, content: msg.content }];
                      
                      // Debug logging disabled for performance
                      // if (msg.role === 'assistant') {
                      //   console.log('🔍 [Message Render]', {
                      //     msgId: msg.id,
                      //     role: msg.role,
                      //     hasThinking: msg.content.includes('<think>'),
                      //     hasOnInsertToEditor: !!onInsertToEditor,
                      //     shouldShowButton,
                      //   });
                      // }
                      
                      return (
                        <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`relative w-full max-w-[85%] min-w-0 rounded-lg p-4 break-words whitespace-pre-wrap overflow-x-hidden ${
                            msg.role === 'user' 
                              ? 'bg-[#0E2E33]/30 text-white border border-[#1CBF79]' 
                              : 'bg-[#0E2E33] text-white border border-[#1b5e5e]'
                          }`}>
                            
                            {/* Show thinking section with streaming support */}
                            {msg.role === 'assistant' && (
                              <div className="mb-4">
                                <StreamingThoughtAccordion 
                                  content={msg.content}
                                  messageId={msg.id}
                                  isStreaming={streamingMessageId === msg.id}
                                  onInsertClick={onInsertToEditor ? (content) => onInsertToEditor(content) : undefined}
                                />
                              </div>
                            )}
                            
                            {/* Content rendering for user messages only (assistant content handled by StreamingThoughtAccordion) */}
                            <div className="space-y-3">
                              {segments.map((seg, i) => (
                                <ReactMarkdown
                                  key={i}
                                  remarkPlugins={[remarkGfm]}
                                  className="prose prose-invert max-w-none text-sm break-words whitespace-pre-wrap prose-pre:whitespace-pre-wrap prose-pre:overflow-x-auto"
                                >
                                  {seg.content}
                                </ReactMarkdown>
                              ))}
                            </div>
                            
                            <div className="flex gap-2 mt-4 items-center sticky bottom-0 z-10 bg-[#0E2E33]/85 backdrop-blur-sm px-2 py-1 rounded-md border-t border-[#1b5e5e]">
                              <p className="text-xs mt-1 opacity-70 flex-1">{formatTimestamp(msg.timestamp)}</p>
                              {/* Single unified insert button per assistant message (full SOW: narrative + JSON) */}
                              {shouldShowButton && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs border-[#1b5e5e] text-gray-200 hover:text-white hover:bg-[#124847]"
                                  title="Insert full SOW (narrative + pricing)"
                                  onClick={() => {
                                    // Pass the entire assistant message content; downstream handler cleans and merges
                                    onInsertToEditor?.(msg.content);
                                  }}
                                >
                                  ✅ Insert SOW
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>

              <div className="p-5 border-t border-[#0E2E33] bg-[#0e0f0f] space-y-3">
                {/* Attachments Preview */}
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((att, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-[#0E2E33] px-3 py-1.5 rounded text-xs text-gray-300">
                        <span className="truncate max-w-[150px]">{att.name}</span>
                        <button onClick={() => removeAttachment(idx)} className="hover:text-red-500">×</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Advanced Controls Row */}
                {isDashboardMode && (
                  <div className="flex gap-2 text-xs">
                    {/* @agent button */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => insertText('@agent ')}
                      className="h-7 px-2 border-[#0E2E33] text-gray-400 hover:text-white hover:bg-[#0E2E33]"
                      title="Insert @agent mention"
                    >
                      @agent
                    </Button>

                    {/* /commands dropdown */}
                    <div className="relative">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowSlashCommands(!showSlashCommands)}
                        className="h-7 px-2 border-[#0E2E33] text-gray-400 hover:text-white hover:bg-[#0E2E33]"
                      >
                        /commands
                      </Button>
                      {showSlashCommands && (
                        <div className="absolute bottom-full left-0 mb-2 bg-[#0E2E33] border border-[#1CBF79] rounded-lg p-2 min-w-[250px] z-50">
                          {slashCommands.map(cmd => (
                            <button
                              key={cmd.command}
                              onClick={() => {
                                insertText(cmd.command + ' ');
                                setShowSlashCommands(false);
                              }}
                              className="w-full text-left p-2 hover:bg-[#0e0f0f] rounded text-gray-300 hover:text-white"
                            >
                              <div className="font-mono text-[#1CBF79]">{cmd.command}</div>
                              <div className="text-xs opacity-70">{cmd.description}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Model selector */}
                    <Select value={selectedModelForAgent} onValueChange={setSelectedModelForAgent}>
                      <SelectTrigger className="h-7 text-xs border-[#0E2E33] bg-[#0E2E33] text-gray-300 w-auto">
                        <SelectValue placeholder="Model" />
                      </SelectTrigger>
                      <SelectContent className="z-50">
                        <SelectItem value="claude-3.5-sonnet">Claude 3.5 Sonnet</SelectItem>
                        <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                        <SelectItem value="gemini-pro">Gemini Pro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Chat Input */}
                <div className="flex gap-3">
                  <div className="flex-1 space-y-2">
                    <Textarea 
                      ref={chatInputRef} 
                      value={chatInput} 
                      onChange={(e) => setChatInput(e.target.value)} 
                      onKeyPress={handleKeyPress} 
                      placeholder="Type /help for commands..." 
                      className="min-h-[50px] max-h-[150px] resize-none text-sm bg-[#0E2E33] border-[#0E2E33] text-white placeholder:text-gray-400 rounded-lg" 
                    />
                    <div className="flex gap-2">
                      {/* File upload */}
                      <input 
                        ref={fileInputRef}
                        type="file" 
                        multiple 
                        onChange={handleFileSelect}
                        className="hidden"
                        accept="image/*,.pdf,.txt,.doc,.docx"
                      />

                    </div>
                  </div>
                  {/* Removed compact 'Insert last reply' button to avoid duplicate insert controls */}

                  {/* Enhance button (no send) */}
                  <EnhancedPromptButton
                    onClick={handleEnhanceOnly}
                    disabled={!chatInput.trim() || isLoading || enhancing}
                    isLoading={enhancing}
                    title="Enhance your prompt with AI"
                  />

                  {/* Original Send button */}
                  <Button 
                    onClick={handleSendMessage} 
                    disabled={!chatInput.trim() || isLoading} 
                    size="sm" 
                    className="self-end bg-[#15a366] hover:bg-[#10a35a] text-white h-[50px] font-semibold border-0"
                    title="Send"
                  >
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </Button>
                </div>
              </div>
            </>
          ) : null}
      </div>
    </div>
  );
}

interface CreateAgentFormProps {
  models: OpenRouterModel[];
  onCreateAgent: (agent: Omit<Agent, 'id'>) => void;
}

function CreateAgentForm({ models, onCreateAgent }: CreateAgentFormProps) {
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("google/gemini-flash-1.5");
  const [modelSearch, setModelSearch] = useState("");
  const [showFreeOnly, setShowFreeOnly] = useState(true);

  const handleSubmit = () => {
    if (!name.trim() || !prompt.trim()) return;
    onCreateAgent({ name, systemPrompt: prompt, model });
    setName("");
    setPrompt("");
  };

  // Debug: Log models on mount
  useEffect(() => {
    console.log("📊 CreateAgentForm models:", models.length, "models available");
    if (models.length === 0) {
      console.warn("⚠️ No models loaded yet!");
    }
  }, [models]);

  // Filter models based on search and free-only toggle
  const filteredModels = models.filter(m => {
    const matchesSearch = !modelSearch || 
      m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
      m.id.toLowerCase().includes(modelSearch.toLowerCase());
    
    const isFree = !m.pricing || 
      (parseFloat(m.pricing.prompt) === 0 && parseFloat(m.pricing.completion) === 0);
    
    const matchesFreeFilter = !showFreeOnly || isFree;
    
    return matchesSearch && matchesFreeFilter;
  });

  return (
    <div className="space-y-4 py-4">
      <div>
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Agent name" />
      </div>
      <div>
        <Label>Model</Label>
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Input 
              placeholder="Search models..." 
              value={modelSearch}
              onChange={(e) => setModelSearch(e.target.value)}
              className="flex-1"
            />
            <label className="flex items-center gap-2 text-sm whitespace-nowrap">
              <input 
                type="checkbox" 
                checked={showFreeOnly}
                onChange={(e) => setShowFreeOnly(e.target.checked)}
                className="rounded"
              />
              Free only
            </label>
          </div>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger>
              <SelectValue placeholder={models.length === 0 ? "Loading models..." : "Select a model"} />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="anythingllm">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">🌐 AnythingLLM (Recommended)</span>
                  <span className="text-xs bg-[#15a366] text-white px-2 py-0.5 rounded">Smart</span>
                </div>
              </SelectItem>
              {models.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">⏳ Loading models from OpenRouter...</div>
              ) : filteredModels.length > 0 ? (
                filteredModels.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    <div className="flex items-center justify-between w-full">
                      <span className="text-sm">{m.name}</span>
                      {m.pricing && (
                        <span className="text-xs text-muted-foreground ml-2">
                          ${m.pricing.prompt}/{m.pricing.completion}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))
              ) : (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">No models match your filters</div>
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {models.length === 0 ? "Loading..." : `${filteredModels.length} of ${models.length} models`}
          </p>
        </div>
      </div>
      <div>
        <Label>Prompt</Label>
        <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="System prompt..." className="min-h-[100px]" />
      </div>
      <DialogFooter>
        <Button onClick={handleSubmit} disabled={!name.trim()}>
          Create
        </Button>
      </DialogFooter>
    </div>
  );
}

interface EditAgentFormProps {
  agent: Agent;
  models: OpenRouterModel[];
  onUpdateAgent: (agent: Agent) => void;
  onDeleteAgent: () => void;
}

function EditAgentForm({ agent, models, onUpdateAgent, onDeleteAgent }: EditAgentFormProps) {
  const [name, setName] = useState(agent.name);
  const [prompt, setPrompt] = useState(agent.systemPrompt);
  const [model, setModel] = useState(agent.model);
  const [modelSearch, setModelSearch] = useState("");
  const [showFreeOnly, setShowFreeOnly] = useState(true);

  const handleSubmit = () => {
    if (!name.trim() || !prompt.trim()) return;
    onUpdateAgent({ ...agent, name, systemPrompt: prompt, model });
  };

  // Filter models based on search and free-only toggle
  const filteredModels = models.filter(m => {
    const matchesSearch = !modelSearch || 
      m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
      m.id.toLowerCase().includes(modelSearch.toLowerCase());
    
    const isFree = !m.pricing || 
      (parseFloat(m.pricing.prompt) === 0 && parseFloat(m.pricing.completion) === 0);
    
    const matchesFreeFilter = !showFreeOnly || isFree;
    
    return matchesSearch && matchesFreeFilter;
  });

  return (
    <div className="space-y-4 py-4">
      <div>
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Agent name" />
      </div>
      <div>
        <Label>Model</Label>
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Input 
              placeholder="Search models..." 
              value={modelSearch}
              onChange={(e) => setModelSearch(e.target.value)}
              className="flex-1"
            />
            <label className="flex items-center gap-2 text-sm whitespace-nowrap">
              <input 
                type="checkbox" 
                checked={showFreeOnly}
                onChange={(e) => setShowFreeOnly(e.target.checked)}
                className="rounded"
              />
              Free only
            </label>
          </div>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger>
              <SelectValue placeholder={models.length === 0 ? "Loading models..." : "Select a model"} />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="anythingllm">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">🌐 AnythingLLM (Recommended)</span>
                  <span className="text-xs bg-[#15a366] text-white px-2 py-0.5 rounded">Smart</span>
                </div>
              </SelectItem>
              {models.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">⏳ Loading models from OpenRouter...</div>
              ) : filteredModels.length > 0 ? (
                filteredModels.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    <div className="flex items-center justify-between w-full">
                      <span className="text-sm">{m.name}</span>
                      {m.pricing && (
                        <span className="text-xs text-muted-foreground ml-2">
                          ${m.pricing.prompt}/{m.pricing.completion}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))
              ) : (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">No models match your filters</div>
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {models.length === 0 ? "Loading..." : `${filteredModels.length} of ${models.length} models`}
          </p>
        </div>
      </div>
      <div>
        <Label>System Prompt</Label>
        <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="System prompt for this agent..." className="min-h-[200px]" />
      </div>
      <DialogFooter className="flex items-center justify-between">
        <Button variant="destructive" size="sm" onClick={onDeleteAgent}>
          Delete Agent
        </Button>
        <Button onClick={handleSubmit} disabled={!name.trim() || !prompt.trim()}>
          Save Changes
        </Button>
      </DialogFooter>
    </div>
  );
}
