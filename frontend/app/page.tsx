"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import TailwindAdvancedEditor from "@/components/tailwind/advanced-editor";
import SidebarNav from "@/components/tailwind/sidebar-nav";
import WorkspaceChat from "@/components/tailwind/workspace-chat";
import { ResizableLayout } from "@/components/tailwind/resizable-layout";
import { DocumentStatusBar } from "@/components/tailwind/document-status-bar";
import OnboardingFlow from "@/components/tailwind/onboarding-flow";
import { EmptyStateWelcome } from "@/components/tailwind/empty-state-welcome";
import { toast } from "sonner";
import { defaultEditorContent } from "@/lib/content";
import { calculateTotalInvestment } from "@/lib/sow-utils";
import {
  extractPricingFromContent,
  exportToExcel,
  cleanSOWContent
} from "@/lib/export-utils";
import type { ArchitectSOW } from "@/lib/export-utils";
import { extractSOWStructuredJson } from "@/lib/export-utils";
import { anythingLLM } from "@/lib/anythingllm";
import { ROLES } from "@/lib/rateCard";
import { calculatePricingTable } from "@/lib/pricingCalculator";
import { THE_ARCHITECT_V6_PROMPT } from "@/lib/knowledge-base";
import { prepareSOWForNewPDF } from "@/lib/sow-pdf-utils";

// Dynamically import PDF components to avoid SSR issues
const SOWPdfExportWrapper = dynamic(
  () => import('@/components/sow/SOWPdfExportWrapper'),
  { ssr: false }
);


// 🎯 UTILITY: Extract client/company name from user prompt
const extractClientName = (prompt: string): string | null => {
  const patterns = [
    /\bfor\s+([A-Z][A-Za-z0-9&\s]+(?:Corp|Corporation|Inc|LLC|Ltd|Company|Co|Group|Agency|Services|Solutions|Technologies)?)/i,
    /\bclient:\s*([A-Z][A-Za-z0-9&\s]+)/i,
    /\b([A-Z][A-Za-z0-9&\s]+(?:Corp|Corporation|Inc|LLC|Ltd|Company|Co|Group))\s+(?:needs|wants|requires)/i,
    /\b([A-Z][A-Za-z0-9&\s]{2,30})\s+(?:integration|website|project|campaign|sow)/i,
  ];

  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match && match[1]) {
      let name = match[1].trim().replace(/\s+(integration|website|project|campaign|sow|needs|wants|requires)$/i, '');
      if (name.length > 2 && name.length < 50) return name;
    }
  }
  return null;
};

// 🎯 UTILITY: Extract budget and discount from user prompt
const extractBudgetAndDiscount = (prompt: string): { budget: number; discount: number } => {
  let budget = 0;
  let discount = 0;

  const budgetPatterns = [
    /firm\s*\$?\s*([\d\s,\.]+)\s*(k)?\s*aud/i,
    /(budget|target|total|investment)\s*(?:[:=]|is|of)?\s*(aud\s*)?\$?\s*([\d\s,\.]+)\s*(k)?\s*(aud)?\s*(\+\s*gst|incl\s*gst|ex\s*gst)?/i,
  ];

  for (const re of budgetPatterns) {
    const m = prompt.match(re);
    if (m) {
      const numGroup = (m[3] || m[2] || m[1] || '');
      let raw = String(numGroup).replace(/[\,\s]/g, '');
      let v = parseFloat(raw || '0');
      const kGroup = (m[4] || m[3] || m[2] || '');
      if (kGroup && /k/i.test(kGroup)) v = v * 1000;
      const gstStr = (m[6] || m[5] || '').toLowerCase();
      const inclGST = /incl\s*gst/.test(gstStr);
      if (!isNaN(v) && v > 0) {
        budget = inclGST ? v / 1.1 : v;
        break;
      }
    }
  }

  const discountPatterns = [
    /(\d+(?:\.\d+)?)\s*%\s*(?:goodwill\s+)?discount/i,
    /discount\s*(?:of\s+)?(\d+(?:\.\d+)?)\s*%/i,
    /(\d+(?:\.\d+)?)\s*%\s*off/i,
  ];

  for (const re of discountPatterns) {
    const m = prompt.match(re);
    if (m && m[1]) {
      discount = parseFloat(m[1]);
      break;
    }
  }
  return { budget, discount };
};

