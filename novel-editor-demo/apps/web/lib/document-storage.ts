/**
 * Document Storage Service
 * Handles storage of SOW documents with dual strategy:
 * 1. Short-term: localStorage for fast access
 * 2. Long-term: AnythingLLM for persistence and multi-device access
 * 
 * Future: This will be the primary storage layer replacing all localStorage usage
 */

import { anythingLLM } from './anythingllm';

export interface Document {
  id: string;
  title: string;
  content: any; // TipTap JSON
  folderId?: string;
  createdAt: string;
  updatedAt: string;
  workspaceSlug?: string;
  embedId?: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId?: string;
  createdAt: string;
}

/**
 * Document Storage Service
 * Manages SOW documents with localStorage + AnythingLLM sync
 */
export class DocumentStorageService {
  private readonly DOCUMENTS_KEY = 'documents';
  private readonly FOLDERS_KEY = 'folders';
  private readonly SYNC_INTERVAL = 30000; // 30 seconds
  private syncTimer: NodeJS.Timeout | null = null;

  /**
   * Initialize the storage service
   * Starts auto-sync timer
   */
  init() {
    // Auto-sync every 30 seconds
    this.syncTimer = setInterval(() => {
      this.syncToAnythingLLM();
    }, this.SYNC_INTERVAL);
  }

  /**
   * Cleanup when service is destroyed
   */
  destroy() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
  }

  /**
   * Get all documents from localStorage
   */
  getDocuments(): Document[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const saved = localStorage.getItem(this.DOCUMENTS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('❌ Error loading documents:', error);
      return [];
    }
  }

  /**
   * Get all folders from localStorage
   */
  getFolders(): Folder[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const saved = localStorage.getItem(this.FOLDERS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('❌ Error loading folders:', error);
      return [];
    }
  }

  /**
   * Save documents to localStorage
   */
  saveDocuments(documents: Document[]) {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(this.DOCUMENTS_KEY, JSON.stringify(documents));
      console.log(`💾 Saved ${documents.length} documents to localStorage`);
    } catch (error) {
      console.error('❌ Error saving documents:', error);
    }
  }

  /**
   * Save folders to localStorage
   */
  saveFolders(folders: Folder[]) {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(this.FOLDERS_KEY, JSON.stringify(folders));
      console.log(`📁 Saved ${folders.length} folders to localStorage`);
    } catch (error) {
      console.error('❌ Error saving folders:', error);
    }
  }

  /**
   * Create a new document
   */
  createDocument(title: string, content: any, folderId?: string): Document {
    const doc: Document = {
      id: `doc_${Date.now()}`,
      title,
      content,
      folderId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const documents = this.getDocuments();
    documents.push(doc);
    this.saveDocuments(documents);

    return doc;
  }

  /**
   * Update an existing document
   */
  updateDocument(id: string, updates: Partial<Document>): Document | null {
    const documents = this.getDocuments();
    const index = documents.findIndex(d => d.id === id);
    
    if (index === -1) return null;

    documents[index] = {
      ...documents[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.saveDocuments(documents);
    return documents[index];
  }

  /**
   * Delete a document
   */
  deleteDocument(id: string): boolean {
    const documents = this.getDocuments();
    const filtered = documents.filter(d => d.id !== id);
    
    if (filtered.length === documents.length) return false;

    this.saveDocuments(filtered);
    return true;
  }

  /**
   * Create a new folder
   */
  createFolder(name: string, parentId?: string): Folder {
    const folder: Folder = {
      id: `folder_${Date.now()}`,
      name,
      parentId,
      createdAt: new Date().toISOString(),
    };

    const folders = this.getFolders();
    folders.push(folder);
    this.saveFolders(folders);

    return folder;
  }

  /**
   * Update a folder
   */
  updateFolder(id: string, updates: Partial<Folder>): Folder | null {
    const folders = this.getFolders();
    const index = folders.findIndex(f => f.id === id);
    
    if (index === -1) return null;

    folders[index] = {
      ...folders[index],
      ...updates,
    };

    this.saveFolders(folders);
    return folders[index];
  }

  /**
   * Delete a folder and optionally its contents
   */
  deleteFolder(id: string, deleteContents: boolean = false): boolean {
    const folders = this.getFolders();
    const filtered = folders.filter(f => f.id !== id);
    
    if (filtered.length === folders.length) return false;

    this.saveFolders(filtered);

    if (deleteContents) {
      const documents = this.getDocuments();
      const filteredDocs = documents.filter(d => d.folderId !== id);
      this.saveDocuments(filteredDocs);
    }

    return true;
  }

  /**
   * Sync all documents to AnythingLLM
   * This creates/updates documents in their respective workspaces
   */
  async syncToAnythingLLM(): Promise<void> {
    const documents = this.getDocuments();
    
    if (documents.length === 0) {
      console.log('📭 No documents to sync');
      return;
    }

    console.log(`🔄 Starting sync of ${documents.length} documents to AnythingLLM...`);
    
    let synced = 0;
    let failed = 0;

    for (const doc of documents) {
      try {
        // Skip if already has embedId (already synced)
        if (doc.embedId) {
          continue;
        }

        // Extract client name from title
        const clientName = doc.title.split(':')[1]?.split('-')[0]?.trim();
        
        if (!clientName) {
          console.warn(`⚠️ Cannot extract client name from: ${doc.title}`);
          continue;
        }

        // Create or get workspace
        const workspaceSlug = await anythingLLM.createOrGetClientWorkspace(clientName);

        // Convert TipTap JSON to HTML (simple conversion)
        const htmlContent = this.tiptapToHTML(doc.content);

        // Embed document
        const success = await anythingLLM.embedSOWDocument(
          workspaceSlug,
          doc.title,
          htmlContent,
          {
            docId: doc.id,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
          }
        );

        if (success) {
          // Update document with workspace info
          this.updateDocument(doc.id, {
            workspaceSlug,
          });
          
          synced++;
          console.log(`✅ Synced: ${doc.title}`);
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`❌ Failed to sync ${doc.title}:`, error);
        failed++;
      }
    }

    console.log(`🔄 Sync complete: ${synced} synced, ${failed} failed`);
  }

  /**
   * Simple TipTap JSON to HTML conversion
   * TODO: Improve this with proper TipTap HTML serialization
   */
  private tiptapToHTML(content: any): string {
    if (!content || !content.content) return '';
    
    let html = '';
    
    for (const node of content.content) {
      if (node.type === 'paragraph') {
        html += '<p>';
        if (node.content) {
          for (const textNode of node.content) {
            html += textNode.text || '';
          }
        }
        html += '</p>';
      } else if (node.type === 'heading') {
        const level = node.attrs?.level || 1;
        html += `<h${level}>`;
        if (node.content) {
          for (const textNode of node.content) {
            html += textNode.text || '';
          }
        }
        html += `</h${level}>`;
      }
    }
    
    return html;
  }
}

// Export singleton instance
export const documentStorage = new DocumentStorageService();
