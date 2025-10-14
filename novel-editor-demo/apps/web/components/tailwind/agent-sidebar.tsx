"use client";

import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
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
  Brain
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
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentPrompt, setNewAgentPrompt] = useState("");
  const [newAgentModel, setNewAgentModel] = useState("");
  const [editingAgent, setEditingAgent] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [editModel, setEditModel] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [modelSearch, setModelSearch] = useState("");
  const [showFreeOnly, setShowFreeOnly] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

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
      // Fallback to some default models
      setModels([
        { id: 'openai/gpt-4o', name: 'GPT-4o' },
        { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
        { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
      ]);
    }
    setLoadingModels(false);
  };

  const filteredModels = models.filter(model => {
    const matchesSearch = model.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
                         model.id.toLowerCase().includes(modelSearch.toLowerCase());
    const isFree = !model.pricing || (parseFloat(model.pricing.prompt) === 0 && parseFloat(model.pricing.completion) === 0);
    return matchesSearch && (!showFreeOnly || isFree);
  });

  const handleCreateAgent = () => {
    if (newAgentName.trim() && newAgentPrompt.trim() && newAgentModel) {
      onCreateAgent({
        name: newAgentName.trim(),
        systemPrompt: newAgentPrompt.trim(),
        model: newAgentModel,
      });
      setNewAgentName("");
      setNewAgentPrompt("");
      setNewAgentModel("");
    }
  };

  const handleUpdateAgent = (id: string) => {
    if (editName.trim() && editPrompt.trim() && editModel) {
      onUpdateAgent(id, {
        name: editName.trim(),
        systemPrompt: editPrompt.trim(),
        model: editModel,
      });
      setEditingAgent(null);
      setEditName("");
      setEditPrompt("");
      setEditModel("");
    }
  };

  const startEditing = (agent: Agent) => {
    setEditingAgent(agent.id);
    setEditName(agent.name);
    setEditPrompt(agent.systemPrompt);
    setEditModel(agent.model);
  };

  const handleSendMessage = () => {
    if (chatInput.trim() && currentAgentId) {
      onSendMessage(chatInput.trim());
      setChatInput("");
    }
  };

  const currentAgent = agents.find(a => a.id === currentAgentId);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="fixed top-4 right-4 z-50 bg-background border shadow-lg"
      >
        {isOpen ? <ChevronRight /> : <ChevronLeft />}
      </Button>
      {isOpen && (
        <div className="fixed right-0 top-0 h-full w-96 bg-background border-l border-muted z-40 flex flex-col shadow-xl">
          <div className="p-4 border-b bg-gradient-to-r from-primary/5 to-secondary/5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">AI Assistant</h2>
                <p className="text-sm text-muted-foreground">Social Garden SOW Generator</p>
              </div>
            </div>

            {currentAgent && (
              <div className="flex items-center gap-2 p-2 bg-accent/50 rounded-lg">
                <Sparkles className="w-4 h-4 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{currentAgent.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {models.find(m => m.id === currentAgent.model)?.name || currentAgent.model}
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs">
                  Active
                </Badge>
              </div>
            )}
          </div>

          <Tabs defaultValue="chat" className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-3 mx-4 mt-4">
              <TabsTrigger value="chat" className="text-xs">
                <MessageSquare className="w-3 h-3 mr-1" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="agents" className="text-xs">
                <Bot className="w-3 h-3 mr-1" />
                Agents
              </TabsTrigger>
              <TabsTrigger value="settings" className="text-xs">
                <Settings className="w-3 h-3 mr-1" />
                Models
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="flex-1 flex flex-col m-0">
              {currentAgent ? (
                <>
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {chatMessages.map(message => (
                        <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          {message.role === 'assistant' && (
                            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                              <Bot className="w-4 h-4 text-primary" />
                            </div>
                          )}
                          <div className={`max-w-[80%] ${message.role === 'user' ? 'order-1' : 'order-2'}`}>
                            <div className={`p-3 rounded-lg ${
                              message.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted border'
                            }`}>
                              {message.role === 'assistant' ? (
                                <div className="prose prose-sm max-w-none">
                                  <ReactMarkdown
                                    components={{
                                      table: ({ children }) => (
                                        <div className="overflow-x-auto">
                                          <table className="sow-table">{children}</table>
                                        </div>
                                      ),
                                      th: ({ children }) => (
                                        <th className="bg-primary text-primary-foreground">{children}</th>
                                      ),
                                      td: ({ children }) => <td>{children}</td>,
                                      code: ({ children }) => (
                                        <code className="bg-accent px-1 py-0.5 rounded text-sm">{children}</code>
                                      ),
                                      pre: ({ children }) => (
                                        <pre className="bg-accent p-2 rounded text-sm overflow-x-auto">{children}</pre>
                                      ),
                                    }}
                                  >
                                    {message.content}
                                  </ReactMarkdown>
                                </div>
                              ) : (
                                <p className="text-sm">{message.content}</p>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(message.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                          {message.role === 'user' && (
                            <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <div className="p-4 border-t bg-background">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Ask me to generate a SOW..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                        className="flex-1"
                      />
                      <Button onClick={handleSendMessage} size="icon">
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Try: "Create a scope of work for OakTree client - email template build"
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="text-center">
                    <Bot className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Agent Selected</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Choose an agent from the Agents tab to start chatting
                    </p>
                    <Button onClick={() => (document.querySelector('[value="agents"]') as HTMLElement)?.click()}>
                      Select Agent
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="agents" className="flex-1 m-0">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">Your Agents</h3>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="w-4 h-4 mr-1" />
                        New
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Create New Agent</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <Input
                          placeholder="Agent Name (e.g., SOW Generator)"
                          value={newAgentName}
                          onChange={(e) => setNewAgentName(e.target.value)}
                        />
                        <div className="space-y-2">
                          <label className="text-sm font-medium">AI Model</label>
                          <Select value={newAgentModel} onValueChange={setNewAgentModel}>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a model..." />
                            </SelectTrigger>
                            <SelectContent>
                              {models.slice(0, 10).map(model => (
                                <SelectItem key={model.id} value={model.id}>
                                  <div className="flex items-center gap-2">
                                    <Brain className="w-3 h-3" />
                                    {model.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Textarea
                          placeholder="System prompt (instructions for the AI)"
                          value={newAgentPrompt}
                          onChange={(e) => setNewAgentPrompt(e.target.value)}
                          rows={4}
                        />
                        <Button onClick={handleCreateAgent} className="w-full">
                          Create Agent
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <ScrollArea className="h-96">
                  <div className="space-y-2">
                    {agents.map(agent => (
                      <div
                        key={agent.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          currentAgentId === agent.id
                            ? 'bg-primary/5 border-primary'
                            : 'hover:bg-accent'
                        }`}
                        onClick={() => onSelectAgent(agent.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Bot className="w-4 h-4 text-primary" />
                            <span className="font-medium">{agent.name}</span>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => { e.stopPropagation(); startEditing(agent); }}
                            >
                              <Edit3 className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => { e.stopPropagation(); onDeleteAgent(agent.id); }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {models.find(m => m.id === agent.model)?.name || agent.model}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="flex-1 m-0">
              <div className="p-4">
                <h3 className="font-medium mb-4">Available AI Models</h3>
                <div className="space-y-2 mb-4">
                  <Input
                    placeholder="Search models..."
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={showFreeOnly ? "default" : "outline"}
                      onClick={() => setShowFreeOnly(!showFreeOnly)}
                    >
                      Free Only
                    </Button>
                  </div>
                </div>
                <ScrollArea className="h-80">
                  <div className="space-y-1">
                    {loadingModels ? (
                      <div className="text-center py-8">
                        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                        <p className="text-sm text-muted-foreground">Loading models...</p>
                      </div>
                    ) : (
                      filteredModels.map(model => (
                        <div
                          key={model.id}
                          className="p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Zap className="w-4 h-4 text-primary" />
                              <span className="font-medium text-sm">{model.name}</span>
                            </div>
                            {model.pricing && (
                              <Badge variant="secondary" className="text-xs">
                                ${model.pricing.prompt}/k
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{model.id}</p>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>
          </Tabs>

          {editingAgent && (
            <Dialog open={!!editingAgent} onOpenChange={() => setEditingAgent(null)}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Edit Agent</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Agent Name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                  <div className="space-y-2">
                    <label className="text-sm font-medium">AI Model</label>
                    <Select value={editModel} onValueChange={setEditModel}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {models.slice(0, 10).map(model => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea
                    placeholder="System prompt"
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button onClick={() => handleUpdateAgent(editingAgent)}>Save</Button>
                    <Button variant="outline" onClick={() => setEditingAgent(null)}>Cancel</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}
    </>
  );
}