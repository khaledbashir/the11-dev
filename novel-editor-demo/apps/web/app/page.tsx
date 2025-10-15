"use client";

import { useState, useEffect, useRef } from "react";
import TailwindAdvancedEditor from "@/components/tailwind/advanced-editor";
import Sidebar from "@/components/tailwind/sidebar";
import AgentSidebar from "@/components/tailwind/agent-sidebar-clean";
import PricingTableBuilder from "@/components/tailwind/pricing-table-builder";
import Menu from "@/components/tailwind/ui/menu";
import { Button } from "@/components/tailwind/ui/button";
import { toast } from "sonner";
import { Sparkles, Info, ExternalLink } from "lucide-react";
import { defaultEditorContent } from "@/lib/content";
import { THE_ARCHITECT_SYSTEM_PROMPT } from "@/lib/knowledge-base";
import { 
  extractPricingFromContent, 
  exportToExcel, 
  exportToPDF,
  parseSOWMarkdown
} from "@/lib/export-utils";
import { anythingLLM } from "@/lib/anythingllm";

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

      // Convert data rows to pricing row format
      const pricingRows = dataRows.map(row => ({
        role: row[roleIdx] || '',
        description: row[descIdx] || '',
        hours: parseFloat(row[hoursIdx]?.replace(/[^0-9.]/g, '') || '0'),
        rate: parseFloat(row[rateIdx]?.replace(/[^0-9.]/g, '') || '0'),
      }));

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
}

interface Folder {
  id: string;
  name: string;
  parentId?: string;
}

interface Agent {
  id: string;
  name: string;
  systemPrompt: string;
  model: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export default function Page() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [agentSidebarOpen, setAgentSidebarOpen] = useState(true); // Open by default
  const [agents, setAgents] = useState<Agent[]>([]);
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const editorRef = useRef<any>(null);

