// AnythingLLM Integration Service
// Handles workspace creation, document embedding, and chat integration

// Social Garden AnythingLLM Instance
const ANYTHINGLLM_BASE_URL = 'https://socialgarden-anything-llm.vo0egb.easypanel.host';
const ANYTHINGLLM_API_KEY = '0G0WTZ3-6ZX4D20-H35VBRG-9059WPA'; // Update with your Social Garden API key

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
      
      // Automatically set client-facing prompt for new workspace
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
      const response = await fetch(`${this.baseUrl}/api/v1/embed/new`, {
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
    
    const prompt = `${greeting} I have complete access to all your Statement of Work (SOW) documents and I'm here to help you understand every detail of your projects with us.

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
- "What's my total investment for this project?"
- "How many hours are allocated for social media management?"
- "What deliverables am I getting with the HubSpot integration?"
- "When does the project start and what are the key milestones?"
- "Can you break down the pricing for the content creation services?"
- "What's included in the monthly retainer?"

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
}

// Export singleton instance
export const anythingLLM = new AnythingLLMService();
