"use client";

import { Command, CommandInput } from "@/components/tailwind/ui/command";
import { useCompletion } from "ai/react";
import { 
  ArrowUp, 
  Sparkles, 
  Wand2,
  Table,
  List,
  Code,
  MessageSquare,
  X, 
  Check,
  ChevronDown,
  Loader2,
  Zap
} from "lucide-react";
import { useEditor } from "novel";
import { addAIHighlight } from "novel/extensions";
import { useState, useEffect, useRef } from "react";
import Markdown from "react-markdown";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import AICompletionCommands from "./ai-completion-command";
import AISelectorCommands from "./ai-selector-commands";
import { Badge } from "../ui/badge";

interface OpenRouterModel {
  id: string;
  name: string;
  pricing?: {
    prompt: string;
    completion: string;
  };
  context_length?: number;
  architecture?: {
    modality?: string;
  };
}

interface AISelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Smart action suggestions based on selected text
const getSmartSuggestions = (selectedText: string) => {
  const suggestions = [];
  const text = selectedText.toLowerCase();
  const hasNumbers = /\d/.test(selectedText);
  const hasListItems = /[-•*]\s|^\d+\.\s/m.test(selectedText);
  const hasCode = /[{}();]/.test(selectedText);
  const hasParagraphs = selectedText.split('\n').length > 2;
  
  if (hasNumbers && selectedText.length > 20) {
    suggestions.push({ icon: Table, label: "Turn into table", prompt: "Convert this into a well-formatted table" });
  }
  if (hasParagraphs || selectedText.length > 100) {
    suggestions.push({ icon: List, label: "Make it a list", prompt: "Convert this into a bullet point list" });
  }
  if (hasListItems) {
    suggestions.push({ icon: Table, label: "List to table", prompt: "Convert this list into a table format" });
  }
  if (hasCode || text.includes('function') || text.includes('const')) {
    suggestions.push({ icon: Code, label: "Explain code", prompt: "Explain this code in simple terms" });
  }
  
  // Always available
  suggestions.push(
    { icon: Sparkles, label: "Improve writing", prompt: "Improve the writing quality and clarity" },
    { icon: Wand2, label: "Fix grammar", prompt: "Fix any grammar and spelling mistakes" },
    { icon: MessageSquare, label: "Make it shorter", prompt: "Make this more concise and shorter" },
    { icon: Zap, label: "Make it longer", prompt: "Expand this with more detail and examples" }
  );
  
  return suggestions;
};

