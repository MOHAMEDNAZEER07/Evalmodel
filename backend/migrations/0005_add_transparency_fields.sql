-- Migration: Add transparency and trust framework fields to evaluations table
-- These fields support the CalculationTransparencyPanel in the frontend

-- DII components breakdown (I, M, D, S)
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS dii_components JSONB;

-- Trust mode (balanced/strict)
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS trust_mode VARCHAR(20);

-- Raw trust score before penalties
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS trust_score_raw FLOAT;

-- Automatic risk-proportional weights
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS beta_auto JSONB;

-- Lambda (DII-based weight balance)
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS lambda_value FLOAT;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS lambda_raw FLOAT;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS lambda_cap FLOAT;

-- Non-compensatory guard system
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS guard_threshold FLOAT;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS guard_triggered BOOLEAN;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS guard_failures JSONB;

-- Global penalty (strict mode)
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS global_penalty_applied BOOLEAN;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS instability_penalty_value FLOAT;

-- Per-component contribution breakdown
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS breakdown JSONB;

-- Strict mode comparison result
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS strict_result JSONB;

-- Add comments for documentation
COMMENT ON COLUMN evaluations.dii_components IS 'DII sub-components: imbalance, missing, duplicates, skew';
COMMENT ON COLUMN evaluations.trust_mode IS 'Trust evaluation mode: balanced or strict';
COMMENT ON COLUMN evaluations.beta_auto IS 'Automatic risk-proportional weights';
COMMENT ON COLUMN evaluations.lambda_value IS 'Lambda value (DII-based auto/user weight balance)';
COMMENT ON COLUMN evaluations.guard_threshold IS 'Non-compensatory guard threshold τ';
COMMENT ON COLUMN evaluations.guard_triggered IS 'Whether non-compensatory guard was triggered';
COMMENT ON COLUMN evaluations.breakdown IS 'Per-component contribution to trust score';
COMMENT ON COLUMN evaluations.strict_result IS 'Full strict mode evaluation for comparison';
