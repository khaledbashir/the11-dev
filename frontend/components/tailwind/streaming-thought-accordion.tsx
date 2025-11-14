"use client";

import React, { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "./ui/button";
import { Eye, EyeOff, Clipboard, ClipboardCheck, Lightbulb, Download } from "lucide-react";

type StreamingThoughtAccordionProps = {
  messageId: string;
  content: string;
  isStreaming?: boolean;
  onInsertClick?: (content: string) => void;
  className?: string;
};

type ParsedContent = {
  publicText: string;
  reasoningText: string;
};

/**
 * Extracts reasoning blocks and returns:
 * - publicText: content with <think>, <thinking>, <AI_THINK>, <tool_call> blocks removed
 * - reasoningText: concatenated content of the reasoning blocks
 */
function parseReasoning(content: string): ParsedContent {
  if (!content) {
    return { publicText: "", reasoningText: "" };
  }

  const TAGS = ["AI_THINK", "thinking", "think"];
  const TOOL_TAG = "tool_call";

  let publicText = content;
  const reasoningChunks: string[] = [];

  // Extract reasoning content
  for (const tag of TAGS) {
    const re = new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`, "gi");
    publicText = publicText.replace(re, (m) => {
      // Strip outer tags and store the inner
      const inner = m.replace(new RegExp(`^<${tag}>`, "i"), "").replace(new RegExp(`<\\/${tag}>$`, "i"), "");
      const trimmed = inner.trim();
      if (trimmed) reasoningChunks.push(trimmed);
      return ""; // remove from public text
    });
  }

  // Remove tool_call payload blocks entirely from public output
  const toolRe = new RegExp(`<${TOOL_TAG}>[\\s\\S]*?<\\/${TOOL_TAG}>`, "gi");
  publicText = publicText.replace(toolRe, "");

  // Remove any stray opening/closing tags if present
  publicText = publicText
    .replace(/<\/?(AI_THINK|thinking|think|tool_call)>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const reasoningText = reasoningChunks.join("\n\n---\n\n");

  return { publicText, reasoningText };
}

export function StreamingThoughtAccordion({
  messageId,
  content,
  isStreaming = false,
  onInsertClick,
  className = "",
}: StreamingThoughtAccordionProps) {
  const { publicText, reasoningText } = useMemo(() => parseReasoning(content), [content]);
  const [showReasoning, setShowReasoning] = useState(false);
  const [copied, setCopied] = useState<"public" | "reasoning" | null>(null);

  const hasReasoning = reasoningText.trim().length > 0;

  const handleCopy = async (text: string, which: "public" | "reasoning") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch (e) {
      console.error("Clipboard copy failed:", e);
    }
  };

  return (
    <div
      className={`w-full rounded-md border border-slate-700 bg-slate-800/50 overflow-hidden ${className}`}
      data-message-id={messageId}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-700 bg-slate-900/60">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-300">Assistant</span>
          {isStreaming && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-600/15 text-emerald-400 border border-emerald-700/40">
              streaming…
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {onInsertClick && publicText && (
            <Button
              variant="secondary"
              size="sm"
              className="h-7 px-2 text-xs bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-700/40 text-emerald-300"
              onClick={() => onInsertClick(publicText)}
              title="Insert content into the editor"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Insert
            </Button>
          )}

          {publicText && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-300 hover:text-white"
              onClick={() => handleCopy(publicText, "public")}
              title="Copy visible content"
            >
              {copied === "public" ? <ClipboardCheck className="h-4 w-4 text-emerald-400" /> : <Clipboard className="h-4 w-4" />}
            </Button>
          )}

          {hasReasoning && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-slate-300 hover:text-white"
              onClick={() => setShowReasoning((v) => !v)}
            >
              <Lightbulb className="h-3.5 w-3.5 mr-1 text-yellow-300" />
              {showReasoning ? (
                <>
                  <EyeOff className="h-3.5 w-3.5 mx-1 opacity-70" />
                  Hide reasoning
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5 mx-1 opacity-70" />
                  Show reasoning
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Public content */}
      <div className="px-3 py-3">
        {publicText ? (
          <div className="text-sm leading-relaxed text-slate-100 whitespace-pre-wrap break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{publicText}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic">No visible content.</p>
        )}
      </div>

      {/* Reasoning accordion */}
      {hasReasoning && showReasoning && (
        <div className="border-t border-slate-700 bg-slate-900/40">
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">Reasoning</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-300 hover:text-white"
              onClick={() => handleCopy(reasoningText, "reasoning")}
              title="Copy reasoning"
            >
              {copied === "reasoning" ? <ClipboardCheck className="h-4 w-4 text-emerald-400" /> : <Clipboard className="h-4 w-4" />}
            </Button>
          </div>
          <div className="px-3 pb-3">
            <pre className="text-xs leading-relaxed text-slate-300 whitespace-pre-wrap break-words bg-slate-900/60 border border-slate-700/70 rounded p-3">
              {reasoningText}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
