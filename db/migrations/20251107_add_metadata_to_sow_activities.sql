-- Migration: add metadata column to sow_activities
-- Date: 2025-11-07
-- Adds a nullable JSON `metadata` column used by the SOW backend.

-- UP
ALTER TABLE sow_activities
  ADD COLUMN metadata JSON DEFAULT NULL;

-- DOWN
-- To rollback, run the following:
-- ALTER TABLE sow_activities DROP COLUMN metadata;
