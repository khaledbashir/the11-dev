"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { anythingLLM } from "@/lib/anythingllm";
import type { Agent, ChatMessage, Document } from "@/types";
import {
    extractFinancialReasoning,
    extractBudgetAndDiscount,
    extractClientName,
    extractPricingJSON,
    buildSuggestedRolesFromArchitectSOW,
} from "@/lib/page-utils";
import { WORKSPACE_CONFIG, getWorkspaceForAgent } from "@/lib/workspace-config";
import { ROLES } from "@/lib/rateCard";
import { sanitizeEmptyTextNodes } from "@/lib/page-utils";
import { extractSOWStructuredJson } from "@/lib/export-utils";
import { convertMarkdownToNovelJSON } from "@/lib/editor-utils";

interface UseChatManagerProps {
    viewMode: "editor" | "dashboard";
    currentDoc?: Document | null;
    documents?: Document[];
    editorRef?: React.RefObject<any>;
    workspaces?: any[];
    currentWorkspaceId?: string;
    currentSOWId?: string;
    setLatestEditorJSON?: (content: any) => void;
}

export function useChatManager({
    viewMode,
    currentDoc = null,
    documents = [],
    editorRef = undefined,
    setLatestEditorJSON,
}: UseChatManagerProps) {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [currentAgentId, setCurrentAgentId] = useState<string | null>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
    const [streamingThinking, setStreamingThinking] = useState<string>(""); // PHASE 2: Real CoT content
    const [streamingContent, setStreamingContent] = useState<string>(""); // PHASE 2: Final SOW content
    const [lastUserPrompt, setLastUserPrompt] = useState<string>("");
    const [userPromptDiscount, setUserPromptDiscount] = useState<number>(0);
    const [multiScopePricingData, setMultiScopePricingData] = useState<any | null>(null);

    const currentRequestControllerRef = useRef<AbortController | null>(null);
    const lastMessageSentTimeRef = useRef<number>(0);
    const MESSAGE_RATE_LIMIT = 1000;

    const log = useCallback((...args: any[]) => {
        if (process.env.NODE_ENV === "development") {
            console.log(...args);
        }
    }, []);

    const handleCreateAgent = useCallback(async (agent: Omit<Agent, "id">) => {
        const newId = `agent${Date.now()}`;
        const newAgent: Agent = { id: newId, ...agent };

        try {
            const response = await fetch("/api/agents", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newAgent),
            });

            if (response.ok) {
                setAgents((prev) => [...prev, newAgent]);
                setCurrentAgentId(newId);
                log("✅ Agent created in database");
            }
        } catch (error) {
            log("❌ Failed to create agent:", error);
        }
    }, [log]);

    const handleSelectAgent = useCallback(async (id: string) => {
        setCurrentAgentId(id);
        setChatMessages([]);
        log(`✅ Agent selected: ${id}. Chat history managed by AnythingLLM threads.`);
    }, [setChatMessages, log]);

    const handleUpdateAgent = useCallback(async (id: string, updates: Partial<Agent>) => {
        try {
            const response = await fetch(`/api/agents/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
            });

            if (response.ok) {
                setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
                log("✅ Agent updated in database");
            }
        } catch (error) {
            log("❌ Failed to update agent:", error);
        }
    }, [log]);

    const handleDeleteAgent = useCallback(async (id: string) => {
        try {
            const response = await fetch(`/api/agents/${id}`, {
                method: "DELETE",
            });

            if (response.ok) {
                setAgents((prev) => prev.filter((a) => a.id !== id));
                if (currentAgentId === id) {
                    setCurrentAgentId(null);
                    setChatMessages([]);
                }
                log("✅ Agent deleted from database (messages cascade deleted)");
            }
        } catch (error) {
            log("❌ Failed to delete agent:", error);
        }
    }, [currentAgentId, log]);

    const handleInsertContent = useCallback(async (content: string, suggestedRoles: any[] = []) => {
        let localMultiScopeData: any = undefined;

        // Trim content to check if it's actually empty
        const trimmedContent = content?.trim() || "";
        
        log("📝 Inserting content into editor:", trimmedContent.substring(0, 100));
        log("📝 Content length:", trimmedContent.length);
        log("📝 Editor ref exists:", !!editorRef?.current);
        log("📄 Current doc ID:", currentDoc?.id || null);

        if (!editorRef?.current) {
            log("❌ Editor not initialized, cannot insert content.");
            toast.error("Editor not ready. Please wait a moment and try again.");
            return;
        }

        if (!trimmedContent) {
            log("❌ Content is empty after cleaning");
            toast.error("No content to insert. The AI response appears to be empty or contains only internal processing tags.");
            return;
        }

        if (!currentDoc?.id) {
            log("❌ Missing document ID");
            toast.error("No document is open. Please open a document first.");
            return;
        }

        extractFinancialReasoning(trimmedContent);

        try {
            let filteredContent = trimmedContent;
            filteredContent = filteredContent.replace(/<thinking>([\s\S]*?)<\/thinking>/gi, "");
            filteredContent = filteredContent.replace(/<think>([\s\S]*?)<\/think>/gi, "");

            // Complex content conversion logic with proper TipTap JSON structure
            let convertedContent: any;
            let finalContent: any;
            
            // Extract budget and discount information
            const { budget, discount } = extractBudgetAndDiscount(filteredContent);
            
            // Convert markdown to TipTap JSON structure
            const convertOptions: any = {
                preserveFormatting: true,
                extractPricing: true,
            };
            
            // Sanitize roles if provided
            const sanitized = suggestedRoles && suggestedRoles.length > 0
                ? sanitizeEmptyTextNodes(suggestedRoles)
                : [];
            
            try {
                convertedContent = convertMarkdownToNovelJSON(
                    filteredContent,
                    sanitized,
                    convertOptions,
                );
                finalContent = convertedContent;
            } catch (error) {
                console.error("Error converting content:", error);
                finalContent = { type: "doc", content: [] };
            }
            
            // CRITICAL DIAGNOSTIC: Check content type before insertion
            console.log("🧩 Final Content Type Check:");
            console.log("FinalContent is object:", typeof finalContent === 'object' && finalContent !== null);
            console.log("FinalContent type attribute:", finalContent?.type);
            if (typeof finalContent === 'string' || !finalContent || finalContent.type !== 'doc') {
                console.error("❌ CRITICAL INSERTION FAILURE: Final content is not a valid TipTap JSON object (type: 'doc'). Inserting raw string is blocked.");
                toast.error("Insertion failed: Content conversion error.");
                return; // Block insertion of invalid data
            }
            
            // Update editor with properly structured content
            if (editorRef.current) {
                if (editorRef.current.commands?.setContent) {
                    editorRef.current.commands.setContent(finalContent);
                } else {
                    editorRef.current.insertContent(finalContent);
                }
                // Sync with parent component state
                if (setLatestEditorJSON) {
                    setLatestEditorJSON(finalContent);
                }
                log("✅ Content inserted successfully with proper TipTap structure");
            }

            // Attempt to embed to AnythingLLM workspace if configured (non-blocking)
            // This runs asynchronously and won't block content insertion
            const workspaceForAgent = getWorkspaceForAgent(currentAgentId || "");
            if (workspaceForAgent && currentDoc?.id) {
                // Run embedding in background - don't await to avoid blocking insertion
                (async () => {
                    try {
                        // Get HTML content from editor if available, otherwise use filtered markdown
                        let htmlContent = filteredContent;
                        if (editorRef.current?.getHTML) {
                            htmlContent = editorRef.current.getHTML();
                        } else if (editorRef.current?.view?.dom) {
                            // Fallback: try to get HTML from editor DOM
                            htmlContent = editorRef.current.view.dom.innerHTML || filteredContent;
                        }
                        
                        // Fix parameter order: workspaceSlug, sowTitle, htmlContent, metadata
                        const success = await anythingLLM.embedSOWDocument(
                            workspaceForAgent,
                            currentDoc?.title || currentDoc?.id || "Untitled SOW",
                            htmlContent,
                            {
                                clientContext: currentDoc?.clientName || "",
                                source: "chat_insertion",
                            }
                        );
                        if (success) {
                            log("✅ Document embedded in AnythingLLM workspace");
                        } else {
                            log("⚠️ Embedding completed with warnings (non-critical)");
                        }
                    } catch (embedError) {
                        // Log but don't throw - embedding is optional
                        log("⚠️ Embedding error (non-critical):", embedError);
                        console.warn("⚠️ Failed to embed document to AnythingLLM (this is non-critical):", embedError);
                    }
                })();
            }

            toast.success("✅ Content inserted into editor!");
        } catch (error) {
            log("Error inserting content:", error);
            toast.error("❌ Failed to insert content. Please try again.");
        }
    }, [currentDoc, currentAgentId, editorRef, log]);

    const handleSendMessage = useCallback(async (message: string, threadSlugParam?: string | null, attachments?: Array<{ name: string; mime: string; contentString: string; }>) => {
        const isDashboardMode = viewMode === "dashboard";

        if (!message.trim()) return;

        const now = Date.now();
        if (now - lastMessageSentTimeRef.current < MESSAGE_RATE_LIMIT) {
            log(`⏱️ Rate limit: Please wait before sending another message.`);
            toast.error("⏱️ Please wait a moment before sending another message.");
            return;
        }
        lastMessageSentTimeRef.current = now;

        if (currentRequestControllerRef.current) {
            log("🛑 Cancelling previous request to avoid rate limiting...");
            currentRequestControllerRef.current.abort();
        }

        const controller = new AbortController();
        currentRequestControllerRef.current = controller;

        setIsChatLoading(true);

        // Insert command detection
        if (!isDashboardMode && (message.toLowerCase().includes("insert into editor") || message.toLowerCase() === "insert" || message.toLowerCase().includes("add to editor"))) {
            log("📝 Insert command detected!", { message });
            setIsChatLoading(false);

            const lastAIMessage = [...chatMessages].reverse().find((msg) => msg.role === "assistant" && !msg.content.includes("✅ SOW has been inserted") && !msg.content.includes("Ready to insert"));

            if (lastAIMessage) {
                extractFinancialReasoning(lastAIMessage.content);

                // For brevity, use handleInsertContent to insert lastAIMessage content
                await handleInsertContent(lastAIMessage.content, []);
            }

            return;
        }

        setLastUserPrompt(message);

        const userMessage: ChatMessage = {
            id: `msg${Date.now()}`,
            role: "user",
            content: message,
            timestamp: Date.now(),
        };

        const newMessages = [...chatMessages, userMessage];
        setChatMessages(newMessages);

        try {
            // Simplified flow: call AnythingLLM API for a response
            const workspace = currentDoc?.workspaceSlug || getWorkspaceForAgent(currentAgentId || "");
            const threadSlug = threadSlugParam || currentDoc?.threadSlug || `temp-${Date.now()}`;
            
            // Validate required parameters
            if (!workspace) {
                log("❌ [Chat] No workspace available");
                toast.error("No workspace configured. Please ensure a workspace is set up.");
                setIsChatLoading(false);
                currentRequestControllerRef.current = null;
                return;
            }
            
            if (!threadSlug || threadSlug.startsWith("temp-")) {
                log("⚠️ [Chat] Using temporary thread slug - thread may not be persisted");
            }
            
            log("📤 [Chat] Sending message:", {
                workspace,
                threadSlug,
                messageLength: message.length,
                hasCurrentDoc: !!currentDoc,
            });
            
            // PHASE 2: Use streaming for real-time CoT display
            const assistantMessageId = `msg${Date.now()}-assistant`;
            setStreamingMessageId(assistantMessageId);
            setStreamingThinking(""); // Reset thinking content
            setStreamingContent(""); // Reset final content
            
            // Create placeholder assistant message
            const assistantMessage: ChatMessage = {
                id: assistantMessageId,
                role: "assistant",
                content: "", // Will be populated by streaming
                timestamp: Date.now(),
            };
            setChatMessages((prev) => [...prev, assistantMessage]);

            // PHASE 2: Stream parsing logic
            let accumulatedText = "";
            let thinkingContent = "";
            let finalContent = "";
            let hasReachedStructuredOutput = false;
            
            // Detection patterns for structured output (Stage B/C)
            const structuredMarkers = [
                /^Client:\s*\[/i, // "Client: [Client Name]"
                /\[PROJECT_OVERVIEW\]/i,
                /\[PROSE_FOR_SCOPE_\d+\]/i,
                /\[JSON_FOR_SCOPE_\d+\]/i,
                /\[INVESTMENT_OVERVIEW\]/i,
                /```json/i, // JSON code block
            ];

            try {
                await anythingLLM.streamChatWithThread(
                    workspace,
                    threadSlug,
                    message,
                    (chunk: string) => {
                        try {
                            // Parse SSE chunk
                            let data: any = null;
                            if (chunk.startsWith("data: ")) {
                                const jsonStr = chunk.slice(6).trim();
                                if (jsonStr === "[DONE]") return;
                                try {
                                    data = JSON.parse(jsonStr);
                                } catch (e) {
                                    // Not JSON, skip
                                    return;
                                }
                            } else {
                                try {
                                    data = JSON.parse(chunk);
                                } catch (e) {
                                    // Not JSON, skip
                                    return;
                                }
                            }

                            // Extract text from chunk
                            const chunkText = data?.textResponse || data?.text || data?.content || "";
                            if (!chunkText) return;

                            accumulatedText += chunkText;

                            // PHASE 2: Detect transition from thinking (Stage A) to structured output (Stage B/C)
                            if (!hasReachedStructuredOutput) {
                                // Check if we've hit a structured marker
                                const hasMarker = structuredMarkers.some((pattern) =>
                                    pattern.test(accumulatedText)
                                );

                                if (hasMarker) {
                                    // Split accumulated text at the marker
                                    let splitIndex = accumulatedText.length;
                                    for (const pattern of structuredMarkers) {
                                        const match = accumulatedText.match(pattern);
                                        if (match && match.index !== undefined) {
                                            splitIndex = Math.min(splitIndex, match.index);
                                        }
                                    }

                                    thinkingContent = accumulatedText.substring(0, splitIndex).trim();
                                    finalContent = accumulatedText.substring(splitIndex);
                                    hasReachedStructuredOutput = true;

                                    log("🎯 [PHASE 2] Transition detected: Thinking → Structured Output", {
                                        thinkingLength: thinkingContent.length,
                                        finalLength: finalContent.length,
                                    });

                                    // Update thinking accordion with final thinking content
                                    setStreamingThinking(thinkingContent);
                                } else {
                                    // Still in thinking phase - accumulate thinking content
                                    thinkingContent = accumulatedText;
                                    setStreamingThinking(thinkingContent);
                                }
                            } else {
                                // Already in structured output phase - accumulate final content
                                finalContent += chunkText;
                            }

                            // Update message content (combines thinking + final for display)
                            const displayContent = hasReachedStructuredOutput
                                ? thinkingContent + "\n\n" + finalContent
                                : thinkingContent;

                            setChatMessages((prev) =>
                                prev.map((msg) =>
                                    msg.id === assistantMessageId
                                        ? { ...msg, content: displayContent }
                                        : msg
                                )
                            );

                            // Update streaming content for final SOW assembly
                            if (hasReachedStructuredOutput) {
                                setStreamingContent(finalContent);
                            }
                        } catch (parseError) {
                            log("⚠️ [Stream] Parse error:", parseError);
                        }
                    },
                    "chat"
                );

                // Streaming complete
                log("✅ [PHASE 2] Streaming complete", {
                    totalLength: accumulatedText.length,
                    thinkingLength: thinkingContent.length,
                    finalLength: finalContent.length,
                    hasStructuredOutput: hasReachedStructuredOutput,
                });

                // Finalize message content
                const finalMessageContent = hasReachedStructuredOutput
                    ? thinkingContent + "\n\n" + finalContent
                    : thinkingContent || accumulatedText;

                setChatMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === assistantMessageId
                            ? { ...msg, content: finalMessageContent }
                            : msg
                    )
                );

                // Clear streaming state
                setStreamingMessageId(null);
                setStreamingThinking("");
                setStreamingContent("");

                // Use final content for auto-insert logic
                const responseContent = finalMessageContent;

                // Optionally auto-insert content from assistant message
                const hasMarker = responseContent && responseContent.includes("*** Insert into editor:");
                const hasJSON = responseContent && responseContent.includes("```json");
                
                if (!isDashboardMode && (hasMarker || hasJSON)) {
                    let contentToInsert = responseContent;
                
                if (hasMarker) {
                     contentToInsert = responseContent.replace(/\*\*\* Insert into editor:\s*/, '');
                }
                
                // Process content through conversion logic
                let filteredContent = contentToInsert;
                filteredContent = filteredContent.replace(/<thinking>([\s\S]*?)<\/thinking>/gi, "");
                filteredContent = filteredContent.replace(/<think>([\s\S]*?)<\/think>/gi, "");
                
                // Convert to TipTap JSON structure
                let convertedContent: any;
                let finalContent: any;
                
                const convertOptions: any = {
                    preserveFormatting: true,
                    extractPricing: true,
                };
                
                try {
                    convertedContent = convertMarkdownToNovelJSON(
                        filteredContent,
                        [],
                        convertOptions,
                    );
                    finalContent = convertedContent;
                } catch (error) {
                    console.error("Error converting content:", error);
                    finalContent = { type: "doc", content: [] };
                }
                
                // CRITICAL DIAGNOSTIC: Check content type before insertion
                console.log("🧩 [Automatic Insertion] Final Content Type Check:");
                console.log("FinalContent is object:", typeof finalContent === 'object' && finalContent !== null);
                console.log("FinalContent type attribute:", finalContent?.type);
                if (typeof finalContent === 'string' || !finalContent || finalContent.type !== 'doc') {
                    console.error("❌ CRITICAL INSERTION FAILURE: Final content is not a valid TipTap JSON object (type: 'doc'). Inserting raw string is blocked.");
                    toast.error("Insertion failed: Content conversion error.");
                    return; // Block insertion of invalid data
                }
                
                // [INJECT FIX HERE: Direct Editor Update]
                if (editorRef.current) {
                    if (editorRef.current.commands?.setContent) {
                        editorRef.current.commands.setContent(finalContent);
                    } else {
                        editorRef.current.insertContent(finalContent);
                    }
                    // Sync latestEditorJSON immediately after insertion
                    if (setLatestEditorJSON) {
                        setLatestEditorJSON(finalContent);
                    }
                    console.log("🔒 [Automatic Fix] Editor updated and state locked.");
                }
                // [END FIX]
                
                toast.success("✅ Content automatically inserted into SOW editor");
            }

            setIsChatLoading(false);
            currentRequestControllerRef.current = null;
        } catch (error) {
            log("Error sending message:", error);
            setIsChatLoading(false);
            currentRequestControllerRef.current = null;
        }
    }, [viewMode, currentDoc, currentAgentId, chatMessages, handleInsertContent, log]);

    // Effect: agent selection based on view context
    useEffect(() => {
        if (agents.length === 0) return;

        const determineAndSetAgent = async () => {
            let agentIdToUse: string | null = null;

            if (viewMode === "dashboard") {
                log("🎯 [Agent Selection] In DASHBOARD mode - agent managed by dashboard component");
                setCurrentAgentId(null);
            } else if (viewMode === "editor" && currentDoc?.id) {
                try {
                    const prefResponse = await fetch("/api/preferences/current_agent_id");
                    if (prefResponse.ok) {
                        const { value } = await prefResponse.json();
                        if (value && agents.find((a) => a.id === value)) {
                            agentIdToUse = value;
                            log(`🎯 [Agent Selection] Using saved agent preference: ${value}`);
                        }
                    }
                } catch (err) {
                    log("Failed to load agent preference:", err);
                }

                if (!agentIdToUse) {
                    const genArchitect = agents.find((a) => a.name === "GEN - The Architect" || a.id === "gen-the-architect");
                    agentIdToUse = genArchitect?.id || agents[0]?.id || null;
                    log(`🎯 [Agent Selection] In EDITOR mode - using default agent: ${agentIdToUse}`);
                }

                setCurrentAgentId(agentIdToUse);
            } else {
                log("🎯 [Agent Selection] No context yet - deferring agent selection");
                setCurrentAgentId(null);
            }
        };

        determineAndSetAgent();
    }, [agents, viewMode, currentDoc]);

    // Effect: persist current agent to preferences
    useEffect(() => {
        if (currentAgentId) {
            fetch("/api/preferences/current_agent_id", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ value: currentAgentId }),
            }).catch((err) => log("Failed to save agent preference:", err));
        }
    }, [currentAgentId]);

    // Effect: reactive chat context switching between Dashboard and Editor
    useEffect(() => {
        const switchContext = async () => {
            if (viewMode === "dashboard") {
                setChatMessages([]);
                setStreamingMessageId(null);
            } else if (viewMode === "editor") {
                const doc = currentDoc;
                if (doc?.threadSlug && !doc.threadSlug.startsWith("temp-") && doc.workspaceSlug) {
                    try {
                        log("💬 [Context Switch] Loading SOW chat history for thread:", doc.threadSlug);
                        const history = await anythingLLM.getThreadChats(doc.workspaceSlug, doc.threadSlug);
                        const messages: ChatMessage[] = (history || []).map((msg: any) => ({
                            id: `msg${Date.now()}-${Math.random()}`,
                            role: msg.role === "user" ? "user" : "assistant",
                            content: msg.content,
                            timestamp: Date.now(),
                        }));
                        // Guard: only set history if there are no local messages and no active streaming message
                        if (chatMessages.length === 0 && !streamingMessageId) {
                            setChatMessages(messages);
                        } else {
                            log("⚠️ [Context Switch] Skipping history load to avoid overwriting local messages.");
                        }
                    } catch (e) {
                        log("⚠️ Failed to load SOW chat history on context switch:", e);
                        setChatMessages([]);
                    }
                } else {
                    setChatMessages([]);
                }
            }
        };

        switchContext();
    }, [viewMode, currentDoc, documents]);

    return {
        agents,
        currentAgentId,
        setCurrentAgentId,
        chatMessages,
        isChatLoading,
        streamingMessageId,
        streamingThinking, // PHASE 2: Real CoT content for UI display
        streamingContent, // PHASE 2: Final SOW content (after structured output)
        lastUserPrompt,
        userPromptDiscount,
        setUserPromptDiscount,
        multiScopePricingData,
        setMultiScopePricingData,
        setChatMessages,
        handleCreateAgent,
        handleSelectAgent,
        handleUpdateAgent,
        handleDeleteAgent,
        handleInsertContent,
        handleSendMessage,
    };
}
