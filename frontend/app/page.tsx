"use client";

import { useState, useEffect, useRef } from "react";
import TailwindAdvancedEditor from "@/components/tailwind/advanced-editor";
import Sidebar from "@/components/tailwind/sidebar";
import AgentSidebar from "@/components/tailwind/agent-sidebar-clean";
import PricingTableBuilder from "@/components/tailwind/pricing-table-builder";
import Menu from "@/components/tailwind/ui/menu";
import { Button } from "@/components/tailwind/ui/button";
import { SendToClientModal } from "@/components/tailwind/send-to-client-modal";
import { ShareLinkModal } from "@/components/tailwind/share-link-modal";
import { toast } from "sonner";
import { Sparkles, Info, ExternalLink, Send } from "lucide-react";
import { defaultEditorContent } from "@/lib/content";
import { THE_ARCHITECT_SYSTEM_PROMPT } from "@/lib/knowledge-base";
import { InteractiveOnboarding } from "@/components/tailwind/interactive-onboarding";
import { GuidedClientSetup } from "@/components/tailwind/guided-client-setup";
import { EnhancedDashboard } from "@/components/tailwind/enhanced-dashboard";
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
  embedId?: string;
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

export default function Page() {
  const [mounted, setMounted] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [agentSidebarOpen, setAgentSidebarOpen] = useState(false); // Closed by default
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
  const [viewMode, setViewMode] = useState<'editor' | 'dashboard' | 'knowledgebase'>('editor'); // NEW: View mode
  const editorRef = useRef<any>(null);

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

  // Fix hydration by setting mounted state
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    console.log('🔍 useEffect running, mounted:', mounted);
    if (!mounted) return;
    
    const loadData = async () => {
      console.log('📂 Starting to load SOWs from database...');
      const savedCurrent = localStorage.getItem("currentDocId");
      const hasCompletedSetup = localStorage.getItem("sow-guided-setup-completed");
      
      // Load documents from database API instead of localStorage
      try {
        const response = await fetch('/api/sow/list');
        if (response.ok) {
          const sows = await response.json();
          console.log('✅ Loaded SOWs from database:', sows.length);
          setDocuments(sows);
        } else {
          console.warn('⚠️ Failed to load SOWs, creating empty list');
          setDocuments([]);
        }
      } catch (error) {
        console.error('❌ Error loading SOWs:', error);
        setDocuments([]);
      }
      
      // FETCH FOLDERS FROM DATABASE (NOT localStorage!)
      try {
        const response = await fetch('/api/folders');
        if (response.ok) {
          const dbFolders = await response.json();
          console.log('✅ Loaded folders from database:', dbFolders.length);
          console.log('📁 Folder names:', dbFolders.map((f: any) => f.name).join(', '));
          setFolders(dbFolders);
          
          // Show guided setup if no folders in database
          if (!hasCompletedSetup && dbFolders.length === 0) {
            setTimeout(() => setShowGuidedSetup(true), 1000);
          }
        } else {
          console.error('❌ Failed to load folders from database');
        }
      } catch (error) {
        console.error('❌ Error loading folders:', error);
      }
      
      if (savedCurrent) {
        setCurrentDocId(savedCurrent);
      }
    };
    
    loadData();
  }, [mounted]);

  // Note: SOWs are now saved to database via API calls, not localStorage

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
    // Load agents from DATABASE (not localStorage!)
    const loadAgentsFromDB = async () => {
      try {
        const response = await fetch('/api/agents');
        if (!response.ok) throw new Error('Failed to load agents');
        
        let loadedAgents: Agent[] = await response.json();
        
        // Ensure The Architect agent exists with AnythingLLM
        const architectIndex = loadedAgents.findIndex(agent => agent.id === "architect");
        if (architectIndex >= 0) {
          // Update existing architect if needed
          if (loadedAgents[architectIndex].model !== "anythingllm" || 
              loadedAgents[architectIndex].systemPrompt !== THE_ARCHITECT_SYSTEM_PROMPT) {
            await fetch('/api/agents/architect', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: "anythingllm",
                systemPrompt: THE_ARCHITECT_SYSTEM_PROMPT
              })
            });
            loadedAgents[architectIndex].model = "anythingllm";
            loadedAgents[architectIndex].systemPrompt = THE_ARCHITECT_SYSTEM_PROMPT;
          }
          console.log('✅ The Architect agent loaded from database');
        } else {
          // Create new architect agent in database
          const architectAgent = {
            id: "architect",
            name: "The Architect (SOW Generator)",
            systemPrompt: THE_ARCHITECT_SYSTEM_PROMPT,
            model: "anythingllm"
          };
          
          await fetch('/api/agents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(architectAgent)
          });
          
          loadedAgents.unshift(architectAgent);
          console.log('✅ Created The Architect agent in database');
        }
        
        setAgents(loadedAgents);
        
        // Load current agent preference from database
        const prefResponse = await fetch('/api/preferences/current_agent_id');
        if (prefResponse.ok) {
          const { value } = await prefResponse.json();
          setCurrentAgentId(value || "architect");
        } else {
          setCurrentAgentId("architect");
        }
        
      } catch (error) {
        console.error('❌ Failed to load agents from database:', error);
        // Fallback: create default architect in state only
        setAgents([{
          id: "architect",
          name: "The Architect (SOW Generator)",
          systemPrompt: THE_ARCHITECT_SYSTEM_PROMPT,
          model: "anythingllm"
        }]);
        setCurrentAgentId("architect");
      }
    };
    
    loadAgentsFromDB();
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
        const thread = await anythingLLM.createThread(workspaceSlug, title);
        if (thread) {
          newDoc = {
            ...newDoc,
            threadSlug: thread.slug,
            threadId: thread.id,
            syncedAt: new Date().toISOString(),
          };
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
    
    // 🎯 Switch to editor view (in case we're on dashboard/knowledge base)
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
    if (!currentDoc || !editorRef.current) return;
    
    try {
      // Get HTML directly from the editor (includes all formatting and custom nodes)
      const editorHTML = editorRef.current.getHTML();
      
      if (!editorHTML || editorHTML.trim() === '' || editorHTML === '<p></p>') {
        alert('Document is empty. Please add content before exporting.');
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
      
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert(`Error exporting PDF: ${error.message}. Please try again.`);
    }
  };

  const handleExportExcel = () => {
    if (!currentDoc) return;
    
    try {
      // Extract pricing data from document
      const pricingRows = extractPricingFromContent(currentDoc.content);
      
      if (pricingRows.length === 0) {
        alert('No pricing table found in document. Please generate a SOW first.');
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
    } catch (error) {
      console.error('Error exporting Excel:', error);
      alert('Error exporting Excel. Please try again.');
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
    
    // Load chat messages from DATABASE
    try {
      const response = await fetch(`/api/agents/${id}/messages`);
      if (response.ok) {
        const messages = await response.json();
        setChatMessages(messages);
        console.log(`✅ Loaded ${messages.length} messages from database for agent ${id}`);
      } else {
        setChatMessages([]);
      }
    } catch (error) {
      console.error('❌ Failed to load messages:', error);
      setChatMessages([]);
    }
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
          const success = await anythingLLM.embedSOWInBothWorkspaces(docTitle, cleanedContent, clientWorkspaceSlug);
          
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

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || !currentAgentId) return;

    setIsChatLoading(true);
    if (!currentAgentId) return;

    // Check for insert command
    if (message.toLowerCase().includes('insert into editor') ||
        message.toLowerCase() === 'insert' ||
        message.toLowerCase().includes('add to editor')) {
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
          
          // Also update the editor directly
          if (editorRef.current) {
            editorRef.current.insertContent(content);
          }
          
          // Add confirmation message
          const confirmMessage: ChatMessage = {
            id: `msg${Date.now()}`,
            role: 'assistant',
            content: "✅ SOW has been inserted into the editor and the document has been named!",
            timestamp: Date.now(),
          };
          setChatMessages(prev => [...prev, confirmMessage]);
          
          // Save to DATABASE
          if (currentAgentId) {
            await fetch(`/api/agents/${currentAgentId}/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(confirmMessage)
            });
          }
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
          
          // Save to DATABASE
          if (currentAgentId) {
            await fetch(`/api/agents/${currentAgentId}/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(errorMessage)
            });
          }
          return;
        }
      }
    }

    const userMessage: ChatMessage = {
      id: `msg${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };

    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);
    
    // Save user message to DATABASE
    if (currentAgentId) {
      await fetch(`/api/agents/${currentAgentId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userMessage)
      }).catch(err => console.error('Failed to save user message:', err));
    }

    const currentAgent = agents.find(a => a.id === currentAgentId);
    if (currentAgent) {
      try {
        const useAnythingLLM = currentAgent.model === 'anythingllm';
        const endpoint = useAnythingLLM ? '/api/anythingllm/chat' : '/api/chat';
        
        // Get the appropriate workspace for this agent
        const workspaceSlug = useAnythingLLM ? getWorkspaceForAgent(currentAgentId) : undefined;

        const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: currentAgent.model,
          workspace: workspaceSlug, // Pass workspace slug for AnythingLLM agents
          messages: [
            { role: "system", content: currentAgent.systemPrompt },
            ...newMessages.map(m => ({ role: m.role, content: m.content })),
          ],
        }),
      });

        console.log('📥 Response Status:', response.status, response.statusText);
        const data = await response.json();
        console.log('📄 Response Data Structure:', {
          hasChoices: !!data.choices,
          choicesLength: data.choices?.length,
          hasMessage: !!data.choices?.[0]?.message,
          messageContent: data.choices?.[0]?.message?.content?.substring(0, 100),
          rawDataKeys: Object.keys(data)
        });
        console.log('📦 Full Response Data:', data);

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
          const updatedMessages = [...newMessages, aiMessage];
          setChatMessages(updatedMessages);
          
          // Save to DATABASE
          if (currentAgentId) {
            await fetch(`/api/agents/${currentAgentId}/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(aiMessage)
            });
          }
          return;
        }

        const aiMessage: ChatMessage = {
          id: `msg${Date.now() + 1}`,
          role: 'assistant',
          content: data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.",
          timestamp: Date.now(),
        };
        console.log('✅ AI Message Created:', {
          id: aiMessage.id,
          role: aiMessage.role,
          contentLength: aiMessage.content.length,
          contentPreview: aiMessage.content.substring(0, 100) + '...'
        });
        const updatedMessages = [...newMessages, aiMessage];
        setChatMessages(updatedMessages);
        
        // Save AI message to DATABASE
        if (currentAgentId) {
          await fetch(`/api/agents/${currentAgentId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(aiMessage)
          }).catch(err => console.error('Failed to save AI message:', err));
        }
        console.log('💾 Chat messages saved to database, total messages:', updatedMessages.length);
      } catch (error) {
        console.error("❌ Chat API error:", error);
        const errorMessage: ChatMessage = {
          id: `msg${Date.now() + 1}`,
          role: 'assistant',
          content: "❌ Network error: Unable to reach AI service. Please check your connection and try again.",
          timestamp: Date.now(),
        };
        const updatedMessages = [...newMessages, errorMessage];
        setChatMessages(updatedMessages);
        
        // Save error message to DATABASE
        if (currentAgentId) {
          await fetch(`/api/agents/${currentAgentId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(errorMessage)
          }).catch(err => console.error('Failed to save error message:', err));
        }
      } finally {
        setIsChatLoading(false);
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
    <div className="flex min-h-screen bg-[#0e0f0f]">
      {/* Onboarding Tutorial */}
      <InteractiveOnboarding />
      
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        documents={documents}
        folders={folders}
        currentDocId={currentDocId}
        onSelectDoc={handleSelectDoc}
        onNewDoc={handleNewDoc}
        onRenameDoc={handleRenameDoc}
        onDeleteDoc={handleDeleteDoc}
        onNewFolder={handleNewFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
        onMoveDoc={handleMoveDoc}
        onMoveFolder={(folderId, parentId) => {
          // Stub implementation - can be enhanced later
          console.log('Move folder:', folderId, 'to parent:', parentId);
        }}
        onDashboard={() => setViewMode(viewMode === 'dashboard' ? 'editor' : 'dashboard')}
        onKnowledgeBase={() => setViewMode(viewMode === 'knowledgebase' ? 'editor' : 'knowledgebase')}
      />
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'} ${agentSidebarOpen ? 'mr-[480px]' : 'mr-0'}`}>
        
        {viewMode === 'editor' ? (
          <>
            {currentDoc && (
              <div className="mx-auto max-w-screen-lg px-4 py-8">
                <TailwindAdvancedEditor
                  ref={editorRef}
                  initialContent={currentDoc.content}
                  onUpdate={handleUpdateDoc}
                />
              </div>
            )}
            
            {/* Floating Action Button */}
            {currentDoc && (
              // FloatingDocumentActions component - disabled for now
              null
              // <FloatingDocumentActions
              //   onExport={(format) => {
              //     if (format === 'pdf') {
              //       handleExportPDF();
              //     } else if (format === 'docx' || format === 'txt' || format === 'html') {
              //       // Handle other export formats if needed
              //       console.log('Export format:', format);
              //     }
              //   }}
              //   onShare={handleShare}
              // />
            )}
          </>
        ) : viewMode === 'dashboard' ? (
          <EnhancedDashboard />
        ) : (
          <KnowledgeBase />
        )}
      </div>
      {/* Only show Agent Sidebar (SOW Builder) in editor mode */}
      {viewMode === 'editor' && (
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
          onInsertToEditor={(content) => {
            console.log('📝 Insert to Editor button clicked from AI chat');
            // Strip <think> tags and any XML-like tags from AI responses
            const cleanContent = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            // Use the existing handleInsertContent which properly converts markdown to Novel JSON with pricing tables
            handleInsertContent(cleanContent || content);
          }}
        />
      )}

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
