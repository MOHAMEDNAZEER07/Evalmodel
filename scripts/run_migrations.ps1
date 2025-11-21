# PowerShell script to run database migrations
# Usage: .\scripts\run_migrations.ps1 -ConnectionString "postgresql://user:pass@host:5432/dbname" -MigrationFile "backend/migrations/0001_create_model_registry.sql"

param(
    [Parameter(Mandatory=$false)]
    [string]$ConnectionString = $env:DATABASE_URL,
    
    [Parameter(Mandatory=$false)]
    [string]$MigrationFile = "backend/migrations/0001_create_model_registry.sql"
)

# Colors for output
$ErrorColor = "Red"
$SuccessColor = "Green"
$InfoColor = "Cyan"

Write-Host "`n=== Database Migration Runner ===" -ForegroundColor $InfoColor

# Check if connection string is provided
if ([string]::IsNullOrEmpty($ConnectionString)) {
    Write-Host "`nError: No connection string provided!" -ForegroundColor $ErrorColor
    Write-Host "Either set DATABASE_URL environment variable or pass -ConnectionString parameter" -ForegroundColor $ErrorColor
    Write-Host "`nExample usage:" -ForegroundColor $InfoColor
    Write-Host '  .\scripts\run_migrations.ps1 -ConnectionString "postgresql://user:pass@host:5432/dbname"' -ForegroundColor $InfoColor
    Write-Host "  OR set env var first:" -ForegroundColor $InfoColor
    Write-Host '  $env:DATABASE_URL = "postgresql://user:pass@host:5432/dbname"' -ForegroundColor $InfoColor
    Write-Host '  .\scripts\run_migrations.ps1' -ForegroundColor $InfoColor
    exit 1
}

# Check if migration file exists
if (-not (Test-Path $MigrationFile)) {
    Write-Host "`nError: Migration file not found: $MigrationFile" -ForegroundColor $ErrorColor
    exit 1
}

Write-Host "`nMigration file: $MigrationFile" -ForegroundColor $InfoColor
Write-Host "Connection: $($ConnectionString -replace ':[^:@]*@', ':****@')" -ForegroundColor $InfoColor

# Check if psql is available
try {
    $psqlVersion = psql --version 2>&1
    Write-Host "`nUsing: $psqlVersion" -ForegroundColor $SuccessColor
} catch {
    Write-Host "`nError: psql command not found!" -ForegroundColor $ErrorColor
    Write-Host "Please install PostgreSQL client tools:" -ForegroundColor $InfoColor
    Write-Host "  - Download from: https://www.postgresql.org/download/windows/" -ForegroundColor $InfoColor
    Write-Host "  - Or use Supabase CLI: supabase db query < $MigrationFile" -ForegroundColor $InfoColor
    exit 1
}

# Run migration
Write-Host "`nRunning migration..." -ForegroundColor $InfoColor
try {
    psql $ConnectionString -f $MigrationFile
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✓ Migration completed successfully!" -ForegroundColor $SuccessColor
        
        # Validate tables were created
        Write-Host "`nValidating tables..." -ForegroundColor $InfoColor
        $validateSQL = @"
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema='public' 
  AND table_name IN ('models','model_versions');
"@
        
        psql $ConnectionString -c $validateSQL
        
        Write-Host "`n✓ Validation complete!" -ForegroundColor $SuccessColor
    } else {
        Write-Host "`n✗ Migration failed with exit code: $LASTEXITCODE" -ForegroundColor $ErrorColor
        exit $LASTEXITCODE
    }
} catch {
    Write-Host "`n✗ Error running migration: $_" -ForegroundColor $ErrorColor
    exit 1
}

Write-Host "`n=== Migration Complete ===" -ForegroundColor $SuccessColor
