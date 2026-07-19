param(
  [string]$ServiceAccountPath,
  [string]$GoogleServicesPath,
  [string]$StorageBucket,
  [string]$DatabaseUrl,
  [string]$StorageFolder = "EdgeLedger Content"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot ".env.local"

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

$projectId = $null
if ($GoogleServicesPath) {
  if (-not (Test-Path -LiteralPath $GoogleServicesPath)) { throw "google-services.json was not found." }
  $googleServices = Get-Content -Raw -LiteralPath $GoogleServicesPath | ConvertFrom-Json
  $projectId = $googleServices.project_info.project_id
  if (-not $StorageBucket) { $StorageBucket = $googleServices.project_info.storage_bucket }
  if (-not $DatabaseUrl) { $DatabaseUrl = $googleServices.project_info.firebase_url }
  if ($googleServices.client -and $googleServices.client[0]) {
    $client = $googleServices.client[0]
    if ($client.api_key -and $client.api_key[0].current_key) { Set-EnvironmentValue $lines "NEXT_PUBLIC_FIREBASE_API_KEY" $client.api_key[0].current_key }
    if ($client.client_info.mobilesdk_app_id) { Set-EnvironmentValue $lines "NEXT_PUBLIC_FIREBASE_APP_ID" $client.client_info.mobilesdk_app_id }
  }
}

if ($ServiceAccountPath) {
  if (-not (Test-Path -LiteralPath $ServiceAccountPath)) { throw "Firebase service-account file was not found." }
  $serviceAccount = Get-Content -Raw -LiteralPath $ServiceAccountPath | ConvertFrom-Json
  if (-not $serviceAccount.project_id -or -not $serviceAccount.client_email -or -not $serviceAccount.private_key) {
    throw "Use a Firebase service-account private key JSON file from Project settings > Service accounts."
  }
  if (-not $projectId) { $projectId = $serviceAccount.project_id }
  Set-EnvironmentValue $lines "FIREBASE_SERVICE_ACCOUNT_PATH" $ServiceAccountPath
}

if (-not $StorageBucket) { $StorageBucket = Read-Host "Paste the Firebase Storage bucket name, for example your-project-id.firebasestorage.app" }
if ($StorageBucket -match '^gs://') { $StorageBucket = $StorageBucket -replace '^gs://', '' }
if ($StorageBucket -notmatch '^[a-z0-9.\-_]+$') { throw "Use the bucket name only, without https:// or extra path text." }

if ($projectId) {
  Set-EnvironmentValue $lines "FIREBASE_PROJECT_ID" $projectId
  Set-EnvironmentValue $lines "NEXT_PUBLIC_FIREBASE_PROJECT_ID" $projectId
}
if ($DatabaseUrl) {
  Set-EnvironmentValue $lines "FIREBASE_DATABASE_URL" $DatabaseUrl
  Set-EnvironmentValue $lines "NEXT_PUBLIC_FIREBASE_DATABASE_URL" $DatabaseUrl
}
Set-EnvironmentValue $lines "FIREBASE_STORAGE_BUCKET" $StorageBucket
Set-EnvironmentValue $lines "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET" $StorageBucket
Set-EnvironmentValue $lines "FIREBASE_STORAGE_FOLDER" $StorageFolder
Set-EnvironmentValue $lines "MAX_UPLOAD_MB" "20480"

Set-Content -LiteralPath $envPath -Value $lines -Encoding utf8
if ($ServiceAccountPath) {
  Write-Host "Firebase server settings saved. Restart the website, sign in as an administrator, and open /admin."
} else {
  Write-Host "Firebase project settings saved. Add a service-account private key before using secure admin uploads."
}
