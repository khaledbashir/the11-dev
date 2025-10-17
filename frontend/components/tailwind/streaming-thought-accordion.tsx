"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
    // No thinking tags, just return the content with proper markdown rendering
    return (
      <div className="pt-2">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Headings with proper spacing
            h1: ({node, ...props}) => <h1 className="text-xl font-bold mt-4 mb-2 text-white" {...props} />,
            h2: ({node, ...props}) => <h2 className="text-lg font-bold mt-3 mb-2 text-white" {...props} />,
            h3: ({node, ...props}) => <h3 className="text-base font-bold mt-2 mb-1 text-white" {...props} />,
            
            // Paragraphs with proper spacing
            p: ({node, ...props}) => <p className="text-sm text-white mb-2 leading-relaxed" {...props} />,
            
            // Lists
            ul: ({node, ...props}) => <ul className="list-disc list-inside text-sm text-white mb-2 pl-2" {...props} />,
            ol: ({node, ...props}) => <ol className="list-decimal list-inside text-sm text-white mb-2 pl-2" {...props} />,
            li: ({node, ...props}) => <li className="text-sm text-white mb-1" {...props} />,
            
            // Tables with professional styling
            table: ({node, ...props}) => (
              <div className="overflow-x-auto my-3">
                <table className="w-full border-collapse border border-[#1b5e5e]" {...props} />
              </div>
            ),
            thead: ({node, ...props}) => <thead className="bg-[#0e2e33]" {...props} />,
            th: ({node, ...props}) => (
              <th className="border border-[#1b5e5e] px-3 py-2 text-left font-bold text-white text-xs" {...props} />
            ),
            td: ({node, ...props}) => (
              <td className="border border-[#1b5e5e] px-3 py-2 text-xs text-white" {...props} />
            ),
            tr: ({node, ...props}) => <tr className="hover:bg-[#1b5e5e]/20" {...props} />,
            
            // Code blocks
            code: ({node, className, children, ...props}: any) => {
              const isInline = !className?.includes('language-');
              return isInline ? (
                <code className="bg-[#0a0a0a] text-[#20e28f] px-2 py-1 rounded text-xs font-mono" {...props}>{children}</code>
              ) : (
                <code className="bg-[#0a0a0a] text-[#20e28f] block p-3 rounded text-xs font-mono overflow-x-auto mb-2 border border-[#1b5e5e]" {...props}>{children}</code>
              );
            },
            pre: ({node, ...props}) => <pre className="mb-2" {...props} />,
            
            // Blockquotes
            blockquote: ({node, ...props}) => (
              <blockquote className="border-l-4 border-[#20e28f] pl-3 italic text-gray-300 my-2 text-sm" {...props} />
            ),
            
            // Strong and emphasis
            strong: ({node, ...props}) => <strong className="font-bold text-white" {...props} />,
            em: ({node, ...props}) => <em className="italic text-gray-200" {...props} />,
            
            // Horizontal rules
            hr: ({node, ...props}) => <hr className="border-t border-[#1b5e5e] my-3" {...props} />,
          }}
          className="prose prose-invert max-w-none text-sm"
        >
          {actualContent}
        </ReactMarkdown>
      </div>
    );
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

      {/* Actual Content - Properly formatted Markdown */}
      {actualContent && (
        <div className="pt-2">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Headings with proper spacing
              h1: ({node, ...props}) => <h1 className="text-xl font-bold mt-4 mb-2 text-white" {...props} />,
              h2: ({node, ...props}) => <h2 className="text-lg font-bold mt-3 mb-2 text-white" {...props} />,
              h3: ({node, ...props}) => <h3 className="text-base font-bold mt-2 mb-1 text-white" {...props} />,
              
              // Paragraphs with proper spacing
              p: ({node, ...props}) => <p className="text-sm text-white mb-2 leading-relaxed" {...props} />,
              
              // Lists
              ul: ({node, ...props}) => <ul className="list-disc list-inside text-sm text-white mb-2 pl-2" {...props} />,
              ol: ({node, ...props}) => <ol className="list-decimal list-inside text-sm text-white mb-2 pl-2" {...props} />,
              li: ({node, ...props}) => <li className="text-sm text-white mb-1" {...props} />,
              
              // Tables with professional styling
              table: ({node, ...props}) => (
                <div className="overflow-x-auto my-3">
                  <table className="w-full border-collapse border border-[#1b5e5e]" {...props} />
                </div>
              ),
              thead: ({node, ...props}) => <thead className="bg-[#0e2e33]" {...props} />,
              th: ({node, ...props}) => (
                <th className="border border-[#1b5e5e] px-3 py-2 text-left font-bold text-white text-xs" {...props} />
              ),
              td: ({node, ...props}) => (
                <td className="border border-[#1b5e5e] px-3 py-2 text-xs text-white" {...props} />
              ),
              tr: ({node, ...props}) => <tr className="hover:bg-[#1b5e5e]/20" {...props} />,
              
              // Code blocks
              code: ({node, className, children, ...props}: any) => {
                const isInline = !className?.includes('language-');
                return isInline ? (
                  <code className="bg-[#0a0a0a] text-[#20e28f] px-2 py-1 rounded text-xs font-mono" {...props}>{children}</code>
                ) : (
                  <code className="bg-[#0a0a0a] text-[#20e28f] block p-3 rounded text-xs font-mono overflow-x-auto mb-2 border border-[#1b5e5e]" {...props}>{children}</code>
                );
              },
              pre: ({node, ...props}) => <pre className="mb-2" {...props} />,
              
              // Blockquotes
              blockquote: ({node, ...props}) => (
                <blockquote className="border-l-4 border-[#20e28f] pl-3 italic text-gray-300 my-2 text-sm" {...props} />
              ),
              
              // Strong and emphasis
              strong: ({node, ...props}) => <strong className="font-bold text-white" {...props} />,
              em: ({node, ...props}) => <em className="italic text-gray-200" {...props} />,
              
              // Horizontal rules
              hr: ({node, ...props}) => <hr className="border-t border-[#1b5e5e] my-3" {...props} />,
            }}
            className="prose prose-invert max-w-none text-sm"
          >
            {actualContent}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
