-- Migration: Add Row-Level Security (RLS) policies for Model Registry
-- This ensures users can only access their own models and versions
-- Run this after 0001_create_model_registry.sql

BEGIN;

-- Enable Row-Level Security on models table
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own models
CREATE POLICY "Users can view their own models"
ON public.models
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own models
CREATE POLICY "Users can insert their own models"
ON public.models
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own models
CREATE POLICY "Users can update their own models"
ON public.models
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own models
CREATE POLICY "Users can delete their own models"
ON public.models
FOR DELETE
USING (auth.uid() = user_id);

-- Enable Row-Level Security on model_versions table
ALTER TABLE public.model_versions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view versions of their own models
CREATE POLICY "Users can view versions of their own models"
ON public.model_versions
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.models
        WHERE models.id = model_versions.model_id
        AND models.user_id = auth.uid()
    )
);

-- Policy: Users can insert versions to their own models
CREATE POLICY "Users can insert versions to their own models"
ON public.model_versions
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.models
        WHERE models.id = model_versions.model_id
        AND models.user_id = auth.uid()
    )
);

-- Policy: Users can update versions of their own models
CREATE POLICY "Users can update versions of their own models"
ON public.model_versions
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.models
        WHERE models.id = model_versions.model_id
        AND models.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.models
        WHERE models.id = model_versions.model_id
        AND models.user_id = auth.uid()
    )
);

-- Policy: Users can delete versions of their own models
CREATE POLICY "Users can delete versions of their own models"
ON public.model_versions
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.models
        WHERE models.id = model_versions.model_id
        AND models.user_id = auth.uid()
    )
);

COMMIT;

-- To verify RLS is enabled, run:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('models', 'model_versions');
