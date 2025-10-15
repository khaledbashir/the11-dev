"use client";

import { useCompletion } from "ai/react";
import { 
  Sparkles, 
  Loader2,
  Check,
  Search,
  X,
  Zap,
  ArrowUp,
  Info,
  Keyboard,
  History,
  BookOpen,
  AlertCircle
} from "lucide-react";
import { useEditor } from "novel";
import { addAIHighlight } from "novel/extensions";
import { useState, useEffect, useRef } from "react";
import Markdown from "react-markdown";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import AICompletionCommands from "./ai-completion-command";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";

// Phase 1 imports
import { LoadingState } from "./ui/LoadingState";
import { SuccessAnimation } from "./ui/SuccessAnimation";
import { ErrorState } from "./ui/ErrorState";
import { ThinkingIndicator } from "./ui/ThinkingIndicator";
import { SmartSuggestions } from "./ui/SmartSuggestions";
import { KeyboardShortcutsHelp } from "./ui/KeyboardShortcutsHelp";
import { detectContext, formatReadingTime, getReadabilityLevel } from "./utils/context-detector";
import { useKeyboardShortcuts } from "./utils/shortcuts";
import { getSmartSuggestions, type PromptTemplate } from "./utils/templates";

interface OpenRouterModel {
  id: string;
  name: string;
  pricing?: {
    prompt: string;
    completion: string;
  };
}

interface AISelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AISelector({ onOpenChange }: AISelectorProps) {
  const { editor } = useEditor();
  const [prompt, setPrompt] = useState("");
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [selectedModel, setSelectedModel] = useState("anthropic/claude-3.5-sonnet");
  const [loadingModels, setLoadingModels] = useState(false);
  const [showFreeOnly, setShowFreeOnly] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [completion, setCompletion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loadingStage, setLoadingStage] = useState<"thinking" | "generating" | "formatting" | "finishing">("thinking");
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [textContext, setTextContext] = useState<ReturnType<typeof detectContext> | null>(null);
  const [smartSuggestions, setSmartSuggestions] = useState<PromptTemplate[]>([]);

  const hasCompletion = completion.length > 0;

  // Client-side only - load from localStorage
  useEffect(() => {
    setIsClient(true);
    const savedModel = localStorage.getItem("ai-selector-model");
    if (savedModel) {
      setSelectedModel(savedModel);
    }
    const savedFreeOnly = localStorage.getItem("ai-selector-free-only") === "true";
    setShowFreeOnly(savedFreeOnly);
  }, []);

  // Fetch models on mount
  useEffect(() => {
    fetchModels();
  }, []);

  // Auto-focus input
  useEffect(() => {
    if (inputRef.current && !hasCompletion) {
      inputRef.current.focus();
    }
  }, [hasCompletion]);

  // Analyze selected text on mount
  useEffect(() => {
    if (!editor) {
      console.log("⚠️ Editor not available yet");
      return;
    }
    
    try {
      const slice = editor.state?.selection?.content();
      if (slice && editor.storage?.markdown?.serializer) {
        const text = editor.storage.markdown.serializer.serialize(slice.content);
        setSelectedText(text);
        
        // Detect context and get smart suggestions
        const context = detectContext(text);
        setTextContext(context);
        const suggestions = getSmartSuggestions(context);
        setSmartSuggestions(suggestions);
        
        console.log("📊 Text analysis:", context);
        console.log("💡 Smart suggestions:", suggestions.map(s => s.name));
      }
    } catch (err) {
      console.warn("Could not analyze text:", err);
      // Continue without analysis - not critical
    }
  }, [editor]);

