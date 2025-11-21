# Environment & Keys (Simple Reference)

This file lists the environment variables and keys used by this project and explains how to obtain them. Do NOT put real secrets into version control. Use a `.env` locally and store secrets in your cloud provider / CI secrets for deployments.

## Backend (FastAPI / Server)

- DATABASE_URL: "postgresql://<DB_USER>:<DB_PASS>@<DB_HOST>:5432/<DB_NAME>"
	- How to get it: create a Postgres database (managed provider or local). Example providers: Supabase (Database page), AWS RDS, DigitalOcean Managed DB, or local Postgres.
	- Example (local): after creating DB, build connection string: postgresql://user:pass@host:5432/dbname

- SUPABASE_URL: "https://your-supabase-project.supabase.co"
	- How to get it: from your Supabase project dashboard → Project Settings → API → Project URL.

- SUPABASE_SERVICE_ROLE_KEY: "your-supabase-service-role-key"  # server-only
	- How to get it: Supabase dashboard → Project Settings → API → Service Role Key. Keep this on the server only.

- SUPABASE_ANON_KEY: "your-supabase-anon-key"  # used by frontend (public)
	- How to get it: Supabase dashboard → Project Settings → API → anon (public) key. This is safe for the frontend.

- STORAGE_BUCKET_MODELS: "models"
	- How to get it: Supabase dashboard → Storage → Create a bucket named `models` (or your preferred name). Update `STORAGE_BUCKET_MODELS` with that name.

- SECRET_KEY: "a-long-random-secret-for-session-or-signing"
	- How to get it: generate a long random string for session signing (e.g., `python -c "import secrets; print(secrets.token_urlsafe(32))"`). Used for cookies/signing.

- JWT_SECRET: "your-jwt-secret"
	- How to get it: similar to SECRET_KEY; used to sign JWTs if you issue them server-side.

- SENTRY_DSN: "https://examplePublicKey@o0.ingest.sentry.io/0"
	- How to get it: create a project in Sentry and copy the DSN from project settings.

- REDIS_URL: "redis://:password@redis-host:6379/0"
	- How to get it: provision a Redis instance (Redis Cloud, Upstash, AWS Elasticache) and use the connection string they provide.

- SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS
	- How to get it: configure an SMTP provider (SendGrid, Mailgun, SMTP credentials from your mail provider). Use these to send password resets and notifications.

## Frontend (Vite / React)

- VITE_API_BASE_URL: "http://localhost:8000"  # backend API base
	- How to get it: your backend server address. In dev it's typically `http://localhost:8000`.

- VITE_SUPABASE_URL: "https://your-supabase-project.supabase.co"
- VITE_SUPABASE_ANON_KEY: "your-supabase-anon-key"  # public
	- How to get both: see Supabase dashboard → Project Settings → API.

- VITE_MAX_UPLOAD_SIZE_MB: "50"
	- How to set: controls client-side upload size validation.

## Optional / Integrations

- OPENAI_API_KEY: "sk-..."  # if using LLMs
	- How to get it: sign in at https://platform.openai.com and create an API key in the user settings.

- S3_ENDPOINT / S3_BUCKET_MODELS
	- How to get it: if you prefer S3 instead of Supabase Storage, create a bucket in AWS S3 and use credentials (access key / secret) configured server-side.

## GitHub / CI secrets

- In GitHub Actions set repository secrets (Settings → Secrets) for values such as `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `SENTRY_DSN`, `REDIS_URL`, `SMTP_PASS`, etc. Use `VITE_*` variables only if you need them in the frontend build (remember anon keys are public).

## How to create the Supabase bucket & keys (quick steps)

1. Create Supabase project at https://app.supabase.com.
2. Open your project → Settings → API → copy `Project URL` and `anon/public` and `service_role` keys.
3. Open Storage → Buckets → Create new bucket, e.g. `models` and set public/private according to your needs.

## How to create a Postgres DB with Supabase (quick)

1. Create a Supabase project — Supabase provisions Postgres for you.
2. In the project dashboard, go to `Database` → `Connection string` to copy a connection URL. Alternatively use the psql connection info.

## Example commands

- Generate a strong secret (PowerShell):
	```powershell
	python -c "import secrets; print(secrets.token_urlsafe(48))"
	```

- Run the migration SQL using `psql` (replace values):
	```powershell
	$PG_CONN = "postgresql://<DB_USER>:<DB_PASS>@<DB_HOST>:5432/<DB_NAME>"
	psql $PG_CONN -f backend/migrations/0001_create_model_registry.sql
	```

- Use Supabase CLI to run SQL (when linked to a project):
	```powershell
	supabase login
	supabase link --project-ref <PROJECT_REF>
	supabase db query < backend/migrations/0001_create_model_registry.sql
	```

## Quick .env example (backend)

```env
DATABASE_URL="postgresql://db_user:db_pass@db_host:5432/db_name"
SUPABASE_URL="https://your-supabase-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
SUPABASE_ANON_KEY="your-anon-key"
STORAGE_BUCKET_MODELS="models"
SECRET_KEY="replace-with-a-long-random-string"
JWT_SECRET="replace-with-a-long-random-string"
VITE_MAX_UPLOAD_SIZE_MB=50
SENTRY_DSN="https://..."
REDIS_URL="redis://:password@redis-host:6379/0"
OPENAI_API_KEY="sk-..."
```

## Security reminders

- Never commit `SUPABASE_SERVICE_ROLE_KEY`, `SECRET_KEY`, `JWT_SECRET`, `DATABASE_URL`, or any credentials to the repo.
- Use GitHub Actions secrets or your cloud provider's secret manager for CI/CD and deployments.
- Limit service-role key usage to server-only code paths. Frontend should only use anon/public keys.

## Next steps I can do for you

- Add a `.env.example` to `backend/` that mirrors the variables above (safe to commit).
- Add `scripts/run_migrations.ps1` to run migrations against a provided connection string.
- Add a short `documentation/SUPABASE_KEY_AUDIT.md` describing where service-role keys are used and how to rotate them.

Tell me which of those you'd like and I'll add it.