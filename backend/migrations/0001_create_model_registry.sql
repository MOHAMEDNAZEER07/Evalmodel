-- Migration: create models and model_versions tables for Model Registry
-- Run this against your Postgres/Supabase database

BEGIN;

-- Models table
CREATE TABLE IF NOT EXISTS public.models (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    model_type text,
    framework text,
    file_path text,
    file_size bigint DEFAULT 0,
    uploaded_at timestamp with time zone DEFAULT timezone('utc', now()),
    metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_models_user_id ON public.models(user_id);
CREATE INDEX IF NOT EXISTS idx_models_uploaded_at ON public.models(uploaded_at DESC);

-- Model versions table
CREATE TABLE IF NOT EXISTS public.model_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id uuid NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
    version text NOT NULL,
    description text,
    file_path text,
    file_size bigint DEFAULT 0,
    tags jsonb DEFAULT '[]'::jsonb,
    is_production boolean DEFAULT false,
    is_archived boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc', now()),
    created_by uuid
);

CREATE INDEX IF NOT EXISTS idx_model_versions_model_id ON public.model_versions(model_id);
CREATE INDEX IF NOT EXISTS idx_model_versions_version ON public.model_versions(version);

COMMIT;
