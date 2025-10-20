"use client";

import { useState, useEffect, useRef } from "react";
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

import { toast } from "sonner";
import { Sparkles, Info, ExternalLink, Send } from "lucide-react";
import { defaultEditorContent } from "@/lib/content";
import { THE_ARCHITECT_SYSTEM_PROMPT } from "@/lib/knowledge-base";
import { InteractiveOnboarding } from "@/components/tailwind/interactive-onboarding";
import { GuidedClientSetup } from "@/components/tailwind/guided-client-setup";
import { EnhancedDashboard } from "@/components/tailwind/enhanced-dashboard";
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
const convertMarkdownToNovelJSON = (markdown: string) => {
  const lines = markdown.split('\n');
  const content: any[] = [];
  let i = 0;
  let inTable = false;
  let tableRows: string[] = [];

  const parseTextWithFormatting = (text: string) => {
    const parts: any[] = [];
    let currentText = '';
    let isBold = false;
    let isItalic = false;
    
    for (let i = 0; i < text.length; i++) {
      if (text.substring(i, i + 2) === '**') {
        if (currentText) {
          parts.push({ type: 'text', text: currentText, marks: isBold || isItalic ? [isBold ? { type: 'bold' } : { type: 'italic' }] : undefined });
          currentText = '';
        }
        isBold = !isBold;
        i++;
      } else if (text[i] === '*' || text[i] === '_') {
        if (currentText) {
          parts.push({ type: 'text', text: currentText, marks: isBold || isItalic ? [isBold ? { type: 'bold' } : { type: 'italic' }] : undefined });
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
      parts.push({ type: 'text', text: currentText, marks: marks.length > 0 ? marks : undefined });
    }
    
    return parts.length > 0 ? parts : [{ type: 'text', text: text }];
  };

  const processTable = (rows: string[]) => {
    if (rows.length < 2) return null;
    
    const headerRow = rows[0].split('|').filter(cell => cell.trim() !== '').map(cell => cell.trim());
    const dataRows = rows.slice(2).map(row => 
      row.split('|').filter(cell => cell.trim() !== '').map(cell => cell.trim())
    );

    // Check if this is a pricing table (has Role, Hours, Rate columns)
    const isPricingTable = headerRow.some(h => h.toLowerCase().includes('role')) &&
                          headerRow.some(h => h.toLowerCase().includes('hours')) &&
                          headerRow.some(h => h.toLowerCase().includes('rate'));

    if (isPricingTable) {
      // Find column indexes
      const roleIdx = headerRow.findIndex(h => h.toLowerCase().includes('role'));
      const descIdx = headerRow.findIndex(h => h.toLowerCase().includes('description'));
      const hoursIdx = headerRow.findIndex(h => h.toLowerCase().includes('hours'));
      const rateIdx = headerRow.findIndex(h => h.toLowerCase().includes('rate'));

      // Helper function to match role name to ROLES list with better fuzzy matching
      const matchRole = (roleName: string) => {
        const cleanRoleName = roleName.trim().replace(/\s+/g, ' ');
        
        // 1. Try exact match first
        const exactMatch = ROLES.find(r => r.name === cleanRoleName);
        if (exactMatch) return { name: exactMatch.name, rate: exactMatch.rate };
        
        // 2. Try case-insensitive match
        const caseInsensitiveMatch = ROLES.find(r => 
          r.name.toLowerCase() === cleanRoleName.toLowerCase()
        );
        if (caseInsensitiveMatch) return { name: caseInsensitiveMatch.name, rate: caseInsensitiveMatch.rate };
        
        // 3. Try splitting by hyphen and matching parts (e.g., "Tech - Producer" should match "Producer")
        const parts = cleanRoleName.split(/\s*[-–—]\s*/);
        if (parts.length > 1) {
          for (const part of parts) {
            const trimmedPart = part.trim();
            if (trimmedPart.length > 2) {
              const partMatch = ROLES.find(r => 
                r.name.toLowerCase() === trimmedPart.toLowerCase() ||
                r.name.toLowerCase().includes(trimmedPart.toLowerCase())
              );
              if (partMatch) return { name: partMatch.name, rate: partMatch.rate };
            }
          }
        }
        
        // 4. Try fuzzy matching by looking for role keywords
        const keywords = ['tech', 'producer', 'specialist', 'consultant', 'manager', 'coordinator', 'architect', 'designer', 'developer', 'strategist', 'account'];
        for (const keyword of keywords) {
          if (cleanRoleName.toLowerCase().includes(keyword)) {
            const keywordMatch = ROLES.find(r => r.name.toLowerCase().includes(keyword));
            if (keywordMatch) return { name: keywordMatch.name, rate: keywordMatch.rate };
          }
        }
        
        // 5. Try partial match (contains)
        const partialMatch = ROLES.find(r => 
          r.name.toLowerCase().includes(cleanRoleName.toLowerCase()) ||
          cleanRoleName.toLowerCase().includes(r.name.toLowerCase())
        );
        if (partialMatch) return { name: partialMatch.name, rate: partialMatch.rate };
        
        // 6. Default: use the role name as-is but try to extract rate
        const rateMatch = roleName.match(/\$?(\d+)/);
        return { 
          name: cleanRoleName, 
          rate: rateMatch ? parseFloat(rateMatch[1]) : 0 
        };
      };

      // Convert data rows to pricing row format
      const pricingRows = dataRows.map(row => {
        const rawRole = row[roleIdx] || '';
        const matchedRole = matchRole(rawRole);
        const specifiedRate = row[rateIdx] ? parseFloat(row[rateIdx]?.replace(/[^0-9.]/g, '') || '0') : null;
        
        console.log(`💼 [Role Match] "${rawRole}" → "${matchedRole.name}" @ $${matchedRole.rate}`);
        
        return {
          role: matchedRole.name, // Use matched role name from ROLES list
          description: row[descIdx] || '',
          hours: parseFloat(row[hoursIdx]?.replace(/[^0-9.]/g, '') || '0'),
          rate: specifiedRate || matchedRole.rate, // Use specified rate or matched role's rate
        };
      });

      // Return editable pricing table node
      return {
        type: 'editablePricingTable',
        attrs: {
          rows: pricingRows,
          discount: 0,
        },
      };
    }

    // Regular table
    const tableNode = {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: headerRow.map(header => ({
            type: 'tableHeader',
            content: [{
              type: 'paragraph',
              content: parseTextWithFormatting(header)
            }]
          }))
        },
        ...dataRows.map(row => ({
          type: 'tableRow',
          content: row.map(cell => ({
            type: 'tableCell',
            content: [{
              type: 'paragraph',
              content: parseTextWithFormatting(cell)
            }]
          }))
        }))
      ]
    };
    
    return tableNode;
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.includes('|') && i + 1 < lines.length && lines[i + 1].includes('---')) {
      // Start of table
      inTable = true;
      tableRows = [line];
      i++;
      continue;
    } else if (inTable && line.includes('|')) {
      tableRows.push(line);
      i++;
      continue;
    } else if (inTable && !line.includes('|')) {
      // End of table
      const tableNode = processTable(tableRows);
      if (tableNode) content.push(tableNode);
      inTable = false;
      tableRows = [];
    }

    if (!inTable) {
      if (line.startsWith('# ')) {
        content.push({
          type: 'heading',
          attrs: { level: 1 },
          content: parseTextWithFormatting(line.substring(2))
        });
      } else if (line.startsWith('## ')) {
        content.push({
          type: 'heading',
          attrs: { level: 2 },
          content: parseTextWithFormatting(line.substring(3))
        });
      } else if (line.startsWith('### ')) {
        content.push({
          type: 'heading',
          attrs: { level: 3 },
          content: parseTextWithFormatting(line.substring(4))
        });
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        content.push({
          type: 'bulletList',
          content: [{
            type: 'listItem',
            content: [{
              type: 'paragraph',
              content: parseTextWithFormatting(line.substring(2))
            }]
          }]
        });
      } else if (line.startsWith('---')) {
        content.push({
          type: 'horizontalRule'
        });
      } else if (line.trim() === '') {
        // Skip empty lines
      } else if (line.trim() !== '') {
        content.push({
          type: 'paragraph',
          content: parseTextWithFormatting(line)
        });
      }
    }

    i++;
  }

  // Process any remaining table
  if (inTable && tableRows.length > 0) {
    const tableNode = processTable(tableRows);
    if (tableNode) content.push(tableNode);
  }

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

