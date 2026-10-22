# Gig Giveaway-Bot - Installation fuer Windows
#
# In PowerShell einfuegen und Enter druecken:
#   irm https://github.com/efn67tungtungtungsahur/Gig/releases/download/app-latest/install.ps1 | iex
#
# Installiert alles nach %LOCALAPPDATA%\Gig (keine Admin-Rechte noetig), oeffnet einmal
# ein Fenster zum Reddit-Login und Handy-Koppeln und startet Gig danach automatisch mit Windows.
# (Diese Datei ist absichtlich nur ASCII, damit sie in jeder PowerShell-Version sauber laeuft.)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$Base = "https://github.com/efn67tungtungtungsahur/Gig/releases/download/app-latest"
if ($env:GIG_BASE_URL) { $Base = $env:GIG_BASE_URL.TrimEnd("/") }
$CI = $env:GIG_CI -eq "1"

$GigHome = Join-Path $env:LOCALAPPDATA "Gig"
$App = Join-Path $GigHome "app"
$Venv = Join-Path $GigHome "venv"
$UvDir = Join-Path $GigHome "uv"
$Py = Join-Path $Venv "Scripts\python.exe"
$PyW = Join-Path $Venv "Scripts\pythonw.exe"
$Launcher = Join-Path $App "launcher.py"

function Step([string]$Text) {
    Write-Host ""
    Write-Host "==> $Text" -ForegroundColor Magenta
}

function Invoke-Native([string]$Exe, [string[]]$Arguments, [string]$What) {
    $old = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & $Exe @Arguments
    $code = $LASTEXITCODE
    $ErrorActionPreference = $old
    if ($code -ne 0) { throw "$What fehlgeschlagen (Code $code)" }
}

function New-Shortcut([string]$Path, [string]$Target, [string]$Arguments, [string]$Dir) {
    $shell = New-Object -ComObject WScript.Shell
    $lnk = $shell.CreateShortcut($Path)
    $lnk.TargetPath = $Target
    $lnk.Arguments = $Arguments
    $lnk.WorkingDirectory = $Dir
    $lnk.Save()
}

Write-Host "Gig Giveaway-Bot wird eingerichtet - das dauert ein paar Minuten." -ForegroundColor Magenta
New-Item -ItemType Directory -Force -Path $GigHome, $App | Out-Null

Step "Laufende Gig-Version beenden (falls vorhanden)"
Get-Process python, pythonw -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -and $_.Path.StartsWith($Venv, [StringComparison]::OrdinalIgnoreCase) } |
    Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Step "Python-Werkzeug herunterladen"
$arch = "x86_64"
if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { $arch = "aarch64" }
$uvZip = Join-Path $env:TEMP "gig-uv.zip"
Invoke-WebRequest -UseBasicParsing "https://github.com/astral-sh/uv/releases/latest/download/uv-$arch-pc-windows-msvc.zip" -OutFile $uvZip
if (Test-Path $UvDir) { Remove-Item -Recurse -Force $UvDir }
Expand-Archive -Path $uvZip -DestinationPath $UvDir -Force
$Uv = (Get-ChildItem -Path $UvDir -Recurse -Filter "uv.exe" | Select-Object -First 1).FullName

Step "Python einrichten"
$env:UV_PYTHON_INSTALL_DIR = Join-Path $GigHome "python"
$env:UV_CACHE_DIR = Join-Path $GigHome "cache"
$env:UV_PYTHON_PREFERENCE = "only-managed"
if (Test-Path $Venv) { Remove-Item -Recurse -Force $Venv }
Invoke-Native $Uv @("venv", "--seed", "--python", "3.12", $Venv) "Python-Einrichtung"

Step "Gig herunterladen"
$botZip = Join-Path $env:TEMP "gig-bot.zip"
Invoke-WebRequest -UseBasicParsing "$Base/gig-bot.zip" -OutFile $botZip
Expand-Archive -Path $botZip -DestinationPath $App -Force

Step "Pakete und Browser installieren (dauert am laengsten)"
$env:GIG_BASE_URL = $Base
Invoke-Native $Py @($Launcher, "--setup") "Installation"

Step "Verknuepfungen anlegen"
$startup = [Environment]::GetFolderPath("Startup")
New-Shortcut (Join-Path $startup "Gig Giveaway-Bot.lnk") $PyW ('"' + $Launcher + '"') $App
$menu = Join-Path ([Environment]::GetFolderPath("Programs")) "Gig"
New-Item -ItemType Directory -Force -Path $menu | Out-Null
New-Shortcut (Join-Path $menu "Gig - Handy koppeln.lnk") $PyW ('"' + (Join-Path $App "gig_bot.py") + '" pair') $App
New-Shortcut (Join-Path $menu "Gig - Neu bei Reddit einloggen.lnk") $PyW ('"' + (Join-Path $App "gig_bot.py") + '" login') $App
New-Shortcut (Join-Path $menu "Gig - Protokoll ansehen.lnk") "notepad.exe" ('"' + (Join-Path $App "data\bot.log") + '"') $App

$uninstall = Join-Path $GigHome "uninstall.ps1"
@"
Get-Process python, pythonw -ErrorAction SilentlyContinue | Where-Object { `$_.Path -like '$Venv*' } | Stop-Process -Force
Remove-Item -Force -ErrorAction SilentlyContinue '$(Join-Path $startup "Gig Giveaway-Bot.lnk")'
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue '$menu'
Start-Sleep -Seconds 2
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue '$GigHome'
Write-Host 'Gig wurde entfernt.'
"@ | Set-Content -Path $uninstall -Encoding UTF8
New-Shortcut (Join-Path $menu "Gig deinstallieren.lnk") "powershell.exe" ('-NoProfile -ExecutionPolicy Bypass -File "' + $uninstall + '"') $GigHome

if ($CI) {
    Write-Host "CI-Modus: Login, Energieeinstellungen und Start werden uebersprungen."
    exit 0
}

Step "Bei Reddit einloggen und Handy koppeln"
Write-Host "Gleich oeffnet sich ein Browserfenster:"
Write-Host "  1. Bei Reddit einloggen"
Write-Host "  2. Danach zeigt das Fenster zwei QR-Codes fuer dein Handy (App laden + koppeln)"
$old = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& $Py (Join-Path $App "gig_bot.py") setup
$ErrorActionPreference = $old

Step "Laptop wach halten"
Write-Host "Gig verhindert automatisch den Ruhezustand, solange der Laptop am Strom haengt."
$answer = Read-Host "Soll Gig auch bei ZUGEKLAPPTEM Laptop weiterlaufen (nur mit Ladekabel)? [J/n]"
if ($answer -notmatch "^[nN]") {
    powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0 | Out-Null
    powercfg /setactive SCHEME_CURRENT | Out-Null
    Write-Host "OK - zugeklappt am Strom laeuft der Laptop weiter."
}

Step "Gig starten"
Start-Process -FilePath $PyW -ArgumentList ('"' + $Launcher + '"') -WorkingDirectory $App

Write-Host ""
Write-Host "FERTIG! Gig laeuft jetzt im Hintergrund und startet automatisch mit Windows." -ForegroundColor Green
Write-Host "Auf dem Handy kommt gleich die Nachricht 'Gig laeuft'. Du musst nichts weiter tun."
Write-Host "(Startmenue > Gig: Handy koppeln, neu einloggen, Protokoll, deinstallieren)"
