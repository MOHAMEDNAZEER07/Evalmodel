-- Add Hybrid Trust Framework fields to evaluations table
-- This migration adds support for the new trust aggregation system

ALTER TABLE evaluations
ADD COLUMN IF NOT EXISTS trust_score NUMERIC,
ADD COLUMN IF NOT EXISTS "DII" NUMERIC,
ADD COLUMN IF NOT EXISTS component_scores JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS risk_values JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS hybrid_weights JSONB DEFAULT '{}'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN evaluations.trust_score IS 'Hybrid Trust Score T = 100 * Σ(β_i * component_i), range [0, 100]';
COMMENT ON COLUMN evaluations."DII" IS 'Dataset Instability Index (0-1), controls adaptive weighting';
COMMENT ON COLUMN evaluations.component_scores IS 'Component scores: performance (P), health (H), fairness (F), robustness (R)';
COMMENT ON COLUMN evaluations.risk_values IS 'Risk metrics: DP (demographic parity), delta (robustness), and per-component risks';
COMMENT ON COLUMN evaluations.hybrid_weights IS 'Final hybrid weights (β) after DII-based adjustment';

-- Add index on trust_score for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_evaluations_trust_score ON public.evaluations(trust_score DESC NULLS LAST);
