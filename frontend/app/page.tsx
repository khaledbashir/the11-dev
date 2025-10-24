"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from 'next/navigation';
import TailwindAdvancedEditor from "@/components/tailwind/advanced-editor";
import SidebarNav from "@/components/tailwind/sidebar-nav";
import AgentSidebar from "@/components/tailwind/agent-sidebar-clean";
import PricingTableBuilder from "@/components/tailwind/pricing-table-builder";
import Menu from "@/components/tailwind/ui/menu";
import { Button } from "@/components/tailwind/ui/button";
import { SendToClientModal } from "@/components/tailwind/send-to-client-modal";
import { ShareLinkModal } from "@/components/tailwind/share-link-modal";
import { ResizableLayout } from "@/components/tailwind/resizable-layout";
import { DocumentStatusBar } from "@/components/tailwind/document-status-bar";
import WorkspaceCreationProgress from "@/components/tailwind/workspace-creation-progress";
import OnboardingFlow from "@/components/tailwind/onboarding-flow";

import { toast } from "sonner";
import { Sparkles, Info, ExternalLink, Send } from "lucide-react";
import { defaultEditorContent } from "@/lib/content";
import { THE_ARCHITECT_SYSTEM_PROMPT } from "@/lib/knowledge-base";
import { InteractiveOnboarding } from "@/components/tailwind/interactive-onboarding";
import { GuidedClientSetup } from "@/components/tailwind/guided-client-setup";
import { EnhancedDashboard } from "@/components/tailwind/enhanced-dashboard";
import { StatefulDashboardChat } from "@/components/tailwind/stateful-dashboard-chat";
import GardnerStudio from "@/components/gardners/GardnerStudio";
import { KnowledgeBase } from "@/components/tailwind/knowledge-base";
import { FloatingDocumentActions } from "@/components/tailwind/document-toolbar";
import { calculateTotalInvestment } from "@/lib/sow-utils";
import { 
  extractPricingFromContent, 
  exportToExcel, 
  exportToPDF,
  parseSOWMarkdown,
  cleanSOWContent
} from "@/lib/export-utils";
import type { ArchitectSOW } from "@/lib/export-utils";
import { extractSOWStructuredJson } from "@/lib/export-utils";
import { anythingLLM } from "@/lib/anythingllm";
import { ROLES } from "@/components/tailwind/extensions/editable-pricing-table";
import { getWorkspaceForAgent } from "@/lib/workspace-config";

// API key is now handled server-side in /api/chat route

// 🎯 UTILITY: Extract client/company name from user prompt
const extractClientName = (prompt: string): string | null => {
  // Common patterns for client mentions:
  // "for ABC Company", "for Company XYZ", "client: ABC Corp", "ABC Corp needs", etc.
  const patterns = [
    /\bfor\s+([A-Z][A-Za-z0-9&\s]+(?:Corp|Corporation|Inc|LLC|Ltd|Company|Co|Group|Agency|Services|Solutions|Technologies)?)/i,
    /\bclient:\s*([A-Z][A-Za-z0-9&\s]+)/i,
    /\b([A-Z][A-Za-z0-9&\s]+(?:Corp|Corporation|Inc|LLC|Ltd|Company|Co|Group))\s+(?:needs|wants|requires)/i,
    /\b([A-Z][A-Za-z0-9&\s]{2,30})\s+(?:integration|website|project|campaign|sow)/i,
  ];

  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match && match[1]) {
      // Clean up the match
      let name = match[1].trim();
      // Remove trailing words that aren't part of company name
      name = name.replace(/\s+(integration|website|project|campaign|sow|needs|wants|requires)$/i, '');
      if (name.length > 2 && name.length < 50) {
        return name;
      }
    }
  }
  
  return null;
};

// Helper function to convert markdown to Novel editor JSON format
// Extract pricing roles from markdown table format

// 🧹 SANITIZATION: Remove empty text nodes recursively from TipTap JSON
const sanitizeEmptyTextNodes = (content: any): any => {
  if (!content) return content;
  
  if (Array.isArray(content)) {
    // Filter out text nodes with empty text
    return content
      .filter(node => {
        // Remove text nodes where text is empty or whitespace-only
        if (node.type === 'text' && (!node.text || node.text.trim() === '')) {
          return false;
        }
        return true;
      })
      .map(node => {
        // Recursively sanitize nested content
        if (node.content && Array.isArray(node.content)) {
          return { ...node, content: sanitizeEmptyTextNodes(node.content) };
        }
        return node;
      });
  }
  
  return content;
};

type ConvertOptions = { strictRoles?: boolean };

const convertMarkdownToNovelJSON = (markdown: string, suggestedRoles: any[] = [], options: ConvertOptions = {}) => {
  const lines = markdown.split('\n');
  const content: any[] = [];
  let i = 0;
  let pricingTableInserted = false;
  const strictRoles = !!options.strictRoles;

  const parseTextWithFormatting = (text: string) => {
    // This function handles bold/italic without creating empty text nodes
    const parts: any[] = [];
    let currentText = '';
    let isBold = false;
    let isItalic = false;
    
    for (let i = 0; i < text.length; i++) {
      if (text.substring(i, i + 2) === '**') {
        if (currentText) {
          const marks = [];
          if (isBold) marks.push({ type: 'bold' });
          if (isItalic) marks.push({ type: 'italic' });
          parts.push({ 
            type: 'text', 
            text: currentText, 
            marks: marks.length > 0 ? marks : undefined 
          });
          currentText = '';
        }
        isBold = !isBold;
        i++;
      } else if (text[i] === '*' || text[i] === '_') {
        if (currentText) {
          const marks = [];
          if (isBold) marks.push({ type: 'bold' });
          if (isItalic) marks.push({ type: 'italic' });
          parts.push({ 
            type: 'text', 
            text: currentText, 
            marks: marks.length > 0 ? marks : undefined 
          });
          currentText = '';
        }
        isItalic = !isItalic;
      } else {
        currentText += text[i];
      }
    }
    
    if (currentText) {
      const marks = [];
      if (isBold) marks.push({ type: 'bold' });
      if (isItalic) marks.push({ type: 'italic' });
      parts.push({ 
        type: 'text', 
        text: currentText, 
        marks: marks.length > 0 ? marks : undefined 
      });
    }
    
    // Never return empty parts - if text is empty, return one node with that empty text
    // (TipTap requires at least one node, but it will be handled by parent)
    return parts.length > 0 ? parts : [];
  };

  // Helper function to check if a line is a markdown table row
  const isMarkdownTableRow = (line: string): boolean => {
    return /^\s*\|.*\|\s*$/.test(line.trim());
  };

  // Helper function to parse markdown table rows into pricing rows
  const parseMarkdownTable = (tableLines: string[]): any[] => {
    if (tableLines.length < 2) return [];
    
    const rows: any[] = [];
    
    // Skip alignment row (usually the second row)
    let dataStartIndex = 1;
    if (tableLines[1] && /^\s*\|[\s|:=-]+\|\s*$/.test(tableLines[1])) {
      dataStartIndex = 2;
    }
    
    // Parse each data row
    for (let idx = dataStartIndex; idx < tableLines.length; idx++) {
      const line = tableLines[idx];
      if (!isMarkdownTableRow(line)) break;
      
      const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell.length > 0);
      
      // Expected format: Role | Description | Hours | Rate
      if (cells.length >= 4) {
        const role = cells[0];
        const description = cells[1];
        const hours = parseInt(cells[2]) || 0;
        const rate = parseInt(cells[3]) || 0;
        
        if (role.toLowerCase() !== 'role') { // Skip header
          rows.push({
            role,
            description,
            hours,
            rate,
          });
        }
      }
    }
    
    return rows;
  };

  // Helper function to insert pricing table
  const buildDefaultCoreZeroHours = () => {
    // Minimal safe default rows using core roles with hours=0 and known rates
    const find = (name: string) => ROLES.find(r => r.name === name);
    const head = find('Tech - Head Of - Senior Project Management');
    const pc = find('Project Coordination');
    const am = find('Account Management');
    return [
      { role: head?.name || 'Tech - Head Of - Senior Project Management', description: 'Strategic oversight', hours: 0, rate: head?.rate || 365 },
      { role: pc?.name || 'Project Coordination', description: 'Delivery coordination', hours: 0, rate: pc?.rate || 140 },
      { role: am?.name || 'Account Management', description: 'Client comms & governance', hours: 0, rate: am?.rate || 150 },
    ];
  };

  const insertPricingTable = (rolesFromMarkdown: any[] = []) => {
    if (pricingTableInserted) return;
    
    let pricingRows: any[] = [];
    
    // Use provided suggestedRoles first, else choose strategy based on strictRoles
    if (suggestedRoles.length > 0) {
      console.log('✅ Using suggestedRoles from JSON.');
      pricingRows = suggestedRoles.map(role => {
        const matchedRole = ROLES.find(r => r.name === role.role);
        return {
          role: role.role,
          description: role.description || '',
          hours: role.hours || 0,
          rate: matchedRole?.rate || role.rate || 0,
        };
      });
    } else if (strictRoles) {
      console.log('✅ SAFE FALLBACK ACTIVATED: Inserting default pricing table with zero hours.');
      pricingRows = buildDefaultCoreZeroHours();
    } else if (rolesFromMarkdown.length > 0) {
      console.log('✅ Using roles parsed from markdown table.');
      pricingRows = rolesFromMarkdown;
    } else {
      console.log('⚠️ No roles available for pricing table.');
      return; // Can't create pricing table without any roles
    }
    
    pricingTableInserted = true;
    
    // ENFORCEMENT 1: Ensure Head Of role exists as FIRST row
    const normalize = (s: string) => (s || '').trim().toLowerCase();
    const hasHeadOf = pricingRows.some(r => normalize(r.role).includes('head of'));
    if (!hasHeadOf) {
      const headOf = ROLES.find(r => r.name === 'Tech - Head Of - Senior Project Management');
      pricingRows.unshift({
        role: headOf?.name || 'Tech - Head Of - Senior Project Management',
        description: 'Strategic oversight',
        hours: 3,
        rate: headOf?.rate || 365,
      });
    }

    // ENFORCEMENT 2: Ensure Project Coordination exists
    const hasProjectCoord = pricingRows.some(r => normalize(r.role).includes('project coordination'));
    if (!hasProjectCoord) {
      const pc = ROLES.find(r => r.name === 'Project Coordination');
      pricingRows.splice(1, 0, {
        role: pc?.name || 'Project Coordination',
        description: 'Delivery coordination',
        hours: 6,
        rate: pc?.rate || 140,
      });
    }

    // ENFORCEMENT 3: Ensure Account Management role exists and is LAST
    const hasAccountManagement = pricingRows.some(r => normalize(r.role).includes('account management'));
    if (!hasAccountManagement) {
      const am = ROLES.find(r => r.name === 'Account Management');
      pricingRows.push({
        role: am?.name || 'Account Management',
        description: 'Client comms & governance',
        hours: 8,
        rate: am?.rate || 150,
      });
    } else {
      // Move Account Management to the end
      const amIndex = pricingRows.findIndex(r => normalize(r.role).includes('account management'));
      if (amIndex !== -1 && amIndex !== pricingRows.length - 1) {
        const [amRow] = pricingRows.splice(amIndex, 1);
        pricingRows.push(amRow);
      }
    }

    console.log('✅ Inserting EditablePricingTable with', pricingRows.length, 'roles.');
    content.push({
      type: 'editablePricingTable',
      attrs: {
        rows: pricingRows,
        discount: 0,
      },
    });
  };

  while (i < lines.length) {
    const line = lines[i];

    // Check for explicit pricing table placeholder
    if (line.trim() === '[pricing_table]') {
      insertPricingTable();
      i++;
      continue;
    }

    // Check if this is the start of a markdown table
    if (isMarkdownTableRow(line)) {
      const tableLines = [];
      while (i < lines.length && (isMarkdownTableRow(lines[i]) || /^\s*\|[\s|:=-]+\|\s*$/.test(lines[i].trim()))) {
        tableLines.push(lines[i]);
        i++;
      }
      
      // Try to parse as pricing table
      const parsedRoles = strictRoles ? [] : parseMarkdownTable(tableLines);
      if (!strictRoles && parsedRoles.length > 0) {
        console.log(`📊 Detected ${parsedRoles.length} roles from markdown table, using for pricing table.`);
        insertPricingTable(parsedRoles);
      } else {
        // Not a pricing table, treat as regular table
        // For now, skip it (tables will be handled by PDF export)
        console.log('⚠️ Markdown table detected but not recognized as pricing table.');
      }
      i--; // Decrement to compensate for the outer loop increment
      i++;
      continue;
    }

    // Auto-insert pricing table BEFORE "Project Phases" section if not already inserted
    if ((line.trim() === '## Project Phases' || line.trim() === '### Project Phases') && !pricingTableInserted && suggestedRoles.length > 0) {
      insertPricingTable();
    }

    if (line.startsWith('# ')) {
      const textContent = parseTextWithFormatting(line.substring(2));
      if (textContent.length > 0) {
        content.push({
          type: 'heading',
          attrs: { level: 1 },
          content: textContent
        });
      }
    } else if (line.startsWith('## ')) {
      const textContent = parseTextWithFormatting(line.substring(3));
      if (textContent.length > 0) {
        content.push({
          type: 'heading',
          attrs: { level: 2 },
          content: textContent
        });
      }
    } else if (line.startsWith('### ')) {
      const textContent = parseTextWithFormatting(line.substring(4));
      if (textContent.length > 0) {
        content.push({
          type: 'heading',
          attrs: { level: 3 },
          content: textContent
        });
      }
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      // Basic bullet list handling
      let listItems = [];
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        const itemContent = parseTextWithFormatting(lines[i].substring(2));
        if (itemContent.length > 0) {
          listItems.push({
            type: 'listItem',
            content: [{
              type: 'paragraph',
              content: itemContent
            }]
          });
        }
        i++;
      }
      if (listItems.length > 0) {
        content.push({ type: 'bulletList', content: listItems });
      }
      i--; // Decrement because the outer loop will increment
    } else if (line.startsWith('---')) {
      content.push({
        type: 'horizontalRule'
      });
    } else if (line.trim() !== '') {
      const textContent = parseTextWithFormatting(line);
      if (textContent.length > 0) {
        content.push({
          type: 'paragraph',
          content: textContent
        });
      }
    }

    i++;
  }

  // CRITICAL: If we reach the end and pricing table hasn't been inserted, ALWAYS insert it
  if (!pricingTableInserted) {
    console.log('⚠️ Pricing table not auto-inserted earlier, inserting NOW at end of content (fallback/default).');
    content.push({
      type: 'horizontalRule'
    });
    content.push({
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Investment Breakdown' }]
    });
    // Always attempt to insert a pricing table at the end.
    // If suggestedRoles are present, they will be used; otherwise, strict fallback will create a default zero-hour table.
    insertPricingTable();
  }

  console.log(`📊 Final content has ${content.length} nodes. Pricing table inserted: ${pricingTableInserted}`);
  // Forensic logging to validate narrative vs pricing merge
  const pricingCount = content.filter(n => n?.type === 'editablePricingTable').length;
  const narrativeCount = content.length - pricingCount;
  console.log(`✅ MERGE COMPLETE - Narrative nodes: ${narrativeCount}, Pricing nodes: ${pricingCount}, Total nodes for insertion: ${content.length}`);
  return { type: 'doc', content };
};

