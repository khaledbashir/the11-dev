"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";
import { Label } from "./ui/label";
import {
  ChevronRight,
  Send,
  Bot,
  User,
  Settings,
  Plus,
  Trash2,
  Loader2,
  Search,
  X,
  Info,
  ChevronDown,
  Check,
  Zap
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
  isLoading?: boolean;
  onInsertToEditor?: () => void;
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
}: AgentSidebarProps) {
  const [chatInput, setChatInput] = useState("");
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [modelSearch, setModelSearch] = useState("");
  const [showFreeOnly, setShowFreeOnly] = useState(() => {
    // Load preference from localStorage (client-side only)
    if (typeof window !== 'undefined') {
      return localStorage.getItem("show-free-models-only") === "true";
    }
    return false;
  });
  const [loadingModels, setLoadingModels] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [selectedModelForAgent, setSelectedModelForAgent] = useState("");
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    if (currentAgentId) {
      chatInputRef.current?.focus();
    }
  }, [currentAgentId]);

  useEffect(() => {
    fetchModels();
  }, []);

  // Save free models preference
  useEffect(() => {
    localStorage.setItem("show-free-models-only", String(showFreeOnly));
  }, [showFreeOnly]);

  const fetchModels = async () => {
    setLoadingModels(true);
    try {
      const response = await fetch('/api/models');
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }
      const modelsData = await response.json();
      setModels(modelsData);
    } catch (error) {
      console.error("Failed to fetch models:", error);
      // Fallback to basic models if API fails
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
  
  const filteredModels = models.filter(model => {
    const matchesSearch = model.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
                         model.id.toLowerCase().includes(modelSearch.toLowerCase());
    const matchesFree = !showFreeOnly ||
                       (model.pricing?.prompt === "0" && model.pricing?.completion === "0") ||
                       (model.pricing?.prompt === "0.00" && model.pricing?.completion === "0.00") ||
                       (!model.pricing?.prompt || !model.pricing?.completion);
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

  const handleChangeModel = () => {
    if (!currentAgent || !selectedModelForAgent) return;
    onUpdateAgent(currentAgent.id, { model: selectedModelForAgent });
    setShowModelPicker(false);
    setModelSearch("");
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
          isOpen ? 'w-[480px]' : 'w-0'
        } overflow-hidden flex flex-col`}
      >
        {/* Compact Header */}
        <div className="p-3 border-b border-border flex items-center justify-between gap-2 bg-gradient-to-r from-primary/5 to-transparent">
          {/* Agent Selector */}
          <Select value={currentAgentId || undefined} onValueChange={onSelectAgent}>
            <SelectTrigger className="flex-1 h-9 text-sm">
              <SelectValue placeholder="Select AI Agent" />
            </SelectTrigger>
            <SelectContent>
              {agents.map(agent => (
                <SelectItem key={agent.id} value={agent.id}>
                  <div className="flex items-center gap-2">
                    <Bot className="h-3 w-3" />
                    {agent.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Settings Button */}
          <Dialog open={showSettings} onOpenChange={setShowSettings}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost" className="h-9 w-9 p-0">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Agent Settings</DialogTitle>
                <DialogDescription>
                  Manage AI agents and their configurations
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 py-4">
                {/* Current Agent Settings */}
                {currentAgent && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Current Agent</h3>
                      <Badge variant="secondary">{currentAgent.name}</Badge>
                    </div>
                    
                    {/* Model Selection */}
                    <div className="space-y-2">
                      <Label>AI Model</Label>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1 justify-between"
                          onClick={() => {
                            setSelectedModelForAgent(currentAgent.model);
                            setShowModelPicker(true);
                          }}
                        >
                          <span className="truncate">
                            {models.find(m => m.id === currentAgent.model)?.name || currentAgent.model}
                          </span>
                          <ChevronDown className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    </div>

                    {/* System Prompt */}
                    <div className="space-y-2">
                      <Label>System Prompt</Label>
                      <Textarea
                        value={currentAgent.systemPrompt}
                        onChange={(e) => onUpdateAgent(currentAgent.id, { systemPrompt: e.target.value })}
                        className="min-h-[120px] font-mono text-xs"
                        placeholder="Define agent behavior..."
                      />
                    </div>

                    {/* Delete Agent (if not architect) */}
                    {currentAgent.id !== "architect" && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (confirm("Delete this agent? This cannot be undone.")) {
                            onDeleteAgent(currentAgent.id);
                            setShowSettings(false);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Agent
                      </Button>
                    )}
                  </div>
                )}

                {/* Create New Agent */}
                <div className="pt-4 border-t">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full">
                        <Plus className="h-4 w-4 mr-2" />
                        Create New Agent
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Agent</DialogTitle>
                      </DialogHeader>
                      <CreateAgentForm
                        models={models}
                        onCreateAgent={(agent) => {
                          onCreateAgent(agent);
                          setShowSettings(false);
                        }}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Model Picker Dialog */}
          <Dialog open={showModelPicker} onOpenChange={setShowModelPicker}>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Select AI Model
                </DialogTitle>
                <DialogDescription>
                  Choose which AI model this agent should use. Changes take effect immediately.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-hidden space-y-4">
                {/* Search & Filter */}
                <div className="space-y-3">
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
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="free-models"
                        checked={showFreeOnly}
                        onChange={(e) => setShowFreeOnly(e.target.checked)}
                        className="rounded border-border"
                      />
                      <Label htmlFor="free-models" className="cursor-pointer text-sm">
                        Show only free models
                      </Label>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {filteredModels.length} models
                    </Badge>
                  </div>
                </div>

                {/* Current Selection */}
                {selectedModelForAgent && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary" />
                      <span className="font-medium">Selected:</span>
                      <span className="text-primary">
                        {models.find(m => m.id === selectedModelForAgent)?.name || selectedModelForAgent}
                      </span>
                    </div>
                  </div>
                )}

                {/* Model List */}
                <ScrollArea className="h-[400px] border rounded-lg">
                  <div className="p-2 space-y-1">
                    {filteredModels.map(model => {
                      const isSelected = selectedModelForAgent === model.id;
                      const isCurrent = currentAgent?.model === model.id;

                      return (
                        <button
                          key={model.id}
                          onClick={() => setSelectedModelForAgent(model.id)}
                          className={`w-full text-left p-3 rounded-md border transition-all hover:shadow-sm ${
                            isSelected
                              ? 'border-primary bg-primary/10 shadow-sm'
                              : isCurrent
                              ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                              : 'border-border hover:border-primary/50 bg-card'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <div className={`font-medium text-sm truncate ${
                                  isSelected ? 'text-primary' : ''
                                }`}>
                                  {model.name}
                                </div>
                                {isSelected && (
                                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                )}
                                {isCurrent && !isSelected && (
                                  <Badge variant="outline" className="text-xs border-green-500 text-green-700 dark:text-green-400">
                                    Current
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground truncate mb-1">
                                {model.id}
                              </div>
                              {model.pricing && (
                                <div className="text-xs text-muted-foreground">
                                  ${model.pricing.prompt}/1K prompt • ${model.pricing.completion}/1K completion
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>

              <DialogFooter className="flex gap-2 pt-4 border-t flex-shrink-0">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowModelPicker(false);
                    setSelectedModelForAgent("");
                    setModelSearch("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleChangeModel}
                  disabled={!selectedModelForAgent}
                  className="min-w-[140px] bg-primary hover:bg-primary/90"
                >
                  {selectedModelForAgent ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Save & Use Model
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Select a Model
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Chat Area - Maximum Space */}
        <div className="flex-1 flex flex-col min-h-0">
          {currentAgent ? (
            <>
              {/* Info Bar - Minimal */}
              <div className="px-3 py-2 bg-muted/30 border-b border-border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Info className="h-3 w-3" />
                  <span>
                    Type <code className="bg-background px-1.5 py-0.5 rounded text-[10px]">/inserttosow</code> to insert AI content
                  </span>
                </div>
              </div>

              {/* Messages - Full Height */}
              <ScrollArea className="flex-1 px-4">
                {chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <div className="bg-primary/10 p-4 rounded-full mb-4">
                      <Bot className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">Start Chatting</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Ask {currentAgent.name} anything
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setChatInput("Create a SOW for a client at 50k AUD")}
                    >
                      Try an example →
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 py-4">
                    {chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {msg.role === 'assistant' && (
                          <div className="flex-shrink-0 mt-1">
                            <div className="bg-primary/10 p-1.5 rounded-full">
                              <Bot className="h-3.5 w-3.5 text-primary" />
                            </div>
                          </div>
                        )}
                        <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} flex-1 min-w-0 max-w-[85%]`}>
                          <div
                            className={`rounded-lg px-3 py-2 ${
                              msg.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            {msg.role === 'user' ? (
                              <div className="text-sm text-primary-foreground whitespace-pre-wrap">
                                {msg.content}
                              </div>
                            ) : (
                              <div className="text-sm prose prose-sm dark:prose-invert max-w-none text-foreground">
                                <ReactMarkdown
                                  components={{
                                    h1: ({ children }) => (
                                      <h1 className="text-xl font-bold mb-3 mt-4 text-foreground border-b pb-2">
                                        {children}
                                      </h1>
                                    ),
                                    h2: ({ children }) => (
                                      <h2 className="text-lg font-bold mb-2 mt-3 text-foreground">
                                        {children}
                                      </h2>
                                    ),
                                    h3: ({ children }) => (
                                      <h3 className="text-base font-semibold mb-2 mt-2 text-foreground">
                                        {children}
                                      </h3>
                                    ),
                                    p: ({ children }) => (
                                      <p className="mb-2 last:mb-0 text-foreground leading-relaxed">
                                        {children}
                                      </p>
                                    ),
                                    strong: ({ children }) => (
                                      <strong className="font-bold text-foreground">
                                        {children}
                                      </strong>
                                    ),
                                    ul: ({ children }) => (
                                      <ul className="list-disc list-inside mb-2 space-y-1 text-foreground">
                                        {children}
                                      </ul>
                                    ),
                                    ol: ({ children }) => (
                                      <ol className="list-decimal list-inside mb-2 space-y-1 text-foreground">
                                        {children}
                                      </ol>
                                    ),
                                    li: ({ children }) => (
                                      <li className="text-foreground">
                                        {children}
                                      </li>
                                    ),
                                    table: ({ children }) => (
                                      <div className="overflow-x-auto my-4 rounded-lg border border-border shadow-sm">
                                        <table className="min-w-full divide-y divide-border">
                                          {children}
                                        </table>
                                      </div>
                                    ),
                                    thead: ({ children }) => (
                                      <thead className="bg-[#2C823D] text-white">
                                        {children}
                                      </thead>
                                    ),
                                    tbody: ({ children }) => (
                                      <tbody className="divide-y divide-border bg-background">
                                        {children}
                                      </tbody>
                                    ),
                                    tr: ({ children }) => (
                                      <tr className="hover:bg-muted/50 transition-colors">
                                        {children}
                                      </tr>
                                    ),
                                    th: ({ children }) => (
                                      <th className="px-4 py-3 text-left text-sm font-semibold text-white tracking-wide border-r border-[#25703A] last:border-r-0">
                                        {children}
                                      </th>
                                    ),
                                    td: ({ children }) => (
                                      <td className="px-4 py-3 text-sm text-foreground border-r border-border last:border-r-0">
                                        {children}
                                      </td>
                                    ),
                                    code: ({ children }) => (
                                      <code className="bg-muted px-1.5 py-0.5 rounded text-xs text-foreground font-mono">
                                        {children}
                                      </code>
                                    ),
                                    pre: ({ children }) => (
                                      <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto text-foreground my-2 font-mono">
                                        {children}
                                      </pre>
                                    ),
                                    hr: () => (
                                      <hr className="my-4 border-border" />
                                    ),
                                    blockquote: ({ children }) => (
                                      <blockquote className="border-l-4 border-green-500 pl-4 italic my-2 text-muted-foreground">
                                        {children}
                                      </blockquote>
                                    ),
                                  }}
                                >
                                  {msg.content}
                                </ReactMarkdown>
                              </div>
                            )}
                          </div>
                          {msg.role === 'assistant' && onInsertToEditor && msg.content.includes('Statement of Work') && (
                            <Button
                              size="sm"
                              onClick={onInsertToEditor}
                              className="mt-2 bg-green-600 hover:bg-green-700 text-white"
                            >
                              📄 Insert SOW into Editor
                            </Button>
                          )}
                          <span className="text-[10px] text-muted-foreground mt-1 px-1">
                            {formatTimestamp(msg.timestamp)}
                          </span>
                        </div>
                        {msg.role === 'user' && (
                          <div className="flex-shrink-0 mt-1">
                            <div className="bg-primary p-1.5 rounded-full">
                              <User className="h-3.5 w-3.5 text-primary-foreground" />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex gap-3 justify-start">
                        <div className="flex-shrink-0 mt-1">
                          <div className="bg-primary/10 p-1.5 rounded-full">
                            <Bot className="h-3.5 w-3.5 text-primary" />
                          </div>
                        </div>
                        <div className="flex flex-col items-start flex-1 min-w-0 max-w-[85%]">
                          <div className="bg-muted rounded-lg px-3 py-2">
                            <div className="flex items-center space-x-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                              <span className="text-sm text-muted-foreground">
                                {currentAgent?.name || "Agent"} is thinking...
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Input - Compact */}
              <div className="p-3 border-t border-border bg-background/95 backdrop-blur-sm">
                <div className="flex gap-2">
                  <Textarea
                    ref={chatInputRef}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder={`Message ${currentAgent.name}...`}
                    className="min-h-[44px] max-h-[120px] resize-none text-sm"
                    disabled={isLoading}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!chatInput.trim() || isLoading}
                    size="icon"
                    className="h-[44px] w-[44px] flex-shrink-0"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <Card className="p-6 text-center">
                <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">No Agent Selected</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose an agent from the dropdown above
                </p>
              </Card>
            </div>
          )}
        </div>
      </div>
      
      {/* Toggle Button */}
      <Button
        onClick={onToggle}
        size="sm"
        variant="default"
        className={`fixed top-4 z-40 transition-all duration-300 shadow-lg ${
          isOpen ? 'right-[496px]' : 'right-4'
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
            AI Chat
          </>
        )}
      </Button>
    </>
  );
}

// Separate component for create agent form
function CreateAgentForm({ 
  models, 
  onCreateAgent 
}: { 
  models: OpenRouterModel[];
  onCreateAgent: (agent: Omit<Agent, 'id'>) => void;
}) {
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("anthropic/claude-3.5-sonnet");

  const handleSubmit = () => {
    if (!name.trim() || !prompt.trim()) return;
    onCreateAgent({ name, systemPrompt: prompt, model });
    setName("");
    setPrompt("");
  };

  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Agent Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Marketing Expert"
        />
      </div>
      <div className="space-y-2">
        <Label>AI Model</Label>
        <Select value={model} onValueChange={setModel}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {models.slice(0, 20).map(m => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>System Prompt</Label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="You are a helpful assistant..."
          className="min-h-[120px] font-mono text-sm"
        />
      </div>
      <DialogFooter>
        <DialogTrigger asChild>
          <Button variant="outline">Cancel</Button>
        </DialogTrigger>
        <DialogTrigger asChild>
          <Button onClick={handleSubmit} disabled={!name.trim() || !prompt.trim()}>
            Create Agent
          </Button>
        </DialogTrigger>
      </DialogFooter>
    </div>
  );
}
