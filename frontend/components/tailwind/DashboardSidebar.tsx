"use client";

// 📊 Dashboard Analytics Sidebar - Query-only mode for embedded SOW analytics
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

interface DashboardSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  chatMessages: ChatMessage[];
  onSendMessage: (message: string, threadSlug?: string | null) => void;
  isLoading?: boolean;
  streamingMessageId?: string | null;
  dashboardChatTarget: string; // Workspace slug for dashboard mode
  onDashboardWorkspaceChange: (slug: string) => void;
  availableWorkspaces: Array<{slug: string, name: string}>;
  onClearChat: () => void;
  onReplaceChatMessages: (messages: Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: number }>) => void;
}

export default function DashboardSidebar({
  isOpen,
  onToggle,
  chatMessages,
  onSendMessage,
  isLoading = false,
  streamingMessageId,
  dashboardChatTarget,
  onDashboardWorkspaceChange,
  availableWorkspaces,
  onClearChat,
  onReplaceChatMessages,
}: DashboardSidebarProps) {
  const [chatInput, setChatInput] = useState("");
  
  // 🧵 THREAD MANAGEMENT STATE
  const [threads, setThreads] = useState<Array<{ slug: string; name: string; id: number; createdAt: string }>>([]);
  const [currentThreadSlug, setCurrentThreadSlug] = useState<string | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [showThreadList, setShowThreadList] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Load threads on mount and when workspace changes
  useEffect(() => {
    if (dashboardChatTarget) {
      loadThreads(dashboardChatTarget);
    }
  }, [dashboardChatTarget]);

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
    if (!dashboardChatTarget) {
      toast.error('No workspace selected');
      return null;
    }
    
    console.log('🆕 Creating new thread for workspace:', dashboardChatTarget);
    setLoadingThreads(true);
    
    try {
      const response = await fetch(`/api/anythingllm/thread?workspace=${encodeURIComponent(dashboardChatTarget)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace: dashboardChatTarget }),
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
      const response = await fetch(`/api/anythingllm/thread?workspace=${encodeURIComponent(dashboardChatTarget)}&thread=${encodeURIComponent(threadSlug)}`);

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
      const response = await fetch(`/api/anythingllm/thread?workspace=${encodeURIComponent(dashboardChatTarget)}&thread=${encodeURIComponent(threadSlug)}`, {
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
          handleNewThread();
        }
      }
      
      console.log('✅ Thread deleted successfully');
    } catch (error) {
      console.error('❌ Failed to delete thread:', error);
      toast.error('Failed to delete thread');
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isLoading) return;

    // Ensure a thread exists before sending (for persistence)
    let threadToUse = currentThreadSlug;
    if (!threadToUse) {
      const created = await handleNewThread();
      if (!created) return;
      threadToUse = created;
    }

    console.log('📤 Sending message:', {
      message: chatInput,
      threadSlug: threadToUse,
      workspaceSlug: dashboardChatTarget,
    });

    onSendMessage(chatInput, threadToUse);
    setChatInput("");
  };

  // Enhance prompt using AI
  const [enhancing, setEnhancing] = useState(false);
  const handleEnhanceOnly = async () => {
    if (!chatInput.trim() || isLoading || enhancing) return;
    try {
      setEnhancing(true);
      
      // 🎯 NEW: Use AnythingLLM utility workspace for prompt enhancement
      const resp = await fetch('/api/anythingllm/stream-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: chatInput,
          workspaceSlug: 'utility-prompt-enhancer',
          mode: 'chat',
        })
      });
      
      if (!resp.ok) {
        const msg = await resp.text().catch(() => '');
        throw new Error(msg || `Enhancer error ${resp.status}`);
      }
      
      // Read the streaming response
      const reader = resp.body?.getReader();
      const decoder = new TextDecoder();
      let enhanced = '';
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6);
              if (jsonStr === '[DONE]') break;
              
              try {
                const data = JSON.parse(jsonStr);
                if (data.textResponse) {
                  enhanced = data.textResponse;
                }
              } catch (e) {
                // Ignore parse errors for streaming chunks
              }
            }
          }
        }
      }
      
      enhanced = enhanced.trim();
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

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  const currentWorkspaceName = availableWorkspaces.find(w => w.slug === dashboardChatTarget)?.name || '🎯 All SOWs (Master)';
  const isMasterView = dashboardChatTarget === 'sow-master-dashboard';
  const personaName = isMasterView ? 'Analytics Assistant' : 'The Architect';
  const personaSubtitle = isMasterView ? 'Master Dashboard' : 'Client Workspace';

  return (
    <div className="h-full w-full min-w-0 bg-[#0e0f0f] border-l border-[#0E2E33] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[#0E2E33] bg-[#0e0f0f] flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-white truncate">Chat</h2>
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

        {/* Workspace Selector */}
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
          <span className="text-sm font-medium text-white">{personaName}</span>
          <span className="ml-2 text-xs text-gray-400">{personaSubtitle}</span>
        </div>
      </div>

      {/* Chat Messages */}
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

      {/* Input Area */}
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
          {/* Enhance button */}
          <Button
            onClick={handleEnhanceOnly}
            disabled={!chatInput.trim() || isLoading || enhancing}
            className="self-end bg-[#0E2E33] hover:bg-[#143e45] text-white border border-[#1CBF79]"
            title="Enhance your prompt with AI"
          >
            {enhancing ? (
              <Loader2 className="h-5 w-5 animate-spin text-[#1CBF79]" />
            ) : (
              <span className="text-lg">✨</span>
            )}
          </Button>
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
    </div>
  );
}
