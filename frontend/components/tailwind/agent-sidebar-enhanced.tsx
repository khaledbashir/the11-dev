"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";
import { Separator } from "./ui/separator";
import { Label } from "./ui/label";
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Plus,
  Trash2,
  Edit3,
  Send,
  Bot,
  User,
  Settings,
  Sparkles,
  Zap,
  Brain,
  Search,
  AlertCircle,
  Check,
  X,
  Copy,
  RefreshCw,
  Info,
  Star,
  Filter,
  Loader2,
  ChevronDown,
  HelpCircle
} from "lucide-react";
import ReactMarkdown from 'react-markdown';

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
}

const OPENROUTER_API_KEY = "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";

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
}: AgentSidebarProps) {
  // State management
  const [activeTab, setActiveTab] = useState("chat");
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentPrompt, setNewAgentPrompt] = useState("");
  const [newAgentModel, setNewAgentModel] = useState("anthropic/claude-3.5-sonnet");
  const [editingAgent, setEditingAgent] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [editModel, setEditModel] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [modelSearch, setModelSearch] = useState("");
  const [showFreeOnly, setShowFreeOnly] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showModelInfo, setShowModelInfo] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Focus chat input when agent changes
  useEffect(() => {
    if (currentAgentId && activeTab === "chat") {
      chatInputRef.current?.focus();
    }
  }, [currentAgentId, activeTab]);

  // Check if first time user
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem("agent-onboarding-seen");
    if (!hasSeenOnboarding && agents.length === 1) {
      setShowOnboarding(true);
    }
  }, [agents.length]);

  const dismissOnboarding = () => {
    localStorage.setItem("agent-onboarding-seen", "true");
    setShowOnboarding(false);
  };

  // Fetch available models
  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    setLoadingModels(true);
    try {
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        },
      });
      const data = await response.json();
      setModels(data.data || []);
    } catch (error) {
      console.error("Failed to fetch models:", error);
      // Fallback models
      setModels([
        { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
        { id: 'openai/gpt-4o', name: 'GPT-4o' },
        { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo' },
        { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus' },
      ]);
    } finally {
      setLoadingModels(false);
    }
  };

  const currentAgent = agents.find(a => a.id === currentAgentId);
  
  // Filter models
  const filteredModels = models.filter(model => {
    const matchesSearch = model.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
                         model.id.toLowerCase().includes(modelSearch.toLowerCase());
    const matchesFree = !showFreeOnly || 
                       (model.pricing?.prompt === "0" && model.pricing?.completion === "0");
    return matchesSearch && matchesFree;
  });

  // Popular models for quick access
  const popularModels = [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'openai/gpt-4-turbo',
    'anthropic/claude-3-opus',
    'google/gemini-pro'
  ];

  const handleCreateAgent = () => {
    if (!newAgentName.trim() || !newAgentPrompt.trim() || !newAgentModel) {
      return;
    }
    
    setIsCreatingAgent(true);
    
    onCreateAgent({
      name: newAgentName,
      systemPrompt: newAgentPrompt,
      model: newAgentModel,
    });
    
    setNewAgentName("");
    setNewAgentPrompt("");
    setNewAgentModel("anthropic/claude-3.5-sonnet");
    setIsCreatingAgent(false);
    setActiveTab("chat"); // Switch to chat after creating
  };

  const handleUpdateAgent = () => {
    if (!editingAgent || !editName.trim() || !editPrompt.trim() || !editModel) {
      return;
    }
    
    onUpdateAgent(editingAgent, {
      name: editName,
      systemPrompt: editPrompt,
      model: editModel,
    });
    
    setEditingAgent(null);
    setEditName("");
    setEditPrompt("");
    setEditModel("");
  };

  const handleDeleteAgent = (id: string) => {
    if (confirm("Are you sure you want to delete this agent? This action cannot be undone.")) {
      onDeleteAgent(id);
      if (currentAgentId === id && agents.length > 1) {
        const nextAgent = agents.find(a => a.id !== id);
        if (nextAgent) onSelectAgent(nextAgent.id);
      }
    }
  };

  const handleSendMessage = () => {
    if (!chatInput.trim() || !currentAgentId || isSending) return;
    
    setIsSending(true);
    onSendMessage(chatInput);
    setChatInput("");
    
    // Reset sending state after a delay (actual state managed by parent)
    setTimeout(() => setIsSending(false), 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyPromptToClipboard = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
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

  return (
    <>
      {/* Main Sidebar */}
      <div
        className={`fixed right-0 top-0 h-screen bg-background border-l border-border transition-all duration-300 z-30 ${
          isOpen ? 'w-96' : 'w-0'
        } overflow-hidden flex flex-col`}
      >
        {/* Header */}
        <div className="p-4 border-b border-border bg-gradient-to-r from-primary/10 to-primary/5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">AI Agents</h2>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowOnboarding(true)}
              className="h-8 w-8 p-0"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Current Agent Display */}
          {currentAgent && (
            <div className="bg-background/50 backdrop-blur-sm rounded-lg p-2 mt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium truncate">{currentAgent.name}</span>
                </div>
                <Badge variant="secondary" className="text-xs ml-2 flex-shrink-0">
                  {currentAgent.model.split('/')[1] || currentAgent.model}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                {currentAgent.systemPrompt}
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3 mx-4 mt-4">
            <TabsTrigger value="chat" className="text-xs">
              <MessageSquare className="h-4 w-4 mr-1" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="agents" className="text-xs">
              <Bot className="h-4 w-4 mr-1" />
              Agents
            </TabsTrigger>
            <TabsTrigger value="models" className="text-xs">
              <Zap className="h-4 w-4 mr-1" />
              Models
            </TabsTrigger>
          </TabsList>

          {/* Chat Tab */}
          <TabsContent value="chat" className="flex-1 flex flex-col m-0 mt-4">
            {currentAgent ? (
              <>
                {/* Messages Area */}
                <ScrollArea className="flex-1 px-4">
                  {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                      <div className="bg-primary/10 p-4 rounded-full mb-4">
                        <Sparkles className="h-8 w-8 text-primary" />
                      </div>
                      <h3 className="font-semibold text-lg mb-2">Start a Conversation</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Ask {currentAgent.name} anything. Try:
                      </p>
                      <div className="space-y-2 w-full">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start text-left"
                          onClick={() => setChatInput("Create a SOW for a client at 50k AUD")}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Create a SOW for a client at 50k AUD
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start text-left"
                          onClick={() => setChatInput("What services does Social Garden offer?")}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          What services does Social Garden offer?
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 pb-4">
                      {chatMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          {msg.role === 'assistant' && (
                            <div className="flex-shrink-0">
                              <div className="bg-primary/10 p-2 rounded-full">
                                <Bot className="h-4 w-4 text-primary" />
                              </div>
                            </div>
                          )}
                          <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} flex-1 min-w-0`}>
                            <div
                              className={`rounded-lg px-4 py-2 max-w-[85%] ${
                                msg.role === 'user'
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted'
                              }`}
                            >
                              <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground mt-1 px-1">
                              {formatTimestamp(msg.timestamp)}
                            </span>
                          </div>
                          {msg.role === 'user' && (
                            <div className="flex-shrink-0">
                              <div className="bg-primary p-2 rounded-full">
                                <User className="h-4 w-4 text-primary-foreground" />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                  )}
                </ScrollArea>

                {/* Input Area */}
                <div className="p-4 border-t border-border bg-background/95 backdrop-blur-sm">
                  <Alert className="mb-3 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <AlertDescription className="text-xs text-blue-800 dark:text-blue-300">
                      <strong>Tip:</strong> Type <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">/inserttosow</code> to insert AI content into the editor
                    </AlertDescription>
                  </Alert>
                  <div className="flex gap-2">
                    <Textarea
                      ref={chatInputRef}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder={`Ask ${currentAgent.name}...`}
                      className="min-h-[60px] max-h-[120px] resize-none"
                      disabled={isSending}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!chatInput.trim() || isSending}
                      size="icon"
                      className="h-[60px] w-[60px]"
                    >
                      {isSending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Press Enter to send • Shift+Enter for new line
                  </p>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8">
                <Card className="w-full">
                  <CardHeader className="text-center">
                    <div className="bg-muted p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                      <Bot className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <CardTitle>No Agent Selected</CardTitle>
                    <CardDescription>
                      Choose an agent from the Agents tab or create a new one to start chatting
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={() => setActiveTab("agents")}
                      className="w-full"
                      variant="default"
                    >
                      <Bot className="h-4 w-4 mr-2" />
                      View Agents
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Agents Tab */}
          <TabsContent value="agents" className="flex-1 m-0 mt-4">
            <ScrollArea className="h-full px-4">
              <div className="space-y-4 pb-4">
                {/* Create New Agent Button */}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="w-full" variant="default">
                      <Plus className="h-4 w-4 mr-2" />
                      Create New Agent
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Create New Agent
                      </DialogTitle>
                      <DialogDescription>
                        Define a custom AI agent with specific instructions and model
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="agent-name">Agent Name *</Label>
                        <Input
                          id="agent-name"
                          value={newAgentName}
                          onChange={(e) => setNewAgentName(e.target.value)}
                          placeholder="e.g., Content Writer, Code Reviewer"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="agent-model">AI Model *</Label>
                        <Select value={newAgentModel} onValueChange={setNewAgentModel}>
                          <SelectTrigger id="agent-model">
                            <SelectValue placeholder="Select a model" />
                          </SelectTrigger>
                          <SelectContent>
                            <div className="p-2 text-xs font-semibold text-muted-foreground">Popular Models</div>
                            {popularModels.map(modelId => {
                              const model = models.find(m => m.id === modelId);
                              return model ? (
                                <SelectItem key={model.id} value={model.id}>
                                  {model.name}
                                </SelectItem>
                              ) : null;
                            })}
                            <Separator className="my-2" />
                            <div className="p-2 text-xs font-semibold text-muted-foreground">All Models</div>
                            {filteredModels.slice(0, 20).map(model => (
                              <SelectItem key={model.id} value={model.id}>
                                {model.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="agent-prompt">System Prompt *</Label>
                          <span className="text-xs text-muted-foreground">
                            {newAgentPrompt.length} characters
                          </span>
                        </div>
                        <Textarea
                          id="agent-prompt"
                          value={newAgentPrompt}
                          onChange={(e) => setNewAgentPrompt(e.target.value)}
                          placeholder="You are a helpful assistant that..."
                          className="min-h-[200px] font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                          Define how the agent should behave, its expertise, and response style
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogTrigger asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogTrigger>
                      <Button
                        onClick={handleCreateAgent}
                        disabled={!newAgentName.trim() || !newAgentPrompt.trim() || !newAgentModel || isCreatingAgent}
                      >
                        {isCreatingAgent ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Create Agent
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Agents List */}
                <div className="space-y-2">
                  {agents.map((agent) => (
                    <Card
                      key={agent.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        currentAgentId === agent.id
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() => {
                        onSelectAgent(agent.id);
                        setActiveTab("chat");
                      }}
                    >
                      <CardHeader className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className={`p-2 rounded-lg ${
                              currentAgentId === agent.id ? 'bg-primary' : 'bg-primary/10'
                            }`}>
                              <Bot className={`h-5 w-5 ${
                                currentAgentId === agent.id ? 'text-primary-foreground' : 'text-primary'
                              }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <CardTitle className="text-base truncate">{agent.name}</CardTitle>
                                {currentAgentId === agent.id && (
                                  <Badge variant="default" className="text-xs">Active</Badge>
                                )}
                              </div>
                              <CardDescription className="text-xs line-clamp-2">
                                {agent.systemPrompt}
                              </CardDescription>
                              <Badge variant="secondary" className="text-xs mt-2">
                                {agent.model.split('/')[1] || agent.model}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    setEditingAgent(agent.id);
                                    setEditName(agent.name);
                                    setEditPrompt(agent.systemPrompt);
                                    setEditModel(agent.model);
                                  }}
                                >
                                  <Edit3 className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Edit Agent</DialogTitle>
                                  <DialogDescription>
                                    Modify agent settings and behavior
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="edit-name">Agent Name</Label>
                                    <Input
                                      id="edit-name"
                                      value={editName}
                                      onChange={(e) => setEditName(e.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="edit-model">AI Model</Label>
                                    <Select value={editModel} onValueChange={setEditModel}>
                                      <SelectTrigger id="edit-model">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {models.map(model => (
                                          <SelectItem key={model.id} value={model.id}>
                                            {model.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <Label htmlFor="edit-prompt">System Prompt</Label>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => copyPromptToClipboard(editPrompt)}
                                      >
                                        {copiedPrompt ? (
                                          <>
                                            <Check className="h-4 w-4 mr-1" />
                                            Copied
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="h-4 w-4 mr-1" />
                                            Copy
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                    <Textarea
                                      id="edit-prompt"
                                      value={editPrompt}
                                      onChange={(e) => setEditPrompt(e.target.value)}
                                      className="min-h-[200px] font-mono text-sm"
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <DialogTrigger asChild>
                                    <Button variant="outline">Cancel</Button>
                                  </DialogTrigger>
                                  <DialogTrigger asChild>
                                    <Button onClick={handleUpdateAgent}>
                                      <Check className="h-4 w-4 mr-2" />
                                      Save Changes
                                    </Button>
                                  </DialogTrigger>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            {agent.id !== "architect" && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteAgent(agent.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Models Tab */}
          <TabsContent value="models" className="flex-1 m-0 mt-4">
            <div className="px-4 space-y-4">
              {/* Search and Filter */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search models..."
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchModels}
                    disabled={loadingModels}
                  >
                    {loadingModels ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                      </>
                    )}
                  </Button>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {filteredModels.length} models
                    </span>
                  </div>
                </div>
              </div>

              {/* Model Info Alert */}
              {showModelInfo && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Switch models anytime in the Agents tab. Each agent can use a different model.
                  </AlertDescription>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => setShowModelInfo(false)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Alert>
              )}

              {/* Models List */}
              <ScrollArea className="h-[calc(100vh-320px)]">
                <div className="space-y-2 pb-4">
                  {filteredModels.map(model => {
                    const isCurrentModel = currentAgent?.model === model.id;
                    const isPopular = popularModels.includes(model.id);
                    
                    return (
                      <Card
                        key={model.id}
                        className={`transition-all hover:shadow-md ${
                          isCurrentModel ? 'border-primary bg-primary/5' : ''
                        }`}
                      >
                        <CardHeader className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <CardTitle className="text-sm truncate">{model.name}</CardTitle>
                                {isPopular && (
                                  <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                                )}
                                {isCurrentModel && (
                                  <Badge variant="default" className="text-xs">Current</Badge>
                                )}
                              </div>
                              <CardDescription className="text-xs truncate">
                                {model.id}
                              </CardDescription>
                              {model.pricing && (
                                <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                                  <span>Prompt: ${model.pricing.prompt}</span>
                                  <span>•</span>
                                  <span>Completion: ${model.pricing.completion}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Toggle Button */}
      <Button
        onClick={onToggle}
        size="sm"
        variant="default"
        className={`fixed top-4 z-40 transition-all duration-300 shadow-lg ${
          isOpen ? 'right-[25rem]' : 'right-4'
        }`}
      >
        {isOpen ? (
          <>
            <ChevronRight className="h-4 w-4 mr-1" />
            Close
          </>
        ) : (
          <>
            <Bot className="h-4 w-4 mr-1" />
            AI Agents
          </>
        )}
      </Button>

      {/* Onboarding Modal */}
      <Dialog open={showOnboarding} onOpenChange={setShowOnboarding}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Sparkles className="h-6 w-6 text-primary" />
              Welcome to AI Agents
            </DialogTitle>
            <DialogDescription>
              Let's get you started with AI-powered SOW generation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  1. Chat with Your Agent
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>Start a conversation in the <strong>Chat</strong> tab. Try: "Create a SOW for XYZ Corp for HubSpot CRM implementation at 50k AUD"</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  2. Use the /inserttosow Command
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>After the AI generates your SOW, type <code className="bg-muted px-2 py-1 rounded">/inserttosow</code> to automatically insert it into the editor.</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  3. Manage Your Agents
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>Switch between agents, create custom ones, or change AI models in the <strong>Agents</strong> and <strong>Models</strong> tabs.</p>
              </CardContent>
            </Card>

            <Alert className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
              <Sparkles className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-sm text-green-800 dark:text-green-300">
                <strong>The Architect</strong> is pre-configured with Social Garden's rate card and SOW best practices. Start chatting to create your first SOW!
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button onClick={dismissOnboarding} className="w-full">
              <Check className="h-4 w-4 mr-2" />
              Got it, let's start!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
