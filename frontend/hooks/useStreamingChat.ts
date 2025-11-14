"use client";

import { useState, useCallback, useRef } from "react";

export type StreamingMessageUpdate = {
  messageId: string;
  content: string;
  reasoningSteps: string[];
  isComplete: boolean;
  error?: string;
};

export type UseStreamingChatOptions = {
  onUpdate?: (update: StreamingMessageUpdate) => void;
  onComplete?: (messageId: string, finalContent: string) => void;
  onError?: (messageId: string, error: string) => void;
};

/**
 * Hook to handle streaming chat responses with real-time reasoning extraction
 * Parses incoming streaming content and extracts reasoning blocks as they arrive
 */
export function useStreamingChat(options: UseStreamingChatOptions = {}) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [reasoningSteps, setReasoningSteps] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Extract reasoning steps from content
   * Returns array of complete reasoning blocks
   */
  const extractReasoningSteps = useCallback((content: string): string[] => {
    const steps: string[] = [];
    const TAGS = ["AI_THINK", "thinking", "think"];

    for (const tag of TAGS) {
      const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "gi");
      let match;
      while ((match = re.exec(content)) !== null) {
        const trimmed = match[1].trim();
        if (trimmed && !steps.includes(trimmed)) {
          steps.push(trimmed);
        }
      }
    }

    return steps;
  }, []);

  /**
   * Stream a message and handle real-time updates
   */
  const streamMessage = useCallback(
    async (
      messageId: string,
      endpoint: string,
      body: any,
      options?: {
        headers?: Record<string, string>;
        onChunk?: (chunk: string) => void;
      },
    ) => {
      // Cancel any ongoing streaming
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      setIsStreaming(true);
      setStreamingContent("");
      setReasoningSteps([]);

      let accumulatedContent = "";
      let currentReasoningSteps: string[] = [];

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...options?.headers,
          },
          body: JSON.stringify(body),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(
            `API error: ${response.status} ${response.statusText}`,
          );
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Response body is not readable");
        }

        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulatedContent += chunk;

          // Call custom chunk handler if provided
          options?.onChunk?.(chunk);

          // Extract reasoning steps from accumulated content
          currentReasoningSteps = extractReasoningSteps(accumulatedContent);

          // Update state with streaming content
          setStreamingContent(accumulatedContent);
          setReasoningSteps(currentReasoningSteps);

          // Notify via callback
          options?.onUpdate?.({
            messageId,
            content: accumulatedContent,
            reasoningSteps: currentReasoningSteps,
            isComplete: false,
          });
        }

        // Final reasoning extraction
        const finalReasoningSteps = extractReasoningSteps(accumulatedContent);
        setReasoningSteps(finalReasoningSteps);

        // Mark as complete
        options?.onComplete?.(messageId, accumulatedContent);
        options?.onUpdate?.({
          messageId,
          content: accumulatedContent,
          reasoningSteps: finalReasoningSteps,
          isComplete: true,
        });

        return accumulatedContent;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        if (error instanceof Error && error.name === "AbortError") {
          console.log("Streaming was cancelled");
          return accumulatedContent;
        }

        console.error("Streaming error:", error);
        options?.onError?.(messageId, errorMessage);
        throw error;
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [extractReasoningSteps],
  );

  /**
   * Stream with event-stream format (Server-Sent Events)
   */
  const streamMessageSSE = useCallback(
    async (
      messageId: string,
      endpoint: string,
      body: any,
      options?: {
        headers?: Record<string, string>;
        onChunk?: (chunk: string) => void;
      },
    ) => {
      // Cancel any ongoing streaming
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      setIsStreaming(true);
      setStreamingContent("");
      setReasoningSteps([]);

      let accumulatedContent = "";
      let currentReasoningSteps: string[] = [];

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...options?.headers,
          },
          body: JSON.stringify(body),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(
            `API error: ${response.status} ${response.statusText}`,
          );
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Response body is not readable");
        }

        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);

              if (data === "[DONE]") {
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || "";

                if (content) {
                  accumulatedContent += content;
                  options?.onChunk?.(content);

                  // Extract reasoning steps
                  currentReasoningSteps =
                    extractReasoningSteps(accumulatedContent);

                  // Update state
                  setStreamingContent(accumulatedContent);
                  setReasoningSteps(currentReasoningSteps);

                  // Notify via callback
                  options?.onUpdate?.({
                    messageId,
                    content: accumulatedContent,
                    reasoningSteps: currentReasoningSteps,
                    isComplete: false,
                  });
                }
              } catch (e) {
                console.error("Failed to parse SSE data:", data, e);
              }
            }
          }
        }

        // Final reasoning extraction
        const finalReasoningSteps = extractReasoningSteps(accumulatedContent);
        setReasoningSteps(finalReasoningSteps);

        // Mark as complete
        options?.onComplete?.(messageId, accumulatedContent);
        options?.onUpdate?.({
          messageId,
          content: accumulatedContent,
          reasoningSteps: finalReasoningSteps,
          isComplete: true,
        });

        return accumulatedContent;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        if (error instanceof Error && error.name === "AbortError") {
          console.log("Streaming was cancelled");
          return accumulatedContent;
        }

        console.error("Streaming error:", error);
        options?.onError?.(messageId, errorMessage);
        throw error;
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [extractReasoningSteps],
  );

  /**
   * Cancel ongoing streaming
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  /**
   * Reset streaming state
   */
  const reset = useCallback(() => {
    setIsStreaming(false);
    setStreamingContent("");
    setReasoningSteps([]);
  }, []);

  return {
    isStreaming,
    streamingContent,
    reasoningSteps,
    streamMessage,
    streamMessageSSE,
    cancel,
    reset,
  };
}