export function AISelector({ onOpenChange }: AISelectorProps) {
  const { editor } = useEditor();
  const [inputValue, setInputValue] = useState("");
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [selectedModel, setSelectedModel] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem("ai-selector-model") || "anthropic/claude-3.5-sonnet";
    }
    return "anthropic/claude-3.5-sonnet";
  });
  const [loadingModels, setLoadingModels] = useState(false);
  const [showFreeModelsOnly, setShowFreeModelsOnly] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem("ai-selector-free-only") === "true";
    }
    return false;
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { completion, complete, isLoading } = useCompletion({
    api: "/api/generate",
    onResponse: (response) => {
      if (response.status === 429) {
        toast.error("You have reached your request limit for the day.");
        return;
      }
    },
    onError: (e) => {
      console.error("Completion error:", e);
      toast.error(e.message || "Failed to generate response. Please try again.");
    },
  });

  const hasCompletion = completion.length > 0;

  useEffect(() => {
    fetchModels();
  }, []);

  useEffect(() => {
    if (showCustomPrompt && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [showCustomPrompt]);

  const fetchModels = async () => {
    setLoadingModels(true);
    try {
      const response = await fetch("/api/models");
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }
      const modelsData = await response.json();
      setModels(modelsData);
    } catch (error) {
      console.error("Failed to fetch models:", error);
      toast.error("Failed to load models. Using defaults.");
      setModels([
        { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
        { id: "openai/gpt-4o", name: "GPT-4o" },
        { id: "openai/gpt-4-turbo", name: "GPT-4 Turbo" },
        { id: "anthropic/claude-3-opus", name: "Claude 3 Opus" },
      ]);
    } finally {
      setLoadingModels(false);
    }
  };

  const filteredModels = models
    .filter((model) => {
      const isFree = !model.pricing?.prompt || parseFloat(model.pricing.prompt) === 0;
      return !showFreeModelsOnly || isFree;
    })
    .filter((model) => 
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const groupedModels = filteredModels.reduce((acc, model) => {
    const provider = model.id.split("/")[0];
    if (!acc[provider]) {
      acc[provider] = [];
    }
    acc[provider].push(model);
    return acc;
  }, {} as Record<string, OpenRouterModel[]>);

  const popularModels = [
    "anthropic/claude-3.5-sonnet",
    "openai/gpt-4o",
    "openai/gpt-4-turbo",
    "google/gemini-pro",
    "meta-llama/llama-3.1-70b-instruct"
  ];

  const handleModelSelect = (modelId: string) => {
    setSelectedModel(modelId);
    localStorage.setItem("ai-selector-model", modelId);
    setShowModelPicker(false);
    toast.success(`Model switched to ${models.find(m => m.id === modelId)?.name}`);
  };

  const toggleFreeFilter = () => {
    const newValue = !showFreeModelsOnly;
    setShowFreeModelsOnly(newValue);
    localStorage.setItem("ai-selector-free-only", String(newValue));
  };

  const handleGenerate = async () => {
    if (!inputValue.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    setIsGenerating(true);
    
    try {
      if (completion) {
        await complete(completion, {
          body: { option: "zap", command: inputValue, model: selectedModel },
        });
      } else {
        const slice = editor.state.selection.content();
        const text = editor.storage.markdown.serializer.serialize(slice.content);

        await complete(text, {
          body: { option: "zap", command: inputValue, model: selectedModel },
        });
      }
      setInputValue("");
      setShowCustomPrompt(false);
    } catch (error) {
      console.error("Generation error:", error);
      toast.error("Failed to generate response. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const getModelPricing = (model: OpenRouterModel) => {
    if (!model.pricing?.prompt || parseFloat(model.pricing.prompt) === 0) {
      return <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">FREE</Badge>;
    }
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <DollarSign className="h-3 w-3" />
        {parseFloat(model.pricing.prompt).toFixed(4)}/1K
      </span>
    );
  };

  const selectedModelData = models.find(m => m.id === selectedModel);

  return (
    <div className="w-[480px] bg-background/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-pink-500/10 border-b border-border/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Sparkles className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">AI Assistant</h3>
              <p className="text-xs text-muted-foreground">
                {selectedModelData?.name || "Select a model"}
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Completion Display */}
      {hasCompletion && (
        <div className="max-h-[300px] border-b border-border/50">
          <ScrollArea className="h-full">
            <div className="prose prose-sm dark:prose-invert p-4">
              <Markdown>{completion}</Markdown>
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center gap-3 px-4 py-6 bg-purple-500/5">
          <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
          <div>
            <p className="text-sm font-medium text-purple-500">AI is thinking...</p>
            <p className="text-xs text-muted-foreground">Generating your response</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!isLoading && (
        <>
          {/* Model Picker Button */}
          <div className="p-4 space-y-3">
            <Button
              variant="outline"
              className="w-full justify-between h-auto p-3 hover:bg-accent/50 transition-all"
              onClick={() => setShowModelPicker(!showModelPicker)}
            >
              <div className="flex items-center gap-3 text-left">
                <div className="p-1.5 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg">
                  <Zap className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {selectedModelData?.name || "Select Model"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedModelData?.id.split('/')[0] || "Choose your AI"}
                  </p>
                </div>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${showModelPicker ? 'rotate-180' : ''}`} />
            </Button>

            {/* Model Picker Panel */}
            {showModelPicker && (
              <Card className="border-2 shadow-lg">
                <div className="p-4 space-y-3">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search models..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  {/* Free Filter */}
                  <div className="flex items-center justify-between p-2 bg-accent/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Show free models only</span>
                    </div>
                    <Button
                      variant={showFreeModelsOnly ? "default" : "outline"}
                      size="sm"
                      onClick={toggleFreeFilter}
                      className={showFreeModelsOnly ? "bg-green-500 hover:bg-green-600" : ""}
                    >
                      {showFreeModelsOnly && <Check className="h-3 w-3 mr-1" />}
                      {showFreeModelsOnly ? "On" : "Off"}
                    </Button>
                  </div>

                  {/* Models List */}
                  <ScrollArea className="h-[300px]">
                    {loadingModels ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {filteredModels.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            No models found
                          </p>
                        ) : (
                          filteredModels.map((model) => {
                            const isSelected = model.id === selectedModel;
                            const isPopular = popularModels.includes(model.id);
                            
                            return (
                              <button
                                key={model.id}
                                onClick={() => handleModelSelect(model.id)}
                                className={`w-full text-left p-3 rounded-lg border transition-all ${
                                  isSelected 
                                    ? 'bg-purple-500/10 border-purple-500/50 shadow-md' 
                                    : 'border-transparent hover:bg-accent/50 hover:border-border'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      {isSelected && <Check className="h-4 w-4 text-purple-500 shrink-0" />}
                                      {isPopular && !isSelected && <Star className="h-3 w-3 text-yellow-500 shrink-0" />}
                                      <p className="text-sm font-medium truncate">{model.name}</p>
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {model.id}
                                    </p>
                                  </div>
                                  <div className="shrink-0">
                                    {getModelPricing(model)}
                                  </div>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </ScrollArea>

                  {/* Model Count */}
                  <div className="text-xs text-center text-muted-foreground pt-2 border-t">
                    Showing {filteredModels.length} of {models.length} models
                  </div>
                </div>
              </Card>
            )}

            {/* Custom Prompt Toggle */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowCustomPrompt(!showCustomPrompt)}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {showCustomPrompt ? "Hide" : "Show"} Custom Prompt
            </Button>

            {/* Custom Prompt Area */}
            {showCustomPrompt && (
              <Card className="border-2 shadow-lg">
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-semibold">Custom Prompt</span>
                  </div>
                  <Textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Ask AI to edit, improve, or generate content..."
                    className="min-h-[120px] resize-none focus:ring-2 focus:ring-purple-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleGenerate();
                      }
                    }}
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Press {typeof window !== 'undefined' && navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to send
                    </p>
                    <Button
                      onClick={handleGenerate}
                      disabled={!inputValue.trim() || isGenerating}
                      className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                    >
                      {isGenerating ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4 mr-2" />
                      )}
                      Generate
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Quick Actions */}
          {!showCustomPrompt && !hasCompletion && (
            <div className="px-4 pb-4">
              <AISelectorCommands 
                onSelect={(value, option) => complete(value, { body: { option, model: selectedModel } })} 
              />
            </div>
          )}

          {/* Completion Actions */}
          {hasCompletion && (
            <div className="px-4 pb-4">
              <AICompletionCommands
                onDiscard={() => {
                  editor.chain().unsetHighlight().focus().run();
                  onOpenChange(false);
                }}
                completion={completion}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
