param(
  [Parameter(Mandatory = $true)]
  [string]$ClientId,
  [string]$AppName = "EdgeLedger"
)

$ErrorActionPreference = "Stop"
$secureToken = Read-Host "Paste your authorized TeraBox access token" -AsSecureString
$credential = New-Object System.Management.Automation.PSCredential("token", $secureToken)
$accessToken = $credential.GetNetworkCredential().Password

Write-Host "Checking the token with TeraBox..." -ForegroundColor Cyan
$tokenInfo = Invoke-RestMethod -Method Post -Uri "https://www.terabox.com/oauth/tokeninfo" -ContentType "application/x-www-form-urlencoded" -Body @{ access_token = $accessToken }
if ($tokenInfo.errno -ne 0) { throw "TeraBox rejected the token: $($tokenInfo.show_msg) (code $($tokenInfo.errno))" }

$apiDomain = [string]$tokenInfo.data.api_domain
$uploadDomain = [string]$tokenInfo.data.upload_domain
if (-not $apiDomain) { throw "TeraBox did not return api_domain for this token." }
if (-not $uploadDomain) { throw "TeraBox did not return upload_domain for this token. Confirm that file-upload access is enabled for the app." }
if (-not $apiDomain.StartsWith("http")) { $apiDomain = "https://$apiDomain" }
if (-not $uploadDomain.StartsWith("http")) { $uploadDomain = "https://$uploadDomain" }

$envPath = Join-Path (Split-Path $PSScriptRoot -Parent) ".env.local"
$existing = if (Test-Path $envPath) { Get-Content $envPath } else { @() }
$managed = @("TERABOX_CLIENT_ID", "TERABOX_APP_NAME", "TERABOX_ACCESS_TOKEN", "TERABOX_API_DOMAIN", "TERABOX_UPLOAD_DOMAIN", "MAX_UPLOAD_MB")
$preserved = $existing | Where-Object {
  $line = $_
  -not ($managed | Where-Object { $line -match "^\s*$([regex]::Escape($_))\s*=" })
}
$configured = @(
  "TERABOX_CLIENT_ID=`"$ClientId`"",
  "TERABOX_APP_NAME=`"$AppName`"",
  "TERABOX_ACCESS_TOKEN=`"$accessToken`"",
  "TERABOX_API_DOMAIN=`"$apiDomain`"",
  "TERABOX_UPLOAD_DOMAIN=`"$uploadDomain`"",
  "MAX_UPLOAD_MB=`"250`""
)
[System.IO.File]::WriteAllLines($envPath, @($preserved) + $configured)

$quota = Invoke-RestMethod -Method Get -Uri "$apiDomain/openapi/api/quota?access_tokens=$([uri]::EscapeDataString($accessToken))"
$totalGb = if ($quota.total) { [Math]::Round([double]$quota.total / 1GB, 2) } else { 0 }
$usedGb = if ($quota.used) { [Math]::Round([double]$quota.used / 1GB, 2) } else { 0 }
Write-Host "TeraBox connected successfully." -ForegroundColor Green
Write-Host "Capacity: $usedGb GB used of $totalGb GB"
Write-Host "Restart the EdgeLedger server to load the new storage settings."
