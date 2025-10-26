"use client";

import { useState, useEffect, useRef } from "react";
import { useEditor } from "novel";
import { useAISettings } from "@/context/ai-settings";
import { 
  Sparkles, 
  X, 
  Loader2,
  ChevronDown,
  Wand2,
  ArrowDownWideNarrow,
  WrapText,
  Briefcase,
  MessageCircle,
  List,
  FileText,
  RotateCcw
} from "lucide-react";
import { toast } from "sonner";
import { SelectionToolbar } from "./selection-toolbar";

import { type EditorInstance } from "novel";

interface FloatingAIBarProps {
  onGenerate?: (prompt: string, mode: 'replace' | 'insert') => void;
  editor?: EditorInstance | null;
}

export function FloatingAIBar({ onGenerate, editor: editorProp }: FloatingAIBarProps) {
  const { editor: editorContext } = useEditor();
  const editor = editorProp || editorContext;
  const { settings, getVisibleQuickActions } = useAISettings();
  
  // Two separate visibility states for the two modes
  const [showToolbar, setShowToolbar] = useState(false); // Selection toolbar
  const [isVisible, setIsVisible] = useState(false); // Full floating bar
  const [triggerSource, setTriggerSource] = useState<'selection' | 'slash'>('slash'); // What triggered the bar
  
  const [hasSelection, setHasSelection] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [completion, setCompletion] = useState("");
  const [showActions, setShowActions] = useState(false);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef<{ from: number; to: number } | null>(null);

  // Helper function to get icon component by name
  const getIcon = (iconName: string) => {
    const iconMap: { [key: string]: React.ComponentType<any> } = {
      Sparkles,
      ArrowDownWideNarrow,
      WrapText,
      Briefcase,
      MessageCircle,
      List,
      FileText,
      RotateCcw
    };
    return iconMap[iconName] || Sparkles;
  };

  // Log editor status
  useEffect(() => {
    console.log("🔍 [FloatingAIBar] Component mounted, editor:", editor ? "available" : "not available");
  }, [editor]);

  // Monitor text selection - Show toolbar only when text is selected
  useEffect(() => {
    if (!editor) return;

    const updateSelection = () => {
      const { from, to } = editor.state.selection;
      const hasText = from !== to;
      
      // Store the selection when text is selected
      if (hasText) {
        selectionRef.current = { from, to };
        setHasSelection(true);
        // Only show toolbar if we're NOT already in the full floating bar
        setShowToolbar(!isVisible && hasText);
      } else {
        setHasSelection(false);
        setShowToolbar(false);
      }
    };

    editor.on('selectionUpdate', updateSelection);
    editor.on('update', updateSelection);

    return () => {
      editor.off('selectionUpdate', updateSelection);
      editor.off('update', updateSelection);
    };
  }, [editor, isVisible]);

  // Monitor for /ai command - Opens full floating bar
  useEffect(() => {
    if (!editor) return;

    // Listen for custom event from slash command
    const handleOpenAIBar = (evt: Event) => {
      // Open the full floating bar in slash mode
      setTriggerSource('slash');
      setShowToolbar(false);
      setIsVisible(true);
      setShowActions(true);
      setPrompt("");
      // Clear any previous completion
      setCompletion("");
    };

    window.addEventListener('open-ai-bar', handleOpenAIBar as EventListener);

    return () => {
      window.removeEventListener('open-ai-bar', handleOpenAIBar as EventListener);
    };
  }, [editor]);

  // Keyboard shortcut: Alt+A to open AI bar
  useEffect(() => {
    if (!editor) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        // If there is a selection, open in selection mode (like clicking Ask AI)
        const { from, to } = editor.state.selection;
        if (from !== to) {
          handleToolbarAskAI();
        } else {
          // No separate bar when nothing is selected
          // Provide gentle nudge instead of opening overlay
          toast.message("Select text, then press Alt+A or click Ask the AI");
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editor, hasSelection]);

  // Auto-focus input when visible
  useEffect(() => {
    if (isVisible && inputRef.current && !completion) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isVisible, completion]);

  // Handler for toolbar "Ask AI" button
  const handleToolbarAskAI = () => {
    setShowToolbar(false); // Hide toolbar
    setTriggerSource('selection'); // Mark as selection mode
    setIsVisible(true); // Show full bar
    setShowActions(true); // Show quick actions
    setPrompt(""); // Clear prompt
  };

  // Get selected text
  const getSelectedText = () => {
    if (!editor) return "";
    try {
      // Use stored selection if available (preserved during input)
      if (selectionRef.current) {
        const { from, to } = selectionRef.current;
        return editor.state.doc.textBetween(from, to, " ");
      }
      // Fallback to current editor selection
      const { from, to } = editor.state.selection;
      return editor.state.doc.textBetween(from, to, " ");
    } catch {
      return "";
    }
  };

  const handleGenerate = async (commandPrompt?: string) => {
    const finalPrompt = commandPrompt || prompt;
    if (!finalPrompt.trim()) {
      toast.error("Type a command or choose an action");
      return;
    }

    // For slash commands without selection, just generate
    if (triggerSource === 'slash' && !hasSelection) {
      // Generate new content
      setIsLoading(true);
      setCompletion("");

      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: "",
            option: "generate",
            command: finalPrompt,
            model: settings.aiModel,
          }),
        });

        if (!response.ok) {
          if (response.status === 401) {
            toast.error("AI is not configured (401). Set OPENROUTER_API_KEY on the server.");
          } else if (response.status === 400) {
            toast.error("AI is not configured (400). Check OPENROUTER_API_KEY.");
          }
          throw new Error(`API error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let accumulatedText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          accumulatedText += chunk;
          setCompletion(accumulatedText);
        }

        setShowActions(false);
      } catch (error) {
        console.error("Generation error:", error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes('402')) {
          toast.error("API credit limit reached. Please check your OpenRouter account.");
        } else {
          toast.error("Failed to generate");
        }
        setCompletion("");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // For selections, transform the text
    if (!hasSelection) {
      toast.error("Please select some text first");
      return;
    }

    setIsLoading(true);
    setCompletion("");

    try {
      const selectedText = getSelectedText();
      
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: selectedText,
          option: "zap",
          command: finalPrompt,
          model: settings.aiModel,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error("AI is not configured (401). Set OPENROUTER_API_KEY on the server.");
        } else if (response.status === 400) {
          toast.error("AI is not configured (400). Check OPENROUTER_API_KEY.");
        }
        throw new Error(`API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let accumulatedText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        accumulatedText += chunk;
        setCompletion(accumulatedText);
      }

      setShowActions(false);
    } catch (error) {
      console.error("Generation error:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('402')) {
        toast.error("API credit limit reached. Please check your OpenRouter account.");
      } else {
        toast.error("Failed to generate");
      }
      setCompletion("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReplace = () => {
    if (!editor || !completion) return;
    
    if (triggerSource === 'slash' || !hasSelection) {
      // Insert at cursor for slash commands
      const { from } = editor.state.selection;
      editor.chain().focus().insertContentAt(from, completion).run();
      toast.success("Text replaced");
    } else {
      // Replace selection (use stored selection from selection mode)
      const selRange = selectionRef.current || editor.state.selection;
      const { from, to } = selRange;
      editor.chain().focus().insertContentAt({ from, to }, completion).run();
      toast.success("Text replaced");
    }
    
    selectionRef.current = null;
    setCompletion("");
    setPrompt("");
    setIsVisible(false);
    setShowToolbar(false);
    setTriggerSource('slash');
  };

  const handleInsert = () => {
    if (!editor || !completion) return;
    
    const { to } = editor.state.selection;
    editor.chain().focus().insertContentAt(to, "\n\n" + completion).run();
    toast.success("Text inserted");
    setCompletion("");
    setPrompt("");
    setIsVisible(false);
    setShowToolbar(false);
    setTriggerSource('slash');
  };

  const handleQuickAction = (actionPrompt: string) => {
    setPrompt(actionPrompt);
    handleGenerate(actionPrompt);
  };

  if (!editor) {
    return null;
  }

  return (
    <>
      {/* Selection Toolbar - Shows only when text is highlighted */}
      <SelectionToolbar 
        isVisible={showToolbar && hasSelection}
        onAskAI={handleToolbarAskAI}
      />

      {/* Full Floating Bar - Shows when user uses /ai command or clicks "Ask AI" */}
      {isVisible && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-gradient-to-br from-[#1FE18E]/95 via-white/95 to-[#0e2e33]/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-[#1FE18E]/30 w-[580px]">
          
          {/* Main Input Area */}
          {!completion && (
            <div className="p-5 overflow-y-auto max-h-[90vh]">
              {/* Header with suggestions label */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-[#0e2e33]" />
                  <span className="text-sm font-medium text-[#0e2e33]">
                    {hasSelection ? "AI WRITING ASSISTANT" : "Help me write"}
                  </span>
                  {hasSelection && (
                    <span className="text-xs text-gray-600">with AI</span>
                  )}
                </div>
                <button
                  onClick={() => setIsVisible(false)}
                  className="p-1.5 hover:bg-[#1FE18E]/20 rounded-lg transition-colors"
                  title="Close (ESC)"
                >
                  <X className="h-4 w-4 text-[#0e2e33]" />
                </button>
              </div>

              {/* QUICK ACTIONS Dropdown */}
              {showActions && settings.quickActionsEnabled && (
                <div className="mb-4">
                  <button
                    onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                    className="w-full px-4 py-2.5 bg-white/40 hover:bg-white/60 rounded-xl text-left text-sm text-[#0e2e33] border border-[#1FE18E]/50 transition-all flex items-center justify-between backdrop-blur-sm"
                  >
                    <span className="flex items-center gap-2">
                      <Wand2 className="h-4 w-4 text-[#1FE18E]" />
                      Quick Actions
                    </span>
                    <ChevronDown className={`h-4 w-4 text-[#0e2e33] transition-transform ${showActionsDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu - Fixed positioning to avoid clipping */}
                  {showActionsDropdown && (
                    <div className="fixed left-1/2 -translate-x-1/2 mt-2 w-[548px] bg-white/90 rounded-xl border border-[#1FE18E]/30 shadow-lg z-50 backdrop-blur-sm max-h-60 overflow-y-auto" style={{bottom: 'calc(100vh - 280px)'}}>
                      {getVisibleQuickActions().map((action, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            handleQuickAction(action.prompt);
                            setShowActionsDropdown(false);
                          }}
                          disabled={isLoading}
                          className="w-full px-4 py-2.5 text-left text-sm text-[#0e2e33] hover:bg-[#1FE18E]/10 border-b border-[#1FE18E]/10 last:border-b-0 flex items-center gap-3 transition-colors disabled:opacity-50 hover:disabled:bg-white/90"
                        >
                          {(() => {
                            const Icon = getIcon(action.icon);
                            return <Icon className="h-4 w-4 text-[#1FE18E] flex-shrink-0" />;
                          })()}
                          <span>{action.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Custom Input Field */}
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleGenerate();
                    }
                    if (e.key === 'Escape') {
                      setIsVisible(false);
                    }
                  }}
                  placeholder='What do you want to do? (e.g., "make it sound professional")'
                  disabled={isLoading}
                  className="w-full px-4 py-3 text-sm bg-white/60 text-[#0e2e33] placeholder-[#0e2e33]/40 border border-[#1FE18E]/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1FE18E] focus:border-transparent disabled:opacity-50 pr-24 backdrop-blur-sm"
                />
                
                {/* Generate Button */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <button
                    onClick={() => handleGenerate()}
                    disabled={!prompt.trim() || isLoading}
                    className="p-2 bg-[#1FE18E] hover:bg-[#1FE18E]/90 disabled:bg-gray-300 text-[#0e2e33] rounded-lg transition-colors disabled:opacity-50 font-medium"
                    title="Generate (Enter)"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Completion Preview */}
          {completion && (
            <div className="p-5">
              {/* Preview Text */}
              <div className="mb-4 p-4 bg-white/60 rounded-xl text-sm text-[#0e2e33] max-h-40 overflow-y-auto border border-[#1FE18E]/20 backdrop-blur-sm">
                {completion}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setCompletion("");
                    setPrompt("");
                    if (inputRef.current) inputRef.current.focus();
                  }}
                  className="px-4 py-2 text-sm text-[#0e2e33] hover:bg-[#1FE18E]/10 rounded-lg transition-colors font-medium"
                >
                  Refine
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleInsert}
                    className="px-4 py-2 text-sm text-[#1FE18E] hover:bg-[#1FE18E]/10 rounded-lg transition-colors font-medium border border-[#1FE18E]/30"
                  >
                    Insert
                  </button>
                  <button
                    onClick={handleReplace}
                    className="px-5 py-2 bg-[#1FE18E] hover:bg-[#1FE18E]/90 text-[#0e2e33] text-sm font-medium rounded-lg transition-colors shadow-sm"
                  >
                    Replace
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        </div>
      )}
    </>
  );
}
