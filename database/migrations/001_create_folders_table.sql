-- Migration: Create folders table
-- Purpose: Fix P0 Folder Creation Crash (ER_BAD_NULL_ERROR)

-- Create folders table if it doesn't exist
CREATE TABLE IF NOT EXISTS folders (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  workspace_slug VARCHAR(255) NULL, -- Associated workspace for organization
  workspace_id VARCHAR(36) NULL, -- Alternative identifier for workspace
  embed_id INT NULL, -- AnythingLLM embed ID reference
  parent_id VARCHAR(36) NULL, -- For hierarchical folder structure
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Indexes for performance
  INDEX idx_workspace_slug (workspace_slug),
  INDEX idx_parent_id (parent_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add foreign key constraint for parent_id if folders table already exists
-- This will be skipped if table doesn't exist (IF NOT EXISTS above)
ALTER TABLE folders
ADD CONSTRAINT fk_folders_parent
FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE SET NULL;

-- Success message
SELECT 'Folders table created successfully!' as status;
