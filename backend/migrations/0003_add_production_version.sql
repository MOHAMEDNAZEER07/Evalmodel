-- Migration: Add production_version column to models table
-- This column tracks which version is currently in production

BEGIN;

-- Add production_version column to models table
ALTER TABLE public.models 
ADD COLUMN IF NOT EXISTS production_version text;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_models_production_version 
ON public.models(production_version) 
WHERE production_version IS NOT NULL;

COMMIT;
