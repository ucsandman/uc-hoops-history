$ErrorActionPreference = 'Stop'

$envFile = Join-Path (Get-Location) '.env.local'
if (-not (Test-Path $envFile)) { throw "Missing $envFile" }

$line = Get-Content $envFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
if (-not $line) { throw 'DATABASE_URL not found in .env.local' }

$val = $line.Substring('DATABASE_URL='.Length)
$val = $val.Trim()
if ($val.StartsWith('"') -and $val.EndsWith('"')) { $val = $val.Substring(1, $val.Length-2) }
$env:DATABASE_URL = $val
node scripts\wipe_drafts_only.js
