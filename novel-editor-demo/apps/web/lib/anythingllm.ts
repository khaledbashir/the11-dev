// AnythingLLM Integration Service
// Handles workspace creation, document embedding, and chat integration

import SOCIAL_GARDEN_KNOWLEDGE_BASE from './social-garden-knowledge-base';

// Ahmad's AnythingLLM Instance
const ANYTHINGLLM_BASE_URL = 'https://ahmad-anything-llm.840tjq.easypanel.host';
const ANYTHINGLLM_API_KEY = '0G0WTZ3-6ZX4D20-H35VBRG-9059WPA'; // Update with Ahmad's API key

interface WorkspaceResponse {
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
}

interface DocumentResponse {
  success: boolean;
  documentId: string;
  message?: string;
}

export class AnythingLLMService {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl = ANYTHINGLLM_BASE_URL, apiKey = ANYTHINGLLM_API_KEY) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Create or get workspace for a client
   * One workspace per client (recommended approach)
   */
  async createOrGetClientWorkspace(clientName: string): Promise<string> {
    const slug = clientName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    try {
      // Check if workspace exists
      const workspaces = await this.listWorkspaces();
      const existing = workspaces.find((w: any) => w.slug === slug);
      
      if (existing) {
        console.log(`✅ Using existing workspace: ${slug}`);
        return slug;
      }

      // Create new workspace
      console.log(`🆕 Creating new workspace: ${slug}`);
      const response = await fetch(`${this.baseUrl}/api/v1/workspace/new`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          name: clientName,
          slug: slug,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create workspace: ${response.statusText}`);
      }

      const data: WorkspaceResponse = await response.json();
      console.log(`✅ Workspace created: ${data.workspace.slug}`);
      
      // 🌱 STEP 1: Embed Social Garden company knowledge base
      await this.embedCompanyKnowledgeBase(data.workspace.slug);
      
      // 🎯 STEP 2: Set client-facing prompt for new workspace
      await this.setWorkspacePrompt(data.workspace.slug, clientName);
      
      return data.workspace.slug;
    } catch (error) {
      console.error('❌ Error creating workspace:', error);
      throw error;
    }
  }

  /**
   * List all workspaces
   */
  async listWorkspaces(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/workspaces`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to list workspaces: ${response.statusText}`);
      }

      const data = await response.json();
      return data.workspaces || [];
    } catch (error) {
      console.error('❌ Error listing workspaces:', error);
      return [];
    }
  }

  /**
   * Embed SOW document into workspace
   * Converts HTML to text and uploads
   */
  async embedSOWDocument(
    workspaceSlug: string,
    sowTitle: string,
    htmlContent: string,
    metadata: Record<string, any> = {}
  ): Promise<boolean> {
    try {
      console.log(`📄 Embedding SOW: ${sowTitle} to workspace: ${workspaceSlug}`);

      // Convert HTML to plain text (remove tags)
      const textContent = this.htmlToText(htmlContent);

      // Create rich text with metadata
      const enrichedContent = `
# ${sowTitle}

${textContent}

---
Metadata:
- Document ID: ${metadata.docId || 'N/A'}
- Created: ${metadata.createdAt || new Date().toISOString()}
- Source: Social Garden SOW Editor
- Type: Statement of Work
      `.trim();

      // Upload as raw text
      const uploadResponse = await fetch(`${this.baseUrl}/api/v1/document/raw-text`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          textContent: enrichedContent,
          metadata: {
            title: sowTitle,
            ...metadata,
          },
        }),
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload document: ${uploadResponse.statusText}`);
      }

      const uploadData: DocumentResponse = await uploadResponse.json();
      
      if (!uploadData.success) {
        throw new Error(uploadData.message || 'Upload failed');
      }

      console.log(`✅ Document uploaded: ${uploadData.documentId}`);

      // Update workspace to include this document
      const updateResponse = await fetch(
        `${this.baseUrl}/api/v1/workspace/${workspaceSlug}/update`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            adds: [uploadData.documentId],
          }),
        }
      );

      if (!updateResponse.ok) {
        console.warn('⚠️ Document uploaded but failed to add to workspace');
        return false;
      }

      console.log(`✅ Document added to workspace: ${workspaceSlug}`);
      return true;
    } catch (error) {
      console.error('❌ Error embedding SOW:', error);
      return false;
    }
  }

  /**
   * Get workspace chat URL for client
   */
  getWorkspaceChatUrl(workspaceSlug: string): string {
    return `${this.baseUrl}/workspace/${workspaceSlug}`;
  }

  /**
   * Get or create embed ID for workspace
   * Returns the embed UUID needed for the widget script
   */
  async getOrCreateEmbedId(workspaceSlug: string): Promise<string | null> {
    try {
      // First, check if embed already exists for this workspace
      const listResponse = await fetch(`${this.baseUrl}/api/v1/embeds`, {
        headers: this.getHeaders(),
      });

      if (listResponse.ok) {
        const { embeds } = await listResponse.json();
        const existing = embeds?.find((e: any) => e.workspace?.slug === workspaceSlug);
        if (existing) {
          console.log(`✅ Using existing embed: ${existing.uuid}`);
          return existing.uuid;
        }
      }

      // Create new embed config
      console.log(`🆕 Creating new embed for workspace: ${workspaceSlug}`);
      const response = await fetch(`${this.baseUrl}/api/v1/embeds/new`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          workspace_slug: workspaceSlug,
          chat_mode: 'chat', // or 'query' for specific questions only
          max_chats_per_day: 0, // Unlimited for clients
          max_chats_per_session: 0, // Unlimited
          allowlist_domains: [
            'socialgarden.com.au',
            'clientportal.socialgarden.com.au',
            'localhost:3000',
            'localhost:3333',
            '168.231.115.219',
            '168.231.115.219:3333'
          ],
          allow_model_override: false,
          allow_temperature_override: false,
          allow_prompt_override: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create embed: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`✅ Embed created:`, data);
      return data.embed?.uuid || null;
    } catch (error) {
      console.error('❌ Error getting/creating embed:', error);
      return null;
    }
  }

  /**
   * Get embed script snippet for a workspace
   */
  getEmbedScript(embedId: string, options: {
    baseUrl?: string;
    buttonColor?: string;
    assistantName?: string;
    chatIcon?: string;
    position?: string;
    openOnLoad?: boolean;
  } = {}): string {
    const {
      baseUrl = this.baseUrl,
      buttonColor = '#0e2e33',
      assistantName = 'Social Garden AI',
      chatIcon = 'sparkles',
      position = 'bottom-right',
      openOnLoad = false
    } = options;

    return `<script
  data-embed-id="${embedId}"
  data-base-api-url="${baseUrl}/api/embed"
  data-button-color="${buttonColor}"
  data-assistant-name="${assistantName}"
  data-chat-icon="${chatIcon}"
  data-position="${position}"
  ${openOnLoad ? 'data-open-on-load="on"' : ''}
  src="${baseUrl}/embed/anythingllm-chat-widget.min.js">
</script>
<!-- Powered by Social Garden AI -->`;
  }

  /**
   * Embed Social Garden company knowledge base into workspace
   * This gives the AI context about Social Garden's services, case studies, and capabilities
   */
  async embedCompanyKnowledgeBase(workspaceSlug: string): Promise<boolean> {
    try {
      console.log(`📚 Embedding Social Garden knowledge base into workspace: ${workspaceSlug}`);

      // Upload company knowledge base as raw text
      const uploadResponse = await fetch(`${this.baseUrl}/api/v1/document/raw-text`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          textContent: SOCIAL_GARDEN_KNOWLEDGE_BASE,
          metadata: {
            title: 'Social Garden - Company Knowledge Base',
            source: 'Social Garden Internal Documentation',
            type: 'Company Information',
            priority: 'high', // Make this available for all queries
          },
        }),
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload knowledge base: ${uploadResponse.statusText}`);
      }

      const uploadData: DocumentResponse = await uploadResponse.json();
      
      if (!uploadData.success) {
        throw new Error(uploadData.message || 'Knowledge base upload failed');
      }

      console.log(`✅ Company knowledge base uploaded: ${uploadData.documentId}`);

      // Add knowledge base to workspace
      const updateResponse = await fetch(
        `${this.baseUrl}/api/v1/workspace/${workspaceSlug}/update`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            adds: [uploadData.documentId],
          }),
        }
      );

      if (!updateResponse.ok) {
        console.warn('⚠️ Knowledge base uploaded but failed to add to workspace');
        return false;
      }

      console.log(`✅ Social Garden knowledge base added to workspace: ${workspaceSlug}`);
      return true;
    } catch (error) {
      console.error('❌ Error embedding company knowledge base:', error);
      return false;
    }
  }

  /**
   * Convert HTML to plain text (simple implementation)
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  /**
   * Set client-facing system prompt for workspace
   * This prompt is used in the embed widget on the client portal
   */
  async setWorkspacePrompt(workspaceSlug: string, clientName?: string): Promise<boolean> {
    const greeting = clientName ? `Hi! I'm the Social Garden AI assistant for ${clientName}.` : `Hi! I'm your Social Garden AI assistant.`;
    
    const prompt = `${greeting} I have complete access to all your Statement of Work (SOW) documents AND comprehensive knowledge about Social Garden's services, case studies, and capabilities.

🎯 What I Can Help You With:
- Project scope, deliverables, and timelines
- Pricing breakdowns, hourly rates, and total investment
- Service descriptions and what's included
- Team allocation and hours per service
- Payment terms and project milestones
- Any questions about your SOW documents

💼 How I Work:
- I always cite the specific SOW I'm referencing
- I provide exact numbers (hours, rates, totals in AUD)
- I'm professional yet friendly - think of me as your project concierge
- If something isn't in your SOWs, I'll let you know honestly

✨ Example Questions You Can Ask:

About Your SOW:
- "What's my total investment for this project?"
- "How many hours are allocated for social media management?"
- "What deliverables am I getting with the HubSpot integration?"
- "When does the project start and what are the key milestones?"
- "Can you break down the pricing for the content creation services?"
- "What's included in the monthly retainer?"

About Social Garden:
- "What other property clients has Social Garden worked with?"
- "Tell me about Social Garden's CRM implementation services"
- "What case studies do you have in education marketing?"
- "Who are the founders and leadership team?"
- "What marketing automation platforms does Social Garden specialize in?"
- "Does Social Garden offer internships or career opportunities?"

📊 Response Style:
I'll always give you clear, accurate answers with specific details from your SOWs. For example:
"According to your HubSpot Integration SOW, we've allocated 40 hours for landing page development at $150/hour, totaling $6,000 AUD. This includes responsive design, SEO optimization, and integration with your CRM."

🤝 My Goal:
Make you feel completely confident about your investment with Social Garden. Every dollar, every hour, every deliverable - I'm here to make it crystal clear.

Ready to explore your project details? Ask me anything!`;

    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/workspace/${workspaceSlug}/update`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            openAiPrompt: prompt,
          }),
        }
      );

      if (response.ok) {
        console.log(`✅ Client-facing prompt set for workspace: ${workspaceSlug}`);
      }

      return response.ok;
    } catch (error) {
      console.error('❌ Error setting workspace prompt:', error);
      return false;
    }
  }

  // ========================================
  // 🧵 THREAD MANAGEMENT API METHODS
  // ========================================

  /**
   * Create a new thread in a workspace
   * Each SOW becomes a thread for isolated chat history
   */
  async createThread(workspaceSlug: string, threadName: string): Promise<{ slug: string; id: string } | null> {
    try {
      console.log(`🆕 Creating thread "${threadName}" in workspace: ${workspaceSlug}`);
      
      const response = await fetch(
        `${this.baseUrl}/api/v1/workspace/${workspaceSlug}/thread/new`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            name: threadName,
          }),
        }
      );

      if (!response.ok) {
        console.error(`❌ Failed to create thread: ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      console.log(`✅ Thread created: ${data.thread.slug} (ID: ${data.thread.id})`);
      
      return {
        slug: data.thread.slug,
        id: data.thread.id,
      };
    } catch (error) {
      console.error('❌ Error creating thread:', error);
      return null;
    }
  }

  /**
   * Update/rename a thread
   */
  async updateThread(workspaceSlug: string, threadSlug: string, newName: string): Promise<boolean> {
    try {
      console.log(`✏️ Renaming thread ${threadSlug} to "${newName}"`);
      
      const response = await fetch(
        `${this.baseUrl}/api/v1/workspace/${workspaceSlug}/thread/${threadSlug}/update`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            name: newName,
          }),
        }
      );

      if (response.ok) {
        console.log(`✅ Thread renamed successfully`);
        return true;
      }

      console.error(`❌ Failed to rename thread: ${response.statusText}`);
      return false;
    } catch (error) {
      console.error('❌ Error updating thread:', error);
      return false;
    }
  }

  /**
   * Delete a thread
   */
  async deleteThread(workspaceSlug: string, threadSlug: string): Promise<boolean> {
    try {
      console.log(`🗑️ Deleting thread: ${threadSlug}`);
      
      const response = await fetch(
        `${this.baseUrl}/api/v1/workspace/${workspaceSlug}/thread/${threadSlug}`,
        {
          method: 'DELETE',
          headers: this.getHeaders(),
        }
      );

      if (response.ok) {
        console.log(`✅ Thread deleted successfully`);
        return true;
      }

      console.error(`❌ Failed to delete thread: ${response.statusText}`);
      return false;
    } catch (error) {
      console.error('❌ Error deleting thread:', error);
      return false;
    }
  }

  /**
   * Get chat history from a thread
   */
  async getThreadChats(workspaceSlug: string, threadSlug: string): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/workspace/${workspaceSlug}/thread/${threadSlug}/chats`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        console.error(`❌ Failed to get thread chats: ${response.statusText}`);
        return [];
      }

      const data = await response.json();
      return data.history || [];
    } catch (error) {
      console.error('❌ Error getting thread chats:', error);
      return [];
    }
  }

  /**
   * Send a chat message to a thread
   */
  async chatWithThread(
    workspaceSlug: string,
    threadSlug: string,
    message: string,
    mode: 'query' | 'chat' = 'chat'
  ): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/workspace/${workspaceSlug}/thread/${threadSlug}/chat`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            message,
            mode,
          }),
        }
      );

      if (!response.ok) {
        console.error(`❌ Failed to send chat message: ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Error sending chat message:', error);
      return null;
    }
  }

  /**
   * Stream chat with a thread (for real-time responses)
   */
  async streamChatWithThread(
    workspaceSlug: string,
    threadSlug: string,
    message: string,
    onChunk: (chunk: string) => void,
    mode: 'query' | 'chat' = 'chat'
  ): Promise<void> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/workspace/${workspaceSlug}/thread/${threadSlug}/stream-chat`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            message,
            mode,
          }),
        }
      );

      if (!response.ok) {
        console.error(`❌ Failed to stream chat: ${response.statusText}`);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            onChunk(line);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error streaming chat:', error);
    }
  }

  /**
   * Delete a workspace and all its threads
   */
  async deleteWorkspace(workspaceSlug: string): Promise<boolean> {
    try {
      console.log(`🗑️ Deleting workspace: ${workspaceSlug}`);
      
      const response = await fetch(
        `${this.baseUrl}/api/v1/workspace/${workspaceSlug}`,
        {
          method: 'DELETE',
          headers: this.getHeaders(),
        }
      );

      if (response.ok) {
        console.log(`✅ Workspace deleted successfully (all threads cascaded)`);
        return true;
      }

      console.error(`❌ Failed to delete workspace: ${response.statusText}`);
      return false;
    } catch (error) {
      console.error('❌ Error deleting workspace:', error);
      return false;
    }
  }

  /**
   * Update/rename a workspace
   */
  async updateWorkspace(workspaceSlug: string, newName: string): Promise<boolean> {
    try {
      console.log(`✏️ Renaming workspace ${workspaceSlug} to "${newName}"`);
      
      const response = await fetch(
        `${this.baseUrl}/api/v1/workspace/${workspaceSlug}/update`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            name: newName,
          }),
        }
      );

      if (response.ok) {
        console.log(`✅ Workspace renamed successfully`);
        return true;
      }

      console.error(`❌ Failed to rename workspace: ${response.statusText}`);
      return false;
    } catch (error) {
      console.error('❌ Error updating workspace:', error);
      return false;
    }
  }
}

// Export singleton instance
export const anythingLLM = new AnythingLLMService();
