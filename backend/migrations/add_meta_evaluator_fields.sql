-- Add Meta Evaluator fields to evaluations table

ALTER TABLE evaluations
ADD COLUMN IF NOT EXISTS meta_score NUMERIC,
ADD COLUMN IF NOT EXISTS dataset_health_score NUMERIC,
ADD COLUMN IF NOT EXISTS meta_flags JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS meta_recommendations JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS meta_verdict JSONB DEFAULT '{}'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN evaluations.meta_score IS 'Overall model quality score (0-100) from Meta Evaluator';
COMMENT ON COLUMN evaluations.dataset_health_score IS 'Dataset quality score (0-100)';
COMMENT ON COLUMN evaluations.meta_flags IS 'Array of warning flags detected';
COMMENT ON COLUMN evaluations.meta_recommendations IS 'Array of recommended actions';
COMMENT ON COLUMN evaluations.meta_verdict IS 'Final verdict with status and confidence';
