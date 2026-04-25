$basePath = 'g:\Interview System\interve-ai'
$srcPrefix = if (Test-Path "$basePath\src\app") { 'src/' } else { '' }

$filesToCheck = @(
    @{Path="${srcPrefix}app/page.tsx"; MinSize=10KB},
    @{Path="${srcPrefix}app/layout.tsx"; MinSize=2KB},
    @{Path="${srcPrefix}app/login/page.tsx"; MinSize=8KB},
    @{Path="${srcPrefix}app/dashboard/page.tsx"; MinSize=15KB},
    @{Path="${srcPrefix}app/dashboard/interview/page.tsx"; MinSize=12KB},
    @{Path="${srcPrefix}app/dashboard/resume/page.tsx"; MinSize=10KB},
    @{Path="${srcPrefix}app/dashboard/settings/page.tsx"; MinSize=8KB},
    @{Path="${srcPrefix}components/auth/LoginForm.tsx"; MinSize=6KB},
    @{Path="${srcPrefix}components/auth/ProtectedRoute.tsx"; MinSize=3KB},
    @{Path="${srcPrefix}components/auth/index.ts"; MinSize=100},
    @{Path="${srcPrefix}components/layout/Navbar.tsx"; MinSize=5KB},
    @{Path="${srcPrefix}components/layout/Sidebar.tsx"; MinSize=7KB},
    @{Path="${srcPrefix}components/layout/Footer.tsx"; MinSize=3KB},
    @{Path="${srcPrefix}components/layout/index.ts"; MinSize=100},
    @{Path="${srcPrefix}components/ui/Button.tsx"; MinSize=2KB},
    @{Path="${srcPrefix}components/ui/Input.tsx"; MinSize=2KB},
    @{Path="${srcPrefix}components/ui/Card.tsx"; MinSize=2KB},
    @{Path="${srcPrefix}components/ui/index.ts"; MinSize=100},
    @{Path="${srcPrefix}components/home/HeroSection.tsx"; MinSize=5KB},
    @{Path="${srcPrefix}components/home/FeaturesSection.tsx"; MinSize=8KB},
    @{Path="${srcPrefix}components/home/TestimonialsSection.tsx"; MinSize=6KB},
    @{Path="${srcPrefix}components/home/FAQSection.tsx"; MinSize=5KB},
    @{Path="${srcPrefix}components/home/index.ts"; MinSize=100},
    @{Path="${srcPrefix}context/AuthContext.tsx"; MinSize=6KB},
    @{Path="${srcPrefix}lib/auth.ts"; MinSize=3KB},
    @{Path="${srcPrefix}lib/api.ts"; MinSize=4KB},
    @{Path="${srcPrefix}types/auth.ts"; MinSize=1KB},
    @{Path="${srcPrefix}utils/constants.ts"; MinSize=1KB},
    @{Path="public/favicon.ico"; MinSize=100},
    @{Path="${srcPrefix}middleware.ts"; MinSize=2KB},
    @{Path="package.json"; MinSize=100},
    @{Path="next.config.js"; MinSize=1KB; AltPaths=@("next.config.mjs","next.config.ts")},
    @{Path="tailwind.config.js"; MinSize=2KB; AltPaths=@("tailwind.config.ts")},
    @{Path="tsconfig.json"; MinSize=1KB}
)

$results = @()
foreach ($file in $filesToCheck) {
    $fullPath = Join-Path $basePath $file.Path
    $exists = Test-Path $fullPath
    if (-not $exists -and $file.AltPaths) {
        foreach ($alt in $file.AltPaths) {
            $altPath = Join-Path $basePath $alt
            if (Test-Path $altPath) {
                $fullPath = $altPath
                $exists = $true
                $file.Path = $alt
                break
            }
        }
    }
    
    if ($exists) {
        $item = Get-Item $fullPath
        $size = $item.Length
        $status = 'OK'
        if ($size -lt 100) {
            $status = 'EMPTY_OR_PLACEHOLDER'
        } elseif ($size -lt $file.MinSize) {
            $status = 'UNDERSIZED'
        }
        $results += [PSCustomObject]@{
            File = $file.Path
            Exists = $true
            Size = $size
            MinSize = $file.MinSize
            Status = $status
        }
    } else {
        $results += [PSCustomObject]@{
            File = $file.Path
            Exists = $false
            Size = 0
            MinSize = $file.MinSize
            Status = 'MISSING'
        }
    }
}

$results | Format-Table -AutoSize

$imagesCount = if (Test-Path "$basePath\public\images") { (Get-ChildItem -File -Path "$basePath\public\images").Count } else { 0 }
$iconsCount = if (Test-Path "$basePath\public\icons") { (Get-ChildItem -File -Path "$basePath\public\icons").Count } else { 0 }
Write-Host "Images Count: $imagesCount"
Write-Host "Icons Count: $iconsCount"

$pkgPath = "$basePath\package.json"
$depsCount = 0
if (Test-Path $pkgPath) {
    $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
    if ($null -ne $pkg.dependencies) { $depsCount += ($pkg.dependencies.PSObject.Properties).Count }
    if ($null -ne $pkg.devDependencies) { $depsCount += ($pkg.devDependencies.PSObject.Properties).Count }
}
Write-Host "Dependencies Count: $depsCount"
