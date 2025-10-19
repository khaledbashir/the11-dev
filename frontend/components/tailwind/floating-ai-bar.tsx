"use client";

import { useState, useEffect, useRef } from "react";
import { useEditor } from "novel";
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

interface FloatingAIBarProps {
  onGenerate?: (prompt: string, mode: 'replace' | 'insert') => void;
}

export function FloatingAIBar({ onGenerate }: FloatingAIBarProps) {
  const { editor } = useEditor();
  const [isVisible, setIsVisible] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [completion, setCompletion] = useState("");
  const [showActions, setShowActions] = useState(false);
  const [triggerSource, setTriggerSource] = useState<'selection' | 'slash'>('selection');
  const inputRef = useRef<HTMLInputElement>(null);

  // Log editor status
  useEffect(() => {
    console.log("🔍 [FloatingAIBar] Component mounted, editor:", editor ? "available" : "not available");
  }, [editor]);

  // Quick actions - matching your image exactly
  const quickActions = [
    { label: "Improve Writing", icon: Sparkles, prompt: "Improve the writing quality and clarity" },
    { label: "Shorten", icon: ArrowDownWideNarrow, prompt: "Make this shorter and more concise" },
    { label: "Elaborate", icon: WrapText, prompt: "Add more details and expand this" },
    { label: "More formal", icon: Briefcase, prompt: "Rewrite in a more formal, professional tone" },
    { label: "More casual", icon: MessageCircle, prompt: "Rewrite in a casual, friendly tone" },
    { label: "Bulletize", icon: List, prompt: "Convert this into bullet points" },
    { label: "Summarize", icon: FileText, prompt: "Create a concise summary" },
    { label: "Rewrite", icon: RotateCcw, prompt: "Rewrite this in a different way" },
  ];

  // Monitor text selection
  useEffect(() => {
    if (!editor) {
      console.log("⚠️ [FloatingAIBar] No editor available");
      return;
    }

    console.log("✅ [FloatingAIBar] Editor connected, monitoring selection");

    const updateSelection = () => {
      const { from, to } = editor.state.selection;
      const hasText = from !== to;
      console.log("📝 [FloatingAIBar] Selection update:", { from, to, hasText, isVisible });
      setHasSelection(hasText);
      
      if (hasText) {
        console.log("🎯 [FloatingAIBar] Showing bar (selection)");
        setTriggerSource('selection');
        setIsVisible(true);
        setShowActions(true); // Show quick actions for selections
      } else if (triggerSource === 'selection' && !isVisible) {
        console.log("🔒 [FloatingAIBar] Hiding bar (no selection)");
        setIsVisible(false);
        setPrompt("");
        setCompletion("");
        setShowActions(false);
      }
    };

    editor.on('selectionUpdate', updateSelection);
    editor.on('update', updateSelection);

    return () => {
      editor.off('selectionUpdate', updateSelection);
      editor.off('update', updateSelection);
    };
  }, [editor, isVisible, triggerSource]);

  // Monitor for /ai command
  useEffect(() => {
    if (!editor) return;

    console.log("✅ [FloatingAIBar] Monitoring for /ai command and slash menu");

    // Listen for custom event from slash command
    const handleOpenAIBar = (event: CustomEvent) => {
      console.log("🎯 [FloatingAIBar] Opened via slash command!");
      setTriggerSource('slash');
      setIsVisible(true);
      setHasSelection(false);
      setShowActions(false); // Don't show quick actions for slash command
    };

    window.addEventListener('open-ai-bar', handleOpenAIBar as EventListener);

    const checkForSlashCommand = () => {
      const { from } = editor.state.selection;
      const textBefore = editor.state.doc.textBetween(Math.max(0, from - 10), from, '\n');
      
      // Check if user typed /ai
      if (textBefore.endsWith('/ai ')) {
        console.log("🎯 [FloatingAIBar] /ai command detected!");
        setTriggerSource('slash');
        setIsVisible(true);
        setHasSelection(false);
        setShowActions(false);
        
        // Remove the /ai command
        editor.chain().focus().deleteRange({ from: from - 4, to: from }).run();
      }
    };

    editor.on('update', checkForSlashCommand);

    return () => {
      window.removeEventListener('open-ai-bar', handleOpenAIBar as EventListener);
      editor.off('update', checkForSlashCommand);
    };
  }, [editor]);

  // Auto-focus input when visible
  useEffect(() => {
    if (isVisible && inputRef.current && !completion) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isVisible, completion]);

  // Get selected text
  const getSelectedText = () => {
    if (!editor) return "";
    try {
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
            option: "continue",
            command: finalPrompt,
            model: "anthropic/claude-3.5-sonnet",
          }),
        });

        if (!response.ok) {
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
        toast.error("Failed to generate");
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
          model: "anthropic/claude-3.5-sonnet",
        }),
      });

      if (!response.ok) {
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
      toast.error("Failed to generate");
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
      toast.success("Text inserted");
    } else {
      // Replace selection
      const { from, to } = editor.state.selection;
      editor.chain().focus().insertContentAt({ from, to }, completion).run();
      toast.success("Text replaced");
    }
    
    setCompletion("");
    setPrompt("");
    setIsVisible(false);
  };

  const handleInsert = () => {
    if (!editor || !completion) return;
    
    const { to } = editor.state.selection;
    editor.chain().focus().insertContentAt(to, "\n\n" + completion).run();
    toast.success("Text inserted");
    setCompletion("");
    setPrompt("");
    setIsVisible(false);
  };

  const handleQuickAction = (actionPrompt: string) => {
    setPrompt(actionPrompt);
    handleGenerate(actionPrompt);
  };

  if (!editor) {
    console.log("⚠️ [FloatingAIBar] Waiting for editor to be ready...");
    return null;
  }

  if (!isVisible) return null;

  return (
    <>
      {/* Fixed Bottom Bar - Exact match to your image */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-gradient-to-r from-blue-50/95 via-blue-100/95 to-blue-50/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-200/50 overflow-hidden w-[580px]">
          
          {/* Main Input Area */}
          {!completion && (
            <div className="p-5">
              {/* Header with suggestions label */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">
                    {hasSelection ? "AI WRITING ASSISTANT" : "Help me write"}
                  </span>
                  {hasSelection && (
                    <span className="text-xs text-gray-500">1 word selected</span>
                  )}
                </div>
                <button
                  onClick={() => setIsVisible(false)}
                  className="p-1.5 hover:bg-blue-200/50 rounded-lg transition-colors"
                  title="Close (ESC)"
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>

              {/* SUGGESTIONS Section (only if text selected) */}
              {hasSelection && showActions && (
                <div className="mb-4">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
                    SUGGESTIONS
                  </div>
                  <button
                    onClick={() => handleQuickAction("Improve the writing quality and clarity")}
                    className="w-full px-4 py-2.5 bg-white hover:bg-blue-50 rounded-xl text-left text-sm text-gray-700 border border-gray-200 hover:border-blue-300 transition-all flex items-center gap-2"
                  >
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    Improve Writing
                  </button>
                </div>
              )}

              {/* QUICK ACTIONS Section */}
              {showActions && (
                <div className="mb-4">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
                    QUICK ACTIONS
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {quickActions.slice(1, 5).map((action, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleQuickAction(action.prompt)}
                        disabled={isLoading}
                        className="px-3 py-3 bg-white hover:bg-blue-50 rounded-xl text-center text-xs font-medium text-gray-700 border border-gray-200 hover:border-blue-300 transition-all disabled:opacity-50 flex flex-col items-center gap-1.5"
                      >
                        <action.icon className="h-4 w-4 text-blue-600" />
                        <span>{action.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {quickActions.slice(5).map((action, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleQuickAction(action.prompt)}
                        disabled={isLoading}
                        className="px-3 py-3 bg-white hover:bg-blue-50 rounded-xl text-center text-xs font-medium text-gray-700 border border-gray-200 hover:border-blue-300 transition-all disabled:opacity-50 flex flex-col items-center gap-1.5"
                      >
                        <action.icon className="h-4 w-4 text-blue-600" />
                        <span>{action.label}</span>
                      </button>
                    ))}
                  </div>
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
                  className="w-full px-4 py-3 text-sm bg-white text-gray-700 placeholder-gray-400 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 pr-24"
                />
                
                {/* Model indicator */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <span className="text-xs text-gray-400">GLM-4.5 Air (Free)</span>
                  <button
                    onClick={() => handleGenerate()}
                    disabled={!prompt.trim() || isLoading}
                    className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg transition-colors disabled:opacity-50"
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
              <div className="mb-4 p-4 bg-white rounded-xl text-sm text-gray-700 max-h-40 overflow-y-auto border border-gray-200">
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
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-blue-50 rounded-lg transition-colors font-medium"
                >
                  Refine with a prompt
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleInsert}
                    className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium"
                  >
                    Insert
                  </button>
                  <button
                    onClick={handleReplace}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                  >
                    Replace
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