const extractPricingJSON = (content: string): { roles: any[]; discount?: number; multiScopeData?: any } | null => {
  const pricingJsonMatch = content.match(/\[PRICING[\/_]JSON\]\s*```json\s*([\s\S]*?)\s*```/i) || content.match(/```json\s*([\s\S]*?)\s*```/);
  if (pricingJsonMatch && pricingJsonMatch[1]) {
    try {
      const parsedJson = JSON.parse(pricingJsonMatch[1]);
      if (parsedJson.scopes && Array.isArray(parsedJson.scopes)) {
        const allRoles = parsedJson.scopes.flatMap((scope: any) => scope.role_allocation || []).map((role: any) => ({
          role: role.role,
          hours: role.hours || 0,
          rate: role.rate || 0,
          cost: role.cost || (role.hours * role.rate),
        }));
        return { roles: allRoles, discount: parsedJson.discount || 0, multiScopeData: { scopes: parsedJson.scopes, discount: parsedJson.discount || 0 } };
      }
      if (parsedJson.role_allocation && Array.isArray(parsedJson.role_allocation)) {
        const rolesWithHours = parsedJson.role_allocation.map((item: any) => ({
          role: item.role,
          hours: item.hours || 0,
          rate: item.rate || 0,
          cost: item.cost || (item.hours * item.rate),
        }));
        return { roles: rolesWithHours, discount: parsedJson.project_details?.discount_percentage || 0 };
      }
      if (parsedJson.suggestedRoles && Array.isArray(parsedJson.suggestedRoles)) {
        return { roles: parsedJson.suggestedRoles };
      }
    } catch (e) {
      console.warn('⚠️ Could not parse [PRICING_JSON] block:', e);
    }
  }
  return null;
};

// Add back the missing utility functions
const sanitizeEmptyTextNodes = (content: any[]): any[] => {
  return content.filter(node => {
    if (node.type === 'text' && (!node.text || node.text.trim() === '')) {
      return false;
    }
    if (node.content && Array.isArray(node.content)) {
      node.content = sanitizeEmptyTextNodes(node.content);
    }
    return true;
  });
};

const buildSuggestedRolesFromArchitectSOW = (structured: any) => {
  if (!structured || !Array.isArray(structured.scopeItems)) return [];
  const hoursByRole = new Map();
  for (const item of structured.scopeItems) {
    const roles = Array.isArray(item?.roles) ? item.roles : [];
    for (const r of roles) {
      const name = (r?.role || '').toString().trim();
      const hrs = Number(r?.hours) || 0;
      // 🔧 CRITICAL FIX: Filter out empty, placeholder, or invalid role names
      if (!name || name.length === 0 || name.toLowerCase() === 'select role' || name.toLowerCase() === 'select role...') continue;
      hoursByRole.set(name, (hoursByRole.get(name) || 0) + hrs);
    }
  }
  // Map to suggestedRoles shape and attach rate from ROLES where possible
  return Array.from(hoursByRole.entries())
    .filter(([role]) => { /* ... filtering logic ... */ })
    .map(([role, hours]) => {
      const match = ROLES.find(x => x.name === role);
      return { role, hours, description: '', rate: match?.rate || 0 };
    });
};

const convertMarkdownToNovelJSON = (markdown: string, pricingTables?: { roles: any[], discount: number, scopeName?: string, scopeDescription?: string }[]): any[] => {
  const lines = markdown.split('\n');
  const content: any[] = [];
  let tableIndex = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.trim() === '[editablePricingTable]') {
      // Replace placeholder with actual pricing table node
      if (pricingTables && pricingTables[tableIndex]) {
        const tableData = pricingTables[tableIndex];
        const rows = tableData.roles.map((role: any, idx: number) => ({
          id: `row-${idx}-${Date.now()}`,
          role: role.role || '',
          description: role.description || '',
          hours: role.hours || 0,
          rate: role.rate || 0
        }));
        
        content.push({
          type: 'editablePricingTable',
          attrs: {
            rows: rows,
            discount: tableData.discount || 0,
            scopeName: tableData.scopeName || '',
            scopeDescription: tableData.scopeDescription || ''
          }
        });
        tableIndex++;
      }
      continue;
    }
    
    if (line.startsWith('# ')) {
      content.push({
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: line.substring(2).trim() }]
      });
    } else if (line.startsWith('## ')) {
      content.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: line.substring(3).trim() }]
      });
    } else if (line.startsWith('### ')) {
      content.push({
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: line.substring(4).trim() }]
      });
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      content.push({
        type: 'bulletList',
        content: [{
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: line.substring(2).trim() }]
          }]
        }]
      });
    } else if (line.match(/^\d+\.\s/)) {
      content.push({
        type: 'orderedList',
        content: [{
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: line.substring(line.indexOf('.') + 2).trim() }]
          }]
        }]
      });
    } else if (line.trim() === '') {
      // Skip empty lines
      continue;
    } else {
      content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: line.trim() }]
      });
    }
  }
  
  return content;
};

