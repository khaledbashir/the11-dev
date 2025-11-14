"use client";

import React, { useMemo, useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "./ui/button";
import {
    Eye,
    EyeOff,
    Clipboard,
    ClipboardCheck,
    Lightbulb,
    Download,
    Loader2,
} from "lucide-react";

type StreamingThoughtAccordionProps = {
    messageId: string;
    content: string;
    isStreaming?: boolean;
    onInsertClick?: (content: string) => void;
    className?: string;
    streamingContent?: string; // Real-time streaming content
    reasoningSteps?: string[]; // Accumulated reasoning steps
};

type ParsedContent = {
    publicText: string;
    reasoningText: string;
    reasoningSteps: string[];
};

/**
 * Extracts reasoning blocks and returns:
 * - publicText: content with <think>, <thinking>, <AI_THINK>, <tool_call> blocks removed
 * - reasoningText: concatenated content of the reasoning blocks
 * - reasoningSteps: array of individual reasoning steps
 */
function parseReasoning(content: string): ParsedContent {
    if (!content) {
        return { publicText: "", reasoningText: "", reasoningSteps: [] };
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
            const inner = m
                .replace(new RegExp(`^<${tag}>`, "i"), "")
                .replace(new RegExp(`<\\/${tag}>$`, "i"), "");
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

    // Split reasoning into individual steps (paragraphs)
    const reasoningSteps = reasoningChunks.filter(
        (chunk) => chunk.trim().length > 0,
    );

    return { publicText, reasoningText, reasoningSteps };
}

/**
 * Extract partial reasoning steps from streaming content
 * Returns an array of reasoning blocks found so far
 */
function extractStreamingReasoningSteps(content: string): string[] {
    const steps: string[] = [];

    // Look for complete thinking blocks
    const TAGS = ["AI_THINK", "thinking", "think"];

    for (const tag of TAGS) {
        const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "gi");
        let match;
        while ((match = re.exec(content)) !== null) {
            const trimmed = match[1].trim();
            if (trimmed) steps.push(trimmed);
        }
    }

    return steps;
}

/**
 * Extract visible content from streaming response
 * (removes thinking blocks but keeps incomplete content)
 */
function extractStreamingVisibleContent(content: string): string {
    const TAGS = ["AI_THINK", "thinking", "think"];
    const TOOL_TAG = "tool_call";

    let visibleText = content;

    // Remove complete thinking blocks
    for (const tag of TAGS) {
        const re = new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`, "gi");
        visibleText = visibleText.replace(re, "");
    }

    // Remove tool_call blocks
    const toolRe = new RegExp(`<${TOOL_TAG}>[\\s\\S]*?<\\/${TOOL_TAG}>`, "gi");
    visibleText = visibleText.replace(toolRe, "");

    // Remove stray tags
    visibleText = visibleText
        .replace(/<\/?(AI_THINK|thinking|think|tool_call)>/gi, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    return visibleText;
}

export function StreamingThoughtAccordion({
    messageId,
    content,
    isStreaming = false,
    onInsertClick,
    className = "",
    streamingContent,
    reasoningSteps: propReasoningSteps,
}: StreamingThoughtAccordionProps) {
    const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
    const [copied, setCopied] = useState<"public" | "reasoning" | null>(null);
    const [showReasoningPanel, setShowReasoningPanel] = useState(false);

    // Use streaming content if available, otherwise use final content
    const displayContent = streamingContent || content;
    const {
        publicText,
        reasoningText,
        reasoningSteps: parsedSteps,
    } = useMemo(() => parseReasoning(displayContent), [displayContent]);

    // Use provided reasoning steps or parsed steps
    const reasoningSteps = propReasoningSteps || parsedSteps;
    const streamingReasoningSteps = isStreaming
        ? extractStreamingReasoningSteps(displayContent)
        : [];

    // Combine both for display
    const allReasoningSteps = [
        ...reasoningSteps,
        ...streamingReasoningSteps,
    ].filter(
        (step, idx, arr) => idx === arr.findIndex((s) => s === step), // deduplicate
    );

    const hasReasoning =
        allReasoningSteps.length > 0 || reasoningText.trim().length > 0;
    const visibleContent = isStreaming
        ? extractStreamingVisibleContent(displayContent)
        : publicText;

    const handleCopy = async (text: string, which: "public" | "reasoning") => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(which);
            setTimeout(() => setCopied(null), 1500);
        } catch (e) {
            console.error("Clipboard copy failed:", e);
        }
    };

    const toggleStep = (index: number) => {
        const newExpanded = new Set(expandedSteps);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedSteps(newExpanded);
    };

    return (
        <div
            className={`w-full rounded-md border border-slate-700 bg-slate-800/50 overflow-hidden ${className}`}
            data-message-id={messageId}
        >
            {/* Header row */}
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-700 bg-slate-900/60">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-300">
                        Assistant
                    </span>
                    {isStreaming && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-600/15 text-emerald-400 border border-emerald-700/40 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            streaming…
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1.5">
                    {onInsertClick && visibleContent && (
                        <Button
                            variant="secondary"
                            size="sm"
                            className="h-7 px-2 text-xs bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-700/40 text-emerald-300"
                            onClick={() => onInsertClick(visibleContent)}
                            title="Insert content into the editor"
                        >
                            <Download className="h-3.5 w-3.5 mr-1" />
                            Insert
                        </Button>
                    )}

                    {visibleContent && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-300 hover:text-white"
                            onClick={() => handleCopy(visibleContent, "public")}
                            title="Copy visible content"
                        >
                            {copied === "public" ? (
                                <ClipboardCheck className="h-4 w-4 text-emerald-400" />
                            ) : (
                                <Clipboard className="h-4 w-4" />
                            )}
                        </Button>
                    )}

                    {hasReasoning && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-slate-300 hover:text-white"
                            onClick={() =>
                                setShowReasoningPanel(!showReasoningPanel)
                            }
                        >
                            <Lightbulb className="h-3.5 w-3.5 mr-1 text-yellow-300" />
                            {showReasoningPanel ? (
                                <>
                                    <EyeOff className="h-3.5 w-3.5 mx-1 opacity-70" />
                                    Hide thinking
                                </>
                            ) : (
                                <>
                                    <Eye className="h-3.5 w-3.5 mx-1 opacity-70" />
                                    Show thinking ({allReasoningSteps.length})
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </div>

            {/* Main visible content */}
            <div className="px-3 py-3">
                {visibleContent ? (
                    <div className="text-sm leading-relaxed text-slate-100 whitespace-pre-wrap break-words">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {visibleContent}
                        </ReactMarkdown>
                    </div>
                ) : isStreaming ? (
                    <div className="text-sm text-slate-400 italic flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                        AI is thinking...
                    </div>
                ) : (
                    <p className="text-sm text-slate-400 italic">
                        No visible content.
                    </p>
                )}
            </div>

            {/* Reasoning accordion panel */}
            {hasReasoning && showReasoningPanel && (
                <div className="border-t border-slate-700 bg-slate-900/40">
                    <div className="px-3 py-3">
                        {/* Reasoning header with copy button */}
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-700/50">
                            <div className="flex items-center gap-2">
                                <Lightbulb className="h-4 w-4 text-yellow-300" />
                                <span className="text-xs font-medium text-slate-300">
                                    Reasoning Steps ({allReasoningSteps.length})
                                </span>
                            </div>
                            {reasoningText && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-slate-300 hover:text-white"
                                    onClick={() =>
                                        handleCopy(reasoningText, "reasoning")
                                    }
                                    title="Copy all reasoning"
                                >
                                    {copied === "reasoning" ? (
                                        <ClipboardCheck className="h-3.5 w-3.5 text-emerald-400" />
                                    ) : (
                                        <Clipboard className="h-3.5 w-3.5" />
                                    )}
                                </Button>
                            )}
                        </div>

                        {/* Individual reasoning steps */}
                        {allReasoningSteps.length > 0 ? (
                            <div className="space-y-2">
                                {allReasoningSteps.map((step, idx) => (
                                    <div
                                        key={idx}
                                        className="border border-slate-700/50 rounded bg-slate-900/60 overflow-hidden"
                                    >
                                        <button
                                            onClick={() => toggleStep(idx)}
                                            className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-800/50 transition-colors text-left"
                                        >
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <span className="text-slate-400 text-xs font-medium flex-shrink-0">
                                                    Step {idx + 1}
                                                </span>
                                                <span className="text-slate-400 text-xs truncate">
                                                    {step.substring(0, 50)}...
                                                </span>
                                            </div>
                                            <span className="text-slate-400 text-xs flex-shrink-0 ml-2">
                                                {expandedSteps.has(idx)
                                                    ? "▼"
                                                    : "▶"}
                                            </span>
                                        </button>

                                        {/* Expanded step content */}
                                        {expandedSteps.has(idx) && (
                                            <div className="px-3 pb-2 border-t border-slate-700/50 bg-slate-950/40">
                                                <pre className="text-xs leading-relaxed text-slate-300 whitespace-pre-wrap break-words font-mono overflow-x-auto max-h-64">
                                                    {step}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-xs text-slate-400 italic py-2">
                                {isStreaming
                                    ? "Reasoning steps will appear as they're generated..."
                                    : "No reasoning steps available"}
                            </div>
                        )}

                        {/* Full reasoning text (if available and not showing steps) */}
                        {reasoningText && allReasoningSteps.length === 0 && (
                            <div className="mt-3 p-3 bg-slate-950/60 rounded border border-slate-700/50">
                                <pre className="text-xs leading-relaxed text-slate-300 whitespace-pre-wrap break-words font-mono overflow-x-auto max-h-96">
                                    {reasoningText}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Streaming indicator bar */}
            {isStreaming && (
                <div className="h-1 bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 opacity-70 animate-pulse" />
            )}
        </div>
    );
}