  // Helper function to check if element is input
  const isInputElement = (target: EventTarget | null) => {
    if (!target) return false;
    const element = target as HTMLElement;
    return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.getAttribute('contenteditable') === 'true';
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onGenerate: () => {
      if (!isLoading && prompt.trim() && editor) {
        handleGenerate();
      }
    },
    onCancel: () => {
      if (isLoading) {
        // Future: cancel request
      } else if (hasCompletion) {
        setCompletion("");
      } else {
        onOpenChange(false);
      }
    },
    onFocusInput: () => {
      inputRef.current?.focus();
    },
  });

  // Add "?" shortcut for help
  useEffect(() => {
    const handleQuestionMark = (e: KeyboardEvent) => {
      if (e.key === '?' && !isInputElement(e.target)) {
        e.preventDefault();
        setShowKeyboardHelp(true);
      }
    };
    
    window.addEventListener('keydown', handleQuestionMark);
    return () => window.removeEventListener('keydown', handleQuestionMark);
  }, []);

  const fetchModels = async () => {
    setLoadingModels(true);
    try {
      const response = await fetch("/api/models");
      if (!response.ok) throw new Error("Failed to fetch models");
      const data = await response.json();
      setModels(data);
    } catch (error) {
      console.error("Model fetch error:", error);
      setModels([
        { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
        { id: "openai/gpt-4o", name: "GPT-4o" },
        { id: "openai/gpt-4-turbo", name: "GPT-4 Turbo" },
      ]);
    } finally {
      setLoadingModels(false);
    }
  };

  const filteredModels = models
    .filter((model) => {
      const isFree = !model.pricing?.prompt || parseFloat(model.pricing.prompt) === 0;
      return !showFreeOnly || isFree;
    })
    .filter((model) => 
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const handleModelSelect = (modelId: string) => {
    setSelectedModel(modelId);
    localStorage.setItem("ai-selector-model", modelId);
    setShowModelPicker(false);
    const modelName = models.find(m => m.id === modelId)?.name;
    toast.success(`Switched to ${modelName}`);
  };

  const toggleFreeFilter = () => {
    const newValue = !showFreeOnly;
    setShowFreeOnly(newValue);
    localStorage.setItem("ai-selector-free-only", String(newValue));
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    // Safety checks
    if (!editor) {
      console.error("❌ Editor not available");
      toast.error("Editor not ready. Please try again.");
      return;
    }

    setIsLoading(true);
    setCompletion("");
    setError(null);
    setShowSuccess(false);
    setLoadingStage("thinking");

    try {
      // Safely get selected text
      let textToProcess = selectedText;
      if (!textToProcess) {
        try {
          const slice = editor.state?.selection?.content();
          if (slice && editor.storage?.markdown?.serializer) {
            textToProcess = editor.storage.markdown.serializer.serialize(slice.content);
          }
        } catch (err) {
          console.warn("Could not get selected text:", err);
          textToProcess = "";
        }
      }

      console.log("🚀 Generating with:", { 
        selectedText: textToProcess.substring(0, 50), 
        command: prompt,
        model: selectedModel 
      });

      // Stage 2: Generating
      setLoadingStage("generating");

      // Custom streaming fetch - more robust than useCompletion
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: textToProcess || " ",
          option: "zap",
          command: prompt,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      // Read the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";
      let chunkCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        accumulatedText += chunk;
        setCompletion(accumulatedText);
        
        chunkCount++;
        // Stage 3: Formatting (after first chunks arrive)
        if (chunkCount === 3) {
          setLoadingStage("formatting");
        }
      }

      // Stage 4: Finishing
      setLoadingStage("finishing");
      
      console.log("✅ Generation complete:", accumulatedText.length, "characters");
      
      // Show success animation
      setShowSuccess(true);
      setPrompt("");
      
      // Hide success after 2 seconds
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (error) {
      console.error("❌ Generation error:", error);
      const errorObj = error instanceof Error ? error : new Error('Unknown error');
      setError(errorObj);
      toast.error(`Failed to generate: ${errorObj.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateSelect = (template: PromptTemplate) => {
    setPrompt(template.prompt);
    toast.success(`Template selected: ${template.name}`);
    // Auto-generate after template selection
    setTimeout(() => {
      handleGenerate();
    }, 100);
  };

  const handleRetry = () => {
    setError(null);
    handleGenerate();
  };

  const selectedModelData = models.find(m => m.id === selectedModel);

  // Safety check
  if (!editor) {
    return (
      <div className="w-[500px] bg-background border-2 border-destructive rounded-xl shadow-2xl overflow-hidden p-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span className="font-medium">Editor not ready. Please refresh the page.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[500px] bg-background border-2 border-border rounded-xl shadow-2xl overflow-hidden">
      {/* Header with shortcuts */}
            {/* Header with shortcuts */}
      <div className="bg-[#0e2e33] px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-white" />
          <span className="text-sm font-semibold text-white">AI Writing Assistant</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/90">
          <kbd className="px-2 py-0.5 bg-white/20 rounded text-[10px]">Ctrl+Enter</kbd>
          <span>to generate</span>
        </div>
      </div>

      {/* Context Info */}
      {textContext && textContext.wordCount > 0 && !hasCompletion && !isLoading && (
        <div className="px-4 py-2 bg-muted/50 border-b border-border text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <Badge variant="outline" className="text-xs bg-background text-foreground border-border">
              {textContext.wordCount} words
            </Badge>
            <Badge variant="outline" className="text-xs bg-background text-foreground border-border">
              {formatReadingTime(textContext.estimatedReadingTime)}
            </Badge>
            <Badge variant="outline" className="text-xs bg-background text-foreground border-border">
              {textContext.tone}
            </Badge>
            <Badge variant="outline" className="text-xs bg-background text-foreground border-border" title={getReadabilityLevel(textContext.readabilityScore)}>
              Readability: {textContext.readabilityScore}/100
            </Badge>
          </div>
        </div>
      )}      {/* Completion Display */}
      {hasCompletion && (
        <div className="max-h-[350px] border-b border-border bg-muted/30">
          <ScrollArea className="h-full">
            <div className="prose prose-sm dark:prose-invert p-4 max-w-none">
              <Markdown 
                className="text-foreground"
                components={{
                  p: ({node, ...props}) => <p className="text-foreground my-2" {...props} />,
                  h1: ({node, ...props}) => <h1 className="text-foreground font-bold text-xl mt-4 mb-2" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-foreground font-bold text-lg mt-3 mb-2" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-foreground font-semibold text-base mt-2 mb-1" {...props} />,
                  ul: ({node, ...props}) => <ul className="text-foreground list-disc pl-5 my-2" {...props} />,
                  ol: ({node, ...props}) => <ol className="text-foreground list-decimal pl-5 my-2" {...props} />,
                  li: ({node, ...props}) => <li className="text-foreground my-1" {...props} />,
                  table: ({node, ...props}) => <table className="text-foreground border-collapse border border-[#0e2e33] my-3 w-full text-sm rounded-md overflow-hidden shadow-sm" {...props} />,
                  thead: ({node, ...props}) => <thead className="bg-[#0e2e33]" {...props} />,
                  tbody: ({node, ...props}) => <tbody className="[&>tr:nth-child(even)]:bg-muted/30 [&>tr:hover]:bg-accent/50" {...props} />,
                  th: ({node, ...props}) => <th className="text-white border border-[#0a2328] px-3 py-2 font-semibold text-left text-xs uppercase tracking-wide" {...props} />,
                  td: ({node, ...props}) => <td className="text-foreground border border-border px-3 py-2 text-sm" {...props} />,
                  tr: ({node, ...props}) => <tr className="transition-colors" {...props} />,
                  code: ({node, inline, ...props}: any) => 
                    inline 
                      ? <code className="text-foreground bg-muted px-1 py-0.5 rounded text-sm" {...props} />
                      : <code className="text-foreground bg-muted block p-3 rounded my-2 overflow-x-auto" {...props} />,
                  blockquote: ({node, ...props}) => <blockquote className="text-muted-foreground border-l-4 border-border pl-4 italic my-2" {...props} />,
                  strong: ({node, ...props}) => <strong className="text-foreground font-bold" {...props} />,
                  em: ({node, ...props}) => <em className="text-foreground italic" {...props} />,
                }}
              >
                {completion}
              </Markdown>
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Success Animation */}
      {showSuccess && !isLoading && (
        <SuccessAnimation 
          message="Content generated successfully!" 
          className="mx-4 mt-4"
        />
      )}

      {/* Error State */}
      {error && !isLoading && (
        <ErrorState 
          error={error}
          onRetry={handleRetry}
          onDismiss={() => setError(null)}
          className="mx-4 mt-4"
        />
      )}

      {/* Loading State */}
      {isLoading && (
        <LoadingState 
          stage={loadingStage}
          className="mx-4 my-4"
        />
      )}

      {/* Main Input Area */}
      {!isLoading && (
        <div className="p-4 space-y-3">
          {/* Smart Suggestions */}
          {!hasCompletion && smartSuggestions.length > 0 && (
            <SmartSuggestions 
              suggestions={smartSuggestions}
              onSelectTemplate={handleTemplateSelect}
            />
          )}

          {/* Prompt Input */}
          <div className="relative">
            <Input
              ref={inputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              placeholder="Tell AI what to do... (e.g., 'turn this into a table', 'make it funny', 'fix grammar')"
              className="pr-10 h-11 bg-background text-foreground border-input placeholder:text-muted-foreground"
              disabled={isLoading}
            />
            <Button
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleGenerate}
              disabled={!prompt.trim() || isLoading}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>

          {/* Model Selector */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="flex-1 justify-between h-9 text-xs"
              onClick={() => setShowModelPicker(!showModelPicker)}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-3 w-3 text-primary" />
                <span className="truncate">{selectedModelData?.name || "Select Model"}</span>
              </div>
              <span className="text-muted-foreground text-[10px]">
                {filteredModels.length} models
              </span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Model Picker Dropdown */}
          {showModelPicker && (
            <div className="border border-border rounded-lg bg-popover shadow-lg">
              {/* Search & Filter */}
              <div className="p-3 space-y-2 border-b border-gray-200 dark:border-gray-700">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-500 dark:text-gray-400" />
                  <Input
                    placeholder="Search models..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-7 h-8 text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
                  />
                </div>
                <Button
                  variant={showFreeOnly ? "default" : "outline"}
                  size="sm"
                  onClick={toggleFreeFilter}
                  className="w-full h-7 text-xs"
                >
                  {showFreeOnly ? <Check className="h-3 w-3 mr-1" /> : null}
                  {showFreeOnly ? "Showing Free Only" : "Show Free Models"}
                </Button>
              </div>

              {/* Models List */}
              <ScrollArea className="h-[250px]">
                <div className="p-2">
                  {loadingModels ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredModels.length === 0 ? (
                    <p className="text-xs text-center text-muted-foreground py-8">
                      No models found
                    </p>
                  ) : (
                    filteredModels.map((model) => {
                      const isSelected = model.id === selectedModel;
                      const isFree = !model.pricing?.prompt || parseFloat(model.pricing.prompt) === 0;
                      
                      return (
                        <button
                          key={model.id}
                          onClick={() => handleModelSelect(model.id)}
                          className={`w-full text-left p-2 rounded-md text-xs transition-colors ${
                            isSelected 
                              ? 'bg-purple-500/10 dark:bg-purple-500/20 border border-purple-500/50 dark:border-purple-400/50' 
                              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {isSelected && <Check className="h-3 w-3 text-purple-500 dark:text-purple-400 shrink-0" />}
                              <span className="font-medium truncate text-gray-900 dark:text-gray-100">{model.name}</span>
                            </div>
                            {isFree ? (
                              <span className="text-[10px] bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded shrink-0">
                                FREE
                              </span>
                            ) : (
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 shrink-0">
                                ${parseFloat(model.pricing?.prompt || "0").toFixed(4)}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                            {model.id}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Completion Actions */}
          {hasCompletion && (
            <AICompletionCommands
              onDiscard={() => {
                editor.chain().unsetHighlight().focus().run();
                onOpenChange(false);
              }}
              completion={completion}
            />
          )}

          {/* Help Text */}
          {!hasCompletion && !showModelPicker && smartSuggestions.length === 0 && (
            <p className="text-[10px] text-gray-600 dark:text-gray-400 text-center">
              Type anything in natural language • Press Ctrl+Enter to generate • Press ? for shortcuts
            </p>
          )}
        </div>
      )}

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsHelp 
        open={showKeyboardHelp}
        onOpenChange={setShowKeyboardHelp}
      />
    </div>
  );
}
