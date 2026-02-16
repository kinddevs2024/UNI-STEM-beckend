# Script to update MongoDB URI in .env file
param(
    [Parameter(Mandatory=$true)]
    [string]$ConnectionString
)

$envFile = ".env"

if (-not (Test-Path $envFile)) {
    Write-Host "❌ .env file not found!"
    exit 1
}

# Read .env file
$content = Get-Content $envFile

# Update MONGODB_URI line
$updated = $content | ForEach-Object {
    if ($_ -match "^MONGODB_URI=") {
        "MONGODB_URI=$ConnectionString"
    } else {
        $_
    }
}

# Write back to file
$updated | Set-Content $envFile -Encoding UTF8

Write-Host "✅ Updated MONGODB_URI in .env file"
Write-Host "📋 New connection string: $ConnectionString"
Write-Host ""
Write-Host "🔄 Please restart your server: npm run dev"