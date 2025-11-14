"use client";

import React, { useEffect, useState } from "react";
import { StreamingThoughtAccordion } from "./streaming-thought-accordion";
import { JsonRenderer } from "./ui/json-renderer";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2 } from "lucide-react";

type StreamingChatMessageProps = {
  messageId: string;
  role: "user" | "assistant";
  content: string;
  streamingContent?: string;
  reasoningSteps?: string[];
  isStreaming?: boolean;
  timestamp: number;
  onInsertClick?: (content: string) => void;
  className?: string;
};

/**
 * Component to display a chat message with streaming support
 * Shows user messages as-is, and assistant messages with streaming/reasoning accordion
 */
export function StreamingChatMessage({
  messageId,
  role,
  content,
  streamingContent,
  reasoningSteps,
  isStreaming = false,
  timestamp,
  onInsertClick,
  className = "",
}: StreamingChatMessageProps) {
  const displayContent = streamingContent || content;

  if (role === "user") {
    return (
      <div
        className={`flex justify-end ${className}`}
        data-message-id={messageId}
      >
        <div className="max-w-[70%] rounded-lg p-3 bg-emerald-600 text-white">
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {displayContent}
          </p>
          <p className="text-xs opacity-60 mt-2">
            {new Date(timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>
    );
  }

  // Assistant message with streaming thought accordion
  return (
    <div
      className={`flex justify-start ${className}`}
      data-message-id={messageId}
    >
      <div className="max-w-[85%] space-y-3">
        {/* Streaming thought accordion */}
        <StreamingThoughtAccordion
          messageId={messageId}
          content={content}
          streamingContent={streamingContent}
          reasoningSteps={reasoningSteps}
          isStreaming={isStreaming}
          onInsertClick={onInsertClick}
        />

        {/* Timestamp */}
        <p className="text-xs text-gray-400 px-3">
          {new Date(timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
