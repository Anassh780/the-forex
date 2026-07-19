param(
  [string]$DatabaseUrl
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot ".env.local"

if (-not $DatabaseUrl) {
  $secure = Read-Host "Paste the PostgreSQL connection string (input is hidden)" -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $DatabaseUrl = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

if ($DatabaseUrl -notmatch '^postgres(ql)?://') {
  throw "The connection string must start with postgresql:// or postgres://."
}

$lines = [Collections.Generic.List[string]]::new()
if (Test-Path $envPath) { Get-Content $envPath | ForEach-Object { $lines.Add($_) } }

function Set-EnvironmentValue {
  param([Collections.Generic.List[string]]$Content, [string]$Name, [string]$Value)
  $safeValue = $Value.Replace('\', '\\').Replace('"', '\"')
  for ($index = 0; $index -lt $Content.Count; $index++) {
    if ($Content[$index] -match "^$([regex]::Escape($Name))=") {
      $Content[$index] = "$Name=`"$safeValue`""
      return
    }
  }
  $Content.Add("$Name=`"$safeValue`"")
}

$hasAuthSecret = $false
foreach ($line in $lines) {
  if ($line -match '^NEXTAUTH_SECRET="?(.+?)"?$' -and $Matches[1].Trim()) { $hasAuthSecret = $true; break }
}
if (-not $hasAuthSecret) {
  $secretBytes = New-Object byte[] 48
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($secretBytes)
  Set-EnvironmentValue $lines "NEXTAUTH_SECRET" ([Convert]::ToBase64String($secretBytes))
}

Set-EnvironmentValue $lines "DATABASE_URL" $DatabaseUrl
Set-EnvironmentValue $lines "NEXTAUTH_URL" "http://localhost:3000"
Set-Content -LiteralPath $envPath -Value $lines -Encoding utf8

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) {
  $node = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
}
$prisma = Join-Path $projectRoot 'node_modules\prisma\build\index.js'
if (-not (Test-Path $node) -or -not (Test-Path $prisma)) {
  throw "The database settings were saved, but the project runtime is unavailable. Restart through Codex to apply migrations."
}

$env:DATABASE_URL = $DatabaseUrl
& $node $prisma migrate deploy
if ($LASTEXITCODE -ne 0) { throw "The database connection was saved, but migration failed. Verify the provider connection string." }

Write-Host "Database connected and account tables created. Restart the website, then create your account."
