-- Gardners Table
-- Tracks AnythingLLM workspaces that function as "Gardners" (specialized AI writing assistants)
-- Named after Social Garden - Gardners tend and cultivate content

CREATE TABLE IF NOT EXISTS gardners (
  id VARCHAR(255) PRIMARY KEY,
  workspace_slug VARCHAR(255) UNIQUE NOT NULL, -- Maps to AnythingLLM workspace
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category ENUM('sow', 'email', 'blog', 'social', 'custom') DEFAULT 'custom',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_workspace_slug (workspace_slug),
  INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Note: All Gardner configuration (system prompt, model, temperature, etc.) 
-- is stored in AnythingLLM, not in our database. This table just tracks
-- which workspaces are Gardners vs Client workspaces.
