// AnythingLLM Integration Service
// Handles workspace creation, document embedding, and chat integration

const ANYTHINGLLM_BASE_URL = 'https://ahmad-anything-llm.840tjq.easypanel.host';
const ANYTHINGLLM_API_KEY = '0G0WTZ3-6ZX4D20-H35VBRG-9059WPA';

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
   * Get embed code for iframe
   */
  async getEmbedCode(workspaceSlug: string): Promise<string | null> {
    try {
      // Create embed config
      const response = await fetch(`${this.baseUrl}/api/v1/embed/new`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          workspaceSlug: workspaceSlug,
          maxChatsPerDay: 100,
          maxChatsPerSession: 20,
          allowedDomains: [
            'clientportal.socialgarden.com.au',
            'localhost:3000',
            'localhost:3333',
            '168.231.115.219:3333'
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create embed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.embedId;
    } catch (error) {
      console.error('❌ Error creating embed:', error);
      return null;
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
   * Set system prompt for workspace
   */
  async setWorkspacePrompt(workspaceSlug: string): Promise<boolean> {
    const prompt = `You are a helpful AI assistant for Social Garden clients. You have access to all Statement of Work (SOW) documents for this client.

Your role:
- Answer questions about project scope, pricing, deliverables, and timelines
- Be professional, friendly, and concise
- Always cite the specific SOW when answering
- Provide exact numbers from the documents (hours, rates, totals)
- If asked about something not in the SOWs, politely say you don't have that information

Example responses:
- "According to your HubSpot Integration SOW, we've allocated 40 hours for landing page development at $150/hour, totaling $6,000 AUD."
- "Your project includes 3 main deliverables: [list from SOW]"
- "The total investment for this project is $XX,XXX AUD including GST."

Always be helpful and make the client feel confident about their investment.`;

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

      return response.ok;
    } catch (error) {
      console.error('❌ Error setting workspace prompt:', error);
      return false;
    }
  }
}

// Export singleton instance
export const anythingLLM = new AnythingLLMService();