// Add missing utility functions for handleInsertContent
const extractFinancialReasoning = (content: string): string | null => {
  const reasoningMatch = content.match(/\[FINANCIAL_REASONING\]([\s\S]*?)(?:\[|$)/i);
  if (reasoningMatch && reasoningMatch[1]) {
    const reasoning = reasoningMatch[1].trim();
    console.log('📊 [FINANCIAL_REASONING] Block Detected:');
    console.log('─────────────────────────────────────');
    console.log(reasoning);
    console.log('─────────────────────────────────────');
    return reasoning;
  }
  return null;
};

const scrubBracketTagsPreserveLinks = (txt: string) => {
  return txt.replace(/\[[^\]]+\]/g, (match, offset, str) => {
    const nextChar = str[(offset as number) + match.length];
    // If this is a markdown link like [text](...), keep it
    if (nextChar === '(') return match;
    // 🎯 CRITICAL: Preserve [editablePricingTable] and [pricing_table] placeholders
    const inner = match.slice(1, -1);
    if (/^editablePricingTable|pricing_table$/i.test(inner)) return match;
    // Remove only if inside is likely an internal tag (primarily uppercase, digits, spaces, and symbols)
    if (/^[A-Z0-9 _\-\/&]+$/.test(inner)) return '';
    return match;
  });
};

// ... (keep other utility functions like transformScopesToPDFFormat, sanitizeEmptyTextNodes, buildSuggestedRolesFromArchitectSOW, convertMarkdownToNovelJSON) ...
// The above utility functions are still needed for the editor's core functionality.

interface Document {
  id: string;
  title: string;
  content: any;
  folderId: string | null; // null means it's in "All Docs"
  workspaceSlug?: string;
  threadSlug?: string;
  syncedAt?: string;
  vertical?: 'property' | 'education' | 'finance' | 'healthcare' | 'retail' | 'hospitality' | 'professional-services' | 'technology' | 'other' | null;
  serviceLine?: 'crm-implementation' | 'marketing-automation' | 'revops-strategy' | 'managed-services' | 'consulting' | 'training' | 'other' | null;
}

interface Folder {
  id: string;
  name: string;
  workspaceId?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export default function Page() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [aiChatOpen, setAiChatOpen] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const streamingTimeoutRef = useRef<number | null>(null);
  const [lastUserPrompt, setLastUserPrompt] = useState<string>('');
  const [isGrandTotalVisible, setIsGrandTotalVisible] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const editorRef = useRef<any>(null);
  const [latestEditorJSON, setLatestEditorJSON] = useState<any | null>(null);
  const [structuredSow, setStructuredSow] = useState<ArchitectSOW | null>(null);
  const [multiScopePricingData, setMultiScopePricingData] = useState<any | null>(null);
  const [showNewPDFModal, setShowNewPDFModal] = useState(false);
  const [newPDFData, setNewPDFData] = useState<any>(null);

  // Fix hydration by setting mounted state
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load initial data for folders and documents from the server
  useEffect(() => {
    if (!mounted) return;
    const abortController = new AbortController();
    const loadData = async () => {
      try {
        const foldersResponse = await fetch('/api/folders', { signal: abortController.signal });
        const foldersData = await foldersResponse.json();
        setFolders(foldersData);

        const sowsResponse = await fetch('/api/sow/list', { signal: abortController.signal });
        const { sows } = await sowsResponse.json();
        const documentsFromDB = sows.map((sow: any) => ({
          id: sow.id,
          title: sow.title || 'Untitled SOW',
          content: sow.content ? (typeof sow.content === 'string' ? JSON.parse(sow.content) : sow.content) : defaultEditorContent,
          folderId: sow.folder_id,
          workspaceSlug: sow.workspace_slug,
          threadSlug: sow.thread_slug,
          syncedAt: sow.updated_at,
          vertical: sow.vertical,
          serviceLine: sow.service_line,
        }));
        setDocuments(documentsFromDB);
        
        if (foldersData.length === 0) {
            setShowOnboarding(true);
        }

        const urlParams = new URLSearchParams(window.location.search);
        const initialDocId = urlParams.get('docId');
        if (initialDocId) {
            setCurrentDocId(initialDocId);
        }

      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error('❌ Error loading data:', error);
        toast.error('Failed to load documents and folders');
      }
    };
    loadData();
    return () => abortController.abort();
  }, [mounted]);
  
  // Load chat history when the current document changes
  useEffect(() => {
    const doc = currentDocId ? documents.find(d => d.id === currentDocId) : null;
    if (doc?.threadSlug && !doc.threadSlug.startsWith('temp-')) {
      const loadChatHistory = async () => {
        try {
          const history = await anythingLLM.getThreadChats(doc.workspaceSlug || 'generate', doc.threadSlug);
          const messages: ChatMessage[] = (history || []).map((msg: any) => ({
            id: `msg-${Math.random()}`,
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content,
            timestamp: Date.now(),
          }));
          setChatMessages(messages);
        } catch (error) {
          console.error('❌ Failed to load chat history:', error);
          setChatMessages([]);
        }
      };
      loadChatHistory();
    } else {
      setChatMessages([]);
    }
  }, [currentDocId]);