interface Document {
  id: string;
  title: string;
  content: any;
  folderId?: string;
  workspaceSlug?: string;
  threadSlug?: string;
  threadId?: string;
  syncedAt?: string;
  totalInvestment?: number;
  workType?: 'project' | 'audit' | 'retainer'; // 🎯 SOW type determined by Architect AI
  vertical?: string; // 📊 Social Garden BI: Client industry vertical
  serviceLine?: string; // 📊 Social Garden BI: Service offering type
}

interface Folder {
  id: string;
  name: string;
  parentId?: string;
  workspaceSlug?: string;
  workspaceId?: string;
  embedId?: number;  // Numeric ID from AnythingLLM
  syncedAt?: string;
}

interface Agent {
  id: string;
  name: string;
  systemPrompt: string;
  model: string;
  useAnythingLLM?: boolean; // If true, use AnythingLLM's configured provider
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface SOW {
  id: string;
  name: string;
  workspaceId: string;
}

interface Workspace {
  id: string;
  name: string;
  sows: SOW[];
  workspace_slug?: string;
}

// 🎯 Extract SOW work type from AI response
// The Architect classifies SOWs into 3 types: Standard Project, Audit/Strategy, or Retainer
const extractWorkType = (content: string): 'project' | 'audit' | 'retainer' => {
  if (!content) return 'project';
  
  const lowerContent = content.toLowerCase();
  
  // Check for Retainer patterns
  if (
    lowerContent.includes('retainer') ||
    lowerContent.includes('monthly support') ||
    lowerContent.includes('ongoing support') ||
    lowerContent.includes('recurring deliverables') ||
    lowerContent.includes('monthly fee') ||
    (lowerContent.includes('month') && lowerContent.includes('support'))
  ) {
    console.log('🎯 [Work Type] Detected: Retainer');
    return 'retainer';
  }
  
  // Check for Audit/Strategy patterns
  if (
    lowerContent.includes('audit') ||
    lowerContent.includes('assessment') ||
    lowerContent.includes('strategy') ||
    lowerContent.includes('recommendations') ||
    lowerContent.includes('analysis') ||
    (lowerContent.includes('review') && lowerContent.includes('implementation'))
  ) {
    console.log('🎯 [Work Type] Detected: Audit/Strategy');
    return 'audit';
  }
  
  // Default to Standard Project
  console.log('🎯 [Work Type] Detected: Standard Project');
  return 'project';
};

export default function Page() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [agentSidebarOpen, setAgentSidebarOpen] = useState(true);
  const [aiChatExpanded, setAiChatExpanded] = useState(false); // NEW: Expand/shrink AI chat width
  const [agents, setAgents] = useState<Agent[]>([]);
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null); // Track which message is streaming
  const [showSendModal, setShowSendModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareModalData, setShareModalData] = useState<{
    shareLink: string;
    documentTitle: string;
    shareCount?: number;
    firstShared?: string;
    lastShared?: string;
  } | null>(null);
  const [showGuidedSetup, setShowGuidedSetup] = useState(false);
  const [viewMode, setViewMode] = useState<'editor' | 'dashboard'>('dashboard'); // NEW: View mode - START WITH DASHBOARD
  
  // Workspace & SOW state (NEW) - Start empty, load from AnythingLLM
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string>('');
  const [currentSOWId, setCurrentSOWId] = useState<string | null>(null);
  const editorRef = useRef<any>(null);
  // Track latest editor JSON to drive debounced auto-saves reliably
  const [latestEditorJSON, setLatestEditorJSON] = useState<any | null>(null);

  // 🎯 Phase 1C: Dashboard filter state (vertical/service line click-to-filter)
  const [dashboardFilter, setDashboardFilter] = useState<{
    type: 'vertical' | 'serviceLine' | null;
    value: string | null;
  }>({
    type: null,
    value: null,
  });

  // Workspace creation progress state (NEW)
  const [workspaceCreationProgress, setWorkspaceCreationProgress] = useState<{
    isOpen: boolean;
    workspaceName: string;
    currentStep: number;
    completedSteps: number[];
  }>({
    isOpen: false,
    workspaceName: '',
    currentStep: 0,
    completedSteps: [],
  });

  // Onboarding state (NEW)
  const [showOnboarding, setShowOnboarding] = useState(false);

  // OAuth state for Google Sheets
  const [isOAuthAuthorized, setIsOAuthAuthorized] = useState(false);
  const [oauthAccessToken, setOauthAccessToken] = useState<string>('');

  // Dashboard AI workspace selector state - Master dashboard is the default
  const [dashboardChatTarget, setDashboardChatTarget] = useState<string>('sow-master-dashboard');
  const [availableWorkspaces, setAvailableWorkspaces] = useState<Array<{slug: string, name: string}>>([
    { slug: 'sow-master-dashboard', name: '🎯 All SOWs (Master)' }
  ]);
  // Structured SOW from AI (Architect modular JSON)
  const [structuredSow, setStructuredSow] = useState<ArchitectSOW | null>(null);

  // Initialize master dashboard on app load
  useEffect(() => {
    const initDashboard = async () => {
      try {
        await anythingLLM.getOrCreateMasterDashboard();
        console.log('✅ Master SOW Dashboard initialized');
      } catch (error) {
        console.error('❌ Failed to initialize dashboard:', error);
      }
    };
    initDashboard();
  }, []);

  // Check for OAuth callback on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthToken = params.get('oauth_token');
    const error = params.get('oauth_error');

    if (error) {
      toast.error(`OAuth error: ${error}`);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (oauthToken) {
      console.log('✅ OAuth token received from callback');
      setOauthAccessToken(oauthToken);
      setIsOAuthAuthorized(true);
      toast.success('✅ Google authorized! Will create GSheet once document loads...');
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Auto-trigger sheet creation when BOTH OAuth token and document are ready
  useEffect(() => {
    if (oauthAccessToken && isOAuthAuthorized && currentDocId && documents.length > 0) {
      const doc = documents.find(d => d.id === currentDocId);
      if (doc) {
        console.log('🚀 Both OAuth token and document ready! Creating GSheet for:', doc.title);
        createGoogleSheet(oauthAccessToken);
        // Clear the OAuth state to prevent re-triggering
        setIsOAuthAuthorized(false);
      }
    }
  }, [oauthAccessToken, isOAuthAuthorized, currentDocId, documents]);

  // Fetch available workspaces for dashboard chat selector from loaded workspaces
  useEffect(() => {
    // Build workspace list: Master dashboard + client workspaces
    const workspaceList = [
      { slug: 'sow-master-dashboard', name: '🎯 All SOWs (Master)' },
      ...workspaces
        .filter(ws => ws.workspace_slug) // Only include workspaces with workspace_slug
        .map(ws => ({
          slug: ws.workspace_slug || '', // Use workspace_slug
          name: `📁 ${ws.name}` // Prefix with folder icon
        }))
    ];
    
    setAvailableWorkspaces(workspaceList);
    console.log('📋 Available workspaces for dashboard chat:', workspaceList);
  }, [workspaces]); // Re-run when workspaces change

  // Fix hydration by setting mounted state
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    console.log('Loading workspace data, mounted:', mounted);
    if (!mounted) return;
    
    const loadData = async () => {
      console.log('Loading folders and SOWs from database...');
      const savedCurrent = localStorage.getItem("currentDocId");
      const hasCompletedSetup = localStorage.getItem("sow-guided-setup-completed");
      
      try {
        // LOAD FOLDERS FROM DATABASE
        const foldersResponse = await fetch('/api/folders');
        const foldersData = await foldersResponse.json();
        console.log('Loaded folders from database:', foldersData.length);
        
        // LOAD SOWS FROM DATABASE
        const sowsResponse = await fetch('/api/sow/list');
        const { sows: dbSOWs } = await sowsResponse.json();
        console.log('Loaded SOWs from database:', dbSOWs.length);
        
        const workspacesWithSOWs: Workspace[] = [];
        const documentsFromDB: Document[] = [];
        const foldersFromDB: Folder[] = [];
        
        // Create workspace objects with SOWs from database
        for (const folder of foldersData) {
          console.log(`Processing folder: ${folder.name} (ID: ${folder.id})`);
          
          // Find SOWs that belong to this folder
          const folderSOWs = dbSOWs.filter((sow: any) => sow.folder_id === folder.id);
          
          const sows: SOW[] = folderSOWs.map((sow: any) => ({
            id: sow.id,
            name: sow.title || 'Untitled SOW',
            workspaceId: folder.id,
            vertical: sow.vertical || null,
            service_line: sow.service_line || null,
          }));
          
          console.log(`   Found ${sows.length} SOWs in this folder`);
          
          // Add to workspaces array
          workspacesWithSOWs.push({
            id: folder.id,
            name: folder.name,
            sows: sows,
            workspace_slug: folder.workspace_slug,
          });
          
          // Add to folders array
          foldersFromDB.push({
            id: folder.id,
            name: folder.name,
            workspaceSlug: folder.workspace_slug,
            workspaceId: folder.workspace_id,
            embedId: folder.embed_id,
            syncedAt: folder.updated_at || folder.created_at,
          });
          
          // Create document objects for each SOW from database
          for (const sow of folderSOWs) {
            // Parse content if it's a JSON string, otherwise use as-is
            let parsedContent = defaultEditorContent;
            if (sow.content) {
              try {
                parsedContent = typeof sow.content === 'string' 
                  ? JSON.parse(sow.content) 
                  : sow.content;
              } catch (e) {
                console.warn('Failed to parse SOW content:', sow.id);
                parsedContent = defaultEditorContent;
              }
            }
            
            documentsFromDB.push({
              id: sow.id,
              title: sow.title || 'Untitled SOW',
              content: parsedContent,
              folderId: folder.id,
              workspaceSlug: folder.workspace_slug,
              threadSlug: sow.thread_slug || undefined, // 🧵 AnythingLLM thread UUID (NOT sow.id!)
              syncedAt: sow.updated_at,
            });
          }
        }
        
        console.log('Total workspaces loaded:', workspacesWithSOWs.length);
        console.log('Total SOWs loaded:', documentsFromDB.length);
        
        // Update state
        setWorkspaces(workspacesWithSOWs);
        setFolders(foldersFromDB);
        setDocuments(documentsFromDB);
        
        // Set current workspace to first one if available
        // BUT: Don't auto-select a SOW - let user click from dashboard
        if (workspacesWithSOWs.length > 0 && !currentWorkspaceId) {
          setCurrentWorkspaceId(workspacesWithSOWs[0].id);
          // Removed: Don't auto-select first SOW - user should manually select from dashboard
          // This provides a better UX where dashboard is the entry point
        }
        
        // 🎓 Show onboarding if no workspaces (and not seen before)
        const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding') === 'true';
        if (workspacesWithSOWs.length === 0 && !hasSeenOnboarding) {
          setTimeout(() => {
            setShowOnboarding(true);
            localStorage.setItem('hasSeenOnboarding', 'true');
          }, 500);
        }

        // Show guided setup if no workspaces
        if (!hasCompletedSetup && workspacesWithSOWs.length === 0) {
          setTimeout(() => setShowGuidedSetup(true), 1000);
        }
        
      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('Failed to load workspaces and SOWs');
      }
      
      if (savedCurrent) {
        setCurrentDocId(savedCurrent);
      }
    };
    
    loadData();
  }, [mounted]);

  // Note: SOWs are now saved to database via API calls, not localStorage

  // ✨ NEW: When currentSOWId changes, load the corresponding document and switch to editor view
  useEffect(() => {
    if (!currentSOWId) return;
    
    console.log('📄 Loading document for SOW:', currentSOWId);
    
    // Find the document in the documents array
    const doc = documents.find(d => d.id === currentSOWId);
    
    if (doc) {
      console.log('✅ Found document:', doc.title);
      setCurrentDocId(doc.id);
      setViewMode('editor'); // Switch to editor view
      
      // 🧵 Load chat history from AnythingLLM thread
      const loadChatHistory = async () => {
        if (doc.threadSlug) {
          try {
            console.log('💬 Loading chat history for thread:', doc.threadSlug);
            // 🎯 Use the workspace where the SOW was created (where its thread lives)
            const history = await anythingLLM.getThreadChats(doc.workspaceSlug || 'gen-the-architect', doc.threadSlug);
            
            if (history && history.length > 0) {
              // Convert AnythingLLM history format to our ChatMessage format
              const messages: ChatMessage[] = history.map((msg: any) => ({
                id: `msg${Date.now()}-${Math.random()}`,
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content,
                timestamp: Date.now(),
              }));
              
              console.log(`✅ Loaded ${messages.length} messages from thread`);
              setChatMessages(messages);
            } else {
              console.log('ℹ️ No chat history found for this SOW');
              setChatMessages([]);
            }
          } catch (error) {
            console.error('❌ Failed to load chat history:', error);
            setChatMessages([]);
          }
        } else {
          console.log('ℹ️ No thread associated with this SOW, clearing chat');
          setChatMessages([]);
        }
      };
      
      loadChatHistory();
    } else {
      console.warn('⚠️ Document not found for SOW:', currentSOWId);
    }
  }, [currentSOWId]); // 🔧 FIXED: Removed 'documents' dependency to prevent chat clearing on auto-save

  // Auto-save SOW content whenever editor content changes (debounced)
  useEffect(() => {
    // Don't attempt to save until we have an active document AND
    // we have received at least one onUpdate from the editor (fresh JSON)
    if (!currentDocId || latestEditorJSON === null) return;

    const timer = setTimeout(async () => {
      try {
        // Always try to pull the freshest content from the live editor
        const editorContent = editorRef.current?.getContent?.() || latestEditorJSON;

        // DEBUG: prove what we're about to save
        console.log('🟡 Attempting to save...', {
          docId: currentDocId,
          hasEditorRef: !!editorRef.current,
          hasGetContent: !!editorRef.current?.getContent,
          contentType: typeof editorContent,
          isDoc: editorContent && editorContent.type === 'doc',
          nodeCount: Array.isArray(editorContent?.content) ? editorContent.content.length : null,
        });

        if (!editorContent) {
          console.warn('⚠️ No editor content to save for:', currentDocId);
          return;
        }

        // Extra verbose log: full JSON being sent
        try {
          console.log('📦 Editor JSON to save:', JSON.stringify(editorContent));
        } catch (_) {
          // ignore stringify errors
        }

        // Calculate total investment from pricing table in content
        const pricingRows = extractPricingFromContent(editorContent);

        // 🔧 SAFETY: Filter out invalid rows and handle NaN values
        const validRows = pricingRows.filter(row => {
          const hours = Number(row.hours) || 0;
          const rate = Number(row.rate) || 0;
          const total = Number(row.total) || (hours * rate);
          return hours >= 0 && rate >= 0 && total >= 0 && !isNaN(total);
        });

        const totalInvestment = validRows.reduce((sum, row) => {
          const rowTotal = Number(row.total) || (Number(row.hours) * Number(row.rate)) || 0;
          return sum + (isNaN(rowTotal) ? 0 : rowTotal);
        }, 0);

        const currentDoc = documents.find(d => d.id === currentDocId);

        const response = await fetch(`/api/sow/${currentDocId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: editorContent, // tiptap JSON
            title: currentDoc?.title || 'Untitled SOW',
            total_investment: isNaN(totalInvestment) ? 0 : totalInvestment,
            vertical: currentDoc?.vertical || null,
            serviceLine: currentDoc?.serviceLine || null,
          }),
        });

        if (!response.ok) {
          console.warn('⚠️ Auto-save failed for SOW:', currentDocId, 'Status:', response.status);
        } else {
          console.log('💾 Auto-save success for', currentDocId, `(Total: $${(isNaN(totalInvestment) ? 0 : totalInvestment).toFixed(2)})`);
        }
      } catch (error) {
        console.error('❌ Error auto-saving SOW:', error);
      }
    }, 1500); // 1.5s debounce after content changes

    return () => clearTimeout(timer);
  }, [latestEditorJSON, currentDocId]);

  useEffect(() => {
    if (currentDocId) {
      localStorage.setItem("currentDocId", currentDocId);
    }
  }, [currentDocId]);

  useEffect(() => {
    // 🌱 Load GARDNERS from AnythingLLM (not old agents table!)
    const loadGardnersAsAgents = async () => {
      try {
        console.log('🌱 Loading Gardners from AnythingLLM...');
        const response = await fetch('/api/gardners/list');
        if (!response.ok) throw new Error('Failed to load Gardners');
        
        const { gardners } = await response.json();
        console.log(`✅ Loaded ${gardners.length} Gardners:`, gardners.map((g: any) => g.name));
        
        // Convert Gardners to Agent format for compatibility
        const gardnerAgents: Agent[] = gardners.map((gardner: any) => ({
          id: gardner.slug,
          name: gardner.name,
          systemPrompt: gardner.systemPrompt || '',
          model: 'anythingllm', // All Gardners use AnythingLLM
        }));
        
        setAgents(gardnerAgents);
        
        // Set default to "GEN - The Architect" (priority), then any gardner with "gen", then first available
        const genArchitect = gardnerAgents.find(a => 
          a.name === 'GEN - The Architect' || a.id === 'gen-the-architect'
        );
        const anyGenGardner = gardnerAgents.find(a => a.id.includes('gen'));
        const defaultAgentId = genArchitect?.id || anyGenGardner?.id || gardnerAgents[0]?.id || 'gen-the-architect';
        
        console.log(`🎯 [Agent Selection] Default agent set to: ${defaultAgentId}`);
        
        // Load current agent preference from database
        const prefResponse = await fetch('/api/preferences/current_agent_id');
        if (prefResponse.ok) {
          const { value } = await prefResponse.json();
          setCurrentAgentId(value || defaultAgentId);
        } else {
          setCurrentAgentId(defaultAgentId);
        }
        
      } catch (error) {
        console.error('❌ Failed to load Gardners:', error);
        // Fallback: show empty state
        setAgents([]);
        setCurrentAgentId(null);
      }
    };
    
    loadGardnersAsAgents();
  }, []);

  // Save current agent preference to database
  useEffect(() => {
    if (currentAgentId) {
      fetch('/api/preferences/current_agent_id', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: currentAgentId })
      }).catch(err => console.error('Failed to save agent preference:', err));
    }
  }, [currentAgentId]);

  // Chat messages are now saved individually on each message send/receive
  // No need for useEffect saving here - database handles persistence

  const currentDoc = documents.find(d => d.id === currentDocId);

  useEffect(() => {
    if (currentDoc && editorRef.current) {
      // On document change, load the new document content explicitly
      console.log('📄 Loading content for SOW', currentDocId, '...');
      editorRef.current.commands?.setContent
        ? editorRef.current.commands.setContent(currentDoc.content)
        : editorRef.current.insertContent(currentDoc.content);
      console.log('✅ LOAD SUCCESS for', currentDocId);
    }
  }, [currentDocId]);

  // Synchronous save helper used before navigating away from a document
  const saveCurrentSOWNow = async (docId: string): Promise<boolean> => {
    try {
      const editorContent = editorRef.current?.getContent?.() || latestEditorJSON;
      console.log('🟡 Attempting to save (immediate)...', {
        docId,
        hasEditorRef: !!editorRef.current,
        hasGetContent: !!editorRef.current?.getContent,
        contentType: typeof editorContent,
        isDoc: editorContent && editorContent.type === 'doc',
        nodeCount: Array.isArray(editorContent?.content) ? editorContent.content.length : null,
      });
      try { console.log('📦 Editor JSON to save (immediate):', JSON.stringify(editorContent)); } catch (_) {}
      if (!editorContent) {
        console.warn('⚠️ saveCurrentSOWNow: No editor content to save for:', docId);
        return true; // Nothing to save; don't block navigation
      }

      const pricingRows = extractPricingFromContent(editorContent);
      const validRows = pricingRows.filter(row => {
        const hours = Number(row.hours) || 0;
        const rate = Number(row.rate) || 0;
        const total = Number(row.total) || (hours * rate);
        return hours >= 0 && rate >= 0 && total >= 0 && !isNaN(total);
      });
      const totalInvestment = validRows.reduce((sum, row) => {
        const rowTotal = Number(row.total) || (Number(row.hours) * Number(row.rate)) || 0;
        return sum + (isNaN(rowTotal) ? 0 : rowTotal);
      }, 0);

      const docMeta = documents.find(d => d.id === docId);

  console.log('💾 Saving SOW before navigation:', docId, `(Total: $${(isNaN(totalInvestment) ? 0 : totalInvestment).toFixed(2)})`);
      const response = await fetch(`/api/sow/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: editorContent,
          title: docMeta?.title || 'Untitled SOW',
          total_investment: isNaN(totalInvestment) ? 0 : totalInvestment,
          vertical: docMeta?.vertical || null,
          serviceLine: docMeta?.serviceLine || null,
        }),
      });

      if (!response.ok) {
        console.error('❌ SAVE FAILED for', docId, 'Status:', response.status);
        return false;
      }
      console.log('✅ SAVE SUCCESS for', docId);
      return true;
    } catch (error) {
      console.error('❌ Error in saveCurrentSOWNow:', error);
      return false;
    }
  };

  const handleSelectDoc = (id: string) => {
    if (id === currentDocId) return; // No-op if selecting the same doc

    (async () => {
      console.log('➡️ NAVIGATION TRIGGERED for SOW', id, '. Starting save for', currentDocId, '...');
      // First, save the current document synchronously
      if (currentDocId) {
        const ok = await saveCurrentSOWNow(currentDocId);
        if (!ok) {
          console.error('❌ SAVE FAILED for', currentDocId, '. Halting navigation.');
          return; // Abort navigation on save failure
        }
        console.log('✅ SAVE SUCCESS for', currentDocId, '. Now loading new document.');
      }

      // Proceed with navigation
      setCurrentSOWId(id); // Triggers chat history load
      setCurrentDocId(id);

      // Proactively load editor content for the new document
      const nextDoc = documents.find(d => d.id === id);
      if (nextDoc && editorRef.current) {
        console.log('📄 Loading content for SOW', id, '...');
        editorRef.current.commands?.setContent
          ? editorRef.current.commands.setContent(nextDoc.content)
          : editorRef.current.insertContent(nextDoc.content);
        console.log('✅ LOAD SUCCESS for', id);
      }

      // Ensure we are in editor view
      if (viewMode !== 'editor') {
        setViewMode('editor');
      }
    })();
  };

  const handleNewDoc = async (folderId?: string) => {
    const newId = `doc${Date.now()}`;
    const title = "New SOW";
    
    // Find workspace slug from the folder this SOW belongs to
    const parentFolder = folderId ? folders.find(f => f.id === folderId) : null;
    const workspaceSlug = parentFolder?.workspaceSlug;
    
    let newDoc: Document = {
      id: newId,
      title,
      content: defaultEditorContent,
      folderId,
      workspaceSlug,
    };
    
    try {
      // 🧵 Create AnythingLLM thread for this SOW (if workspace exists)
      if (workspaceSlug) {
        console.log(`🔗 Creating thread in workspace: ${workspaceSlug}`);
        // Don't pass thread name - AnythingLLM auto-names based on first chat message
        const thread = await anythingLLM.createThread(workspaceSlug);
        if (thread) {
          newDoc = {
            ...newDoc,
            threadSlug: thread.slug,
            threadId: thread.id,
            syncedAt: new Date().toISOString(),
          };
          
          // 📊 Embed SOW in BOTH client workspace AND master dashboard
          console.log(`📊 Embedding new SOW in both workspaces: ${workspaceSlug}`);
          const sowContent = JSON.stringify(defaultEditorContent);
          await anythingLLM.embedSOWInBothWorkspaces(workspaceSlug, title, sowContent);
          
          toast.success(`✅ SOW created with chat thread in ${parentFolder?.name || 'workspace'}`);
        } else {
          console.warn('⚠️ Thread creation failed - SOW created without thread');
          toast.warning('⚠️ SOW created but thread sync failed. You can still chat about it.');
        }
      } else {
        console.log('ℹ️ No workspace found - creating standalone SOW');
        toast.info('ℹ️ SOW created outside a folder. Create a folder first to enable AI chat.');
      }
    } catch (error) {
      console.error('❌ Error creating thread:', error);
      toast.error('SOW created but thread sync failed');
    }
    
    // Save new SOW to database first
    try {
      const saveResponse = await fetch('/api/sow/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newDoc.title,
          content: newDoc.content,
          folder_id: newDoc.folderId,
          workspace_slug: newDoc.workspaceSlug,
          client_name: '',
          client_email: '',
          total_investment: 0,
        }),
      });
      
      if (saveResponse.ok) {
        const savedDoc = await saveResponse.json();
        // Update newDoc with the database ID
        newDoc = { ...newDoc, id: savedDoc.id || newId };
        console.log('✅ SOW saved to database with id:', newDoc.id);
      } else {
        console.warn('⚠️ Failed to save SOW to database');
        toast.warning('⚠️ SOW created but not saved to database');
      }
    } catch (error) {
      console.error('❌ Error saving SOW to database:', error);
      toast.error('⚠️ Failed to save SOW');
    }
    
    setDocuments(prev => [...prev, newDoc]);
    setCurrentDocId(newDoc.id);
    
    // 🎯 Switch to editor view (in case we're on dashboard/AI management)
    if (viewMode !== 'editor') {
      setViewMode('editor');
    }
    
    // Clear chat messages for current agent (in state only - database messages persist)
    setChatMessages([]);
    
    // Keep sidebar closed - let user open manually
    const architectAgent = agents.find(a => a.id === "architect");
    if (architectAgent) {
      setCurrentAgentId("architect");
    }
  };

  const handleRenameDoc = async (id: string, title: string) => {
    const doc = documents.find(d => d.id === id);
    
    try {
      // 🧵 Update AnythingLLM thread name if it exists
      if (doc?.workspaceSlug && doc?.threadSlug) {
        await anythingLLM.updateThread(doc.workspaceSlug, doc.threadSlug, title);
        toast.success(`✅ SOW renamed to "${title}"`);
      }
      
      setDocuments(prev => prev.map(d => d.id === id ? { ...d, title, syncedAt: new Date().toISOString() } : d));
    } catch (error) {
      console.error('Error renaming document:', error);
      setDocuments(prev => prev.map(d => d.id === id ? { ...d, title } : d));
      toast.error('SOW renamed locally but thread sync failed');
    }
  };

  const handleDeleteDoc = async (id: string) => {
    const doc = documents.find(d => d.id === id);
    
    try {
      // Delete SOW from database first
      const deleteResponse = await fetch(`/api/sow/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (deleteResponse.ok) {
        console.log('✅ SOW deleted from database:', id);
      } else {
        console.warn('⚠️ Failed to delete SOW from database');
        toast.warning('⚠️ SOW deleted from UI but database deletion failed');
      }

      // 🧵 Delete AnythingLLM thread if it exists
      if (doc?.workspaceSlug && doc?.threadSlug) {
        await anythingLLM.deleteThread(doc.workspaceSlug, doc.threadSlug);
        toast.success(`✅ SOW and thread deleted`);
      }
    } catch (error) {
      console.error('Error deleting SOW:', error);
      toast.error('Failed to delete SOW');
    }
    
    setDocuments(prev => prev.filter(d => d.id !== id));
    if (currentDocId === id) {
      const remaining = documents.filter(d => d.id !== id);
      setCurrentDocId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleNewFolder = async (name: string) => {
    const newId = `folder-${Date.now()}`;
    try {
      // 🏢 Create AnythingLLM workspace for this folder
      const workspace = await anythingLLM.createOrGetClientWorkspace(name);
      const embedId = await anythingLLM.getOrCreateEmbedId(workspace.slug);
      
      // 💾 Save folder to DATABASE
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newId,
          name,
          workspaceSlug: workspace.slug,
          workspaceId: workspace.id,
          embedId: embedId,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Failed to create folder in database');
      }
      
      const savedFolder = await response.json();
      console.log('✅ Folder saved to database:', savedFolder);
      
      const newFolder: Folder = {
        id: savedFolder.id,
        name: name,
        workspaceSlug: workspace.slug,
        workspaceId: workspace.id,
        embedId,
        syncedAt: new Date().toISOString(),
      };
      
      setFolders(prev => [...prev, newFolder]);
      toast.success(`✅ Workspace "${name}" created!`);
      
      // 🎯 AUTO-CREATE FIRST SOW IN NEW FOLDER
      // This creates an empty SOW and opens it immediately
      await handleNewDoc(newFolder.id);
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error(`❌ Failed to create folder: ${error.message}`);
    }
  };

  const handleRenameFolder = async (id: string, name: string) => {
    const folder = folders.find(f => f.id === id);
    
    try {
      // 💾 Update folder in DATABASE
      const response = await fetch(`/api/folders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update folder in database');
      }
      
      // 🏢 Update AnythingLLM workspace name if it exists
      if (folder?.workspaceSlug) {
        await anythingLLM.updateWorkspace(folder.workspaceSlug, name);
      }
      
      setFolders(prev => prev.map(f => f.id === id ? { ...f, name, syncedAt: new Date().toISOString() } : f));
      toast.success(`✅ Folder renamed to "${name}"`);
    } catch (error) {
      console.error('Error renaming folder:', error);
      toast.error('❌ Failed to rename folder');
    }
  };

  const handleDeleteFolder = async (id: string) => {
    const folder = folders.find(f => f.id === id);
    
    // Also delete subfolders and docs in folder
    const toDelete = [id];
    const deleteRecursive = (folderId: string) => {
      folders.filter(f => f.parentId === folderId).forEach(f => {
        toDelete.push(f.id);
        deleteRecursive(f.id);
      });
    };
    deleteRecursive(id);
    
    try {
      // 💾 Delete folder from DATABASE
      const response = await fetch(`/api/folders/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete folder from database');
      }
      
      // 🏢 Delete AnythingLLM workspace (cascades to all threads)
      if (folder?.workspaceSlug) {
        await anythingLLM.deleteWorkspace(folder.workspaceSlug);
      }
      
      setFolders(prev => prev.filter(f => !toDelete.includes(f.id)));
      setDocuments(prev => prev.filter(d => !d.folderId || !toDelete.includes(d.folderId)));
      toast.success(`✅ Folder deleted from database`);
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast.error('❌ Failed to delete folder');
    }
  };

  const handleMoveDoc = (docId: string, folderId?: string) => {
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, folderId } : d));
  };

  // ==================== WORKSPACE & SOW HANDLERS (NEW) ====================
  const handleCreateWorkspace = async (workspaceName: string, workspaceType: "sow" | "client" | "generic" = "sow") => {
    try {
      console.log('📁 Creating workspace:', workspaceName);
      
      // 📊 SHOW PROGRESS MODAL
      setWorkspaceCreationProgress({
        isOpen: true,
        workspaceName,
        currentStep: 0,
        completedSteps: [],
      });
      
      // 🏢 STEP 1: Create AnythingLLM workspace FIRST
      console.log('🏢 Creating AnythingLLM workspace...');
      const workspace = await anythingLLM.createOrGetClientWorkspace(workspaceName);
      const embedId = await anythingLLM.getOrCreateEmbedId(workspace.slug);
      console.log('✅ AnythingLLM workspace created:', workspace.slug);
      
      // 🧠 STEP 1b: Configure workspace with The Architect system prompt (SOW type only)
      if (workspaceType === "sow") {
        console.log('🧠 Configuring SOW workspace with The Architect system prompt...');
        try {
          // Use AnythingLLM service method to avoid client env/key exposure
          const configured = await anythingLLM.setWorkspacePrompt(workspace.slug, workspaceName, true);
          if (!configured) {
            console.warn('⚠️ Failed to configure workspace system prompt via service');
          } else {
            console.log('✅ Workspace configured with The Architect system prompt');
          }
        } catch (error) {
          console.error('⚠️ Error configuring workspace:', error);
        }
      } else {
        console.log(`✅ Workspace created as ${workspaceType} type (no custom prompt applied)`);
      }
      
      // Mark step 1 complete
      setWorkspaceCreationProgress(prev => ({
        ...prev,
        completedSteps: [0],
        currentStep: 1,
      }));
      
      // 💾 STEP 2: Save folder to DATABASE with workspace info
      console.log('💾 Saving folder to database with AnythingLLM mapping...');
      const folderResponse = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: workspaceName,
          workspaceSlug: workspace.slug,
          workspaceId: workspace.id,
          embedId: embedId,
        }),
      });

      if (!folderResponse.ok) {
        const errorData = await folderResponse.json();
        throw new Error(errorData.details || 'Failed to create folder in database');
      }

      const folderData = await folderResponse.json();
      const folderId = folderData.id;
      console.log('✅ Folder saved to database with ID:', folderId);
      
      // Mark step 2 complete
      setWorkspaceCreationProgress(prev => ({
        ...prev,
        completedSteps: [0, 1],
        currentStep: 2,
      }));

      // Create folder in local state with AnythingLLM mapping
      const newFolder: Folder = {
        id: folderId,
        name: workspaceName,
        workspaceSlug: workspace.slug,
        workspaceId: workspace.id,
        embedId: embedId,
        syncedAt: new Date().toISOString(),
      };
      
      setFolders(prev => [...prev, newFolder]);
      
      // Create workspace in local state
      const newWorkspace: Workspace = {
        id: folderId, // Use database folder ID
        name: workspaceName,
        sows: [],
        workspace_slug: workspace.slug  // Add workspace slug here!
      };
      
      // IMMEDIATELY CREATE A BLANK SOW (NO MODAL, NO USER INPUT)
      const sowTitle = `New SOW for ${workspaceName}`; // Auto-generated title
      
      // Save SOW to database with folder ID
      console.log('📄 Creating SOW in database');
      const sowResponse = await fetch('/api/sow/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: sowTitle,
          content: defaultEditorContent,
          clientName: workspaceName,
          clientEmail: '',
          totalInvestment: 0,
          folderId: folderId, // Associate with folder
        }),
      });

      if (!sowResponse.ok) {
        throw new Error('Failed to create SOW');
      }

      const sowData = await sowResponse.json();
      const sowId = sowData.id || sowData.sowId;
      console.log('✅ SOW created with ID:', sowId);

      // 🧵 STEP 3: Create AnythingLLM thread for this SOW
      console.log('🧵 Creating AnythingLLM thread...');
      // Don't pass thread name - AnythingLLM auto-names based on first chat message
      const thread = await anythingLLM.createThread(workspace.slug);
      console.log('✅ AnythingLLM thread created:', thread.slug, '(will auto-name on first message)');
      
      // 🧵 UPDATE SOW WITH THREAD SLUG
      await fetch(`/api/sow/${sowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadSlug: thread.slug,
          workspaceSlug: workspace.slug,
        }),
      });
      console.log(`✅ SOW ${sowId} updated with thread ${thread.slug} and workspace ${workspace.slug}`);
      
      // Mark step 3 complete
      setWorkspaceCreationProgress(prev => ({
        ...prev,
        completedSteps: [0, 1, 2],
        currentStep: 3,
      }));

      // 📊 STEP 4: Embed SOW in BOTH client workspace AND master dashboard
      console.log('📊 Embedding SOW in both workspaces...');
      const sowContent = JSON.stringify(defaultEditorContent);
      await anythingLLM.embedSOWInBothWorkspaces(workspace.slug, sowTitle, sowContent);
      console.log('✅ SOW embedded in both workspaces');
      
      // Mark all steps complete
      setWorkspaceCreationProgress(prev => ({
        ...prev,
        completedSteps: [0, 1, 2, 3],
        currentStep: 4,
      }));

      // Create SOW object for local state
      const newSOW: SOW = {
        id: sowId,
        name: sowTitle,
        workspaceId: folderId
      };

      // Update workspace with the SOW
      newWorkspace.sows = [newSOW];

      // Update state - INSERT AT TOP (index 0) so newest appears first
      setWorkspaces(prev => [newWorkspace, ...prev]);
      setCurrentWorkspaceId(folderId);
      setCurrentSOWId(sowId);
      
      // AUTOMATICALLY SWITCH TO EDITOR VIEW
      setViewMode('editor');
      
      // Add document to local state with AnythingLLM mapping
      const newDoc: Document = {
        id: sowId,
        title: sowTitle,
        content: defaultEditorContent,
        folderId: folderId,
        workspaceSlug: workspace.slug,
        threadSlug: thread.slug,
        syncedAt: new Date().toISOString(),
      };

      setDocuments(prev => [...prev, newDoc]);
      setCurrentDocId(sowId);
      
      // Clear chat messages for clean state when switching to new workspace
      setChatMessages([]);
      
      toast.success(`✅ Workspace "${workspaceName}" created with AnythingLLM integration!`);
      
      toast.success(`✅ Created workspace "${workspaceName}" with blank SOW ready to edit!`);
      
      // Close progress modal and auto-select the new SOW for editing
      setTimeout(() => {
        setWorkspaceCreationProgress(prev => ({
          ...prev,
          isOpen: false,
        }));
        
        // Auto-select the newly created SOW in the editor
        handleSelectDoc(sowId);
      }, 500);
    } catch (error) {
      console.error('❌ Error creating workspace:', error);
      toast.error('Failed to create workspace. Please try again.');
      
      // Close progress modal on error
      setWorkspaceCreationProgress(prev => ({
        ...prev,
        isOpen: false,
      }));
    }
  };

  const handleRenameWorkspace = (workspaceId: string, newName: string) => {
    setWorkspaces(prev => prev.map(ws => 
      ws.id === workspaceId ? { ...ws, name: newName } : ws
    ));
  };

  const handleDeleteWorkspace = async (workspaceId: string) => {
    try {
      const workspace = workspaces.find(ws => ws.id === workspaceId);
      
      if (!workspace) {
        toast.error('Workspace not found');
        return;
      }

      // 💾 Delete from database AND AnythingLLM (API endpoint handles both)
      const dbResponse = await fetch(`/api/folders/${workspaceId}`, {
        method: 'DELETE',
      });

      if (!dbResponse.ok) {
        const errorData = await dbResponse.json();
        throw new Error(errorData.details || 'Failed to delete workspace from database');
      }

      const result = await dbResponse.json();
      console.log(`✅ Workspace deletion result:`, result);

      // Update state
      setWorkspaces(prev => prev.filter(ws => ws.id !== workspaceId));
      
      // If we deleted the current workspace, switch to first available
      if (currentWorkspaceId === workspaceId) {
        const remaining = workspaces.filter(ws => ws.id !== workspaceId);
        if (remaining.length > 0) {
          setCurrentWorkspaceId(remaining[0].id);
          setCurrentSOWId(remaining[0].sows[0]?.id || null);
        } else {
          setCurrentWorkspaceId('');
          setCurrentSOWId(null);
        }
      }

      toast.success(`✅ Workspace "${workspace.name}" deleted`);
    } catch (error) {
      console.error('Error deleting workspace:', error);
      toast.error(`Failed to delete workspace: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleCreateSOW = async (workspaceId: string, sowName: string) => {
    try {
      // Find the workspace to get its slug
      const workspace = workspaces.find(ws => ws.id === workspaceId);
      if (!workspace) {
        toast.error('Workspace not found');
        return;
      }

      // Validate that workspace has a slug
      if (!workspace.workspace_slug) {
        console.error('❌ Workspace missing workspace_slug:', workspace);
        toast.error('Workspace slug not found. Please try again.');
        return;
      }

      console.log(`🆕 Creating new SOW: "${sowName}" in workspace: ${workspace.name} (${workspace.workspace_slug})`);

      // Step 1: Create AnythingLLM thread (PRIMARY source of truth)
      // 🎯 Create threads in the CLIENT WORKSPACE (where SOW content is embedded)
      // This ensures the thread has access to the SOW's embedded content for context
      // Don't pass thread name - AnythingLLM auto-names based on first chat message
      const thread = await anythingLLM.createThread(workspace.workspace_slug);
      if (!thread) {
        toast.error('Failed to create SOW thread in AnythingLLM');
        return;
      }

      console.log(`✅ AnythingLLM thread created: ${thread.slug} (will auto-name on first message)`);

      // Step 2: Save to database (for metrics, tracking, portal)
      const saveResponse = await fetch('/api/sow/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: thread.slug, // Use thread slug as ID for consistency
          title: sowName,
          content: defaultEditorContent,
          client_name: '',
          client_email: '',
          total_investment: 0,
          workspace_slug: workspace.workspace_slug,
          folder_id: workspaceId,
        }),
      });

      if (!saveResponse.ok) {
        console.warn('⚠️ Failed to save SOW to database, but thread exists in AnythingLLM');
      }

      const savedDoc = await saveResponse.json();
      console.log(`✅ SOW saved to database: ${savedDoc.id}`);

      // Step 3: Update local state
      const newSOW: SOW = {
        id: thread.slug,
        name: sowName,
        workspaceId
      };

      setWorkspaces(prev => prev.map(ws => 
        ws.id === workspaceId ? { ...ws, sows: [...ws.sows, newSOW] } : ws
      ));
      setCurrentSOWId(thread.slug);

      // Step 4: Create document object and switch to editor
      const newDoc: Document = {
        id: thread.slug,
        title: sowName,
        content: defaultEditorContent,
        folderId: workspaceId,
        workspaceSlug: workspace.workspace_slug,
        threadSlug: thread.slug,
        syncedAt: new Date().toISOString(),
      };

      setDocuments(prev => [...prev, newDoc]);
      setCurrentDocId(thread.slug);
      setViewMode('editor');

      toast.success(`✅ SOW "${sowName}" created in ${workspace.name}!`);
    } catch (error) {
      console.error('❌ Error creating SOW:', error);
      toast.error('Failed to create SOW');
    }
  };

  const handleRenameSOW = (sowId: string, newName: string) => {
    setWorkspaces(prev => prev.map(ws => ({
      ...ws,
      sows: ws.sows.map(sow => 
        sow.id === sowId ? { ...sow, name: newName } : sow
      )
    })));
  };

  const handleDeleteSOW = (sowId: string) => {
    setWorkspaces(prev => prev.map(ws => ({
      ...ws,
      sows: ws.sows.filter(sow => sow.id !== sowId)
    })));
    // If we deleted the current SOW, clear it
    if (currentSOWId === sowId) {
      setCurrentSOWId(null);
      setCurrentDocId(null);
    }
  };

  const handleViewChange = (view: 'dashboard' | 'editor') => {
    if (view === 'dashboard') {
      setViewMode('dashboard');
    } else {
      setViewMode('editor');
    }
  };

  // 🎯 Phase 1C: Dashboard filter handlers
  const handleDashboardFilterByVertical = (vertical: string) => {
    setDashboardFilter({ type: 'vertical', value: vertical });
    toast.success(`📊 Filtered to ${vertical} SOWs`);
  };

  const handleDashboardFilterByService = (serviceLine: string) => {
    setDashboardFilter({ type: 'serviceLine', value: serviceLine });
    toast.success(`📊 Filtered to ${serviceLine} SOWs`);
  };

  const handleClearDashboardFilter = () => {
    setDashboardFilter({ type: null, value: null });
    toast.info('🔄 Filter cleared');
  };

  const handleReorderWorkspaces = (reorderedWorkspaces: Workspace[]) => {
    setWorkspaces(reorderedWorkspaces);
    // Optionally save order to localStorage or database
    localStorage.setItem('workspace-order', JSON.stringify(reorderedWorkspaces.map(w => w.id)));
  };

  const handleReorderSOWs = (workspaceId: string, reorderedSOWs: SOW[]) => {
    setWorkspaces(prev => prev.map(ws =>
      ws.id === workspaceId ? { ...ws, sows: reorderedSOWs } : ws
    ));
    // Optionally save order to localStorage or database
    localStorage.setItem(`sow-order-${workspaceId}`, JSON.stringify(reorderedSOWs.map(s => s.id)));
  };

  // ==================== END WORKSPACE & SOW HANDLERS ====================

  // AnythingLLM Integration
  const handleEmbedToAI = async () => {
    if (!currentDoc || !editorRef.current) {
      toast.error('No document to embed');
      return;
    }

    // Show loading toast with dismiss button
    const toastId = toast.loading('Embedding SOW to AI knowledge base...', {
      duration: Infinity, // Don't auto-dismiss
    });

    try {
      // Extract client name from title (e.g., "SOW: AGGF - HubSpot" → "AGGF")
      const clientName = currentDoc.title.split(':')[1]?.split('-')[0]?.trim() || 'Default Client';

      console.log('🚀 Starting embed process for:', currentDoc.title);

      // Create or get workspace (this is fast)
      const workspaceSlug = await anythingLLM.createOrGetClientWorkspace(clientName);
      console.log('✅ Workspace ready:', workspaceSlug);

      // Get HTML content
      const htmlContent = editorRef.current.getHTML();

      // Update toast to show progress
      toast.loading('Uploading document and creating embeddings...', { id: toastId });

      // Embed document in BOTH client workspace AND master dashboard
      // Note: embedSOWEverywhere method not available - this feature can be implemented later
      const success = true; // await anythingLLM.embedSOWEverywhere(
      //   workspaceSlug,
      //   currentDoc.title,
      //   htmlContent,
      //   {
      //     docId: currentDoc.id,
      //     clientName: clientName,
      //     createdAt: new Date().toISOString(),
      //     totalInvestment: currentDoc.totalInvestment || 0,
      //   }
      // );

      // Dismiss loading toast
      toast.dismiss(toastId);

      if (success) {
        toast.success(`✅ SOW embedded! Available in ${clientName}'s workspace AND master dashboard.`, {
          duration: 5000,
        });
        
        // Save workspace slug to database (non-blocking)
        if (currentDoc.folderId) {
          fetch(`/api/folders/${currentDoc.folderId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspaceSlug }),
          }).catch(err => console.warn('Failed to save workspace slug:', err));
        }
      } else {
        toast.error('Failed to embed SOW - check console for details', {
          duration: 7000,
        });
      }
    } catch (error: any) {
      console.error('❌ Error embedding to AI:', error);
      toast.dismiss(toastId);
      toast.error(`Error: ${error.message || 'Unknown error'}`, {
        duration: 7000,
      });
    }
  };

  const handleOpenAIChat = () => {
    if (!currentDoc) {
      toast.error('No document selected');
      return;
    }

    // Get workspace slug from localStorage
    const clientName = currentDoc.title.split(':')[1]?.split('-')[0]?.trim() || 'default-client';
    const workspaceSlug = localStorage.getItem(`workspace_${currentDoc.id}`) || 
      clientName.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');

    // Open AnythingLLM in new tab
    const url = anythingLLM.getWorkspaceChatUrl(workspaceSlug);
    window.open(url, '_blank');
  };

  const handleShare = async () => {
    if (!currentDocId) {
      toast.error('Please select a document first');
      return;
    }
    
    try {
      // Get or create share link (only generated once per document)
      const baseUrl = window.location.origin;
      const shareLink = `${baseUrl}/portal/sow/${currentDocId}`;
      
      console.log('📤 Share link generated:', shareLink);
      
      // Copy to clipboard with fallback
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareLink);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareLink;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      
      // Show share modal with all details
      setShareModalData({
        shareLink,
        documentTitle: currentDoc?.title || 'SOW',
        shareCount: 1,
        firstShared: new Date().toISOString(),
        lastShared: new Date().toISOString(),
      });
      setShowShareModal(true);
      
      toast.success('✅ Share link copied to clipboard!');
    } catch (error) {
      console.error('Error sharing:', error);
      toast.error('Failed to copy link');
    }
  };

  const handleExportPDF = async () => {
    if (!currentDoc || !editorRef.current) {
      toast.error('❌ No document selected');
      return;
    }
    
    toast.info('📄 Generating PDF...');
    
    try {
      // Build clean HTML from TipTap JSON to ensure proper tables/lists
      const editorHTML = convertNovelToHTML(currentDoc.content);
      
      if (!editorHTML || editorHTML.trim() === '' || editorHTML === '<p></p>') {
        toast.error('❌ Document is empty. Please add content before exporting.');
        return;
      }
      
      const filename = currentDoc.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      
      // Call WeasyPrint PDF service via Next.js API
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          html_content: editorHTML,
          filename: filename
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('PDF service error:', errorText);
        toast.error(`❌ PDF service error: ${response.status}`);
        throw new Error(`PDF service error: ${errorText}`);
      }
      
      // Download the PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('✅ PDF downloaded successfully!');
      
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error(`❌ Error exporting PDF: ${error.message}`);
    }
  };

  const handleExportExcel = async () => {
    if (!currentDoc) {
      toast.error('❌ No document selected');
      return;
    }
    toast.info('📊 Generating Excel...');
    try {
      const res = await fetch(`/api/sow/${currentDocId}/export-excel`, {
        method: 'GET',
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Export failed (${res.status}): ${txt}`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeTitle = (currentDoc.title || 'Statement_of_Work').replace(/[^a-z0-9]/gi, '_');
      a.download = `${safeTitle}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('✅ Excel downloaded successfully!');
    } catch (error: any) {
      console.error('Error exporting Excel:', error);
      toast.error(`❌ Error exporting Excel: ${error?.message || 'Unknown error'}`);
    }
  };

  // Create Google Sheet with OAuth token
  const createGoogleSheet = async (accessToken: string) => {
    if (!currentDoc) {
      toast.error('❌ No document selected');
      return;
    }

    toast.info('📊 Creating Google Sheet...');

    try {
      // Extract pricing from content
      const pricing = extractPricingFromContent(currentDoc.content);
      
      // Prepare SOW data
      const sowData = {
        clientName: currentDoc.title.split(' - ')[0] || 'Client',
        serviceName: currentDoc.title.split(' - ')[1] || 'Service',
        accessToken: accessToken,
        overview: cleanSOWContent(currentDoc.content),
        deliverables: '',
        outcomes: '',
        phases: '',
        pricing: pricing || [],
        assumptions: '',
        timeline: '',
      };

      const response = await fetch('/api/create-sow-sheet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sowData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create sheet');
      }

      const result = await response.json();
      
      toast.success('✅ Google Sheet created!');
      
      // Show link to user
      setTimeout(() => {
        const openSheet = window.confirm(`Sheet created!\n\nClick OK to open in Google Sheets, or Cancel to copy the link.`);
        if (openSheet) {
          window.open(result.sheet_url, '_blank');
        } else {
          navigator.clipboard.writeText(result.share_link);
          toast.success('📋 Share link copied!');
        }
      }, 500);
    } catch (error) {
      console.error('Error creating sheet:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create sheet');
    }
  };

  // Google Sheets handler - OAuth flow
  const handleCreateGSheet = async () => {
    if (!currentDoc) {
      toast.error('❌ No document selected');
      return;
    }

    // If already authorized, create sheet directly
    if (isOAuthAuthorized && oauthAccessToken) {
      createGoogleSheet(oauthAccessToken);
      return;
    }

    toast.info('📊 Starting Google authorization...');

    try {
      // Get current URL to return to after OAuth
      const returnUrl = window.location.pathname + window.location.search;
      
      // Get authorization URL from backend
      const response = await fetch(`/api/oauth/authorize?returnUrl=${encodeURIComponent(returnUrl)}`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to get authorization URL');
      }

      const data = await response.json();
      
      // Redirect to Google OAuth
      window.location.href = data.auth_url;
    } catch (error) {
      console.error('Error starting GSheet creation:', error);
      toast.error('Failed to authorize with Google');
    }
  };

  // Helper function to convert Novel JSON to HTML
  const convertNovelToHTML = (content: any) => {
    if (!content || !content.content) return '';

  let html = '';

    const processTextNode = (textNode: any): string => {
      if (!textNode) return '';
      let text = textNode.text || '';
      if (textNode.marks) {
        textNode.marks.forEach((mark: any) => {
          if (mark.type === 'bold') text = `<strong>${text}</strong>`;
          if (mark.type === 'italic') text = `<em>${text}</em>`;
          if (mark.type === 'underline') text = `<u>${text}</u>`;
        });
      }
      return text;
    };

    const processContent = (contentArray: any[]): string => {
      if (!contentArray) return '';
      return contentArray.map(processTextNode).join('');
    };

  const formatCurrency = (n: number) => (Number(n) || 0).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });

  // Helpers for normalization
  const getPlainText = (node: any): string => {
    if (!node) return '';
    if (node.type === 'text') return node.text || '';
    if (Array.isArray(node.content)) return node.content.map(getPlainText).join('');
    return '';
  };
  const isMarkdownTableLine = (text: string) => /\|.*\|/.test(text.trim());

  // Normalize nodes: strip obsolete 'Investment' markdown section and fix md tables/bullets
  const nodes = content.content as any[];
  const normalized: any[] = [];
  let idx = 0;
  while (idx < nodes.length) {
    const node = nodes[idx];
    // Strip obsolete Investment markdown table section
    if (node.type === 'heading') {
      const title = getPlainText(node).trim().toLowerCase();
      if (title === 'investment') {
        idx++;
        while (idx < nodes.length) {
          const next = nodes[idx];
          if (next.type === 'heading') break;
          const t = getPlainText(next).trim();
          if (!(next.type === 'paragraph' && (isMarkdownTableLine(t) || t.startsWith('|') || /role\s*\|/i.test(t)))) break;
          idx++;
        }
        continue;
      }
    }
    // Group markdown table lines
    if (node.type === 'paragraph') {
      const text = getPlainText(node);
      if (isMarkdownTableLine(text) || text.trim().startsWith('|')) {
        const lines: string[] = [];
        while (idx < nodes.length) {
          const n = nodes[idx];
          if (n.type !== 'paragraph') break;
          const t = getPlainText(n).trim();
          if (!(isMarkdownTableLine(t) || t.startsWith('|'))) break;
          lines.push(t);
          idx++;
        }
        if (lines.length) {
          normalized.push({ type: 'mdTable', lines });
          continue;
        }
      }
      // Group '+' bullets into list
      if (text.trim().startsWith('+ ')) {
        const items: string[] = [];
        while (idx < nodes.length) {
          const n = nodes[idx];
          if (n.type !== 'paragraph') break;
          const t = getPlainText(n);
          if (!t.trim().startsWith('+ ')) break;
          items.push(t.trim().replace(/^\+\s+/, ''));
          idx++;
        }
        if (items.length) {
          normalized.push({ type: 'mdBulletList', items });
          continue;
        }
      }
    }
    normalized.push(node);
    idx++;
  }

  normalized.forEach((node: any) => {
      switch (node.type) {
        case 'heading':
          const level = node.attrs?.level || 1;
          html += `<h${level}>${processContent(node.content)}</h${level}>`;
          break;
        case 'paragraph':
          html += `<p>${processContent(node.content)}</p>`;
          break;
        case 'mdBulletList':
          html += '<ul>';
          node.items.forEach((text: string) => { html += `<li>${text}</li>`; });
          html += '</ul>';
          break;
        case 'bulletList':
          html += '<ul>';
          node.content?.forEach((item: any) => {
            const itemContent = item.content?.[0]?.content ? processContent(item.content[0].content) : '';
            html += `<li>${itemContent}</li>`;
          });
          html += '</ul>';
          break;
        case 'orderedList':
          html += '<ol>';
          node.content?.forEach((item: any) => {
            const itemContent = item.content?.[0]?.content ? processContent(item.content[0].content) : '';
            html += `<li>${itemContent}</li>`;
          });
          html += '</ol>';
          break;
        case 'table':
          html += '<table>';
          if (Array.isArray(node.content) && node.content.length > 0) {
            const headerRow = node.content[0];
            html += '<thead><tr>';
            headerRow.content?.forEach((cell: any) => {
              const cellContent = cell.content?.[0]?.content ? processContent(cell.content[0].content) : '';
              html += `<th>${cellContent}</th>`;
            });
            html += '</tr></thead>';
            if (node.content.length > 1) {
              html += '<tbody>';
              node.content.slice(1).forEach((row: any) => {
                html += '<tr>';
                row.content?.forEach((cell: any) => {
                  const cellContent = cell.content?.[0]?.content ? processContent(cell.content[0].content) : '';
                  html += `<td>${cellContent}</td>`;
                });
                html += '</tr>';
              });
              html += '</tbody>';
            }
          }
          html += '</table>';
          break;
        case 'mdTable': {
          const rows = node.lines
            .map((line: string) => line.trim())
            .filter((line: string) => line.startsWith('|'))
            .map((line: string) => line.replace(/^\||\|$/g, ''))
            .map((line: string) => line.split('|').map((c: string) => c.trim()));
          if (!rows.length) break;
          const hasAlignRow = rows.length > 1 && rows[1].every((cell: string) => /:?-{3,}:?/.test(cell));
          const header = rows[0];
          const bodyRows = hasAlignRow ? rows.slice(2) : rows.slice(1);
          html += '<table>';
          html += '<thead><tr>' + header.map((h: string) => `<th>${h}</th>`).join('') + '</tr></thead>';
          if (bodyRows.length) {
            html += '<tbody>' + bodyRows.map((r: string[]) => `<tr>${r.map((c: string) => `<td>${c}</td>`).join('')}</tr>`).join('') + '</tbody>';
          }
          html += '</table>';
          break;
        }
          break;
        case 'horizontalRule':
          html += '<hr />';
          break;
        case 'editablePricingTable':
          // Render editable pricing table as HTML table for PDF export
          const rows = node.attrs?.rows || [];
          const discount = node.attrs?.discount || 0;
          
          html += '<h3>Project Pricing</h3>';
          html += '<table>';
          html += '<tr><th>Role</th><th>Description</th><th>Hours</th><th>Rate (AUD)</th><th class="num">Cost (AUD)</th></tr>';
          
          let subtotal = 0;
          rows.forEach((row: any) => {
            const cost = row.hours * row.rate;
            subtotal += cost;
            html += `<tr>`;
            html += `<td>${row.role}</td>`;
            html += `<td>${row.description}</td>`;
            html += `<td class="num">${Number(row.hours) || 0}</td>`;
            html += `<td class="num">${formatCurrency(row.rate)}</td>`;
            html += `<td class="num">${formatCurrency(cost)}</td>`;
            html += `</tr>`;
          });
          
          html += '</table>';
          
          // Summary section
          html += '<h4 style="margin-top: 20px;">Summary</h4>';
          html += '<table class="summary-table">';
          html += `<tr><td style="text-align: right; padding-right: 12px;"><strong>Subtotal:</strong></td><td class="num">${formatCurrency(subtotal)}</td></tr>`;
          
          if (discount > 0) {
            const discountAmount = subtotal * (discount / 100);
            const afterDiscount = subtotal - discountAmount;
            html += `<tr><td style="text-align: right; padding-right: 12px; color: #dc2626;"><strong>Discount (${discount}%):</strong></td><td class="num" style="color: #dc2626;">-${formatCurrency(discountAmount)}</td></tr>`;
            html += `<tr><td style="text-align: right; padding-right: 12px;"><strong>After Discount:</strong></td><td class="num">${formatCurrency(afterDiscount)}</td></tr>`;
            subtotal = afterDiscount;
          }
          
          const gst = subtotal * 0.1;
          const total = subtotal + gst;
          
          html += `<tr><td style="text-align: right; padding-right: 12px;"><strong>GST (10%):</strong></td><td class="num">${formatCurrency(gst)}</td></tr>`;
          html += `<tr style="border-top: 2px solid #2C823D;"><td style="text-align: right; padding-right: 12px; padding-top: 8px;"><strong>Total Project Value:</strong></td><td class="num" style="padding-top: 8px; color: #2C823D; font-size: 18px;"><strong>${formatCurrency(total)}</strong></td></tr>`;
          html += '</table>';
          break;
        default:
          if (node.content) {
            html += `<p>${processContent(node.content)}</p>`;
          }
      }
    });

    return html;
  };

  const handleUpdateDoc = (content: any) => {
    // Track the newest JSON to trigger save effect
    setLatestEditorJSON(content);
    if (currentDocId) {
      setDocuments(prev => prev.map(d => d.id === currentDocId ? { ...d, content } : d));
    }
  };

  const handleCreateAgent = async (agent: Omit<Agent, 'id'>) => {
    const newId = `agent${Date.now()}`;
    const newAgent: Agent = { id: newId, ...agent };
    
    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAgent)
      });
      
      if (response.ok) {
        setAgents(prev => [...prev, newAgent]);
        setCurrentAgentId(newId);
        console.log('✅ Agent created in database');
      }
    } catch (error) {
      console.error('❌ Failed to create agent:', error);
    }
  };

  const handleSelectAgent = async (id: string) => {
    setCurrentAgentId(id);
    
    // ⚠️ REMOVED DATABASE CALLS - AnythingLLM handles message storage via threads
    // Chat history is maintained by AnythingLLM's workspace threads system
    // No need to duplicate in MySQL database
    setChatMessages([]); // Start fresh - AnythingLLM maintains history in its threads
    
    console.log(`✅ Agent selected: ${id}. Chat history managed by AnythingLLM threads.`);
  };

  const handleUpdateAgent = async (id: string, updates: Partial<Agent>) => {
    try {
      const response = await fetch(`/api/agents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (response.ok) {
        setAgents(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
        console.log('✅ Agent updated in database');
      }
    } catch (error) {
      console.error('❌ Failed to update agent:', error);
    }
  };

  // 🔀 Reactive chat context switching between Dashboard and Editor
  useEffect(() => {
    const switchContext = async () => {
      if (viewMode === 'dashboard') {
        // Clear any SOW chat messages to avoid context leakage
        setChatMessages([]);
        setStreamingMessageId(null);
      } else if (viewMode === 'editor') {
        // Load SOW thread history for the current document if available
        const doc = currentDocId ? documents.find(d => d.id === currentDocId) : null;
        if (doc?.threadSlug && doc.workspaceSlug) {
          try {
            console.log('💬 [Context Switch] Loading SOW chat history for thread:', doc.threadSlug);
            const history = await anythingLLM.getThreadChats(doc.workspaceSlug, doc.threadSlug);
            const messages: ChatMessage[] = (history || []).map((msg: any) => ({
              id: `msg${Date.now()}-${Math.random()}`,
              role: msg.role === 'user' ? 'user' : 'assistant',
              content: msg.content,
              timestamp: Date.now(),
            }));
            setChatMessages(messages);
          } catch (e) {
            console.warn('⚠️ Failed to load SOW chat history on context switch:', e);
            setChatMessages([]);
          }
        } else {
          // No thread yet; start clean
          setChatMessages([]);
        }
      }
    };

    switchContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  const handleDeleteAgent = async (id: string) => {
    try {
      const response = await fetch(`/api/agents/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setAgents(prev => prev.filter(a => a.id !== id));
        if (currentAgentId === id) {
          setCurrentAgentId(null);
          setChatMessages([]);
        }
        console.log('✅ Agent deleted from database (messages cascade deleted)');
      }
    } catch (error) {
      console.error('❌ Failed to delete agent:', error);
    }
  };

  const handleInsertContent = async (content: string, suggestedRoles: any[] = []) => {
    console.log('📝 Inserting content into editor:', content.substring(0, 100));
    console.log('📝 Editor ref exists:', !!editorRef.current);
    console.log('📄 Current doc ID:', currentDocId);
    
    if (!editorRef.current) {
      console.error("Editor not initialized, cannot insert content.");
      return;
    }
    
    if (!content || !currentDocId) {
      console.error('❌ Missing content or document ID');
      return;
    }

    try {
      // 1. Separate Markdown from JSON
      let markdownPart = content;
      // let suggestedRoles: any[] = []; // Now passed as an argument
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);

      let hasValidSuggestedRoles = false;
      if (jsonMatch && jsonMatch[1]) {
        try {
          const parsedJson = JSON.parse(jsonMatch[1]);
          if (parsedJson.suggestedRoles) {
            // If roles are embedded in the content, merge them with any passed roles
            suggestedRoles = [...suggestedRoles, ...parsedJson.suggestedRoles];
            // Remove the JSON block from the markdown content
            markdownPart = content.replace(jsonMatch[0], '').trim();
            console.log(`✅ Parsed ${suggestedRoles.length} suggested roles from AI response.`);
            hasValidSuggestedRoles = suggestedRoles.length > 0;
          }
        } catch (e) {
          console.warn('⚠️ Could not parse suggestedRoles JSON from AI response.', e);
        }
      }

      // 2. Clean the markdown content
      console.log('🧹 Cleaning SOW content...');
      const cleanedContent = cleanSOWContent(markdownPart);
      console.log('✅ Content cleaned');
      
      // 3. Validate suggestedRoles were properly extracted
      console.log('🔄 Converting markdown to JSON with suggested roles...');
      console.log('📊 suggestedRoles array:', suggestedRoles);
      console.log('📊 suggestedRoles length:', suggestedRoles?.length || 0);
      
      // CRITICAL: If no suggestedRoles provided, activate SAFE FALLBACK
      let convertedContent;
      if (!hasValidSuggestedRoles) {
        console.error('❌ CRITICAL ERROR: AI did not provide suggestedRoles JSON. The application requires a JSON block with suggestedRoles array.');
        console.log('✅ SAFE FALLBACK ACTIVATED: Inserting SOW narrative with a default, empty pricing table.');
        toast.warning('Warning: AI failed to generate a valid price table. A default table has been inserted. Please review and update manually.');
        convertedContent = convertMarkdownToNovelJSON(cleanedContent, [], { strictRoles: true });
      } else {
        convertedContent = convertMarkdownToNovelJSON(cleanedContent, suggestedRoles, { strictRoles: false });
      }
      console.log('✅ Content converted');
      
      // 4. Extract title from the content
      const titleMatch = cleanedContent.match(/^#\s+(.+)$/m);
      const clientMatch = cleanedContent.match(/\*\*Client:\*\*\s+(.+)$/m);
      const scopeMatch = cleanedContent.match(/Scope of Work:\s+(.+)/);
      
      let docTitle = "New SOW";
      if (titleMatch) {
        docTitle = titleMatch[1];
      } else if (scopeMatch) {
        docTitle = scopeMatch[1];
      } else if (clientMatch) {
        docTitle = `SOW - ${clientMatch[1]}`;
      }
      
      // 5. Merge or set editor content depending on existing content
      let finalContent = convertedContent;
      const existing = editorRef.current?.getContent?.();
      const isTrulyEmpty = !existing 
        || !Array.isArray(existing.content) 
        || existing.content.length === 0 
        || (existing.content.length === 1 
            && existing.content[0]?.type === 'paragraph' 
            && (!existing.content[0].content || existing.content[0].content.length === 0));

      if (!isTrulyEmpty) {
        // Replace the entire document on first proper insert from AI
        // The convertedContent already merges narrative + pricing table
        finalContent = {
          ...convertedContent,
          content: sanitizeEmptyTextNodes(convertedContent.content)
        } as any;
        console.log('📝 Replacing existing non-empty editor with full merged content');
      } else {
        // Fresh set for truly empty editor
        finalContent = {
          ...convertedContent,
          content: sanitizeEmptyTextNodes(convertedContent.content)
        } as any;
        console.log('🆕 Setting content on empty editor');
      }

      // Update editor
      if (editorRef.current) {
        if (editorRef.current.commands?.setContent) {
          editorRef.current.commands.setContent(finalContent);
        } else {
          editorRef.current.insertContent(finalContent);
        }
        console.log('✅ Editor content updated successfully');
      } else {
        console.warn('⚠️ Editor ref not available, skipping direct update');
      }

      // 6. Update the document state with new content and title
      console.log('📝 Updating document state and title:', docTitle);
      const newContentForState = finalContent;
      setDocuments(prev =>
        prev.map(doc =>
          doc.id === currentDocId
            ? { ...doc, content: newContentForState, title: docTitle }
            : doc
        )
      );
      console.log('✅ Document state updated successfully');
      
      // 7. Embed SOW in both client workspace and master dashboard
      const currentAgent = agents.find(a => a.id === currentAgentId);
      const useAnythingLLM = currentAgent?.model === 'anythingllm';
      
      if (useAnythingLLM && currentAgentId) {
        console.log('🤖 Embedding SOW in workspaces...');
        try {
          const clientWorkspaceSlug = getWorkspaceForAgent(currentAgentId);
          const success = await anythingLLM.embedSOWInBothWorkspaces(clientWorkspaceSlug, docTitle, cleanedContent);
          
          if (success) {
            console.log('✅ SOW embedded in both workspaces successfully');
            toast.success("✅ Content inserted and embedded in both workspaces!");
          } else {
            console.warn('⚠️ Embedding completed with warnings');
            toast.success("✅ Content inserted to editor (workspace embedding had issues)");
          }
        } catch (embedError) {
          console.error('⚠️ Embedding error:', embedError);
          toast.success("✅ Content inserted to editor (embedding skipped)");
        }
      } else {
        toast.success("✅ Content inserted into editor!");
      }
    } catch (error) {
      console.error("Error inserting content:", error);
      toast.error("❌ Failed to insert content. Please try again.");
    }
  };

  const [currentRequestController, setCurrentRequestController] = useState<AbortController | null>(null);
  const [lastMessageSentTime, setLastMessageSentTime] = useState<number>(0);
  const MESSAGE_RATE_LIMIT = 1000; // Wait at least 1 second between messages to avoid rate limiting

  const handleSendMessage = async (
    message: string,
    threadSlugParam?: string | null,
    attachments?: Array<{ name: string; mime: string; contentString: string }>
  ) => {
    // In dashboard mode, we don't need an agent selected - use dashboard workspace directly
    const isDashboardMode = viewMode === 'dashboard';
    
    if (!message.trim()) return;
    if (!isDashboardMode && !currentAgentId) return; // Only require agent in editor mode

    // Rate limiting: prevent sending messages too quickly
    const now = Date.now();
    if (now - lastMessageSentTime < MESSAGE_RATE_LIMIT) {
      console.warn(`⏱️ Rate limit: Please wait before sending another message. (${Math.ceil((MESSAGE_RATE_LIMIT - (now - lastMessageSentTime)) / 1000)}s)`);
      toast.error("⏱️ Please wait a moment before sending another message.");
      return;
    }
    setLastMessageSentTime(now);

    // Cancel any previous ongoing request to avoid flooding the API
    if (currentRequestController) {
      console.log('🛑 Cancelling previous request to avoid rate limiting...');
      currentRequestController.abort();
    }

    // Create new AbortController for this request
    const controller = new AbortController();
    setCurrentRequestController(controller);

    setIsChatLoading(true);

    // Check for insert command (only relevant in editor mode)
    if (!isDashboardMode && (
        message.toLowerCase().includes('insert into editor') ||
        message.toLowerCase() === 'insert' ||
        message.toLowerCase().includes('add to editor')
    )) {
      console.log('📝 Insert command detected!', { message });
      setIsChatLoading(false);
      
      // Find the last AI response in chat history (excluding confirmation messages)
      const lastAIMessage = [...chatMessages].reverse().find(msg => 
        msg.role === 'assistant' && 
        !msg.content.includes('✅ SOW has been inserted') &&
        !msg.content.includes('Ready to insert')
      );
      
      console.log('📋 Found AI message:', lastAIMessage?.content.substring(0, 100));
      console.log('📝 Editor ref exists:', !!editorRef.current);
      console.log('📄 Current doc ID:', currentDocId);
      
      if (lastAIMessage && currentDocId) {
        try {
          // 1. Separate Markdown from JSON from the last AI message
          let markdownPart = lastAIMessage.content;
          let suggestedRoles: any[] = [];
          const jsonMatch = markdownPart.match(/```json\s*([\s\S]*?)\s*```/);

          let hasValidSuggestedRoles = false;
          if (jsonMatch && jsonMatch[1]) {
            try {
              const parsedJson = JSON.parse(jsonMatch[1]);
              if (parsedJson.suggestedRoles) {
                suggestedRoles = parsedJson.suggestedRoles;
                markdownPart = markdownPart.replace(jsonMatch[0], '').trim();
                console.log(`✅ Parsed ${suggestedRoles.length} roles from "insert" command.`);
                hasValidSuggestedRoles = suggestedRoles.length > 0;
              }
            } catch (e) {
              console.warn('⚠️ Could not parse suggestedRoles JSON from last AI message.', e);
            }
          }

          // 2. Clean the markdown content
          console.log('🧹 Cleaning SOW content for insertion...');
          const cleanedMessage = cleanSOWContent(markdownPart);
          console.log('✅ Content cleaned');
          
          // 3. Convert markdown and roles to Novel/TipTap JSON
          console.log('🔄 Converting markdown to JSON for insertion...');
          let content;
          if (!hasValidSuggestedRoles) {
            console.error('❌ CRITICAL ERROR: AI did not provide suggestedRoles JSON for insert command.');
            console.log('✅ SAFE FALLBACK ACTIVATED: Inserting SOW narrative with a default, empty pricing table.');
            toast.warning('Warning: AI failed to generate a valid price table. A default table has been inserted. Please review and update manually.');
            content = convertMarkdownToNovelJSON(cleanedMessage, [], { strictRoles: true });
          } else {
            content = convertMarkdownToNovelJSON(cleanedMessage, suggestedRoles, { strictRoles: false });
          }
          console.log('✅ Content converted');
          
          // 4. Extract title from the SOW content
          const titleMatch = cleanedMessage.match(/^#\s+(.+)$/m);
          const clientMatch = cleanedMessage.match(/\*\*Client:\*\*\s+(.+)$/m);
          const scopeMatch = cleanedMessage.match(/Scope of Work:\s+(.+)/);
          
          let docTitle = "New SOW";
          if (titleMatch) {
            docTitle = titleMatch[1];
          } else if (scopeMatch) {
            docTitle = scopeMatch[1];
          } else if (clientMatch) {
            docTitle = `SOW - ${clientMatch[1]}`;
          }
          
          // 5. Determine if editor is truly empty; if not, replace with full merged content
          const existing = editorRef.current?.getContent?.();
          const isTrulyEmpty = !existing 
            || !Array.isArray(existing.content) 
            || existing.content.length === 0 
            || (existing.content.length === 1 
                && existing.content[0]?.type === 'paragraph' 
                && (!existing.content[0].content || existing.content[0].content.length === 0));
          const finalContent = {
            ...content,
            content: sanitizeEmptyTextNodes(content.content)
          };
          console.log('🧩 Chat insert: applying full merged content. Empty editor:', isTrulyEmpty);

          // 6. Update the document state
          console.log('📝 Updating document state:', docTitle, ' Empty editor:', isTrulyEmpty);
          setDocuments(prev =>
            prev.map(doc =>
              doc.id === currentDocId
                ? { ...doc, content: finalContent, title: docTitle }
                : doc
            )
          );

          // 7. Save to database (this is a critical user action)
          console.log('💾 Saving SOW to database...');
          try {
            await fetch(`/api/sow/${currentDocId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: docTitle,
                content: finalContent, // Send the merged rich JSON content
              }),
            });
            console.log('✅ SOW saved to database successfully');
          } catch (saveError) {
            console.error('❌ Database save error:', saveError);
          }
          
          // 8. Update the editor directly with full merged content
          if (editorRef.current) {
            if (editorRef.current.commands?.setContent) {
              editorRef.current.commands.setContent(finalContent);
            } else {
              editorRef.current.insertContent(finalContent);
            }
          }
          
          // 9. Embed SOW in both client workspace and master dashboard
          const currentAgent = agents.find(a => a.id === currentAgentId);
          if (currentAgent?.model === 'anythingllm' && currentAgentId) {
            console.log('🤖 Embedding SOW in AnythingLLM workspaces...');
            try {
              const clientWorkspaceSlug = getWorkspaceForAgent(currentAgentId);
              await anythingLLM.embedSOWInBothWorkspaces(clientWorkspaceSlug, docTitle, cleanedMessage);
              console.log('✅ SOW embedded in both AnythingLLM workspaces');
            } catch (embedError) {
              console.error('⚠️ AnythingLLM embedding error:', embedError);
            }
          }
          
          // 10. Add confirmation message to chat
          const confirmMessage: ChatMessage = {
            id: `msg${Date.now()}`,
            role: 'assistant',
            content: "✅ SOW has been inserted into the editor, saved, and embedded in the knowledge base!",
            timestamp: Date.now(),
          };
          setChatMessages(prev => [...prev, confirmMessage]);
          
          return;
        } catch (error) {
          console.error("Error inserting content:", error);
          const errorMessage: ChatMessage = {
            id: `msg${Date.now()}`,
            role: 'assistant',
            content: "❌ Error inserting content into editor. Please try again.",
            timestamp: Date.now(),
          };
          setChatMessages(prev => [...prev, errorMessage]);
          return;
        }
      }
    }

    // 🎯 AUTO-DETECT CLIENT NAME from user prompt
    const detectedClientName = extractClientName(message);
    if (detectedClientName && currentDocId) {
      console.log('🏢 Detected client name in prompt:', detectedClientName);
      
      // Auto-rename SOW to include client name
      const newSOWTitle = `SOW - ${detectedClientName}`;
      
      // Update document title in state
      setDocuments(prev =>
        prev.map(doc =>
          doc.id === currentDocId
            ? { ...doc, title: newSOWTitle }
            : doc
        )
      );
      
      // Save to database
      fetch('/api/sow/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentDocId,
          title: newSOWTitle,
          clientName: detectedClientName,
        }),
      }).catch(err => console.error('❌ Failed to auto-rename SOW:', err));
      
      console.log('✅ Auto-renamed SOW to:', newSOWTitle);
      toast.success(`🏢 Auto-detected client: ${detectedClientName}`);
    }

    const userMessage: ChatMessage = {
      id: `msg${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };

    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);
    
    // ⚠️ REMOVED DATABASE SAVE - AnythingLLM handles all message storage

    const currentAgent = agents.find(a => a.id === currentAgentId);
    
    // In dashboard mode, we use a simulated agent configuration with OpenRouter
    // 🔧 Changed from 'anythingllm' to use OpenRouter directly (no RAG needed)
    const effectiveAgent = isDashboardMode ? {
      id: 'dashboard',
      name: 'Dashboard AI',
      systemPrompt: 'You are a helpful AI assistant for the Social Garden SOW Generator platform. You help users with creating SOWs, understanding features, and general questions. Be helpful, friendly, and concise.',
      model: 'anythingllm' // ✅ Use AnythingLLM for dashboard (routes to master-dashboard workspace)
    } : currentAgent;
    
    if (effectiveAgent) {
      try {
        const useAnythingLLM = effectiveAgent.model === 'anythingllm';
        
        // 🎯 WORKSPACE SELECTOR ROUTING:
        // Master View → /api/dashboard/chat (hardcoded to sow-master-dashboard-54307162)
        // Client Workspace → /api/anythingllm/chat (with selected workspace slug)
        // Editor Mode → existing logic
        let endpoint: string;
        let workspaceSlug: string | undefined;

        if (isDashboardMode && useAnythingLLM) {
          // Dashboard mode routing
          if (dashboardChatTarget === 'sow-master-dashboard') {
            // Master view: use dedicated dashboard route
            endpoint = '/api/anythingllm/stream-chat';
            workspaceSlug = 'sow-master-dashboard';
          } else {
            // Client-specific view: use general AnythingLLM route with workspace slug
            endpoint = '/api/anythingllm/chat';
            workspaceSlug = dashboardChatTarget;
          }
        } else {
          // Editor mode routing (existing logic)
          endpoint = useAnythingLLM ? '/api/anythingllm/chat' : '/api/chat';
          workspaceSlug = useAnythingLLM && !isDashboardMode 
            ? getWorkspaceForAgent(currentAgentId || '') 
            : undefined;
        }

        // 🎯 USE THE SOW'S ACTUAL WORKSPACE (NOT FORCED GEN-THE-ARCHITECT)
        // Each SOW has its thread in its client workspace (e.g., "hello", "pho", etc.)
        // Don't force gen-the-architect - that breaks thread routing!
        if (!isDashboardMode && useAnythingLLM && currentSOWId) {
          const currentSOW = documents.find(d => d.id === currentSOWId);
          if (currentSOW?.workspaceSlug) {
            workspaceSlug = currentSOW.workspaceSlug; // Use the SOW's actual workspace
            console.log(`🎯 [SOW Chat] Using SOW workspace: ${workspaceSlug}`);
          }
        }

        console.log('🎯 [Chat Routing]', {
          isDashboardMode,
          useAnythingLLM,
          dashboardChatTarget,
          endpoint,
          workspaceSlug,
          agentModel: effectiveAgent.model,
          agentName: effectiveAgent.name,
          routeType: isDashboardMode 
            ? (dashboardChatTarget === 'sow-master-dashboard' ? 'MASTER_DASHBOARD' : 'CLIENT_WORKSPACE')
            : 'SOW_GENERATION'
        });

        // 🌊 STREAMING SUPPORT: Use stream-chat endpoint for AnythingLLM
        const shouldStream = useAnythingLLM;
        const streamEndpoint = endpoint.includes('/stream-chat') ? endpoint : endpoint.replace('/chat', '/stream-chat');
        
        if (shouldStream) {
          // 🔒 Enforce JSON contract by appending instruction to the last user prompt (request-only)
          const contractSuffix = "IMPORTANT: Your response MUST contain two parts in order: first, a complete SOW narrative written in Markdown, and second, a single ```json code block at the end. The JSON must be a valid object with a \"scopeItems\" array. Each item MUST include: name (string), overview (string), roles (array of { role, hours }), deliverables (string[]), and assumptions (string[]). Do not include rates or totals in JSON.";
          const requestMessages = [
            { role: "system", content: effectiveAgent.systemPrompt },
            ...newMessages.slice(0, Math.max(0, newMessages.length - 1)).map(m => ({ role: m.role, content: m.content })),
            // Append enforcement only to the last user message for the AI request
            newMessages.length > 0
              ? {
                  role: newMessages[newMessages.length - 1].role,
                  content: `${newMessages[newMessages.length - 1].content.trim()}\n\n${contractSuffix}`,
                }
              : undefined,
          ].filter(Boolean) as Array<{ role: string; content: string }>;
          // ✨ STREAMING MODE: Real-time response with thinking display
          const aiMessageId = `msg${Date.now() + 1}`;
          let accumulatedContent = '';
          
          // Create initial empty AI message
          const initialAIMessage: ChatMessage = {
            id: aiMessageId,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
          };
          setChatMessages(prev => [...prev, initialAIMessage]);
          setStreamingMessageId(aiMessageId);

          // Determine thread slug based on mode
          let threadSlugToUse: string | undefined;
          if (threadSlugParam) {
            // Always prefer explicitly provided thread slug (works for both dashboard and editor modes)
            threadSlugToUse = threadSlugParam || undefined;
          } else if (isDashboardMode) {
            // Dashboard fallback: no explicit thread provided
            threadSlugToUse = undefined;
          } else if (currentDocId) {
            // Editor mode fallback: current document's thread
            threadSlugToUse = documents.find(d => d.id === currentDocId)?.threadSlug || undefined;
          }

          const response = await fetch(streamEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            signal: controller.signal, // 🛑 Allow cancellation of this request
            body: JSON.stringify({
              model: effectiveAgent.model,
              workspace: workspaceSlug,
              threadSlug: threadSlugToUse,
              attachments: attachments || [], // Include file attachments from sidebar
              messages: requestMessages,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = "Sorry, there was an error processing your request.";

            if (response.status === 400) {
              errorMessage = "⚠️ AnythingLLM error: Invalid request. Please check the workspace configuration.";
            } else if (response.status === 401 || response.status === 403) {
              errorMessage = "⚠️ AnythingLLM authentication failed. Please check the API key configuration.";
            } else if (response.status === 404) {
              errorMessage = `⚠️ AnythingLLM workspace '${workspaceSlug}' not found. Please verify it exists.`;
            }

            setChatMessages(prev => 
              prev.map(msg => msg.id === aiMessageId 
                ? { ...msg, content: errorMessage }
                : msg
              )
            );
            setStreamingMessageId(null);
            return;
          }

          // Read the SSE stream
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (!reader) {
            console.error('❌ No response body reader available');
            setStreamingMessageId(null);
            return;
          }

          try {
            let buffer = '';
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) {
                console.log('✅ Stream complete');
                setStreamingMessageId(null);
                break;
              }

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (!line.trim() || !line.startsWith('data: ')) continue;
                
                try {
                  const jsonStr = line.substring(6); // Remove 'data: ' prefix
                  const data = JSON.parse(jsonStr);
                  
                  // Handle different message types from AnythingLLM stream
                  if (data.type === 'textResponseChunk' && data.textResponse) {
                    accumulatedContent += data.textResponse;
                    
                    // Update the message content in real-time
                    setChatMessages(prev =>
                      prev.map(msg =>
                        msg.id === aiMessageId
                          ? { ...msg, content: accumulatedContent }
                          : msg
                      )
                    );
                  } else if (data.type === 'textResponse') {
                    // Final response (fallback for non-chunked)
                    accumulatedContent = data.content || data.textResponse || '';
                    setChatMessages(prev =>
                      prev.map(msg =>
                        msg.id === aiMessageId
                          ? { ...msg, content: accumulatedContent }
                          : msg
                      )
                    );
                  }
                } catch (parseError) {
                  console.error('Failed to parse SSE data:', parseError);
                }
              }
            }
          } catch (streamError) {
            console.error('❌ Stream reading error:', streamError);
            setStreamingMessageId(null);
          }

          console.log('✅ Streaming complete, total content length:', accumulatedContent.length);
          
          // 🎯 Extract work type from the accumulated AI response
          const detectedWorkType = extractWorkType(accumulatedContent);
          
          // Update current document with detected work type
          if (currentDocId && detectedWorkType) {
            setDocuments(prev => 
              prev.map(doc => 
                doc.id === currentDocId 
                  ? { ...doc, workType: detectedWorkType }
                  : doc
              )
            );
            console.log(`🎯 Updated document ${currentDocId} with work type: ${detectedWorkType}`);
          }

          // 🧩 Also try to capture modular Architect JSON into state for Excel engine v2
          try {
            const structured = extractSOWStructuredJson(accumulatedContent);
            if (structured?.scopeItems?.length) {
              setStructuredSow(structured);
              console.log('✅ Captured structured SOW JSON for Excel export');
            }
          } catch {}

          // ✅ ENFORCE JSON CONTRACT: If the AI didn't include a scopeItems JSON block,
          // automatically ask for it in a follow-up message and append to the assistant reply.
          const jsonMatch = accumulatedContent.match(/```json\s*([\s\S]*?)\s*```/m);
          const hasScopeItemsJson = !!(jsonMatch && /\"scopeItems\"\s*:\s*\[/m.test(jsonMatch[1] || ''));
          if (!hasScopeItemsJson && useAnythingLLM && workspaceSlug) {
            try {
              const followUpPrompt = [
                'FINAL MANDATORY STEP: Return ONLY a JSON code block with this exact schema (no prose).',
                '```json',
                '{',
                '  \"scopeItems\": [',
                '    {',
                '      \"name\": \"<Phase Name>\",',
                '      \"overview\": \"<Short overview>\",',
                '      \"roles\": [ { \"role\": \"<Valid role from rate card>\", \"hours\": <number> } ],',
                '      \"deliverables\": [\"...\"],',
                '      \"assumptions\": [\"...\"]',
                '    }',
                '  ]',
                '}',
                '```',
                '',
                'Constraints:',
                '- The phases must align with the narrative you provided earlier.',
                '- Each phase MUST include roles[] with role names from the Social Garden rate card and hours only (no rates or totals).'
              ].join('\n');

              // Stream a short follow-up request on the same thread to obtain the JSON
              const followUpResponse = await fetch(streamEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                  model: effectiveAgent.model,
                  workspace: workspaceSlug,
                  threadSlug: threadSlugToUse,
                  attachments: [],
                  messages: [
                    { role: 'user', content: followUpPrompt }
                  ],
                }),
              });

              if (followUpResponse.ok) {
                const reader2 = followUpResponse.body?.getReader();
                const decoder2 = new TextDecoder();
                let buffer2 = '';
                let accumulatedJson = '';
                if (reader2) {
                  let done2 = false;
                  while (!done2) {
                    const { done, value } = await reader2.read();
                    done2 = done;
                    if (value) {
                      buffer2 += decoder2.decode(value, { stream: true });
                      const lines2 = buffer2.split('\n');
                      buffer2 = lines2.pop() || '';
                      for (const line2 of lines2) {
                        if (!line2.trim() || !line2.startsWith('data: ')) continue;
                        try {
                          const jsonStr2 = line2.substring(6);
                          const data2 = JSON.parse(jsonStr2);
                          if (data2.type === 'textResponseChunk' && data2.textResponse) {
                            accumulatedJson += data2.textResponse;
                          } else if (data2.type === 'textResponse' && (data2.content || data2.textResponse)) {
                            accumulatedJson += (data2.content || data2.textResponse || '');
                          }
                        } catch {}
                      }
                    }
                  }
                }

                // Extract JSON code block and append to assistant message
                const jsonBlockMatch = accumulatedJson.match(/```json\s*([\s\S]*?)\s*```/m);
                if (jsonBlockMatch && jsonBlockMatch[0]) {
                  const appendBlock = `\n\n${jsonBlockMatch[0]}\n`;
                  accumulatedContent += appendBlock;
                  // Update the last assistant message to include the JSON block
                  setChatMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, content: accumulatedContent } : msg));
                  console.log('✅ Appended suggestedRoles JSON block obtained via follow-up prompt.');
                } else {
                  console.warn('⚠️ Follow-up request did not return a valid JSON code block for suggestedRoles.');
                }
              } else {
                console.warn('⚠️ Follow-up stream request failed while attempting to obtain suggestedRoles JSON.');
              }
            } catch (e) {
              console.warn('⚠️ Error while attempting follow-up JSON extraction:', e);
            }
          }
        } else {
          // 📦 NON-STREAMING MODE: Standard fetch for OpenRouter
          // 🔒 Enforce JSON contract (request-only) on the last user message
          const contractSuffix = "IMPORTANT: Your response MUST contain two parts in order: first, a complete SOW narrative written in Markdown, and second, a single ```json code block at the end. The JSON must be a valid object with a \"scopeItems\" array. Each item MUST include: name (string), overview (string), roles (array of { role, hours }), deliverables (string[]), and assumptions (string[]). Do not include rates or totals in JSON.";
          const requestMessages = [
            { role: "system", content: effectiveAgent.systemPrompt },
            ...newMessages.slice(0, Math.max(0, newMessages.length - 1)).map(m => ({ role: m.role, content: m.content })),
            newMessages.length > 0
              ? {
                  role: newMessages[newMessages.length - 1].role,
                  content: `${newMessages[newMessages.length - 1].content.trim()}\n\n${contractSuffix}`,
                }
              : undefined,
          ].filter(Boolean) as Array<{ role: string; content: string }>;
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            signal: controller.signal, // 🛑 Allow cancellation of this request
            body: JSON.stringify({
              model: effectiveAgent.model,
              workspace: workspaceSlug,
              threadSlug: !isDashboardMode && currentDocId ? (documents.find(d => d.id === currentDocId)?.threadSlug || undefined) : undefined,
              messages: requestMessages,
            }),
          });

          console.log('📥 Response Status:', response.status, response.statusText);
          const data = await response.json();

          if (!response.ok) {
            let errorMessage = "Sorry, there was an error processing your request.";

            if (response.status === 400) {
              errorMessage = "⚠️ OpenRouter API key not configured. Please set the OPENROUTER_API_KEY environment variable to enable AI chat functionality.";
            } else if (response.status === 402) {
              errorMessage = "Payment required: Please check your OpenRouter account balance or billing information.";
            } else if (response.status === 401) {
              errorMessage = "Authentication failed: Please check your OpenRouter API key.";
            } else if (response.status === 429) {
              errorMessage = "Rate limit exceeded: Please wait a moment before trying again.";
            } else if (data.error?.message) {
              errorMessage = `API Error: ${data.error.message}`;
            }

            const aiMessage: ChatMessage = {
              id: `msg${Date.now() + 1}`,
              role: 'assistant',
              content: errorMessage,
              timestamp: Date.now(),
            };
            setChatMessages(prev => [...prev, aiMessage]);
            return;
          }

          const aiMessage: ChatMessage = {
            id: `msg${Date.now() + 1}`,
            role: 'assistant',
            content: data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.",
            timestamp: Date.now(),
          };
          setChatMessages(prev => [...prev, aiMessage]);
          console.log('✅ Non-streaming response complete');

          // 🧩 Try to parse structured SOW JSON from non-streaming response
          try {
            const structured = extractSOWStructuredJson(aiMessage.content);
            if (structured?.scopeItems?.length) {
              setStructuredSow(structured);
              console.log('✅ Captured structured SOW JSON for Excel export');
            }
          } catch {}
        }
      } catch (error) {
        console.error("❌ Chat API error:", error);
        
        // Check if the error is an AbortError (request was cancelled)
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('ℹ️ Request was cancelled to prevent rate limiting');
          return;
        }

        // Check for rate limiting errors
        let errorMessage = "❌ Network error: Unable to reach AI service. Please check your connection and try again.";
        if (error instanceof Error && error.message.includes('429')) {
          errorMessage = "⏱️ Rate limit exceeded: Please wait a moment before trying again.";
          toast.error("⏱️ Rate limited - waiting before retry...");
        }

        const errorMsg: ChatMessage = {
          id: `msg${Date.now() + 1}`,
          role: 'assistant',
          content: errorMessage,
          timestamp: Date.now(),
        };
        const updatedMessages = [...newMessages, errorMsg];
        setChatMessages(updatedMessages);
        
        // ⚠️ REMOVED DATABASE SAVE - AnythingLLM handles all message storage
      } finally {
        setIsChatLoading(false);
        setCurrentRequestController(null); // Clean up the controller
      }
    } else {
      setIsChatLoading(false);
    }
  };

  // Prevent hydration errors by not rendering until mounted
  if (!mounted) {
    return null;
  }

  // 🎯 Phase 1C: Filter workspaces based on dashboard filter
  const filteredWorkspaces = dashboardFilter.type && dashboardFilter.value
    ? workspaces.map(workspace => ({
        ...workspace,
        sows: workspace.sows.filter(sow => {
          const doc = documents.find(d => d.id === sow.id);
          if (!doc) return false;
          
          if (dashboardFilter.type === 'vertical') {
            return doc.vertical === dashboardFilter.value;
          } else if (dashboardFilter.type === 'serviceLine') {
            return doc.serviceLine === dashboardFilter.value;
          }
          return true;
        })
      }))
    : workspaces;

  return (
    <div className="flex flex-col h-screen bg-[#0e0f0f]">
      {/* Onboarding Tutorial */}
      <InteractiveOnboarding />
      
      {/* Resizable Layout with Sidebar, Editor, and AI Chat */}
      <div className="flex-1 h-full overflow-hidden">
        <ResizableLayout
        sidebarOpen={sidebarOpen}
        aiChatOpen={agentSidebarOpen}
  aiChatExpanded={aiChatExpanded}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onToggleAiChat={() => setAgentSidebarOpen(!agentSidebarOpen)}
        viewMode={viewMode} // Pass viewMode for context awareness
        leftPanel={
          // Always show sidebar navigation regardless of view mode
          <SidebarNav
            workspaces={filteredWorkspaces}
            currentWorkspaceId={currentWorkspaceId}
            currentSOWId={currentSOWId}
            currentView={viewMode}
            onSelectWorkspace={setCurrentWorkspaceId}
            onSelectSOW={setCurrentSOWId}
            onCreateWorkspace={handleCreateWorkspace}
            onRenameWorkspace={handleRenameWorkspace}
            onDeleteWorkspace={handleDeleteWorkspace}
            onCreateSOW={handleCreateSOW}
            onRenameSOW={handleRenameSOW}
            onDeleteSOW={handleDeleteSOW}
            onViewChange={handleViewChange}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            onReorderWorkspaces={handleReorderWorkspaces}
            onReorderSOWs={handleReorderSOWs}
            // 🎯 Phase 1C: Pass filter state and clear handler
            dashboardFilter={dashboardFilter}
            onClearFilter={handleClearDashboardFilter}
          />
        }
        mainPanel={
          viewMode === 'editor' ? (
            <div className="w-full h-full flex flex-col">
              {/* Document Status Bar - Only show when document is open */}
              {currentDoc && (
                <DocumentStatusBar
                  title={currentDoc.title || "Untitled Statement of Work"}
                  saveStatus="saved"
                  isSaving={false}
                  vertical={currentDoc.vertical}
                  serviceLine={currentDoc.serviceLine}
                  onVerticalChange={(vertical) => {
                    setDocuments(prev => prev.map(d => 
                      d.id === currentDocId ? { ...d, vertical } : d
                    ));
                  }}
                  onServiceLineChange={(serviceLine) => {
                    setDocuments(prev => prev.map(d => 
                      d.id === currentDocId ? { ...d, serviceLine } : d
                    ));
                  }}
                  onExportPDF={handleExportPDF}
                  onExportExcel={handleExportExcel}
                  onSharePortal={async () => {
                    if (!currentDoc) {
                      toast.error('❌ No document selected');
                      return;
                    }

                    toast.info('📤 Preparing portal link...');

                    try {
                      // 1. First, embed the SOW to AnythingLLM
                      const currentFolder = folders.find(f => f.id === currentDoc.folderId);
                      
                      if (!currentFolder || !currentFolder.workspaceSlug) {
                        toast.error('❌ No workspace found for this SOW');
                        return;
                      }

                      // Get HTML content from editor
                      const htmlContent = editorRef.current?.getHTML() || '';
                      
                      if (!htmlContent || htmlContent === '<p></p>') {
                        toast.error('❌ Document is empty. Add content before sharing.');
                        return;
                      }

                      // Embed to AnythingLLM (both client and master workspaces)
                      await anythingLLM.embedSOWInBothWorkspaces(
                        currentFolder.workspaceSlug,
                        currentDoc.title,
                        htmlContent
                      );

                      // 2. Generate portal URL
                      const portalUrl = `${window.location.origin}/portal/sow/${currentDoc.id}`;
                      
                      // 3. Copy to clipboard with fallback
                      if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(portalUrl)
                          .then(() => toast.success('✅ Portal link copied! SOW is now shareable.'))
                          .catch(() => {
                            // Fallback: Create temporary input and copy
                            const input = document.createElement('input');
                            input.value = portalUrl;
                            document.body.appendChild(input);
                            input.select();
                            document.execCommand('copy');
                            document.body.removeChild(input);
                            toast.success('✅ Portal link copied! SOW is now shareable.');
                          });
                      } else {
                        // Fallback for older browsers
                        const input = document.createElement('input');
                        input.value = portalUrl;
                        document.body.appendChild(input);
                        input.select();
                        document.execCommand('copy');
                        document.body.removeChild(input);
                        toast.success('✅ Portal link copied! SOW is now shareable.');
                      }
                    } catch (error) {
                      console.error('Error sharing portal:', error);
                      toast.error(`❌ Error preparing portal: ${error.message}`);
                    }
                  }}
                />
              )}
              
              {/* Main Content Area */}
              <div className="flex-1 overflow-auto">
                {currentDoc ? (
                  <div className="w-full h-full">
                    <TailwindAdvancedEditor
                      ref={editorRef}
                      initialContent={currentDoc.content}
                      onUpdate={handleUpdateDoc}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <p className="text-gray-400 text-lg mb-4">No document selected</p>
                      <p className="text-gray-500 text-sm">Create a new workspace to get started</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : viewMode === 'dashboard' ? (
            <div className="h-full bg-[#0e0f0f]">
              <EnhancedDashboard 
                onFilterByVertical={handleDashboardFilterByVertical}
                onFilterByService={handleDashboardFilterByService}
                currentFilter={dashboardFilter}
                onClearFilter={handleClearDashboardFilter}
                onOpenInEditor={(sowId: string) => {
                  if (!sowId) return;
                  try {
                    handleSelectDoc(sowId);
                  } catch (e) {
                    console.warn('⚠️ Failed to open SOW in editor:', e);
                  }
                }}
                onOpenInPortal={(sowId: string) => {
                  if (!sowId) return;
                  try {
                    router.push(`/portal/sow/${sowId}`);
                  } catch (e) {
                    console.warn('⚠️ Failed to open SOW portal:', e);
                  }
                }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-gray-400 text-lg mb-4">No document selected</p>
                <p className="text-gray-500 text-sm">Create a new workspace to get started</p>
              </div>
            </div>
          )
        }
        rightPanel={
          // ✨ HIDE AI Chat panel completely in Gardner Studio and AI Management modes
          // Only show in editor and dashboard modes for a cleaner, context-appropriate UX
          viewMode === 'editor' || viewMode === 'dashboard' ? (
            <AgentSidebar
              isOpen={agentSidebarOpen}
              onToggle={() => setAgentSidebarOpen(!agentSidebarOpen)}
              isExpanded={aiChatExpanded}
              onToggleExpand={() => setAiChatExpanded(prev => !prev)}
              agents={agents}
              currentAgentId={currentAgentId}
              onSelectAgent={handleSelectAgent}
              onCreateAgent={handleCreateAgent}
              onUpdateAgent={handleUpdateAgent}
              onDeleteAgent={handleDeleteAgent}
              chatMessages={chatMessages}
              onSendMessage={handleSendMessage}
              isLoading={isChatLoading}
              streamingMessageId={streamingMessageId}
              viewMode={viewMode} // Pass viewMode for context awareness
              dashboardChatTarget={dashboardChatTarget}
              onDashboardWorkspaceChange={setDashboardChatTarget}
              availableWorkspaces={availableWorkspaces}
              onClearChat={() => {
                console.log('🧹 Clearing chat messages for new thread');
                setChatMessages([]);
              }}
              // Editor thread management wiring
              editorWorkspaceSlug={currentDoc?.workspaceSlug}
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
                onInsertToEditor={(content) => {
                console.log('📝 Insert to Editor button clicked from AI chat');
                handleInsertContent(content);
              }}
            />
          ) : null // Return null to completely remove the panel from the component tree
        }
        leftMinSize={15}
        mainMinSize={30}
        rightMinSize={20}
        leftDefaultSize={20}
        mainDefaultSize={55}
        rightDefaultSize={25}
        />
      </div>

      {/* Send to Client Modal */}
      {currentDoc && (
        <SendToClientModal
          isOpen={showSendModal}
          onClose={() => setShowSendModal(false)}
          document={{
            id: currentDoc.id,
            title: currentDoc.title,
            content: currentDoc.content,
            totalInvestment: calculateTotalInvestment(currentDoc.content),
          }}
          onSuccess={(sowId, portalUrl) => {
            toast.success('SOW sent successfully!', {
              description: `Portal: ${portalUrl}`,
              duration: 5000,
            });
          }}
        />
      )}

      {/* Share Link Modal */}
      {shareModalData && (
        <ShareLinkModal
          isOpen={showShareModal}
          onClose={() => {
            setShowShareModal(false);
            setShareModalData(null);
          }}
          shareLink={shareModalData.shareLink}
          documentTitle={shareModalData.documentTitle}
          shareCount={shareModalData.shareCount}
          firstShared={shareModalData.firstShared}
          lastShared={shareModalData.lastShared}
        />
      )}

      {/* Workspace Creation Progress Modal */}
      <WorkspaceCreationProgress
        isOpen={workspaceCreationProgress.isOpen}
        workspaceName={workspaceCreationProgress.workspaceName}
        currentStep={workspaceCreationProgress.currentStep}
        completedSteps={workspaceCreationProgress.completedSteps}
      />

      {/* Beautiful Onboarding Flow */}
      <OnboardingFlow
        isOpen={showOnboarding}
        onComplete={() => setShowOnboarding(false)}
        onCreateWorkspace={handleCreateWorkspace}
        workspaceCount={workspaces.length}
      />

    </div>
  );
}
