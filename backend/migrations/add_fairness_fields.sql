-- Add fairness analysis fields to evaluations table
-- Run this in your Supabase SQL editor

ALTER TABLE evaluations
ADD COLUMN IF NOT EXISTS fairness_metrics JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS group_metrics JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS sensitive_attribute TEXT;

-- Add comments for documentation
COMMENT ON COLUMN evaluations.fairness_metrics IS 'Fairness metrics including demographic parity, equal opportunity, disparate impact, etc.';
COMMENT ON COLUMN evaluations.group_metrics IS 'Performance metrics broken down by demographic groups';
COMMENT ON COLUMN evaluations.sensitive_attribute IS 'Name of the sensitive attribute used for fairness analysis (e.g., gender, race)';

-- Create index for faster queries on evaluations with fairness data
CREATE INDEX IF NOT EXISTS idx_evaluations_fairness_metrics ON evaluations USING GIN (fairness_metrics);
CREATE INDEX IF NOT EXISTS idx_evaluations_sensitive_attribute ON evaluations (sensitive_attribute) WHERE sensitive_attribute IS NOT NULL;
