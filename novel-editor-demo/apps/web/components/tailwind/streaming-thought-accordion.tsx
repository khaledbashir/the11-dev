"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface StreamingThoughtAccordionProps {
  content: string; // Full content including <think> tags
  isStreaming?: boolean; // Whether this message is currently streaming
  messageId?: string; // Unique message ID for tracking
  onThinkingExtracted?: (thinking: string) => void;
}

export function StreamingThoughtAccordion({
  content,
  isStreaming = false,
  messageId,
  onThinkingExtracted,
}: StreamingThoughtAccordionProps) {
  const [thinking, setThinking] = useState<string>("");
  const [actualContent, setActualContent] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);
  const [displayedThinking, setDisplayedThinking] = useState<string>("");

  // Extract thinking tags and stream the display
  useEffect(() => {
    const thinkingMatch = content.match(/<think>([\s\S]*?)<\/think>/i);
    const extractedThinking = thinkingMatch ? thinkingMatch[1].trim() : "";
    const cleanedContent = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

    setThinking(extractedThinking);
    setActualContent(cleanedContent);

    if (onThinkingExtracted && extractedThinking) {
      onThinkingExtracted(extractedThinking);
    }

    // Stream the thinking display character by character
    if (extractedThinking && isStreaming) {
      setDisplayedThinking("");
      let currentIndex = 0;

      const streamThinking = () => {
        if (currentIndex < extractedThinking.length) {
          setDisplayedThinking((prev) => prev + extractedThinking[currentIndex]);
          currentIndex++;
          // Typing speed - adjust for faster/slower effect
          const delay = Math.random() * 20 + 10; // 10-30ms between chars
          setTimeout(streamThinking, delay);
        }
      };

      streamThinking();
    } else if (extractedThinking) {
      setDisplayedThinking(extractedThinking);
    }
  }, [content, isStreaming, onThinkingExtracted]);

  if (!thinking) {
    // No thinking tags, just return the content
    return <>{actualContent}</>;
  }

  return (
    <div className="w-full space-y-3">
      {/* Thinking Accordion */}
      <details
        className="border border-[#1b5e5e] rounded-lg overflow-hidden bg-[#0a0a0a] group"
        open={isOpen}
        onToggle={(e) => setIsOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer px-4 py-3 bg-[#1b5e5e]/20 hover:bg-[#1b5e5e]/30 transition-colors text-sm font-semibold flex items-center gap-2 select-none">
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          <span className="text-yellow-400">🧠</span>
          <span>
            {isStreaming ? "AI Thinking..." : "AI Reasoning"}
            {isStreaming && <span className="ml-2 inline-flex gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"></span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" style={{ animationDelay: "0.2s" }}></span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" style={{ animationDelay: "0.4s" }}></span>
            </span>}
          </span>
          <span className="text-xs text-gray-400 ml-auto">Transparency Mode</span>
        </summary>
        <div className="px-4 py-3 bg-[#000000]/50 border-t border-[#1b5e5e]/30">
          <div className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed max-h-[300px] overflow-y-auto">
            {/* Show streamed thinking with typing effect */}
            <span>{displayedThinking}</span>
            {isStreaming && displayedThinking.length < thinking.length && (
              <span className="animate-pulse text-gray-500">_</span>
            )}
          </div>
        </div>
      </details>

      {/* Actual Content */}
      {actualContent && <div className="pt-2">{actualContent}</div>}
    </div>
  );
}
