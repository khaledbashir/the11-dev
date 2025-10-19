-- Gardner System Migration
-- Tracks which AnythingLLM workspaces are "Gardners" (AI writing assistants)
-- All configuration (system prompt, model, temperature) is stored in AnythingLLM
-- This table just links workspace slugs to our internal Gardner system

CREATE TABLE IF NOT EXISTS gardners (
  id VARCHAR(255) PRIMARY KEY,
  workspace_slug VARCHAR(255) UNIQUE NOT NULL,
  category VARCHAR(50) DEFAULT 'custom' COMMENT 'sow, email, blog, social, custom',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_workspace_slug (workspace_slug),
  INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert existing "Gen" workspace as first Gardner (The Architect)
INSERT INTO gardners (id, workspace_slug, category) 
VALUES ('the-architect', 'gen', 'sow')
ON DUPLICATE KEY UPDATE workspace_slug = workspace_slug;
