-- Migration: Drop FK constraint on evaluation_jobs.user_id
-- The service-role client enforces FK constraints even for auth.users,
-- so inserts fail when the user exists in auth.users but not public.users.
-- Other tables (e.g. models) intentionally omit this FK — match that pattern.
-- user_id is still stored for RLS (auth.uid() = user_id) and ownership filtering.

ALTER TABLE evaluation_jobs
    DROP CONSTRAINT IF EXISTS evaluation_jobs_user_id_fkey;
