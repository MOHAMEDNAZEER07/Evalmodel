-- Migration: Add 'evaluated' column to models table
-- Description: Adds a boolean column to track whether a model has been evaluated
-- Created: 2025-11-18

-- Add evaluated column to models table
ALTER TABLE public.models 
ADD COLUMN IF NOT EXISTS evaluated boolean DEFAULT false;

-- Add index for performance when filtering by evaluated status
CREATE INDEX IF NOT EXISTS idx_models_evaluated 
ON public.models(evaluated);

-- Add comment for documentation
COMMENT ON COLUMN public.models.evaluated IS 'Indicates whether the model has been evaluated at least once';
