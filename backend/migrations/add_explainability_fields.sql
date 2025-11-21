-- Add Explainability fields to evaluations table
-- Run this in Supabase SQL Editor

ALTER TABLE evaluations
ADD COLUMN IF NOT EXISTS feature_importance JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS explainability_method TEXT,
ADD COLUMN IF NOT EXISTS shap_summary JSONB DEFAULT '{}'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN evaluations.feature_importance IS 'Array of features with importance scores from SHAP/LIME';
COMMENT ON COLUMN evaluations.explainability_method IS 'Method used for explainability (SHAP, LIME, or basic)';
COMMENT ON COLUMN evaluations.shap_summary IS 'SHAP summary statistics including mean values and top features';