export default function Page() {
  const [mounted, setMounted] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [agentSidebarOpen, setAgentSidebarOpen] = useState(true);
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
  const [viewMode, setViewMode] = useState<'editor' | 'dashboard' | 'gardner-studio' | 'ai-management'>('dashboard'); // NEW: View mode - START WITH DASHBOARD
  
  // Workspace & SOW state (NEW) - Start empty, load from AnythingLLM
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string>('');
  const [currentSOWId, setCurrentSOWId] = useState<string | null>(null);
  const editorRef = useRef<any>(null);

  // OAuth state for Google Sheets
  const [isOAuthAuthorized, setIsOAuthAuthorized] = useState(false);
  const [oauthAccessToken, setOauthAccessToken] = useState<string>('');

  // Dashboard AI workspace selector state - Master dashboard is the default
  const [dashboardChatTarget, setDashboardChatTarget] = useState<string>('sow-master-dashboard-54307162');
  const [availableWorkspaces, setAvailableWorkspaces] = useState<Array<{slug: string, name: string}>>([
    { slug: 'sow-master-dashboard-54307162', name: '🎯 All SOWs (Master)' }
  ]);

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
      toast.success('✅ Google authorized! Creating GSheet...');
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Wait for document to be loaded, then trigger sheet creation
      const checkAndCreate = () => {
        const doc = documents.find(d => d.id === currentDocId);
        if (doc) {
          console.log('🚀 Creating GSheet for:', doc.title);
          createGoogleSheet(oauthToken);
        } else {
          // Document not loaded yet, try again
          setTimeout(checkAndCreate, 500);
        }
      };
      
      // Start checking after a short delay
      setTimeout(checkAndCreate, 1000);
    }
  }, []);

  // Fetch available workspaces for dashboard chat selector from loaded workspaces
  useEffect(() => {
    // Build workspace list: Master dashboard + client workspaces
    const workspaceList = [
      { slug: 'sow-master-dashboard-54307162', name: '🎯 All SOWs (Master)' },
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
        if (workspacesWithSOWs.length > 0 && !currentWorkspaceId) {
          setCurrentWorkspaceId(workspacesWithSOWs[0].id);
          if (workspacesWithSOWs[0].sows.length > 0) {
            setCurrentSOWId(workspacesWithSOWs[0].sows[0].id);
          }
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
    } else {
      console.warn('⚠️ Document not found for SOW:', currentSOWId);
    }
  }, [currentSOWId, documents]);

  // Auto-save SOW content to database with debouncing
  useEffect(() => {
    // Find current doc in documents array
    const currentDoc = documents.find(d => d.id === currentDocId);
    if (!currentDocId || !currentDoc?.content) return;

    const autoSaveTimer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/sow/${currentDocId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: currentDoc.content,
            title: currentDoc.title,
          }),
        });

        if (response.ok) {
          console.log('💾 Auto-saved SOW:', currentDocId);
        } else {
          console.warn('⚠️ Auto-save failed for SOW:', currentDocId);
        }
      } catch (error) {
        console.error('❌ Error auto-saving SOW:', error);
      }
    }, 2000); // Save after 2 seconds of inactivity

    return () => clearTimeout(autoSaveTimer);
  }, [currentDocId, documents]);

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
      // Update editor content when document changes
      editorRef.current.insertContent(currentDoc.content);
    }
  }, [currentDocId, currentDoc]);

  const handleSelectDoc = (id: string) => {
    setCurrentDocId(id);
    // Clear chat messages for clean state when switching documents
    setChatMessages([]);
    // Switch to editor view when selecting a document
    if (viewMode !== 'editor') {
      setViewMode('editor');
    }
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
  const handleCreateWorkspace = async (workspaceName: string) => {
    try {
      console.log('📁 Creating workspace:', workspaceName);
      
      // 🏢 STEP 1: Create AnythingLLM workspace FIRST
      console.log('🏢 Creating AnythingLLM workspace...');
      const workspace = await anythingLLM.createOrGetClientWorkspace(workspaceName);
      const embedId = await anythingLLM.getOrCreateEmbedId(workspace.slug);
      console.log('✅ AnythingLLM workspace created:', workspace.slug);
      
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

      // 📊 STEP 4: Embed SOW in BOTH client workspace AND master dashboard
      console.log('📊 Embedding SOW in both workspaces...');
      const sowContent = JSON.stringify(defaultEditorContent);
      await anythingLLM.embedSOWInBothWorkspaces(workspace.slug, sowTitle, sowContent);
      console.log('✅ SOW embedded in both workspaces');

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
    } catch (error) {
      console.error('❌ Error creating workspace:', error);
      toast.error('Failed to create workspace. Please try again.');
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

      // 💾 Delete from database first
      const dbResponse = await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'DELETE',
      });

      if (!dbResponse.ok) {
        throw new Error('Failed to delete workspace from database');
      }

      // 🏢 Delete AnythingLLM workspace (cascades to all threads)
      if (workspace.workspace_slug) {
        await anythingLLM.deleteWorkspace(workspace.workspace_slug);
      }

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
      toast.error('Failed to delete workspace');
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

  const handleViewChange = (view: 'dashboard' | 'gardner-studio' | 'editor' | 'ai-management') => {
    if (view === 'gardner-studio') {
      setViewMode('gardner-studio');
    } else if (view === 'dashboard') {
      setViewMode('dashboard');
    } else if (view === 'ai-management') {
      setViewMode('ai-management');
    } else {
      setViewMode('editor');
    }
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
      // Get HTML directly from the editor (includes all formatting and custom nodes)
      const editorHTML = editorRef.current.getHTML();
      
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

  const handleExportExcel = () => {
    if (!currentDoc) {
      toast.error('❌ No document selected');
      return;
    }
    
    toast.info('📊 Generating Excel...');
    
    try {
      // Extract pricing data from document
      const pricingRows = extractPricingFromContent(currentDoc.content);
      
      if (pricingRows.length === 0) {
        toast.error('❌ No pricing table found in document. Please generate a SOW first.');
        return;
      }
      
      // Get last AI message for additional SOW data
      const lastAIMessage = [...chatMessages].reverse().find(msg => msg.role === 'assistant');
      const sowData = lastAIMessage ? parseSOWMarkdown(lastAIMessage.content) : {};
      
      const filename = `${currentDoc.title.replace(/[^a-z0-9]/gi, '_')}_pricing.xlsx`;
      exportToExcel({
        title: currentDoc.title,
        pricingRows,
        ...sowData,
      }, filename);
      
      toast.success('✅ Excel downloaded successfully!');
    } catch (error) {
      console.error('Error exporting Excel:', error);
      toast.error(`❌ Error exporting Excel: ${error.message}`);
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

    let html = '<style>';
    html += 'body { font-family: "Plus Jakarta Sans", -apple-system, sans-serif; color: #1a1a1a; line-height: 1.6; }';
    html += 'h1 { font-size: 28px; font-weight: 700; margin: 20px 0 16px; color: #2C823D; }';
    html += 'h2 { font-size: 22px; font-weight: 600; margin: 16px 0 12px; color: #2C823D; }';
    html += 'h3 { font-size: 18px; font-weight: 600; margin: 14px 0 10px; color: #2C823D; }';
    html += 'p { margin: 8px 0; }';
    html += 'ul, ol { margin: 8px 0; padding-left: 24px; }';
    html += 'li { margin: 4px 0; }';
    html += 'strong { font-weight: 600; }';
    html += 'table { width: 100%; border-collapse: collapse; margin: 16px 0; }';
    html += 'th { background: #2C823D; color: white; padding: 12px 8px; text-align: left; font-weight: 600; border: 1px solid #2C823D; }';
    html += 'td { padding: 10px 8px; border: 1px solid #e0e0e0; }';
    html += 'tr:nth-child(even) { background: #f8f8f8; }';
    html += 'hr { border: none; border-top: 2px solid #2C823D; margin: 20px 0; }';
    html += '</style>';

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

    content.content.forEach((node: any) => {
      switch (node.type) {
        case 'heading':
          const level = node.attrs?.level || 1;
          html += `<h${level}>${processContent(node.content)}</h${level}>`;
          break;
        case 'paragraph':
          html += `<p>${processContent(node.content)}</p>`;
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
          node.content?.forEach((row: any, rowIndex: number) => {
            html += '<tr>';
            row.content?.forEach((cell: any) => {
              const cellContent = cell.content?.[0]?.content ? processContent(cell.content[0].content) : '';
              const tag = rowIndex === 0 || cell.type === 'tableHeader' ? 'th' : 'td';
              html += `<${tag}>${cellContent}</${tag}>`;
            });
            html += '</tr>';
          });
          html += '</table>';
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
          html += '<tr><th>Role</th><th>Description</th><th>Hours</th><th>Rate (AUD)</th><th>Cost (AUD)</th></tr>';
          
          let subtotal = 0;
          rows.forEach((row: any) => {
            const cost = row.hours * row.rate;
            subtotal += cost;
            html += `<tr>`;
            html += `<td>${row.role}</td>`;
            html += `<td>${row.description}</td>`;
            html += `<td>${row.hours}</td>`;
            html += `<td>$${row.rate}</td>`;
            html += `<td>$${cost.toFixed(2)}</td>`;
            html += `</tr>`;
          });
          
          html += '</table>';
          
          // Summary section
          html += '<h4 style="margin-top: 20px;">Summary</h4>';
          html += '<table style="width: auto; margin-left: auto;">';
          html += `<tr><td style="text-align: right; padding-right: 12px;"><strong>Subtotal:</strong></td><td style="text-align: right;">$${subtotal.toFixed(2)}</td></tr>`;
          
          if (discount > 0) {
            const discountAmount = subtotal * (discount / 100);
            const afterDiscount = subtotal - discountAmount;
            html += `<tr><td style="text-align: right; padding-right: 12px; color: #dc2626;"><strong>Discount (${discount}%):</strong></td><td style="text-align: right; color: #dc2626;">-$${discountAmount.toFixed(2)}</td></tr>`;
            html += `<tr><td style="text-align: right; padding-right: 12px;"><strong>After Discount:</strong></td><td style="text-align: right;">$${afterDiscount.toFixed(2)}</td></tr>`;
            subtotal = afterDiscount;
          }
          
          const gst = subtotal * 0.1;
          const total = subtotal + gst;
          
          html += `<tr><td style="text-align: right; padding-right: 12px;"><strong>GST (10%):</strong></td><td style="text-align: right;">$${gst.toFixed(2)}</td></tr>`;
          html += `<tr style="border-top: 2px solid #2C823D;"><td style="text-align: right; padding-right: 12px; padding-top: 8px;"><strong>Total Project Value:</strong></td><td style="text-align: right; padding-top: 8px; color: #2C823D; font-size: 18px;"><strong>$${total.toFixed(2)}</strong></td></tr>`;
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
    if (currentDocId) {
      setDocuments(prev => prev.map(d => d.id === currentDocId ? { ...d, content } : d));
    }
  };

  const handleInsertSOWContent = (markdownContent: string) => {
    if (editorRef.current && markdownContent) {
      const novelContent = convertMarkdownToNovelJSON(markdownContent);
      editorRef.current.insertContent(novelContent);
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

  const handleInsertContent = async (content: string) => {
    console.log('📝 Inserting content into editor:', content.substring(0, 100));
    console.log('📝 Editor ref exists:', !!editorRef.current);
    console.log('📄 Current doc ID:', currentDocId);
    
    if (!content || !currentDocId) {
      console.error('❌ Missing content or document ID');
      return;
    }

    try {
      // Clean the content first - remove non-client-facing elements
      console.log('🧹 Cleaning SOW content...');
      const cleanedContent = cleanSOWContent(content);
      console.log('✅ Content cleaned');
      
      // Convert markdown content to Novel editor JSON format
      console.log('🔄 Converting markdown to JSON...');
      const convertedContent = convertMarkdownToNovelJSON(cleanedContent);
      console.log('✅ Content converted');
      
      // Extract title from the content (first heading)
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
      
      // Update the document with new content and title
      console.log('📝 Updating document:', docTitle);
      setDocuments(prev =>
        prev.map(doc =>
          doc.id === currentDocId
            ? { ...doc, content: convertedContent, title: docTitle }
            : doc
        )
      );
      console.log('✅ Document updated successfully');
      
      // Also update the editor directly
      if (editorRef.current) {
        editorRef.current.insertContent(convertedContent);
      }
      
      // Embed SOW in both client workspace and master dashboard
      const currentAgent = agents.find(a => a.id === currentAgentId);
      const useAnythingLLM = currentAgent?.model === 'anythingllm';
      
      if (useAnythingLLM && currentAgentId) {
        console.log('🤖 Embedding SOW in workspaces...');
        try {
          const clientWorkspaceSlug = getWorkspaceForAgent(currentAgentId);
          // Fixed parameter order: (workspaceSlug, title, content)
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

  const handleSendMessage = async (message: string) => {
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
          // Clean the content first - remove non-client-facing elements
          console.log('🧹 Cleaning SOW content...');
          const cleanedMessage = cleanSOWContent(lastAIMessage.content);
          console.log('✅ Content cleaned');
          
          // Convert markdown content to Novel editor JSON format
          console.log('🔄 Converting markdown to JSON...');
          const content = convertMarkdownToNovelJSON(cleanedMessage);
          console.log('✅ Content converted');
          
          // Extract title from the SOW content (first heading)
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
          
          // Update the document with new content and title
          console.log('📝 Updating document:', docTitle);
          setDocuments(prev =>
            prev.map(doc =>
              doc.id === currentDocId
                ? { ...doc, content, title: docTitle }
                : doc
            )
          );
          console.log('✅ Document updated successfully');
          
          // 💾 SAVE TO DATABASE
          console.log('💾 Saving SOW to database...');
          try {
            const saveResponse = await fetch('/api/sow/update', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: currentDocId,
                title: docTitle,
                content: JSON.stringify(content),
              }),
            });
            
            if (saveResponse.ok) {
              console.log('✅ SOW saved to database successfully');
            } else {
              console.warn('⚠️ Failed to save SOW to database');
            }
          } catch (saveError) {
            console.error('❌ Database save error:', saveError);
          }
          
          // Also update the editor directly
          if (editorRef.current) {
            editorRef.current.insertContent(content);
          }
          
          // Embed SOW in both client workspace and master dashboard
          const currentAgent = agents.find(a => a.id === currentAgentId);
          const useAnythingLLM = currentAgent?.model === 'anythingllm';
          
          if (useAnythingLLM && currentAgentId) {
            console.log('🤖 Embedding SOW in AnythingLLM workspaces...');
            try {
              const clientWorkspaceSlug = getWorkspaceForAgent(currentAgentId);
              // Fixed parameter order: (workspaceSlug, title, content)
              const success = await anythingLLM.embedSOWInBothWorkspaces(clientWorkspaceSlug, docTitle, cleanedMessage);
              
              if (success) {
                console.log('✅ SOW embedded in both AnythingLLM workspaces');
              }
            } catch (embedError) {
              console.error('⚠️ AnythingLLM embedding error:', embedError);
            }
          }
          
          // Add confirmation message
          const confirmMessage: ChatMessage = {
            id: `msg${Date.now()}`,
            role: 'assistant',
            content: "✅ SOW has been inserted into the editor, saved to database, and embedded in AnythingLLM!",
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
          
          // ⚠️ REMOVED DATABASE SAVE - AnythingLLM handles all message storage
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
      model: 'google/gemini-2.0-flash-exp:free' // 🆓 FREE on OpenRouter - no cost!
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
          if (dashboardChatTarget === 'sow-master-dashboard-54307162') {
            // Master view: use dedicated dashboard route
            endpoint = '/api/dashboard/chat';
            workspaceSlug = undefined; // Not needed, hardcoded in route
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

        // ⚠️ FORCE GEN-THE-ARCHITECT FOR SOW EDITOR MODE
        // Never route SOW editor chat to client workspaces or Gardner agents
        if (!isDashboardMode && useAnythingLLM) {
          workspaceSlug = 'gen-the-architect'; // Always use Gen workspace for SOW generation
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
            ? (dashboardChatTarget === 'sow-master-dashboard-54307162' ? 'MASTER_DASHBOARD' : 'CLIENT_WORKSPACE')
            : 'SOW_GENERATION'
        });

        // 🌊 STREAMING SUPPORT: Use stream-chat endpoint for AnythingLLM
        const shouldStream = useAnythingLLM;
        const streamEndpoint = endpoint.replace('/chat', '/stream-chat');
        
        if (shouldStream) {
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

          const response = await fetch(streamEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            signal: controller.signal, // 🛑 Allow cancellation of this request
            body: JSON.stringify({
              model: effectiveAgent.model,
              workspace: workspaceSlug,
              messages: [
                { role: "system", content: effectiveAgent.systemPrompt },
                ...newMessages.map(m => ({ role: m.role, content: m.content })),
              ],
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
        } else {
          // 📦 NON-STREAMING MODE: Standard fetch for OpenRouter
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            signal: controller.signal, // 🛑 Allow cancellation of this request
            body: JSON.stringify({
              model: effectiveAgent.model,
              workspace: workspaceSlug,
              messages: [
                { role: "system", content: effectiveAgent.systemPrompt },
                ...newMessages.map(m => ({ role: m.role, content: m.content })),
              ],
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

  return (
    <div className="flex flex-col h-screen bg-[#0e0f0f]">
      {/* Onboarding Tutorial */}
      <InteractiveOnboarding />
      
      {/* Resizable Layout with Sidebar, Editor, and AI Chat */}
      <div className="flex-1 h-full overflow-hidden">
        <ResizableLayout
        sidebarOpen={sidebarOpen}
        aiChatOpen={agentSidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onToggleAiChat={() => setAgentSidebarOpen(!agentSidebarOpen)}
        viewMode={viewMode} // Pass viewMode for context awareness
        leftPanel={
          // Always show sidebar navigation regardless of view mode
          <SidebarNav
            workspaces={workspaces}
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
                  onExportPDF={handleExportPDF}
                  onExportExcel={handleCreateGSheet}
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
            <EnhancedDashboard />
          ) : viewMode === 'ai-management' ? (
            <div className="w-full h-full bg-[#0E0F0F]">
              <iframe
                src="https://ahmad-anything-llm.840tjq.easypanel.host/"
                className="w-full h-full border-0"
                title="AI Management"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-pointer-lock allow-top-navigation allow-top-navigation-by-user-activation"
                style={{ width: '100%', height: '100%', display: 'block', border: 'none' }}
              />
            </div>
          ) : (
            <GardnerStudio onSelectGardner={(slug) => {
              // TODO: Route to Gardner chat
              console.log('Selected Gardner:', slug);
              toast.success('Gardner selected! Chat integration coming soon.');
            }} />
          )
        }
        rightPanel={
          // ✨ HIDE AI Chat panel completely in Gardner Studio and AI Management modes
          // Only show in editor and dashboard modes for a cleaner, context-appropriate UX
          viewMode === 'editor' || viewMode === 'dashboard' ? (
            <AgentSidebar
              isOpen={agentSidebarOpen}
              onToggle={() => setAgentSidebarOpen(!agentSidebarOpen)}
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
              onInsertToEditor={(content) => {
                console.log('📝 Insert to Editor button clicked from AI chat');
                // Clean all AI thinking tags before inserting
                let cleanContent = content
                  .replace(/<AI_THINK>[\s\S]*?<\/AI_THINK>/gi, '')
                  .replace(/<think>[\s\S]*?<\/think>/gi, '')
                  .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
                  .replace(/<\/?[A-Z_]+>/gi, '')
                  .trim();
                handleInsertContent(cleanContent || content);
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

    </div>
  );
}
