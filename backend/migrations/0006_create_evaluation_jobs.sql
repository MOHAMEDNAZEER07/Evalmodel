-- Migration: Create evaluation_jobs table for async evaluation pipeline
-- This enables non-blocking evaluations with real-time progress updates

CREATE TABLE IF NOT EXISTS evaluation_jobs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    model_id    UUID NOT NULL,
    dataset_id  UUID NOT NULL,
    status      TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    progress    INT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    step        TEXT DEFAULT '',
    result      JSONB,
    error       TEXT,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Create index for efficient user job lookups
CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_user_id ON evaluation_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_status ON evaluation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_created_at ON evaluation_jobs(created_at DESC);

-- Enable RLS
ALTER TABLE evaluation_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see and manage their own jobs
CREATE POLICY "users_manage_own_jobs" ON evaluation_jobs
    FOR ALL
    USING (auth.uid() = user_id);

-- Policy: Service role can manage all jobs (for background tasks)
CREATE POLICY "service_role_all_access" ON evaluation_jobs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_evaluation_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_evaluation_jobs_updated_at ON evaluation_jobs;
CREATE TRIGGER trigger_evaluation_jobs_updated_at
    BEFORE UPDATE ON evaluation_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_evaluation_jobs_updated_at();

-- Comment for documentation
COMMENT ON TABLE evaluation_jobs IS 'Async evaluation job tracking for non-blocking model evaluations';
COMMENT ON COLUMN evaluation_jobs.status IS 'Job status: pending → running → completed/failed';
COMMENT ON COLUMN evaluation_jobs.progress IS 'Progress percentage 0-100';
COMMENT ON COLUMN evaluation_jobs.step IS 'Current step description for UI display';
COMMENT ON COLUMN evaluation_jobs.result IS 'Full evaluation result JSON when completed';
