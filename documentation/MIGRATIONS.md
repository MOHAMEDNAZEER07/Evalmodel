# Database Migration Guide

This guide explains how to apply database migrations to create the required tables for the Model Registry and other features.

## Prerequisites

You need ONE of the following:

### Option 1: PostgreSQL Client (psql)
- Download and install PostgreSQL: https://www.postgresql.org/download/windows/
- During installation, make sure to install "Command Line Tools"
- After installation, `psql` should be available in your terminal

### Option 2: Supabase CLI
- Install: `npm install -g supabase`
- Login: `supabase login`
- Link your project: `supabase link --project-ref <YOUR_PROJECT_REF>`

## Quick Start (3 Steps)

### Step 1: Get your database connection string

**Using Supabase:**
1. Go to https://app.supabase.com
2. Open your project
3. Go to Settings → Database
4. Copy the "Connection string" (URI format)
5. Replace `[YOUR-PASSWORD]` with your actual database password

Example result:
```
postgresql://postgres.xxxxx:YourPassword@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

**Using other Postgres providers:**
- Format: `postgresql://<username>:<password>@<host>:<port>/<database>`
- Example: `postgresql://myuser:mypass@localhost:5432/evalmodel`

### Step 2: Run the migration

**Using the provided script (EASIEST):**

```powershell
# Set your connection string
$env:DATABASE_URL = "postgresql://postgres.xxxxx:YourPassword@host:5432/postgres"

# Run the migration
.\scripts\run_migrations.ps1
```

**OR manually with psql:**

```powershell
# Set connection string
$PG_CONN = "postgresql://postgres.xxxxx:YourPassword@host:5432/postgres"

# Run migration
psql $PG_CONN -f backend/migrations/0001_create_model_registry.sql
```

**OR using Supabase CLI:**

```powershell
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
supabase db query < backend/migrations/0001_create_model_registry.sql
```

### Step 3: Validate the migration

Check that tables were created:

```powershell
# Using psql
psql $PG_CONN -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('models','model_versions');"

# Using Supabase CLI
supabase db query "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('models','model_versions');"
```

You should see output showing both `models` and `model_versions` tables.

## Troubleshooting

### "psql: command not found"
- Install PostgreSQL client tools (see Prerequisites)
- OR use Supabase CLI instead
- Make sure PostgreSQL bin folder is in your PATH

### "connection refused" or "could not connect"
- Check your connection string is correct
- Verify the database host is reachable
- For Supabase: ensure your IP is allowed in Database settings
- Check that the password doesn't contain special characters that need escaping

### "password authentication failed"
- Double-check your password
- For Supabase: use the database password, not your Supabase account password
- Special characters in password may need URL encoding (e.g., `@` becomes `%40`)

### "permission denied"
- Ensure your database user has CREATE TABLE permissions
- For Supabase: use the `postgres` user with the service role key

## Next Steps

After running migrations:

1. **Enable RLS (Row Level Security):** Run `backend/migrations/0002_rls_model_registry.sql` (if it exists)
2. **Verify in Supabase Dashboard:** Check Storage → Database → Tables to see your new tables
3. **Test the backend:** Start your FastAPI server and test model upload endpoints

## Available Migrations

- `0001_create_model_registry.sql` - Creates `models` and `model_versions` tables
- `0002_rls_model_registry.sql` - Adds Row-Level Security policies
- `0003_add_production_version.sql` - Adds `production_version` column to models table
- `0004_add_evaluated_column.sql` - Adds `evaluated` boolean column to models table

## Manual Execution (SQL Editor)

If you prefer, you can copy the contents of `backend/migrations/0001_create_model_registry.sql` and paste it directly into:
- Supabase SQL Editor (Dashboard → SQL Editor)
- pgAdmin
- Any PostgreSQL client GUI

Just make sure to execute the entire file as one transaction.
