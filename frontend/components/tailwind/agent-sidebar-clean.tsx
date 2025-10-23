"use client";

import React, { useState, useEffect, useRef } from "react";
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
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  onInsertToEditor?: (content: string) => void;
  streamingMessageId?: string | null; // Track which message is streaming
  viewMode?: 'dashboard' | 'editor' | 'gardner-studio'; // NEW: Context awareness
  dashboardChatTarget?: string; // NEW: Workspace slug for dashboard mode
  onDashboardWorkspaceChange?: (slug: string) => void; // NEW: Handler for workspace selection
  availableWorkspaces?: Array<{slug: string, name: string}>; // NEW: Available workspaces
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
  dashboardChatTarget = 'sow-master-dashboard-54307162', // Default to master dashboard
  onDashboardWorkspaceChange,
  availableWorkspaces = [{ slug: 'sow-master-dashboard-54307162', name: '🎯 All SOWs (Master)' }],
}: AgentSidebarProps) {
  const [chatInput, setChatInput] = useState("");
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [modelSearch, setModelSearch] = useState("");
  const [showFreeOnly, setShowFreeOnly] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [selectedModelForAgent, setSelectedModelForAgent] = useState("");
  const [conversations, setConversations] = useState<Array<{ id: string; title: string; timestamp: number }>>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Debug: Log when onInsertToEditor is available (DISABLED for performance)
  // useEffect(() => {
  //   console.log('🔍 [AgentSidebar] onInsertToEditor prop:', onInsertToEditor ? 'Available ✅' : 'Missing ❌');
  //   console.log('🔍 [AgentSidebar] Chat messages count:', chatMessages.length);
  //   console.log('🔍 [AgentSidebar] Current agent ID:', currentAgentId);
  // }, [onInsertToEditor, chatMessages.length, currentAgentId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleNewChat = () => {
    const newConversation = {
      id: `conv-${Date.now()}`,
      title: `Chat - ${new Date().toLocaleDateString()}`,
      timestamp: Date.now(),
    };
    setConversations(prev => [newConversation, ...prev]);
    setCurrentConversationId(newConversation.id);
  };

  const handleSelectConversation = (conversationId: string) => {
    setCurrentConversationId(conversationId);
    setShowHistory(false);
  };

  useEffect(() => {
    if (currentAgentId) {
      chatInputRef.current?.focus();
    }
  }, [currentAgentId]);

  // 🤖 AUTO-SELECT AGENT BASED ON VIEW MODE
  useEffect(() => {
    if (!agents || agents.length === 0) return;

    let targetAgentId: string | null = null;

    if (viewMode === 'dashboard') {
      // Dashboard mode: Look for "Business Analyst"
      const businessAnalyst = agents.find(a => 
        a.name.toLowerCase().includes('business') || 
        a.name.toLowerCase().includes('analyst') ||
        a.id.toLowerCase().includes('business') ||
        a.id.toLowerCase().includes('analyst')
      );
      targetAgentId = businessAnalyst?.id || null;
      
      if (targetAgentId && targetAgentId !== currentAgentId) {
        console.log(`🤖 [Auto-Select] Dashboard mode → Auto-selecting ${businessAnalyst?.name} (Business Analyst)`);
        onSelectAgent(targetAgentId);
      }
    } else if (viewMode === 'editor') {
      // Editor mode: Look for "The Architect" or "gen-the-architect"
      const architect = agents.find(a => 
        a.name.toLowerCase().includes('architect') || 
        a.id.includes('architect')
      );
      targetAgentId = architect?.id || null;
      
      if (targetAgentId && targetAgentId !== currentAgentId) {
        console.log(`🤖 [Auto-Select] Editor mode → Auto-selecting ${architect?.name} (The Architect)`);
        onSelectAgent(targetAgentId);
      }
    }
  }, [viewMode, agents, currentAgentId, onSelectAgent]);

  useEffect(() => {
    fetchModels();
  }, []);

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

  const currentAgent = agents.find(a => a.id === currentAgentId);
  
  const filteredModels = models.filter(model => {
    const matchesSearch = model.name.toLowerCase().includes(modelSearch.toLowerCase());
    const matchesFree = !showFreeOnly || !model.pricing?.prompt;
    return matchesSearch && matchesFree;
  });

  const handleSendMessage = () => {
    if (!chatInput.trim() || !currentAgentId || isLoading) return;
    onSendMessage(chatInput);
    setChatInput("");
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
  const isMasterView = dashboardChatTarget === 'sow-master-dashboard-54307162';

  return (
    <div className="h-full w-full bg-[#0e0f0f] border-l border-[#0E2E33] overflow-hidden flex flex-col">
      <div className="p-5 border-b border-[#0E2E33] bg-[#0e0f0f]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-white">
            {isDashboardMode 
              ? (isMasterView 
                  ? "Ask the Dashboard" 
                  : `Ask the Dashboard (Client: ${currentWorkspaceName})`)
              : "AI Agent Chat"}
          </h2>
          {/* Close button - collapses the panel */}
          {onToggle && (
            <button
              onClick={onToggle}
              className="p-1 hover:bg-gray-800 rounded transition-colors text-gray-400 hover:text-gray-300"
              title="Close AI chat"
              aria-label="Close AI chat"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Dashboard Mode: New Chat + History Buttons */}
        {isDashboardMode && (
          <div className="flex gap-2 mb-3">
            <Button 
              onClick={handleNewChat} 
              className="flex-1 bg-[#1CBF79] hover:bg-[#1CBF79]/90 text-white text-xs h-8"
              size="sm"
            >
              <Plus className="w-3 h-3 mr-1" />
              New Chat
            </Button>
            <Button 
              onClick={() => setShowHistory(!showHistory)} 
              variant="outline"
              size="sm"
              className="border-[#0E2E33] text-gray-300 hover:bg-[#0E2E33] text-xs h-8"
            >
              History ({conversations.length})
            </Button>
          </div>
        )}

        {/* Conversation History Dropdown */}
        {isDashboardMode && showHistory && conversations.length > 0 && (
          <div className="bg-[#0E2E33] border border-[#0E2E33] rounded-lg mb-3 max-h-48 overflow-y-auto">
            <div className="p-2 space-y-1">
              {conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={`w-full text-left p-2 rounded text-xs transition-colors ${
                    currentConversationId === conv.id 
                      ? 'bg-[#1CBF79] text-white' 
                      : 'text-gray-300 hover:bg-[#0e0f0f]'
                  }`}
                >
                  <div className="truncate">{conv.title}</div>
                  <div className="text-xs text-gray-500">{new Date(conv.timestamp).toLocaleString()}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dashboard mode: Workspace selector */}
        {isDashboardMode && onDashboardWorkspaceChange && (
          <div className="mb-3">
            <Label className="text-xs text-gray-400 mb-2 block">Chat Context</Label>
            <Select value={dashboardChatTarget} onValueChange={onDashboardWorkspaceChange}>
              <SelectTrigger className="h-10 text-sm bg-[#0E2E33] border-[#0E2E33] text-white">
                <SelectValue placeholder="Select workspace" />
              </SelectTrigger>
              <SelectContent className="max-h-80 z-50">
                {availableWorkspaces.map(workspace => (
                  <SelectItem key={workspace.slug} value={workspace.slug}>
                    {workspace.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              {isMasterView 
                ? "Querying master dashboard (all SOWs metadata)" 
                : `Querying ${currentWorkspaceName}'s workspace`}
            </p>
          </div>
        )}
          
          {/* Show agent selection ONLY in editor mode, HIDE Settings and Create Agent buttons (moved to admin) */}
          {isEditorMode && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <Select value={currentAgentId || undefined} onValueChange={onSelectAgent}>
                  <SelectTrigger className="h-10 text-sm bg-[#0E2E33] border-[#0E2E33] text-white">
                    <SelectValue placeholder="Select Agent" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80 z-50">
                    {agents.map(agent => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* 🤖 AUTO-SELECT CONTEXT HINT */}
              {currentAgentId && currentAgent && (
                <p className="text-xs text-gray-400 px-0">
                  {viewMode === 'editor' ? '✨ Selected for SOW generation' : '✨ Agent ready'}
                </p>
              )}

              {/* ❌ HIDDEN: Settings button moved to Admin Panel */}
              {/* <Dialog open={showSettings} onOpenChange={setShowSettings}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-10 px-3 bg-[#1CBF79] hover:bg-[#15a366] text-white font-semibold border-0" title="Agent Settings">
                    <Settings className="h-4 w-4 mr-2" />
                    <span className="text-xs">Settings</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700">
                  <DialogHeader>
                    <DialogTitle className="text-white">Edit Agent</DialogTitle>
                  </DialogHeader>
                  {currentAgent ? (
                    <EditAgentForm 
                      agent={currentAgent} 
                      models={models} 
                      onUpdateAgent={(updated) => {
                        onUpdateAgent(updated.id, { name: updated.name, systemPrompt: updated.systemPrompt, model: updated.model });
                        setShowSettings(false);
                      }}
                      onDeleteAgent={() => {
                        onDeleteAgent(currentAgent.id);
                        setShowSettings(false);
                      }}
                    />
                  ) : (
                    <p>No agent selected</p>
                  )}
                </DialogContent>
              </Dialog> */}

              {/* ❌ HIDDEN: Create Agent button - agents are admin-only */}
              {/* <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-10 px-3 bg-[#1CBF79] hover:bg-[#15a366] text-white font-semibold border-0" title="Create New Agent">
                    <Plus className="h-4 w-4 mr-2" />
                    <span className="text-xs">New Agent</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700">
                  <DialogHeader>
                    <DialogTitle className="text-white">Create New Agent</DialogTitle>
                  </DialogHeader>
                  <CreateAgentForm models={models} onCreateAgent={onCreateAgent} />
                </DialogContent>
              </Dialog> */}
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
                      <h3 className="text-xl font-semibold text-white mb-2">Ask About Your Dashboard</h3>
                      <p className="text-sm text-gray-400 text-center max-w-xs">
                        Ask questions about your SOWs, metrics, clients, or get insights from your dashboard data.
                      </p>
                    </div>
                  ) : (
                    chatMessages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`w-full max-w-[85%] rounded-xl px-4 py-3 ${
                          msg.role === 'user' 
                            ? 'bg-[#1CBF79] text-white' 
                            : 'bg-[#1b1b1e] text-white border border-[#0E2E33]'
                        }`}>
                          {/* Show thinking section with accordion for assistant messages */}
                          {msg.role === 'assistant' && (
                            <div className="mb-4">
                              <StreamingThoughtAccordion 
                                content={msg.content}
                                messageId={msg.id}
                                isStreaming={streamingMessageId === msg.id}
                              />
                            </div>
                          )}
                          
                          {/* Show actual content */}
                          <div className="prose prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.content.replace(/<think>[\s\S]*?<\/think>/gi, '')}
                            </ReactMarkdown>
                          </div>
                          <div className="text-xs mt-2 opacity-60">
                            {formatTimestamp(msg.timestamp)}
                          </div>
                        </div>
                      </div>
                    ))
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
                          onSendMessage(chatInput.trim());
                          setChatInput("");
                        }
                      }
                    }}
                    placeholder="Ask about your dashboard..."
                    className="min-h-[80px] resize-none bg-[#1b1b1e] border-[#0E2E33] text-white placeholder:text-gray-500"
                    disabled={isLoading}
                  />
                  <Button 
                    onClick={() => {
                      if (chatInput.trim() && !isLoading) {
                        onSendMessage(chatInput.trim());
                        setChatInput("");
                      }
                    }}
                    disabled={!chatInput.trim() || isLoading}
                    className="self-end bg-[#1CBF79] hover:bg-[#15a366] text-white border-0"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </>
          ) : isEditorMode && currentAgent ? (
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
                          <div className={`w-full rounded-lg p-4 ${
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
                                />
                              </div>
                            )}
                            
                            {/* Show actual content for user messages */}
                            {msg.role === 'user' && (
                              <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-invert max-w-none text-sm">
                                {msg.content}
                              </ReactMarkdown>
                            )}
                            
                            <div className="flex gap-2 mt-4 items-center">
                              <p className="text-xs mt-1 opacity-70 flex-1">{formatTimestamp(msg.timestamp)}</p>
                              {shouldShowButton && (
                                <Button 
                                  size="sm" 
                                  className="text-xs h-8 px-4 bg-[#1b5e5e] hover:bg-[#1b5e5e]/80 text-white font-semibold border border-[#0E2E33]"
                                  onClick={() => {
                                    console.log('🖱️ Insert to Editor button clicked');
                                    console.log('📤 Inserting content without thinking tags');
                                    // Extract content without thinking tags
                                    const cleanedContent = msg.content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
                                    onInsertToEditor(cleanedContent || msg.content);
                                  }}
                                >
                                  📝 Insert to Editor
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

              <div className="p-5 border-t border-[#0E2E33] bg-[#0e0f0f]">
                <div className="flex gap-3">
                  <Textarea ref={chatInputRef} value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyPress={handleKeyPress} placeholder="Type message..." className="min-h-[50px] max-h-[150px] resize-none text-sm bg-[#0E2E33] border-[#0E2E33] text-white placeholder:text-gray-400 rounded-lg" />
                  <Button onClick={handleSendMessage} disabled={!chatInput.trim() || isLoading} size="sm" className="self-end bg-[#1CBF79] hover:bg-[#15a366] text-white h-[50px] font-semibold border-0">
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </Button>
                </div>
              </div>
            </>
          ) : isEditorMode ? (
            /* EDITOR MODE - NO AGENT SELECTED */
            <div className="flex items-center justify-center h-full">
              <Card className="p-8 text-center bg-[#0E2E33] border-[#0E2E33]">
                <p className="text-base text-white font-medium">Select an agent to start</p>
              </Card>
            </div>
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
                  <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded">Smart</span>
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
                  <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded">Smart</span>
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
