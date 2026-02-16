param(
    [string]$FrontendBase = "https://unistem.vercel.app",
    [string]$BackendBase = "https://kinddevs2024-global-olimpiad-v2-2-b.vercel.app",
    [int]$TimeoutSec = 20
)

$ProgressPreference = 'SilentlyContinue'

function Invoke-JsonRequest {
    param(
        [string]$Method,
        [string]$Url,
        [object]$Body = $null
    )

    try {
        if ($null -ne $Body) {
            $payload = $Body | ConvertTo-Json -Depth 8
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -Method $Method -TimeoutSec $TimeoutSec -ContentType "application/json" -Body $payload
        }
        else {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -Method $Method -TimeoutSec $TimeoutSec
        }

        return [PSCustomObject]@{
            Ok = $true
            StatusCode = [int]$response.StatusCode
            Body = $response.Content
            ErrorMessage = $null
        }
    }
    catch {
        $statusCode = $null
        $body = $null

        if ($_.Exception.Response) {
            try { $statusCode = [int]$_.Exception.Response.StatusCode.value__ } catch {}
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $body = $reader.ReadToEnd()
                $reader.Close()
            }
            catch {}
        }

        return [PSCustomObject]@{
            Ok = $false
            StatusCode = $statusCode
            Body = $body
            ErrorMessage = $_.Exception.Message
        }
    }
}

function Print-Result {
    param(
        [string]$Name,
        [object]$Result,
        [int[]]$ExpectedStatuses
    )

    $isExpected = $false
    if ($null -ne $Result.StatusCode -and $ExpectedStatuses -contains [int]$Result.StatusCode) {
        $isExpected = $true
    }

    if ($isExpected) {
        Write-Host "✅ $Name -> $($Result.StatusCode)" -ForegroundColor Green
    }
    else {
        Write-Host "❌ $Name -> $($Result.StatusCode)" -ForegroundColor Red
    }

    if (-not [string]::IsNullOrWhiteSpace($Result.Body)) {
        $preview = $Result.Body
        if ($preview.Length -gt 300) { $preview = $preview.Substring(0, 300) + "..." }
        Write-Host "   Body: $preview" -ForegroundColor DarkGray
    }

    if (-not [string]::IsNullOrWhiteSpace($Result.ErrorMessage) -and -not $isExpected) {
        Write-Host "   Error: $($Result.ErrorMessage)" -ForegroundColor Yellow
    }

    return $isExpected
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "UNI-STEM API Routing Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "FrontendBase: $FrontendBase" -ForegroundColor Yellow
Write-Host "BackendBase : $BackendBase" -ForegroundColor Yellow
Write-Host ""

$checksPassed = 0
$totalChecks = 0

$healthFrontend = Invoke-JsonRequest -Method "GET" -Url "$FrontendBase/api/health"
$totalChecks++
if (Print-Result -Name "Frontend /api/health" -Result $healthFrontend -ExpectedStatuses @(200)) { $checksPassed++ }

$healthBackend = Invoke-JsonRequest -Method "GET" -Url "$BackendBase/api/health"
$totalChecks++
if (Print-Result -Name "Backend /api/health" -Result $healthBackend -ExpectedStatuses @(200)) { $checksPassed++ }

$loginProbeBody = @{
    email = "check.nonexistent.user@uni-stem.local"
    password = "wrong-password"
}

$loginFrontend = Invoke-JsonRequest -Method "POST" -Url "$FrontendBase/api/auth/login" -Body $loginProbeBody
$totalChecks++
if (Print-Result -Name "Frontend /api/auth/login probe" -Result $loginFrontend -ExpectedStatuses @(401, 400)) { $checksPassed++ }

$loginBackend = Invoke-JsonRequest -Method "POST" -Url "$BackendBase/api/auth/login" -Body $loginProbeBody
$totalChecks++
if (Print-Result -Name "Backend /api/auth/login probe" -Result $loginBackend -ExpectedStatuses @(401, 400)) { $checksPassed++ }

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($checksPassed -eq $totalChecks) {
    Write-Host "✅ All checks passed ($checksPassed/$totalChecks)" -ForegroundColor Green
    exit 0
}
else {
    Write-Host "❌ Checks failed ($checksPassed/$totalChecks)" -ForegroundColor Red
    exit 1
}
