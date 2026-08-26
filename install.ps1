[CmdletBinding()]
param(
  [switch]$Update
)

$ErrorActionPreference = "Stop"
$Repository = "zz41354899/open-slidex"
$DefaultReleaseBaseUrl = "https://github.com/$Repository/releases/latest/download"
$DefaultInstallerUrl = "https://raw.githubusercontent.com/$Repository/main/install.ps1"
$ReleaseBaseUrl = if ($env:OPEN_SLIDEX_RELEASE_BASE_URL) { $env:OPEN_SLIDEX_RELEASE_BASE_URL } else { $DefaultReleaseBaseUrl }
$InstallerUrl = if ($env:OPEN_SLIDEX_INSTALLER_URL) { $env:OPEN_SLIDEX_INSTALLER_URL } else { $DefaultInstallerUrl }
$InstallRoot = if ($env:OPEN_SLIDEX_INSTALL_ROOT) { $env:OPEN_SLIDEX_INSTALL_ROOT } else { Join-Path $env:LOCALAPPDATA "OpenSlideX" }

if (-not [Environment]::Is64BitOperatingSystem) {
  throw "OpenSlideX requires 64-bit Windows."
}

$Asset = "open-slidex-windows-x64.zip"
$TempRoot = Join-Path ([IO.Path]::GetTempPath()) ("open-slidex-install-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $TempRoot -Force | Out-Null

function Copy-Download([string]$Source, [string]$Destination) {
  if (Test-Path -LiteralPath $Source) {
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
  } else {
    Invoke-WebRequest -UseBasicParsing -Uri $Source -OutFile $Destination
  }
}

try {
  $ArchivePath = Join-Path $TempRoot $Asset
  $ChecksumPath = Join-Path $TempRoot "SHA256SUMS.txt"
  Copy-Download ("{0}/{1}" -f $ReleaseBaseUrl.TrimEnd('/'), $Asset) $ArchivePath
  Copy-Download ("{0}/SHA256SUMS.txt" -f $ReleaseBaseUrl.TrimEnd('/')) $ChecksumPath

  $ChecksumLine = Get-Content -LiteralPath $ChecksumPath | Where-Object { $_ -match ("\s\*?" + [regex]::Escape($Asset) + "$") } | Select-Object -First 1
  if (-not $ChecksumLine) { throw "The OpenSlideX release checksum does not list $Asset." }
  $ExpectedSha = ($ChecksumLine -split '\s+')[0].ToLowerInvariant()
  $ActualSha = (Get-FileHash -Algorithm SHA256 -LiteralPath $ArchivePath).Hash.ToLowerInvariant()
  if ($ExpectedSha -ne $ActualSha) { throw "OpenSlideX download checksum verification failed. Nothing was installed." }

  $ExtractRoot = Join-Path $TempRoot "extract"
  Expand-Archive -LiteralPath $ArchivePath -DestinationPath $ExtractRoot -Force
  $ReleaseSource = Join-Path $ExtractRoot "open-slidex"
  $VersionPath = Join-Path $ReleaseSource "VERSION"
  $ReleaseManifestPath = Join-Path $ReleaseSource "release.json"
  if (-not (Test-Path -LiteralPath $VersionPath) -or -not (Test-Path -LiteralPath $ReleaseManifestPath)) {
    throw "The OpenSlideX release archive is incomplete. Nothing was installed."
  }
  $Version = (Get-Content -Raw -LiteralPath $VersionPath).Trim()
  if ($Version -notmatch '^[0-9A-Za-z._-]+$') { throw "The OpenSlideX release has an invalid version. Nothing was installed." }

  $VersionsRoot = Join-Path $InstallRoot "versions"
  New-Item -ItemType Directory -Path $VersionsRoot -Force | Out-Null
  $VersionRoot = Join-Path $VersionsRoot $Version
  $StagedVersion = Join-Path $VersionsRoot (".install-{0}-{1}" -f $Version, $PID)
  Remove-Item -LiteralPath $StagedVersion -Recurse -Force -ErrorAction SilentlyContinue
  Move-Item -LiteralPath $ReleaseSource -Destination $StagedVersion
  $CurrentPath = Join-Path $InstallRoot "current"
  $CurrentVersion = if (Test-Path -LiteralPath $CurrentPath) { (Get-Content -Raw -LiteralPath $CurrentPath).Trim() } else { "" }
  if ($CurrentVersion -eq $Version -and (Test-Path -LiteralPath $VersionRoot)) {
    Remove-Item -LiteralPath $StagedVersion -Recurse -Force
  } else {
    Remove-Item -LiteralPath $VersionRoot -Recurse -Force -ErrorAction SilentlyContinue
    Move-Item -LiteralPath $StagedVersion -Destination $VersionRoot
  }

  Set-Content -LiteralPath $CurrentPath -Value $Version -Encoding UTF8
  Get-ChildItem -LiteralPath $VersionsRoot -Directory | Where-Object { $_.FullName -ne $VersionRoot } | Remove-Item -Recurse -Force
  Set-Content -LiteralPath (Join-Path $InstallRoot "installer-url") -Value $InstallerUrl -Encoding UTF8
  Set-Content -LiteralPath (Join-Path $InstallRoot ".open-slidex-install") -Value "open-slidex-standalone" -Encoding UTF8
  if (-not (Test-Path -LiteralPath (Join-Path $InstallRoot "workspace"))) {
    $Documents = [Environment]::GetFolderPath("MyDocuments")
    $Workspace = if ($env:OPEN_SLIDEX_WORKSPACE) { $env:OPEN_SLIDEX_WORKSPACE } else { Join-Path $Documents "OpenSlideX Workspace" }
    New-Item -ItemType Directory -Path $Workspace -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $InstallRoot "workspace") -Value $Workspace -Encoding UTF8
  }

  $Manager = @'
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
if (-not (Test-Path -LiteralPath (Join-Path $Root ".open-slidex-install"))) {
  throw "OpenSlideX installation metadata is missing. Reinstall OpenSlideX."
}

function Copy-Download([string]$Source, [string]$Destination) {
  if (Test-Path -LiteralPath $Source) { Copy-Item -LiteralPath $Source -Destination $Destination -Force }
  else { Invoke-WebRequest -UseBasicParsing -Uri $Source -OutFile $Destination }
}

$Command = if ($args.Count -gt 0) { $args[0] } else { "" }
if ($Command -eq "update") {
  $TempRoot = Join-Path ([IO.Path]::GetTempPath()) ("open-slidex-update-" + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $TempRoot -Force | Out-Null
  try {
    $InstallerUrl = if ($env:OPEN_SLIDEX_INSTALLER_URL) { $env:OPEN_SLIDEX_INSTALLER_URL } else { (Get-Content -Raw -LiteralPath (Join-Path $Root "installer-url")).Trim() }
    $InstallerPath = Join-Path $TempRoot "install.ps1"
    Copy-Download $InstallerUrl $InstallerPath
    $env:OPEN_SLIDEX_INSTALL_ROOT = $Root
    $env:OPEN_SLIDEX_INSTALLER_URL = $InstallerUrl
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $InstallerPath -Update
    exit $LASTEXITCODE
  } finally {
    Remove-Item -LiteralPath $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
if ($Command -eq "uninstall") {
  $CurrentUserPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $Remaining = @($CurrentUserPath -split ';' | Where-Object { $_ -and $_.TrimEnd('\') -ine $Root.TrimEnd('\') })
  [Environment]::SetEnvironmentVariable("Path", ($Remaining -join ';'), "User")
  $Cleanup = "Start-Sleep -Milliseconds 500; Remove-Item -LiteralPath '" + $Root.Replace("'", "''") + "' -Recurse -Force"
  Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @("-NoProfile", "-Command", $Cleanup) | Out-Null
  Write-Host "OpenSlideX was uninstalled. Your Workspace presentations were kept."
  exit 0
}

$Version = (Get-Content -Raw -LiteralPath (Join-Path $Root "current")).Trim()
$ReleaseRoot = Join-Path (Join-Path $Root "versions") $Version
$Node = Join-Path $ReleaseRoot "node\node.exe"
$Cli = Join-Path $ReleaseRoot "app\node_modules\open-slidex\dist\cli.mjs"
if (-not (Test-Path -LiteralPath $Node) -or -not (Test-Path -LiteralPath $Cli)) {
  throw "OpenSlideX $Version is incomplete. Run the installer again."
}
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $ReleaseRoot "browsers"
$env:OPEN_SLIDEX_STANDALONE = "1"
$CliArgs = @($args)
if ($CliArgs.Count -eq 0) {
  $Workspace = (Get-Content -Raw -LiteralPath (Join-Path $Root "workspace")).Trim()
  $CliArgs = @("workspace", $Workspace)
}
& $Node $Cli @CliArgs
exit $LASTEXITCODE
'@
  Set-Content -LiteralPath (Join-Path $InstallRoot "manager.ps1") -Value $Manager -Encoding UTF8

  $Launcher = @'
@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0manager.ps1" %*
'@
  Set-Content -LiteralPath (Join-Path $InstallRoot "slidex.cmd") -Value $Launcher -Encoding ascii

  $SkipPath = $env:OPEN_SLIDEX_SKIP_PATH_UPDATE -eq "1"
  $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $PathEntries = @($UserPath -split ';' | Where-Object { $_ })
  $HasPath = $PathEntries | Where-Object { $_.TrimEnd('\') -ieq $InstallRoot.TrimEnd('\') }
  if (-not $HasPath -and -not $SkipPath) {
    $NewUserPath = (($PathEntries + $InstallRoot) -join ';')
    [Environment]::SetEnvironmentVariable("Path", $NewUserPath, "User")
    $env:Path = "$InstallRoot;$env:Path"
    $PathUpdated = $true
  } else {
    $PathUpdated = $false
  }

  if ($Update) { Write-Host "OpenSlideX was updated to $Version." }
  else { Write-Host "OpenSlideX $Version was installed." }
  if ($PathUpdated) { Write-Host "Open a new terminal, then run: slidex" }
  else { Write-Host "Run: $InstallRoot\slidex.cmd" }
  Write-Host "Update later with: slidex update"
  Write-Host "Uninstall with: slidex uninstall"
} finally {
  Remove-Item -LiteralPath $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
}
