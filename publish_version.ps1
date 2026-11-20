param (
    [string]$VersionName = "4.0.0",
    [string]$Changelog = "• Mejoras de estabilidad, escaneo de red y seguridad.",
    [string]$DownloadUrl = ""
)

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "    PUBLICADOR DE ACTUALIZACIÓN - WIFI SENTINEL    " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$manifestPath = "android_app\AndroidManifest.xml"
[xml]$manifest = Get-Content $manifestPath

# 1. Leer y aumentar el versionCode actual
$currentCode = [int]$manifest.manifest.versionCode
$newCode = $currentCode + 1
$manifest.manifest.versionCode = $newCode.ToString()
$manifest.manifest.versionName = $VersionName

$manifest.Save($manifestPath)
Write-Host "[1/5] AndroidManifest.xml actualizado:" -ForegroundColor Green
Write-Host "      - versionCode anterior : $currentCode"
Write-Host "      - versionCode NUEVO    : $newCode"
Write-Host "      - versionName NUEVO    : $VersionName"

# 2. Sincronizar assets con static
Copy-Item android_app\assets\index.html, android_app\assets\style.css, android_app\assets\app.js static\ -Force

# 3. Compilar el APK con la nueva versión
Write-Host "`n[2/5] Compilando APK firmado v$VersionName..." -ForegroundColor Yellow
Set-Location android_app
cmd /c build_apk.bat
Set-Location ..

if (-not (Test-Path "dist")) {
    New-Item -ItemType Directory -Path "dist" -Force | Out-Null
}

$compiledApk = "wifi-sentinel.apk"
$distApk = "dist\wifi-sentinel.apk"
$versionedApk = "dist\wifi-sentinel-v$VersionName.apk"
if (Test-Path $compiledApk) {
    Copy-Item $compiledApk $distApk -Force
    Copy-Item $compiledApk $versionedApk -Force
    Write-Host "`n[3/5] Archivos preparados en dist/:" -ForegroundColor Green
    Write-Host "      - $distApk"
    Write-Host "      - $versionedApk"
} else {
    Write-Host "[ERROR] No se pudo encontrar el APK compilado." -ForegroundColor Red
    exit 1
}

# 4. Generar el archivo version.json
if ([string]::IsNullOrWhiteSpace($DownloadUrl)) {
    $DownloadUrl = "https://raw.githubusercontent.com/juanherrerasandoval70-eng/wifi-sentinel/main/dist/wifi-sentinel.apk"
}

$versionJson = @{
    versionCode = $newCode
    versionName = $VersionName
    apkUrl = $DownloadUrl
    changelog = $Changelog
    forceUpdate = $false
} | ConvertTo-Json -Depth 5

Set-Content -Path "version.json" -Value $versionJson -Encoding UTF8

Write-Host "`n[4/5] Archivo version.json actualizado exitosamente!" -ForegroundColor Green

# 5. Git commit y push a GitHub
Write-Host "`n[5/5] Subiendo actualización a GitHub (main)..." -ForegroundColor Yellow
git add .
git commit -m "release: v$VersionName (build $newCode) - $Changelog"
git push origin main

Write-Host "`n==================================================" -ForegroundColor Green
Write-Host "  ¡ACTUALIZACIÓN PUBLICADA EXITOSAMENTE EN GITHUB!  " -ForegroundColor Green
Write-Host "  Los usuarios recibirán la notificación automática" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
