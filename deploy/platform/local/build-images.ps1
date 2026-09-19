# Builds what a local platform run needs: the twelve service images for this
# machine's architecture (tag :local), the five web apps against
# http://auth.localhost, and the platform realm rendered for localhost.
# Re-run after code changes; docker's layer cache keeps it short.
#
#   .\build-images.ps1              everything
#   .\build-images.ps1 -Web         only the web apps
#   .\build-images.ps1 -Images      only the images
#   .\build-images.ps1 -Only sales  one image

param(
    [switch]$Web,
    [switch]$Images,
    [string]$Only
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $here '..\..\..')
$all = -not $Web -and -not $Images -and -not $Only

# The platform realm for localhost, with a password the token endpoint accepts straight away
$realms = Join-Path $here 'realms'
New-Item -ItemType Directory -Force $realms | Out-Null
$template = Get-Content (Join-Path $root 'src\Control.API\Templates\platform-realm.json') -Raw -Encoding UTF8
$realm = $template.Replace('{{controlUrl}}', 'http://control.localhost').Replace('{{platformDomain}}', 'localhost').Replace('{{platformPassword}}', 'Local123$').Replace('"temporary": true', '"temporary": false')
[System.IO.File]::WriteAllText((Join-Path $realms 'ninja-realm.json'), $realm, (New-Object System.Text.UTF8Encoding $false))
Write-Host 'realm  ninja-realm.json (platform / Local123$)'

if ($all -or $Images -or $Only) {
    $services = @('catalog', 'ordering', 'spaces', 'sales', 'inventory', 'payroll', 'finance', 'identity', 'loyalty', 'notification', 'accounts', 'branch')
    if ($Only) { $services = @($Only) }
    $map = @{
        catalog = 'Catalog.API'; ordering = 'Ordering.API'; spaces = 'Spaces.API'; sales = 'Sales.API'
        inventory = 'Inventory.API'; payroll = 'Payroll.API'; finance = 'Finance.API'; identity = 'Identity.API'
        loyalty = 'Loyalty.API'; notification = 'Notification.API'; accounts = 'Accounts.API'; branch = 'Branch.API'
    }
    foreach ($svc in $services) {
        $project = $map[$svc]
        Write-Host "image  ninja-${svc}:local  (src/$project/Dockerfile)"
        # docker writes its progress to stderr; under Stop that would read as a failure
        $ErrorActionPreference = 'Continue'
        & docker build -q -t "ninja-${svc}:local" -f (Join-Path $root "src\$project\Dockerfile") $root 2>&1 | Where-Object { $_ -match 'ERROR|error:' } | ForEach-Object { Write-Host "  $_" }
        $code = $LASTEXITCODE
        $ErrorActionPreference = 'Stop'
        if ($code -ne 0) { throw "docker build failed for $svc" }
    }
}

if ($all -or $Web) {
    $env:VITE_KEYCLOAK_URL = 'http://auth.localhost'
    foreach ($app in @('admin_web', 'client_web', 'pos_web', 'kds_web', 'control_web')) {
        $name = $app.Replace('_web', '-web')
        Write-Host "web    $name"
        Push-Location (Join-Path $root "src\$app")
        try {
            if (-not (Test-Path node_modules)) { npm ci --no-audit --no-fund | Out-Null }
            $ErrorActionPreference = 'Continue'
            & npx.cmd vite build --logLevel error 2>&1 | Out-Host
            $code = $LASTEXITCODE
            $ErrorActionPreference = 'Stop'
            if ($code -ne 0) { throw "vite build failed for $app" }
            $target = Join-Path $here "web\$name"
            if (Test-Path $target) { Remove-Item -Recurse -Force $target }
            New-Item -ItemType Directory -Force (Split-Path $target) | Out-Null
            Copy-Item -Recurse dist $target
        } finally { Pop-Location }
    }
    foreach ($name in @('admin-web', 'client-web', 'pos-web', 'kds-web', 'control-web')) {
        New-Item -ItemType Directory -Force (Join-Path $here "web\$name") | Out-Null
    }
}

Write-Host ''
Write-Host 'Next: docker compose up -d --build    then open http://control.localhost'