  // Debounced auto-save for editor content changes
  useEffect(() => {
    if (!currentDocId || latestEditorJSON === null) return;
    const timer = setTimeout(async () => {
      try {
        const editorContent = editorRef.current?.getContent?.() || latestEditorJSON;
        if (!editorContent) return;
        const totalInvestment = calculateTotalInvestment(editorContent);
        await fetch(`/api/sow/${currentDocId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: editorContent, total_investment: totalInvestment }),
        });
      } catch (error) {
        console.error('❌ Error auto-saving SOW:', error);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [latestEditorJSON, currentDocId]);

  // Sync currentDocId with URL
  useEffect(() => {
    if (!mounted) return;
    const params = new URLSearchParams(window.location.search);
    if (currentDocId) {
      params.set('docId', currentDocId);
    } else {
      params.delete('docId');
    }
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  }, [currentDocId, mounted]);

  const currentDoc = documents.find(d => d.id === currentDocId);

  // FOLDER & DOCUMENT MANAGEMENT HANDLERS (CRUD)
  const handleNewFolder = async (name: string) => {
    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error('Failed to create folder');
      const newFolder = await response.json();
      setFolders(prev => [...prev, newFolder]);
      toast.success(`✅ Folder "${name}" created`);
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Failed to create folder');
    }
  };
  
  const handleRenameFolder = async (id: string, name: string) => {
    setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f));
    await fetch(`/api/folders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
  };

  const handleDeleteFolder = async (id: string) => {
    setFolders(prev => prev.filter(f => f.id !== id));
    setDocuments(prev => prev.filter(d => d.folderId !== id));
    if(documents.find(d => d.folderId === id)?.id === currentDocId) setCurrentDocId(null);
    await fetch(`/api/folders/${id}`, { method: 'DELETE' });
  };
  
  const handleNewDoc = async (folderId?: string) => {
    const tempId = `doc-${Date.now()}`;
    const newDoc: Document = { id: tempId, title: "New SOW", content: defaultEditorContent, folderId };
    setDocuments(prev => [...prev, newDoc]);
    setCurrentDocId(tempId);
    setChatMessages([]);

    try {
        const response = await fetch('/api/sow/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: "New SOW", content: defaultEditorContent, folder_id: folderId }),
        });
        const savedDoc = await response.json();

        // Create thread and embed in AnythingLLM
        const thread = await anythingLLM.createThread('generate');
        if (thread) {
            await fetch(`/api/sow/${savedDoc.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ threadSlug: thread.slug }),
            });
            await anythingLLM.embedSOWDocument('generate', "New SOW", JSON.stringify(defaultEditorContent), {});
        }

        // Replace tempId with real ID from database
        setDocuments(prev => prev.map(d => d.id === tempId ? { ...savedDoc, threadSlug: thread?.slug, content: defaultEditorContent } : d));
        setCurrentDocId(savedDoc.id);
        toast.success("✅ SOW created");
    } catch (error) {
        console.error('Error creating SOW:', error);
        toast.error('Failed to save SOW');
        setDocuments(prev => prev.filter(d => d.id !== tempId)); // Rollback UI change
        setCurrentDocId(null);
    }
  };

  const handleRenameDoc = async (id: string, title: string) => {
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, title } : d));
    await fetch(`/api/sow/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
  };

  const handleDeleteDoc = async (id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
    if (currentDocId === id) setCurrentDocId(null);
    await fetch(`/api/sow/${id}`, { method: 'DELETE' });
  };
  
  const handleSelectDoc = (id: string) => {
    setCurrentDocId(id);
  };

  const handleUpdateDocContent = (content: any) => {
    setLatestEditorJSON(content);
    if (currentDocId) {
      setDocuments(prev => prev.map(d => d.id === currentDocId ? { ...d, content } : d));
    }
  };

  const handleMoveSOW = async (documentId: string, fromFolderId: string | null, toFolderId: string | null) => {
    console.log(`📁 Moving document ${documentId} from folder ${fromFolderId} to ${toFolderId}`);
    
    // Update local state
    setDocuments(prev => prev.map(doc => 
      doc.id === documentId 
        ? { ...doc, folderId: toFolderId }
        : doc
    ));

    // Persist to database
    try {
      await fetch(`/api/sow/${documentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: toFolderId }),
      });
      console.log(`✅ Document ${documentId} moved successfully`);
    } catch (error) {
      console.error('❌ Failed to move document:', error);
      // Revert local state on error
      setDocuments(prev => prev.map(doc => 
        doc.id === documentId 
          ? { ...doc, folderId: fromFolderId }
          : doc
      ));
    }
  };
  
  // AI CHAT & CONTENT INSERTION
  const handleInsertContent = async (content: string, suggestedRoles: any[] = []) => {
    console.log('📝 Inserting content into editor:', content.substring(0, 100));
    console.log('📝 Editor ref exists:', !!editorRef.current);
    console.log('📄 Current doc ID:', currentDocId);

    // 🎯 Extract and log [FINANCIAL_REASONING] block for transparency
    extractFinancialReasoning(content);

    if (!editorRef.current) {
      console.error("Editor not initialized, cannot insert content.");
      return;
    }

    if (!content || !currentDocId) {
      console.error('❌ Missing content or document ID');
      return;
    }

    try {
      // EXTRA SANITIZATION: Defensive remove of any thinking/tool tags that may have slipped
      if (content && typeof content === 'string') {
        content = content
          .replace(/<AI_THINK>[\s\S]*?<\/AI_THINK>/gi, '')
          .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
          .replace(/<think>[\s\S]*?<\/think>/gi, '')
          .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
          .replace(/<\/?think>/gi, '')
          .replace(/<\/?thinking>/gi, '')
          .replace(/<\/?AI_THINK>/gi, '')
          .replace(/<!--[\s\S]*?-->/gi, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      }
      // 🧹 Filter out internal reasoning sections before processing
      let filteredContent = content;

      // Remove known internal sections (keep narrative clean)
      filteredContent = filteredContent.replace(/\[FINANCIAL[\*_\s-]*REASONING[\*_\s-]*\][\s\S]*?(?=\n\s*\[|\n\s*##|\n\s*###|$)/gi, '');
      filteredContent = filteredContent.replace(/\[BUDGET[\*_\s-]*NOTE[\*_\s-]*\][\s\S]*?(?=\n\s*\[|\n\s*##|\n\s*###|$)/gi, '');
      filteredContent = filteredContent.replace(/\[GENERATE\s+THE\s+SOW\]/gi, '');

      // 🧠 Strip <think> tags (AI reasoning blocks)
      filteredContent = filteredContent.replace(/<think>[\s\S]*?<\/think>/gi, '');
      console.log('🧹 Stripped <think> tags from content');

      // 1) Extract ALL JSON code blocks and build per-table roles queue.
      //    Replace each JSON block with a [editablePricingTable] placeholder to preserve placement.
      let markdownPart = filteredContent;
      const tablesRolesQueue: any[][] = [];
      const tablesDiscountsQueue: number[] = [];
      let parsedStructured: ArchitectSOW | null = null;
      let hasValidSuggestedRoles = false;
      let extractedDiscount: number | undefined;

      const jsonBlocks = Array.from(filteredContent.matchAll(/```json\s*([\s\S]*?)\s*```/gi));
      console.log(`🔍 [JSON Extraction] Found ${jsonBlocks.length} JSON blocks in content`);
      if (jsonBlocks.length > 0) {
        // Rebuild markdown by replacing only qualifying pricing JSON blocks with placeholders
        let rebuilt = '';
        let lastIndex = 0;
        for (const m of jsonBlocks) {
          const full = m[0];
          const body = m[1];
          const start = m.index || 0;
          const end = start + full.length;

          // 🎯 CRITICAL FIX: Check if [PRICING_JSON] tag appears before this JSON block
          // If so, remove it along with the JSON block to prevent raw text from appearing in SOW
          let textBeforeBlock = filteredContent.slice(lastIndex, start);
          const pricingJsonTagMatch = textBeforeBlock.match(/\[PRICING[\/_]JSON\]\s*$/i);
          if (pricingJsonTagMatch) {
            // Remove the [PRICING_JSON] tag from the text before the block
            textBeforeBlock = textBeforeBlock.slice(0, -pricingJsonTagMatch[0].length);
            console.log('🧹 Removed [PRICING_JSON] tag before JSON block');
          }

          // Append text before this block (with [PRICING_JSON] tag removed if present)
          rebuilt += textBeforeBlock;
          lastIndex = end;
          try {
            // 🎯 DATA INTEGRITY: Parse JSON directly - throw error if invalid
            const obj = JSON.parse(body);
            console.log('📦 [JSON Block] Parsed object:', {
              hasRoles: Array.isArray(obj?.roles),
              hasSuggestedRoles: Array.isArray(obj?.suggestedRoles),
              hasScopeItems: Array.isArray(obj?.scopeItems),
              hasRoleAllocation: Array.isArray(obj?.role_allocation),
              rolesLength: obj?.roles?.length,
              suggestedRolesLength: obj?.suggestedRoles?.length,
              scopeItemsLength: obj?.scopeItems?.length,
              roleAllocationLength: obj?.role_allocation?.length,
              keys: Object.keys(obj)
            });
            let rolesArr: any[] = [];
            let discountVal: number | undefined = undefined;

            // Check for role_allocation (new [PRICING_JSON] format)
            if (Array.isArray(obj?.role_allocation)) {
              rolesArr = obj.role_allocation;
              console.log(`✅ Using ${rolesArr.length} roles from obj.role_allocation ([PRICING_JSON] format)`);
            } else if (Array.isArray(obj?.roles)) {
              rolesArr = obj.roles;
              console.log(`✅ Using ${rolesArr.length} roles from obj.roles`);
            } else if (Array.isArray(obj?.suggestedRoles)) {
              rolesArr = obj.suggestedRoles;
              console.log(`✅ Using ${rolesArr.length} roles from obj.suggestedRoles`);
            } else if (Array.isArray(obj?.scopeItems)) {
              const derived = buildSuggestedRolesFromArchitectSOW(obj as ArchitectSOW);
              rolesArr = derived;
              console.log(`✅ Derived ${rolesArr.length} roles from obj.scopeItems`);
            } else {
              console.warn('⚠️ JSON block has no roles, suggestedRoles, scopeItems, or role_allocation arrays');
            }

            // Check for discount in various formats
            if (typeof obj?.discount === 'number') {
              discountVal = obj.discount;
            } else if (typeof obj?.discount_percentage === 'number') {
              discountVal = obj.discount_percentage;
            } else if (typeof obj?.project_details?.discount_percentage === 'number') {
              discountVal = obj.project_details.discount_percentage;
            }
            if (rolesArr.length > 0) {
              console.log(`✅ Adding ${rolesArr.length} roles to queue`);
              tablesRolesQueue.push(rolesArr);
              tablesDiscountsQueue.push(discountVal ?? 0);
              // Insert placeholder where the JSON block was
              rebuilt += '\n[editablePricingTable]\n';
            } else {
              // Not a pricing JSON; keep original content
              console.warn(`⚠️ JSON block found but rolesArr is empty - keeping original JSON in content`);
              rebuilt += full;
            }
          } catch (e) {
            // Not valid JSON; keep original content
            console.error('❌ Failed to parse JSON block:', e);
            rebuilt += full;
          }
        }
        // Append the rest
        rebuilt += filteredContent.slice(lastIndex);
        markdownPart = rebuilt.trim();
        hasValidSuggestedRoles = tablesRolesQueue.length > 0;
        if (hasValidSuggestedRoles) {
          console.log(`✅ Detected ${tablesRolesQueue.length} pricing JSON block(s); will insert same number of pricing tables.`);
        }
      } else {
        // Backward compatibility: single-block helpers
        const single = extractPricingJSON(filteredContent);
        if (single && single.roles && single.roles.length > 0) {
          suggestedRoles = single.roles;
          extractedDiscount = single.discount;
          hasValidSuggestedRoles = true;
          // 🎯 CRITICAL FIX: Remove both [PRICING_JSON] tag AND the JSON block
          let cleanedContent = filteredContent;
          // First remove the [PRICING_JSON] tag and the JSON block together
          cleanedContent = cleanedContent.replace(/\[PRICING[\/_]JSON\]\s*```json\s*[\s\S]*?\s*```/gi, '');
          // Fallback: if the above didn't match, try removing just the JSON block
          if (cleanedContent === filteredContent) {
            const jm = filteredContent.match(/```json\s*[\s\S]*?\s*```/i);
            if (jm) cleanedContent = filteredContent.replace(jm[0], '');
          }
          markdownPart = cleanedContent.trim();
          console.log(`✅ Using ${suggestedRoles.length} roles from [PRICING_JSON] (single-block)`);

          // 🎯 V4.1 Multi-Scope Data Storage
          if (single.multiScopeData && single.multiScopeData.scopes) {
            console.log(`✅ Storing V4.1 multi-scope data: ${single.multiScopeData.scopes.length} scopes`);
            setMultiScopePricingData({
              ...single.multiScopeData,
              extractedAt: Date.now()
            });
          }
        } else {
          // Legacy: attempt to parse first JSON block for roles/scopeItems
          const legacyMatch = filteredContent.match(/```json\s*([\s\S]*?)\s*```/);
          if (legacyMatch && legacyMatch[1]) {
            try {
              const parsedJson = JSON.parse(legacyMatch[1]);
              if (parsedJson.suggestedRoles) {
                suggestedRoles = [...suggestedRoles, ...parsedJson.suggestedRoles];
                // 🎯 CRITICAL FIX: Remove both [PRICING_JSON] tag AND the JSON block
                let cleanedContent = filteredContent.replace(/\[PRICING[\/_]JSON\]\s*```json\s*[\s\S]*?\s*```/gi, '');
                if (cleanedContent === filteredContent) {
                  cleanedContent = filteredContent.replace(legacyMatch[0], '');
                }
                markdownPart = cleanedContent.trim();
                hasValidSuggestedRoles = suggestedRoles.length > 0;
                console.log(`✅ Parsed ${suggestedRoles.length} suggested roles from legacy JSON.`);
              } else if (parsedJson.scopeItems) {
                parsedStructured = parsedJson as ArchitectSOW;
                const derived = buildSuggestedRolesFromArchitectSOW(parsedStructured);
                if (derived.length > 0) {
                  suggestedRoles = derived;
                  // 🎯 CRITICAL FIX: Remove both [PRICING_JSON] tag AND the JSON block
                  let cleanedContent = filteredContent.replace(/\[PRICING[\/_]JSON\]\s*```json\s*[\s\S]*?\s*```/gi, '');
                  if (cleanedContent === filteredContent) {
                    cleanedContent = filteredContent.replace(legacyMatch[0], '');
                  }
                  markdownPart = cleanedContent.trim();
                  hasValidSuggestedRoles = true;
                }
              }
            } catch (e) {
              console.warn('⚠️ Could not parse legacy JSON block:', e);
            }
          }
        }
      }

      // Final scrubbing pass
      markdownPart = scrubBracketTagsPreserveLinks(markdownPart)
        // Also directly strip explicit known tags variants
        .replace(/\[(?:PRICING[\/_ ]?JSON|ANALYZE(?:\s*&\s*CLASSIFY)?|FINANCIAL[_\s-]*REASONING|BUDGET[_\s-]*NOTE)\]/gi, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      // Build pricing tables data for conversion
      const pricingTables = tablesRolesQueue.map((roles, index) => ({
        roles: roles,
        discount: tablesDiscountsQueue[index] || 0,
        scopeName: '',
        scopeDescription: ''
      }));

      // Convert markdown to Novel JSON format
      const convertedContent = convertMarkdownToNovelJSON(markdownPart, pricingTables);

      // Sanitize empty text nodes
      let finalContent = {
        type: 'doc',
        content: sanitizeEmptyTextNodes(convertedContent)
      };

      // Insert into editor
      editorRef.current.insertContent(finalContent);
      console.log('✅ Editor content updated successfully');

      // Update document state
      handleUpdateDocContent(finalContent);
      toast.success("Content inserted into editor!");
    } catch (error) {
      console.error('❌ Error inserting content:', error);
      toast.error('Failed to insert content into editor');
    }
  };

  const [currentRequestController, setCurrentRequestController] = useState<AbortController | null>(null);

  const handleSendMessage = async (message: string, providedThreadSlug?: string, attachments?: any[]) => {
    if (!message.trim()) return;

    if (currentRequestController) {
      currentRequestController.abort();
    }
    const controller = new AbortController();
    setCurrentRequestController(controller);

    setIsChatLoading(true);
    setLastUserPrompt(message);

    const userMessage: ChatMessage = { id: `msg-${Date.now()}`, role: 'user', content: message, timestamp: Date.now() };
    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);

    try {
        const workspaceSlug = 'generate';
        const streamEndpoint = '/api/anythingllm/stream-chat';
        const aiMessageId = `msg-${Date.now() + 1}`;
        let accumulatedContent = '';
        
        const initialAIMessage: ChatMessage = { id: aiMessageId, role: 'assistant', content: '', timestamp: Date.now() };
        setChatMessages(prev => [...prev, initialAIMessage]);
        setStreamingMessageId(aiMessageId);

        let threadSlugToUse = providedThreadSlug || currentDoc?.threadSlug;

        if (!threadSlugToUse) {
          console.log('🆕 No thread exists - creating one automatically before sending message');
          try {
            const newThread = await anythingLLM.createThread('generate');
            if (!newThread || !newThread.slug) {
              throw new Error("Failed to create a new thread in AnythingLLM.");
            }
            
            threadSlugToUse = newThread.slug;
            console.log(`✅ Automatically created and saved new thread: ${threadSlugToUse}`);

            // CRITICAL: Save the new thread slug to the document state
            setDocuments(prev => prev.map(doc => 
              doc.id === currentDocId ? { ...doc, threadSlug: threadSlugToUse } : doc
            ));

            // CRITICAL: Persist the new thread slug to the database
            await fetch(`/api/sow/${currentDocId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ threadSlug: threadSlugToUse }),
            });

          } catch (error) {
            console.error("❌ Failed to create chat thread:", error);
            toast.error("Failed to create chat thread. Please check the connection and try again.");
            // Stop execution if thread creation fails
            setIsChatLoading(false);
            return;
          }
        }

        const response = await fetch(streamEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
                workspace: workspaceSlug,
                threadSlug: threadSlugToUse,
                messages: [{ role: "system", content: THE_ARCHITECT_V6_PROMPT }, ...newMessages.map(m => ({ role: m.role, content: m.content }))]
            }),
        });

        if (!response.ok || !response.body) throw new Error("Failed to get streaming response.");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const jsonStr = line.substring(6);
                        const data = JSON.parse(jsonStr);
                        if (data.type === 'textResponseChunk' && data.textResponse) {
                            accumulatedContent += data.textResponse;
                            setChatMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, content: accumulatedContent } : msg));
                        }
                    } catch {}
                }
            }
        }
        
        // After stream is complete, trigger automatic insertion
        if (currentDocId) {
            handleInsertContent(accumulatedContent);
            toast.success("✅ Content automatically inserted into editor!");
        }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error("❌ Chat API error:", error);
      toast.error("Error communicating with AI.");
      setChatMessages(prev => [...prev, {id: `err-${Date.now()}`, role: 'assistant', content: 'Sorry, an error occurred.', timestamp: Date.now()}]);
    } finally {
      setIsChatLoading(false);
      setStreamingMessageId(null);
      setCurrentRequestController(null);
    }
  };

  // EXPORT HANDLERS
  const handleExportPDF = async () => { /* ... Keep your existing PDF export logic ... */ };
  const handleExportNewPDF = async () => { /* ... Keep your existing professional PDF export logic ... */ };
  const handleExportExcel = async () => { /* ... Keep your existing Excel export logic ... */ };

  if (!mounted) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-[#0e0f0f]">
      <div className="flex-1 h-full overflow-hidden">
        <ResizableLayout
          sidebarOpen={sidebarOpen}
          aiChatOpen={aiChatOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onToggleAiChat={() => setAiChatOpen(!aiChatOpen)}
          leftPanel={
            <SidebarNav
              folders={folders}
              documents={documents}
              currentFolderId={currentWorkspaceId}
              currentDocumentId={currentDocId}
              onSelectFolder={setCurrentWorkspaceId}
              onSelectDocument={handleSelectDoc}
              onCreateFolder={handleNewFolder}
              onRenameFolder={handleRenameFolder}
              onRenameWorkspace={handleRenameFolder}
              onDeleteFolder={handleDeleteFolder}
              onCreateDocument={handleNewDoc}
              onRenameDocument={handleRenameDoc}
              onRenameSOW={handleRenameDoc}
              onDeleteDocument={handleDeleteDoc}
              onMoveDocument={handleMoveSOW}
            />
          }
          mainPanel={
            <div className="w-full h-full flex flex-col">
              {currentDoc ? (
                <>
                  <DocumentStatusBar
                    title={currentDoc.title || "Untitled SOW"}
                    saveStatus="saved" // Simplified
                    isSaving={false}
                    isGrandTotalVisible={isGrandTotalVisible}
                    onToggleGrandTotal={() => setIsGrandTotalVisible(!isGrandTotalVisible)}
                    onExportPDF={handleExportPDF}
                    onExportNewPDF={handleExportNewPDF}
                    onExportExcel={handleExportExcel}
                  />
                  <div className="flex-1 overflow-auto">
                    <TailwindAdvancedEditor
                      key={currentDoc.id}
                      ref={editorRef}
                      initialContent={currentDoc.content}
                      onUpdate={handleUpdateDocContent}
                    />
                  </div>
                </>
              ) : (
                <EmptyStateWelcome
                  onCreateNewSOW={() => handleNewDoc()}
                  isLoading={false}
                />
              )}
            </div>
          }
          rightPanel={currentDoc ? (
            <WorkspaceChat
              key={currentDoc.id}
              isOpen={aiChatOpen}
              onToggle={() => setAiChatOpen(!aiChatOpen)}
              chatMessages={chatMessages}
              onSendMessage={handleSendMessage}
              isLoading={isChatLoading}
              onInsertToEditor={handleInsertContent}
              streamingMessageId={streamingMessageId}
              editorWorkspaceSlug={currentDoc?.workspaceSlug || ''}
              editorThreadSlug={currentDoc?.threadSlug || null}
              onEditorThreadChange={async (slug) => {
                if (!currentDocId) return;
                // Update document state
                setDocuments(prev => prev.map(d => d.id === currentDocId ? { ...d, threadSlug: slug || undefined } : d));
                // Persist to DB
                try {
                  await fetch(`/api/sow/${currentDocId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ threadSlug: slug }),
                  });
                } catch (e) {
                  console.warn('⚠️ Failed to persist threadSlug change:', e);
                }
                // Load thread history into chat panel when a thread is selected (or clear when null)
                try {
                  if (slug && currentDoc?.workspaceSlug) {
                    const history = await anythingLLM.getThreadChats(currentDoc.workspaceSlug, slug);
                    const messages: ChatMessage[] = (history || []).map((msg: any) => ({
                      id: `msg${Date.now()}-${Math.random()}`,
                      role: msg.role === 'user' ? 'user' : 'assistant',
                      content: msg.content || '',
                      timestamp: Date.now(),
                    }));
                    setChatMessages(messages);
                  } else {
                    setChatMessages([]);
                  }
                } catch (err) {
                  console.warn('⚠️ Failed to load thread history:', err);
                  setChatMessages([]);
                }
              }}
              onClearChat={() => {
                console.log('🧹 Clearing chat messages for new thread');
                setChatMessages([]);
              }}
              onReplaceChatMessages={(msgs) => {
                console.log('🔁 Replacing chat messages from thread history:', msgs.length);
                setChatMessages(msgs);
              }}
            />
          ) : null}
          leftMinSize={15} mainMinSize={30} rightMinSize={20}
          leftDefaultSize={20} mainDefaultSize={55} rightDefaultSize={25}
        />
      </div>

      {showNewPDFModal && newPDFData && (
        // ... (Keep your Professional PDF Download Modal JSX) ...
        <div/>
      )}
      
      <OnboardingFlow
        isOpen={showOnboarding}
        onComplete={() => setShowOnboarding(false)}
        onCreateWorkspace={handleNewFolder}
        workspaceCount={folders.length}
      />
    </div>
  );
}