"use client";

// ✍️ Workspace SOW Editor Sidebar - Full-featured SOW generation with The Architect
import React, { useEffect, useRef, useState } from "react";
import { toast } from 'sonner';
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { ScrollArea } from "./ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { ChevronRight, Send, Bot, Plus, Loader2 } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { StreamingThoughtAccordion } from "./streaming-thought-accordion";
import { cleanSOWContent } from "@/lib/export-utils";

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface WorkspaceChatProps {
  isOpen: boolean;
  onToggle: () => void;
  chatMessages: ChatMessage[];
  onSendMessage: (message: string, threadSlug?: string | null, attachments?: Array<{name: string; mime: string; contentString: string}>) => void;
  isLoading?: boolean;
  onInsertToEditor: (content: string) => void;
  streamingMessageId?: string | null;
  editorWorkspaceSlug: string; // Workspace slug for currently open SOW
  editorThreadSlug?: string | null; // Current thread for the open SOW
  onEditorThreadChange: (slug: string | null) => void;
  onClearChat: () => void;
  onReplaceChatMessages: (messages: Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: number }>) => void;
}

export default function WorkspaceChat({
  isOpen,
  onToggle,
  chatMessages,
  onSendMessage,
  isLoading = false,
  onInsertToEditor,
  streamingMessageId,
  editorWorkspaceSlug,
  editorThreadSlug,
  onEditorThreadChange,
  onClearChat,
  onReplaceChatMessages,
}: WorkspaceChatProps) {
  const [chatInput, setChatInput] = useState("");
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
  const [showSettings, setShowSettings] = useState(false);
  const [showSlashCommands, setShowSlashCommands] = useState(false);
  const [selectedModelForAgent, setSelectedModelForAgent] = useState("");
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Load workspace system prompt
  useEffect(() => {
    const loadPrompt = async () => {
      if (!editorWorkspaceSlug) return;
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
  }, [editorWorkspaceSlug]);

  // 💾 Save current thread to localStorage whenever it changes
  useEffect(() => {
    if (currentThreadSlug && editorWorkspaceSlug) {
      const storageKey = `workspace-thread-${editorWorkspaceSlug}`;
      localStorage.setItem(storageKey, currentThreadSlug);
      console.log('💾 Saved thread to localStorage:', { workspace: editorWorkspaceSlug, thread: currentThreadSlug });
    }
  }, [currentThreadSlug, editorWorkspaceSlug]);

  // Load threads on mount and when workspace changes
  useEffect(() => {
    const initializeThreads = async () => {
      if (!editorWorkspaceSlug) return;
      
      // Load all threads for this workspace
      await loadThreads(editorWorkspaceSlug);
      
      // 🔄 Restore thread from localStorage or use editorThreadSlug
      const storageKey = `workspace-thread-${editorWorkspaceSlug}`;
      const savedThreadSlug = localStorage.getItem(storageKey);
      
      let threadToLoad: string | null = null;
      
      if (editorThreadSlug) {
        threadToLoad = editorThreadSlug;
        setCurrentThreadSlug(editorThreadSlug);
      } else if (savedThreadSlug) {
        console.log('🔄 Restored thread from localStorage:', savedThreadSlug);
        threadToLoad = savedThreadSlug;
        setCurrentThreadSlug(savedThreadSlug);
        // Notify parent about the restored thread
        onEditorThreadChange(savedThreadSlug);
      }
      
      // Load thread history if we have a thread to restore
      if (threadToLoad) {
        try {
          const response = await fetch(`/api/anythingllm/thread?workspace=${encodeURIComponent(editorWorkspaceSlug)}&thread=${encodeURIComponent(threadToLoad)}`);
          if (response.ok) {
            const data = await response.json();
            const mapped = (data.history || []).map((msg: any) => ({
              id: `msg-${msg.id || Date.now()}-${Math.random()}`,
              role: msg.role === 'user' ? 'user' : 'assistant',
              content: msg.content || '',
              timestamp: new Date(msg.createdAt || Date.now()).getTime(),
            }));
            onReplaceChatMessages(mapped);
            console.log('✅ Restored thread history:', mapped.length, 'messages');
          }
        } catch (error) {
          console.warn('⚠️ Failed to load saved thread history:', error);
        }
      }
    };
    
    initializeThreads();
  }, [editorWorkspaceSlug, editorThreadSlug]);

  // Focus input when component mounts or thread changes
  useEffect(() => {
    setTimeout(() => chatInputRef.current?.focus(), 50);
  }, [editorThreadSlug]);

  const loadThreads = async (workspaceSlug: string) => {
    console.log('📂 Loading threads for workspace:', workspaceSlug);
    setLoadingThreads(true);
    
    try {
      const response = await fetch(`/api/anythingllm/threads?workspace=${encodeURIComponent(workspaceSlug)}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Failed to load threads:', {
          status: response.status,
          workspace: workspaceSlug,
          error: errorData,
        });
        
        // Don't throw - just set empty threads and let the user continue
        setThreads([]);
        return;
      }

      const data = await response.json();
      const threadList = data?.threads || [];
      
      console.log('✅ Threads loaded:', {
        workspace: workspaceSlug,
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

  const handleNewThread = async (): Promise<string | null> => {
    if (!editorWorkspaceSlug) {
      toast.error('No workspace available');
      return null;
    }
    
    console.log('🆕 Creating new thread for workspace:', editorWorkspaceSlug);
    setLoadingThreads(true);
    
    try {
      const response = await fetch(`/api/anythingllm/thread?workspace=${encodeURIComponent(editorWorkspaceSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace: editorWorkspaceSlug }),
      });

      if (!response.ok) {
        throw new Error('Failed to create thread');
      }

      const data = await response.json();
      const newThreadSlug = data.thread?.slug;
      
      if (!newThreadSlug) {
        throw new Error('No thread slug returned from server');
      }

      console.log('✅ New thread created:', newThreadSlug);
      
      // Add to local state
      const newThread = {
        slug: newThreadSlug,
        name: data.thread?.name || 'New Chat',
        id: data.thread?.id || Date.now(),
        createdAt: new Date().toISOString(),
      };
      setThreads(prev => [newThread, ...prev]);
      setCurrentThreadSlug(newThreadSlug);
      
      // Notify parent
      onEditorThreadChange(newThreadSlug);
      
      // Clear chat for new thread
      onClearChat();
      
      return newThreadSlug;
    } catch (error) {
      console.error('❌ Failed to create thread:', error);
      toast.error('Failed to create new chat thread');
      return null;
    } finally {
      setLoadingThreads(false);
    }
  };

  const handleToggleThreads = () => {
    setShowThreadList(prev => !prev);
  };

  const handleSelectThread = async (threadSlug: string) => {
    console.log('📂 Switching to thread:', threadSlug);
    setCurrentThreadSlug(threadSlug);
    setShowThreadList(false);
    setLoadingThreads(true);
    
    try {
      const response = await fetch(`/api/anythingllm/thread?workspace=${encodeURIComponent(editorWorkspaceSlug)}&thread=${encodeURIComponent(threadSlug)}`);

      if (!response.ok) {
        throw new Error('Failed to load thread history');
      }

      const data = await response.json();
      console.log('✅ Loaded thread history:', data.history?.length || 0, 'messages');
      
      const mapped = (data.history || []).map((msg: any) => ({
        id: `msg-${msg.id || Date.now()}-${Math.random()}`,
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content || '',
        timestamp: new Date(msg.createdAt || Date.now()).getTime(),
      }));
      
      onReplaceChatMessages(mapped);
      onEditorThreadChange(threadSlug);
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
      const response = await fetch(`/api/anythingllm/thread?workspace=${encodeURIComponent(editorWorkspaceSlug)}&thread=${encodeURIComponent(threadSlug)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete thread');
      }

      setThreads(prev => prev.filter(t => t.slug !== threadSlug));
      
      if (currentThreadSlug === threadSlug) {
        const remainingThreads = threads.filter(t => t.slug !== threadSlug);
        if (remainingThreads.length > 0) {
          handleSelectThread(remainingThreads[0].slug);
        } else {
          const newSlug = await handleNewThread();
          if (newSlug) onEditorThreadChange(newSlug);
        }
      }

      // Notify parent if current thread was deleted
      const stillExists = threads.some(t => t.slug === threadSlug);
      if (!stillExists) onEditorThreadChange(null);
      
      console.log('✅ Thread deleted successfully');
    } catch (error) {
      console.error('❌ Failed to delete thread:', error);
      toast.error('Failed to delete thread');
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isLoading) return;

    console.log('📤 Sending message:', {
      message: chatInput,
      threadSlug: currentThreadSlug,
      attachments: attachments.length,
      workspaceSlug: editorWorkspaceSlug,
    });

    onSendMessage(chatInput, currentThreadSlug, attachments);
    setChatInput("");
    setAttachments([]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Enhance prompt using AI
  const [enhancing, setEnhancing] = useState(false);
  const handleEnhanceOnly = async () => {
    if (!chatInput.trim() || isLoading || enhancing) return;
    try {
      setEnhancing(true);
      
      // ✅ Use dedicated enhance-prompt endpoint
      const resp = await fetch('/api/ai/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: chatInput,
        })
      });
      
      if (!resp.ok) {
        const msg = await resp.text().catch(() => '');
        throw new Error(msg || `Enhancer error ${resp.status}`);
      }
      
      const data = await resp.json();
      const enhanced = data.enhancedPrompt;
      
      if (!enhanced || !enhanced.trim()) {
        toast.error('Enhancer returned empty text');
        return;
      }
      
      setChatInput(enhanced.trim());
      toast.success('Prompt enhanced');
    } catch (e) {
      console.error('Enhance failed:', e);
      toast.error('Failed to enhance your prompt.');
    } finally {
      setEnhancing(false);
    }
  };

  // File attachment handling
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        console.log('📎 Processing file:', file.name, file.type);
        
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
      }
    } catch (error) {
      console.error('❌ Error processing file:', error);
      toast.error('Failed to process file');
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const insertText = (text: string) => {
    setChatInput(prev => prev + text);
    chatInputRef.current?.focus();
  };

  const slashCommands = [
    { command: '/reset', description: 'Clear chat history and begin a new chat' },
    { command: '/help', description: 'Show available commands' },
    { command: '/summarize', description: 'Summarize the current conversation' },
  ];

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="h-full w-full min-w-0 bg-[#0e0f0f] border-l border-[#0E2E33] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[#0E2E33] bg-[#0e0f0f] flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-white truncate">Workspace Chat</h2>
          <div className="flex items-center gap-2 flex-shrink-0">
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
            <Button
              onClick={onToggle}
              className="bg-[#1c1c1c] hover:bg-[#222] text-white text-xs h-6 px-2 border border-[#2a2a2a] flex-shrink-0"
              size="sm"
              title="Hide chat panel"
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>


      </div>

      {/* Thread List */}
      {showThreadList && (
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
                      <div className="font-medium truncate">{thread.name}</div>
                      <div className="text-[10px] opacity-60">{new Date(thread.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => handleDeleteThread(thread.slug)}
                  className="opacity-0 group-hover:opacity-100 px-2 hover:text-red-400"
                  title="Delete thread"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Persona Badge */}
      <div className="p-3 border-b border-[#0E2E33]">
        <div className="flex items-center gap-2 bg-[#0E2E33] px-3 py-2 rounded-md">
          <Bot className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-white">The Architect</span>
          <span className="ml-2 text-xs text-gray-400">SOW generation</span>
        </div>
      </div>

      {/* Chat Messages */}
      <ScrollArea className="flex-1">
        <div className="p-5 space-y-5">
          {chatMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8">
              <Bot className="h-16 w-16 text-gray-600 mb-3" />
              <p className="text-base text-gray-400">No messages yet</p>
            </div>
          ) : (
            chatMessages.map(msg => {
              const shouldShowButton = msg.role === 'assistant';
              const cleaned = cleanSOWContent(msg.content);
              const segments = msg.role === 'assistant' ? [] : [{ type: 'text' as const, content: msg.content }];
              
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
                          onInsertClick={(content) => onInsertToEditor(content)}
                        />
                      </div>
                    )}
                    
                    {/* Content rendering for user messages only */}
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
                      {/* Insert button for assistant messages */}
                      {shouldShowButton && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs border-[#1b5e5e] text-gray-200 hover:text-white hover:bg-[#124847]"
                          title="Insert full SOW (narrative + pricing)"
                          onClick={() => onInsertToEditor(msg.content)}
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

      {/* Input Area */}
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

        {/* Chat Input */}
        <div className="flex gap-3">
          <div className="flex-1 space-y-2">
            <div className="relative">
              <Textarea 
                ref={chatInputRef} 
                value={chatInput} 
                onChange={(e) => setChatInput(e.target.value)} 
                onKeyPress={handleKeyPress} 
                placeholder="Type /help for commands..." 
                className="min-h-[50px] max-h-[150px] resize-none text-sm bg-[#0E2E33] border-[#0E2E33] text-white placeholder:text-gray-400 rounded-lg pr-12" 
              />
            
            {/* Enhance button - positioned inside textarea */}
            <button
              onClick={handleEnhanceOnly}
              disabled={!chatInput.trim() || isLoading || enhancing}
              className="absolute right-3 top-3 p-1.5 rounded-md bg-[#1b1b1e] hover:bg-[#2a2a2a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-[#1CBF79]/30 hover:border-[#1CBF79]/60"
              title="Enhance your prompt with AI"
            >
              {enhancing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1CBF79]" />
              ) : (
                <span className="text-[#1CBF79] text-sm">✨</span>
              )}
            </button>
            </div>
            
            <div className="flex gap-2 mt-2">
              {/* File upload */}
              <input 
                ref={fileInputRef}
                type="file" 
                multiple 
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,.pdf,.txt,.doc,.docx"
              />
              
              {/* Send button - full width, prominent */}
              <Button 
                onClick={handleSendMessage} 
                disabled={!chatInput.trim() || isLoading} 
                size="sm" 
                className="w-full bg-[#15a366] hover:bg-[#10a35a] text-white h-12 font-semibold border-0 text-base"
                title="Send message to The Architect"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <Send className="h-5 w-5 mr-2" />
                )}
                {isLoading ? 'Generating...' : 'Send'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
