# MongoDB Startup Script
# This script starts MongoDB manually (no admin required)

Write-Host "🚀 Starting MongoDB..." -ForegroundColor Green

$mongodPath = "C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe"
$dataPath = "C:\data\db"

# Check if MongoDB executable exists
if (-not (Test-Path $mongodPath)) {
    Write-Host "❌ MongoDB not found at: $mongodPath" -ForegroundColor Red
    Write-Host "Please update the path in this script." -ForegroundColor Yellow
    exit 1
}

# Create data directory if it doesn't exist
if (-not (Test-Path $dataPath)) {
    Write-Host "📁 Creating data directory: $dataPath" -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $dataPath -Force | Out-Null
}

# Check if MongoDB is already running
$portCheck = Test-NetConnection -ComputerName 127.0.0.1 -Port 27017 -WarningAction SilentlyContinue
if ($portCheck.TcpTestSucceeded) {
    Write-Host "✅ MongoDB is already running on port 27017" -ForegroundColor Green
    exit 0
}

# Start MongoDB
Write-Host "🔄 Starting MongoDB process..." -ForegroundColor Cyan
Start-Process -FilePath $mongodPath -ArgumentList "--dbpath", $dataPath, "--port", "27017" -WindowStyle Hidden

# Wait a moment for MongoDB to start
Start-Sleep -Seconds 3

# Verify it's running
$portCheck = Test-NetConnection -ComputerName 127.0.0.1 -Port 27017 -WarningAction SilentlyContinue
if ($portCheck.TcpTestSucceeded) {
    Write-Host "✅ MongoDB started successfully!" -ForegroundColor Green
    Write-Host "📍 Connection: mongodb://127.0.0.1:27017" -ForegroundColor Cyan
} else {
    Write-Host "❌ Failed to start MongoDB. Check the error messages above." -ForegroundColor Red
    exit 1
}

