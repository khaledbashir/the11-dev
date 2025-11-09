/**
 * Agent Invocation Handler
 * 
 * Manages WebSocket connections to AnythingLLM agent system.
 * Handles tool execution streaming and result aggregation.
 */

export interface AgentMessage {
  type: 'statusResponse' | 'textResponse' | 'toolCall' | 'toolResult' | 'agentComplete';
  uuid?: string;
  content?: string;
  tool?: string;
  arguments?: any;
  result?: any;
  textResponse?: string;
  sources?: any[];
  close?: boolean;
  error?: string | null;
}

export interface AgentInvocation {
  uuid: string;
  websocketUrl: string;
  workspaceId: number;
}

export class AgentHandler {
  private ws: WebSocket | null = null;
  private invocation: AgentInvocation | null = null;
  private messageCallback: ((message: AgentMessage) => void) | null = null;
  private closeCallback: (() => void) | null = null;
  private errorCallback: ((error: Error) => void) | null = null;

  /**
   * Start an agent invocation
   * @param message - The message to send (should start with @agent)
   * @param workspaceSlug - The workspace slug
   * @param threadSlug - Optional thread slug
   * @returns Promise that resolves when connection is established
   */
  async invoke(
    message: string,
    workspaceSlug: string,
    threadSlug?: string
  ): Promise<void> {
    console.log('🤖 [AgentHandler] Starting agent invocation...');
    
    // Step 1: Create invocation via API
    const response = await fetch('/api/anythingllm/agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        workspaceSlug,
        threadSlug,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create agent invocation');
    }

    const data = await response.json();
    this.invocation = data.invocation;

    console.log('✅ [AgentHandler] Invocation created:', this.invocation);

    // Step 2: Connect to WebSocket
    await this.connectWebSocket();
  }

  /**
   * Connect to the agent WebSocket
   */
  private async connectWebSocket(): Promise<void> {
    if (!this.invocation) {
      throw new Error('No invocation created');
    }

    return new Promise((resolve, reject) => {
      console.log('📡 [AgentHandler] Connecting to WebSocket:', this.invocation!.websocketUrl);
      
      this.ws = new WebSocket(this.invocation.websocketUrl);

      this.ws.onopen = () => {
        console.log('✅ [AgentHandler] WebSocket connected');
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: AgentMessage = JSON.parse(event.data);
          console.log('📨 [AgentHandler] Message received:', message.type, message);
          
          if (this.messageCallback) {
            this.messageCallback(message);
          }

          // Close connection if agent signals completion
          if (message.close || message.type === 'agentComplete') {
            console.log('🏁 [AgentHandler] Agent completed, closing connection');
            this.close();
          }
        } catch (error) {
          console.error('❌ [AgentHandler] Failed to parse message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ [AgentHandler] WebSocket error:', error);
        if (this.errorCallback) {
          this.errorCallback(new Error('WebSocket connection error'));
        }
        reject(new Error('WebSocket connection error'));
      };

      this.ws.onclose = () => {
        console.log('🔌 [AgentHandler] WebSocket closed');
        if (this.closeCallback) {
          this.closeCallback();
        }
      };
    });
  }

  /**
   * Register callback for agent messages
   */
  onMessage(callback: (message: AgentMessage) => void): void {
    this.messageCallback = callback;
  }

  /**
   * Register callback for connection close
   */
  onClose(callback: () => void): void {
    this.closeCallback = callback;
  }

  /**
   * Register callback for errors
   */
  onError(callback: (error: Error) => void): void {
    this.errorCallback = callback;
  }

  /**
   * Send feedback to the agent (for interrupt mode)
   */
  sendFeedback(feedback: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ [AgentHandler] WebSocket not open, cannot send feedback');
      return;
    }

    this.ws.send(JSON.stringify({ feedback }));
    console.log('📤 [AgentHandler] Feedback sent:', feedback);
  }

  /**
   * Close the agent connection
   */
  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.invocation = null;
  }

  /**
   * Check if agent is currently active
   */
  isActive(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

/**
 * Detect if a message contains @agent invocation
 */
export function isAgentInvocation(message: string): boolean {
  return message.trim().startsWith('@agent');
}

/**
 * Extract agent handles from message
 * Returns array of @agent mentions
 */
export function parseAgentHandles(message: string): string[] {
  const matches = message.match(/@\w+/g);
  return matches?.filter(m => m.startsWith('@agent')) || [];
}
