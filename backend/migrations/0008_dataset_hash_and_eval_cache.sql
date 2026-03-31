-- Migration: Dataset hash dedupe + evaluation cache metadata

BEGIN;

ALTER TABLE public.datasets
ADD COLUMN IF NOT EXISTS file_hash TEXT,
ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
ADD COLUMN IF NOT EXISTS fingerprint JSONB DEFAULT '{}'::jsonb;

UPDATE public.datasets
SET file_size_bytes = file_size
WHERE file_size_bytes IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_datasets_user_hash
ON public.datasets(user_id, file_hash)
WHERE file_hash IS NOT NULL;

ALTER TABLE public.evaluations
ADD COLUMN IF NOT EXISTS cache_hit BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS evaluation_config JSONB DEFAULT '{}'::jsonb;

COMMIT;
