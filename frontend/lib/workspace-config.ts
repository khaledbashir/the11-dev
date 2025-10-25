// Workspace Configuration for Social Garden SOW Generator
// Different workspaces for different purposes

export const WORKSPACE_CONFIG = {
  // Sidebar AI - For generating SOWs
  sidebar: {
    slug: 'gen-the-architect',
    name: 'SOW Generator',
    description: 'Main workspace for AI-generated SOWs',
    purpose: 'Generate complete Statements of Work',
  },

  // Editor Popup AI - For editing assistance
  editor: {
    slug: 'pop',
    name: 'Editor Assistant',
    description: 'Workspace for in-editor AI assistance',
    purpose: 'Help with SOW editing and refinement',
  },

  // Dashboard AI - For analytics and reporting
  dashboard: {
    slug: 'sow-master-dashboard',
    name: 'Master Dashboard',
    description: 'Workspace for SOW analytics and master dashboard',
    purpose: 'Analytics, reporting, and SOW aggregation',
  },

  // Master embedding target
  masterEmbedding: {
    slug: 'sow-master-dashboard',
    name: 'Master Dashboard',
    description: 'Central repository for all created SOWs',
    purpose: 'All SOWs are embedded here for analytics',
  },
};

/**
 * Get the appropriate workspace slug for an agent
 * @param agentId - The agent ID to get workspace for
 * @returns The workspace slug
 */
export function getWorkspaceForAgent(agentId: string): string {
  switch (agentId) {
    case 'architect':
    case 'strategist':
    case 'sow-generator':
      return WORKSPACE_CONFIG.sidebar.slug;
    
    case 'editor-assistant':
    case 'editor-ai':
      return WORKSPACE_CONFIG.editor.slug;
    
    case 'dashboard':
    case 'analytics':
    case 'sow-master-dashboard':
      return WORKSPACE_CONFIG.dashboard.slug;
    
    default:
      // If no match, default to sidebar
      return WORKSPACE_CONFIG.sidebar.slug;
  }
}

/**
 * Check if an agent uses AnythingLLM workspaces
 * @param agentModel - The agent's model name
 * @returns true if agent should use AnythingLLM workspaces
 */
export function shouldUseAnythingLLMWorkspace(agentModel: string): boolean {
  return agentModel === 'anythingllm' || agentModel === 'anything-llm';
}