  useEffect(() => {
    const savedDocs = localStorage.getItem("documents");
    const savedFolders = localStorage.getItem("folders");
    const savedCurrent = localStorage.getItem("currentDocId");
    if (savedDocs) {
      setDocuments(JSON.parse(savedDocs));
    } else {
      // Create initial document
      const initialDoc: Document = {
        id: "doc1",
        title: "Untitled Document",
        content: defaultEditorContent,
      };
      setDocuments([initialDoc]);
      setCurrentDocId("doc1");
    }
    if (savedFolders) {
      setFolders(JSON.parse(savedFolders));
    }
    if (savedCurrent) {
      setCurrentDocId(savedCurrent);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("documents", JSON.stringify(documents));
  }, [documents]);

  useEffect(() => {
    localStorage.setItem("folders", JSON.stringify(folders));
  }, [folders]);

  useEffect(() => {
    if (currentDocId) {
      localStorage.setItem("currentDocId", currentDocId);
    }
  }, [currentDocId]);

  useEffect(() => {
    const savedAgents = localStorage.getItem("agents");
    const savedCurrentAgent = localStorage.getItem("currentAgentId");
    const savedChatMessages = localStorage.getItem("chatMessages");
    
    let loadedAgents: Agent[] = [];
    if (savedAgents) {
      loadedAgents = JSON.parse(savedAgents);
    }
    
    // Ensure The Architect agent exists
    const architectExists = loadedAgents.some(agent => agent.id === "architect");
    if (!architectExists) {
      const architectAgent: Agent = {
        id: "architect",
        name: "The Architect (SOW Generator)",
        systemPrompt: THE_ARCHITECT_SYSTEM_PROMPT,
        model: "anthropic/claude-3.5-sonnet"
      };
      loadedAgents.unshift(architectAgent); // Add to beginning of array
    }
    
    setAgents(loadedAgents);
    
    if (savedCurrentAgent) {
      setCurrentAgentId(savedCurrentAgent);
    }
    if (savedChatMessages) {
      setChatMessages(JSON.parse(savedChatMessages));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("agents", JSON.stringify(agents));
  }, [agents]);

  useEffect(() => {
    if (currentAgentId) {
      localStorage.setItem("currentAgentId", currentAgentId);
    }
  }, [currentAgentId]);

  useEffect(() => {
    localStorage.setItem("chatMessages", JSON.stringify(chatMessages));
  }, [chatMessages]);

  const currentDoc = documents.find(d => d.id === currentDocId);

  useEffect(() => {
    if (currentDoc && editorRef.current) {
      // Update editor content when document changes
      editorRef.current.insertContent(currentDoc.content);
    }
  }, [currentDocId, currentDoc]);

  const handleSelectDoc = (id: string) => {
    setCurrentDocId(id);
  };

  const handleNewDoc = () => {
    const newId = `doc${Date.now()}`;
    const newDoc: Document = {
      id: newId,
      title: "New SOW",
      content: defaultEditorContent,
    };
    setDocuments(prev => [...prev, newDoc]);
    setCurrentDocId(newId);
    
    // Clear chat messages for current agent
    setChatMessages([]);
    if (currentAgentId) {
      localStorage.setItem(`chatMessages_${currentAgentId}`, JSON.stringify([]));
    }
    
    // Open agent sidebar if not open, select The Architect
    if (!agentSidebarOpen) {
      setAgentSidebarOpen(true);
    }
    const architectAgent = agents.find(a => a.id === "architect");
    if (architectAgent) {
      setCurrentAgentId("architect");
    }
  };

  const handleRenameDoc = (id: string, title: string) => {
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, title } : d));
  };

  const handleDeleteDoc = (id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
    if (currentDocId === id) {
      const remaining = documents.filter(d => d.id !== id);
      setCurrentDocId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleNewFolder = (name: string) => {
    const newId = `folder${Date.now()}`;
    const newFolder: Folder = {
      id: newId,
      name,
    };
    setFolders(prev => [...prev, newFolder]);
  };

  const handleRenameFolder = (id: string, name: string) => {
    setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f));
  };

  const handleDeleteFolder = (id: string) => {
    // Also delete subfolders and docs in folder
    const toDelete = [id];
    const deleteRecursive = (folderId: string) => {
      folders.filter(f => f.parentId === folderId).forEach(f => {
        toDelete.push(f.id);
        deleteRecursive(f.id);
      });
    };
    deleteRecursive(id);
    setFolders(prev => prev.filter(f => !toDelete.includes(f.id)));
    setDocuments(prev => prev.filter(d => !d.folderId || !toDelete.includes(d.folderId)));
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

    try {
      toast.loading('Embedding SOW to AI knowledge base...');

      // Extract client name from title (e.g., "SOW: AGGF - HubSpot" → "AGGF")
      const clientName = currentDoc.title.split(':')[1]?.split('-')[0]?.trim() || 'Default Client';

      // Create or get workspace
      const workspaceSlug = await anythingLLM.createOrGetClientWorkspace(clientName);

      // Get HTML content
      const htmlContent = editorRef.current.getHTML();

      // Embed document
      const success = await anythingLLM.embedSOWDocument(
        workspaceSlug,
        currentDoc.title,
        htmlContent,
        {
          docId: currentDoc.id,
          createdAt: new Date().toISOString(),
        }
      );

      if (success) {
        // Set client-facing workspace prompt with client name
        await anythingLLM.setWorkspacePrompt(workspaceSlug, clientName);
        
        toast.success(`✅ SOW embedded! ${clientName}'s AI assistant is ready to answer questions.`);
        
        // Store workspace slug in localStorage for quick access
        localStorage.setItem(`workspace_${currentDoc.id}`, workspaceSlug);
      } else {
        toast.error('Failed to embed SOW');
      }
    } catch (error: any) {
      console.error('Error embedding to AI:', error);
      toast.error(`Error: ${error.message}`);
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

  const handleCreateAgent = (agent: Omit<Agent, 'id'>) => {
    const newId = `agent${Date.now()}`;
    const newAgent: Agent = { id: newId, ...agent };
    setAgents(prev => [...prev, newAgent]);
    setCurrentAgentId(newId);
  };

  const handleSelectAgent = (id: string) => {
    setCurrentAgentId(id);
    // Load chat messages for this agent
    const agentMessages = localStorage.getItem(`chatMessages_${id}`);
    if (agentMessages) {
      setChatMessages(JSON.parse(agentMessages));
    } else {
      setChatMessages([]);
    }
  };

  const handleUpdateAgent = (id: string, updates: Partial<Agent>) => {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const handleDeleteAgent = (id: string) => {
    setAgents(prev => prev.filter(a => a.id !== id));
    if (currentAgentId === id) {
      setCurrentAgentId(null);
      setChatMessages([]);
    }
    localStorage.removeItem(`chatMessages_${id}`);
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
      // Convert markdown content to Novel editor JSON format
      console.log('🔄 Converting markdown to JSON...');
      const convertedContent = convertMarkdownToNovelJSON(content);
      console.log('✅ Content converted');
      
      // Extract title from the content (first heading)
      const titleMatch = content.match(/^#\s+(.+)$/m);
      const clientMatch = content.match(/\*\*Client:\*\*\s+(.+)$/m);
      const scopeMatch = content.match(/Scope of Work:\s+(.+)/);
      
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
      
      toast.success("✅ Content inserted into editor!");
    } catch (error) {
      console.error("Error inserting content:", error);
      toast.error("❌ Failed to insert content. Please try again.");
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || !currentAgentId) return;

    setIsChatLoading(true);
    if (!currentAgentId) return;

    // Check for /inserttosow or insert command
    if (message.toLowerCase().includes('/inserttosow') || 
        message.toLowerCase().includes('insert into editor') ||
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
          // Convert markdown content to Novel editor JSON format
          console.log('🔄 Converting markdown to JSON...');
          const content = convertMarkdownToNovelJSON(lastAIMessage.content);
          console.log('✅ Content converted');
          
          // Extract title from the SOW content (first heading)
          const titleMatch = lastAIMessage.content.match(/^#\s+(.+)$/m);
          const clientMatch = lastAIMessage.content.match(/\*\*Client:\*\*\s+(.+)$/m);
          const scopeMatch = lastAIMessage.content.match(/Scope of Work:\s+(.+)/);
          
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
          localStorage.setItem(`chatMessages_${currentAgentId}`, JSON.stringify([...chatMessages, confirmMessage]));
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
          localStorage.setItem(`chatMessages_${currentAgentId}`, JSON.stringify([...chatMessages, errorMessage]));
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
    localStorage.setItem(`chatMessages_${currentAgentId}`, JSON.stringify(newMessages));

    const currentAgent = agents.find(a => a.id === currentAgentId);
    if (currentAgent) {
      try {
        // API key validation now handled server-side

        const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: currentAgent.model,
          messages: [
            { role: "system", content: currentAgent.systemPrompt },
            ...newMessages.map(m => ({ role: m.role, content: m.content })),
          ],
        }),
      });

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
          const updatedMessages = [...newMessages, aiMessage];
          setChatMessages(updatedMessages);
          localStorage.setItem(`chatMessages_${currentAgentId}`, JSON.stringify(updatedMessages));
          return;
        }

        const aiMessage: ChatMessage = {
          id: `msg${Date.now() + 1}`,
          role: 'assistant',
          content: data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.",
          timestamp: Date.now(),
        };
        const updatedMessages = [...newMessages, aiMessage];
        setChatMessages(updatedMessages);
        localStorage.setItem(`chatMessages_${currentAgentId}`, JSON.stringify(updatedMessages));
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
        localStorage.setItem(`chatMessages_${currentAgentId}`, JSON.stringify(updatedMessages));
      } finally {
        setIsChatLoading(false);
      }
    } else {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
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
      />
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'} ${agentSidebarOpen ? 'mr-[480px]' : 'mr-0'}`}>
        {/* Workflow Info Banner */}
        <div className="w-full bg-gradient-to-r from-[#0e2e33] to-[#0a2328] text-white px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="bg-white/10 px-2 py-1 rounded">1. AnythingLLM Login</span>
              <span className="text-[#20e28f]">→</span>
              <span className="bg-[#20e28f]/20 px-2 py-1 rounded border border-[#20e28f]">2. SOW Generator (You are here)</span>
              <span className="text-[#20e28f]">→</span>
              <span className="bg-white/10 px-2 py-1 rounded">3. Share Portal Link</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/70">
            <Info className="w-3 h-3" />
            <span>Logged in as Sam (Admin)</span>
          </div>
        </div>
        
        <div className="flex w-full max-w-screen-lg items-center gap-2 px-4 sm:mb-[calc(20vh)] mx-auto mt-4">
          {/* Back to AnythingLLM button */}
          <Button
            onClick={() => window.open('https://ahmad-anything-llm.840tjq.easypanel.host', '_blank')}
            variant="ghost"
            size="sm"
            className="gap-2 text-slate-600 hover:text-slate-900"
            title="Return to AnythingLLM"
          >
            ← Back to AI Hub
          </Button>
          
          <div className="ml-auto flex gap-2">
            <Button
              onClick={handleEmbedToAI}
              variant="outline"
              size="sm"
              className="gap-2 border-[#20e28f] text-[#0e2e33] hover:bg-[#20e28f]/10"
              title="Embed this SOW to AI knowledge base"
            >
              <Sparkles className="h-4 w-4" />
              Embed to AI
            </Button>
            <Button
              onClick={handleOpenAIChat}
              variant="default"
              size="sm"
              className="gap-2 bg-[#0e2e33] hover:bg-[#0e2e33]/90"
              title="Ask AI about this SOW"
            >
              <Sparkles className="h-4 w-4" />
              Ask AI
            </Button>
            <Button
              onClick={() => {
                if (currentDocId) {
                  const portalUrl = `http://168.231.115.219:3333/portal/sow/${currentDocId}`;
                  navigator.clipboard.writeText(portalUrl);
                  toast.success('Portal link copied to clipboard!', {
                    description: 'Share this link with your client',
                  });
                } else {
                  toast.error('Please select a document first');
                }
              }}
              variant="outline"
              size="sm"
              className="gap-2 border-blue-500 text-blue-600 hover:bg-blue-50"
              title="Copy client portal link"
            >
              🔗 Share Portal Link
            </Button>
            <Menu 
              onExportPDF={handleExportPDF}
              onExportExcel={handleExportExcel}
            />
          </div>
        </div>
        
        {currentDoc && (
          <div className="mx-auto max-w-screen-lg px-4">
            <TailwindAdvancedEditor
              ref={editorRef}
              initialContent={currentDoc.content}
              onUpdate={handleUpdateDoc}
            />
          </div>
        )}
      </div>
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
        onInsertToEditor={(content) => handleInsertContent(content)}
      />
    </div>
  );
}
