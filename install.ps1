[CmdletBinding()]
param(
  [switch]$Update
)

$ErrorActionPreference = "Stop"
$Repository = "zz41354899/open-slidex"
$DefaultReleaseBaseUrl = "https://github.com/$Repository/releases/latest/download"
$ReleaseBaseUrl = if ($env:OPEN_SLIDEX_RELEASE_BASE_URL) { $env:OPEN_SLIDEX_RELEASE_BASE_URL } else { $DefaultReleaseBaseUrl }
$InstallRoot = if ($env:OPEN_SLIDEX_INSTALL_ROOT) { $env:OPEN_SLIDEX_INSTALL_ROOT } else { Join-Path $env:LOCALAPPDATA "OpenSlideX" }
$Asset = "open-slidex-windows-x64.zip"
$ExpectedTarget = "windows-x64"
$TempRoot = Join-Path ([IO.Path]::GetTempPath()) ("open-slidex-install-" + [guid]::NewGuid().ToString("N"))

if (-not [Environment]::Is64BitOperatingSystem) {
  throw "OpenSlideX requires 64-bit Windows."
}

function Copy-Download([string]$Source, [string]$Destination) {
  if (Test-Path -LiteralPath $Source) {
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
  } else {
    Invoke-WebRequest -UseBasicParsing -Uri $Source -OutFile $Destination
  }
}

function Test-SafeVersion([string]$Version) {
  return $Version -cmatch '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z]+([.-][0-9A-Za-z]+)*)?$'
}

function Set-AtomicText([string]$Path, [string]$Value) {
  $Temporary = "$Path.tmp.$PID"
  [IO.File]::WriteAllText($Temporary, "$Value`n", [Text.UTF8Encoding]::new($false))
  if (Test-Path -LiteralPath $Path) {
    $Backup = "$Temporary.backup"
    Remove-Item -LiteralPath $Backup -Force -ErrorAction SilentlyContinue
    try { [IO.File]::Replace($Temporary, $Path, $Backup) }
    finally { Remove-Item -LiteralPath $Backup -Force -ErrorAction SilentlyContinue }
  } else {
    [IO.File]::Move($Temporary, $Path)
  }
}

function Assert-NotReparsePoint([string]$Path, [string]$Message) {
  if (Test-Path -LiteralPath $Path) {
    $Item = Get-Item -LiteralPath $Path -Force
    if (($Item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw $Message }
  }
}

function Find-GitHubCli([switch]$RefreshPath) {
  $Gh = Get-Command gh -ErrorAction SilentlyContinue
  if ($Gh) { return $Gh.Source }

  if (-not $RefreshPath) { return $null }

  $UserPath = (Get-ItemProperty -Path "HKCU:\Environment" -Name Path -ErrorAction SilentlyContinue).Path
  $MachinePath = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" -Name Path -ErrorAction SilentlyContinue).Path
  $PathEntries = @($env:Path, $UserPath, $MachinePath) |
    Where-Object { $_ } |
    ForEach-Object { $_ -split ';' } |
    Where-Object { $_ } |
    ForEach-Object { [Environment]::ExpandEnvironmentVariables($_) }
  $env:Path = ($PathEntries | Select-Object -Unique) -join ';'

  $Gh = Get-Command gh -ErrorAction SilentlyContinue
  if ($Gh) { return $Gh.Source }

  $Candidates = @(
    (Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links\gh.exe"),
    (Join-Path $env:ProgramFiles "GitHub CLI\gh.exe")
  )
  if (${env:ProgramFiles(x86)}) {
    $Candidates += Join-Path ${env:ProgramFiles(x86)} "GitHub CLI\gh.exe"
  }
  return $Candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
}

function Install-GitHubCli {
  $GhPath = Find-GitHubCli
  if ($GhPath) { return $GhPath }

  $Winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $Winget) {
    throw "GitHub CLI is required to verify the release attestation, and Windows Package Manager (winget) is unavailable. Install GitHub CLI from https://cli.github.com/, then run the installer again."
  }

  Write-Host "OpenSlideX is installing GitHub CLI with winget to verify the release attestation..."
  & $Winget.Source install --id GitHub.cli --exact --source winget --accept-source-agreements --accept-package-agreements
  if ($LASTEXITCODE -ne 0) { throw "GitHub CLI installation with winget failed. Approve any Windows elevation prompt, or install GitHub CLI from https://cli.github.com/, then run the installer again." }

  $GhPath = Find-GitHubCli -RefreshPath
  if (-not $GhPath) {
    throw "GitHub CLI was installed but is not available to this PowerShell session. Open a new PowerShell window, then run the installer again."
  }
  return $GhPath
}

function Assert-SafeZip([string]$ArchivePath, [string]$DestinationRoot) {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $DestinationFull = [IO.Path]::GetFullPath($DestinationRoot).TrimEnd('\', '/')
  $DestinationPrefix = $DestinationFull + [IO.Path]::DirectorySeparatorChar
  $Seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  $FoundRoot = $false
  $FoundChild = $false
  $Zip = [IO.Compression.ZipFile]::OpenRead($ArchivePath)
  try {
    foreach ($Entry in $Zip.Entries) {
      $RawName = $Entry.FullName
      if ([string]::IsNullOrWhiteSpace($RawName) -or $RawName.Contains('\') -or
          $RawName.StartsWith('/') -or $RawName -match '^[A-Za-z]:' -or
          $RawName.StartsWith('//') -or $RawName.IndexOf([char]0) -ge 0) {
        throw "The OpenSlideX archive contains an unsafe path: $RawName"
      }
      $Name = $RawName.TrimEnd('/')
      if (-not $Name) { throw "The OpenSlideX archive contains an empty path." }
      $Segments = @($Name -split '/', -1)
      if ($Segments[0] -cne 'open-slidex') { throw "The OpenSlideX archive has an unexpected root: $RawName" }
      foreach ($Segment in $Segments) {
        if (-not $Segment -or $Segment -eq '.' -or $Segment -eq '..' -or
            $Segment.EndsWith('.') -or $Segment.EndsWith(' ') -or
            $Segment -match '[<>:"|?*]' -or $Segment -match '[\x00-\x1f]') {
          throw "The OpenSlideX archive contains an unsafe path segment: $RawName"
        }
        $DeviceBase = ($Segment -split '\.')[0]
        if ($DeviceBase -match '^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$') {
          throw "The OpenSlideX archive contains a reserved Windows path: $RawName"
        }
      }
      if (-not $Seen.Add($Name)) { throw "The OpenSlideX archive contains a duplicate path: $RawName" }
      $UnixType = (($Entry.ExternalAttributes -shr 16) -band 0xF000)
      if ($UnixType -eq 0xA000) { throw "The OpenSlideX archive contains a symbolic link: $RawName" }
      $Relative = $Name.Replace('/', [IO.Path]::DirectorySeparatorChar)
      $Resolved = [IO.Path]::GetFullPath([IO.Path]::Combine($DestinationFull, $Relative))
      if (-not $Resolved.StartsWith($DestinationPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "The OpenSlideX archive path escapes its extraction directory: $RawName"
      }
      if ($Name -ceq 'open-slidex') { $FoundRoot = $true } else { $FoundChild = $true }
    }
  } finally {
    $Zip.Dispose()
  }
  if (-not $FoundRoot -or -not $FoundChild) { throw "The OpenSlideX archive root is incomplete." }
}

New-Item -ItemType Directory -Path $TempRoot -Force | Out-Null
try {
  $ArchivePath = Join-Path $TempRoot $Asset
  $ChecksumPath = Join-Path $TempRoot "SHA256SUMS.txt"
  Copy-Download ("{0}/{1}" -f $ReleaseBaseUrl.TrimEnd('/'), $Asset) $ArchivePath
  Copy-Download ("{0}/SHA256SUMS.txt" -f $ReleaseBaseUrl.TrimEnd('/')) $ChecksumPath

  $ChecksumLine = Get-Content -LiteralPath $ChecksumPath | Where-Object { $_ -match ("\s\*?" + [regex]::Escape($Asset) + "$") } | Select-Object -First 1
  if (-not $ChecksumLine) { throw "The OpenSlideX release checksum does not list $Asset." }
  $ExpectedSha = ($ChecksumLine -split '\s+')[0].ToLowerInvariant()
  if ($ExpectedSha -notmatch '^[0-9a-f]{64}$') { throw "The OpenSlideX release checksum for $Asset is invalid." }
  $ActualSha = (Get-FileHash -Algorithm SHA256 -LiteralPath $ArchivePath).Hash.ToLowerInvariant()
  if ($ExpectedSha -cne $ActualSha) { throw "OpenSlideX download checksum verification failed. Nothing was installed." }
  if ($ReleaseBaseUrl -ceq $DefaultReleaseBaseUrl) {
    $GhPath = Install-GitHubCli
    & $GhPath attestation verify $ArchivePath --repo $Repository | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "OpenSlideX release provenance verification failed. Nothing was installed." }
  }

  $ExtractRoot = Join-Path $TempRoot "extract"
  New-Item -ItemType Directory -Path $ExtractRoot -Force | Out-Null
  Assert-SafeZip $ArchivePath $ExtractRoot
  [IO.Compression.ZipFile]::ExtractToDirectory($ArchivePath, $ExtractRoot)
  $ExtractFull = [IO.Path]::GetFullPath($ExtractRoot).TrimEnd('\', '/')
  $ReleaseSource = Join-Path $ExtractFull "open-slidex"
  if (-not (Test-Path -LiteralPath $ReleaseSource -PathType Container)) { throw "The OpenSlideX release archive is incomplete. Nothing was installed." }
  $ReleaseFull = [IO.Path]::GetFullPath($ReleaseSource).TrimEnd('\', '/')
  if ($ReleaseFull -cne (Join-Path $ExtractFull "open-slidex")) { throw "The OpenSlideX release root is invalid. Nothing was installed." }
  Get-ChildItem -LiteralPath $ReleaseFull -Recurse -Force | ForEach-Object {
    if (($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "The OpenSlideX archive contains a reparse point: $($_.FullName)" }
    $Resolved = [IO.Path]::GetFullPath($_.FullName)
    if (-not $Resolved.StartsWith($ReleaseFull + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
      throw "The OpenSlideX archive contains a path outside its release root."
    }
  }

  $VersionPath = Join-Path $ReleaseFull "VERSION"
  $ManifestPath = Join-Path $ReleaseFull "release.json"
  if (-not (Test-Path -LiteralPath $VersionPath -PathType Leaf) -or -not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
    throw "The OpenSlideX release archive is incomplete. Nothing was installed."
  }
  Assert-NotReparsePoint $VersionPath "The OpenSlideX version metadata must not be a reparse point."
  Assert-NotReparsePoint $ManifestPath "The OpenSlideX release metadata must not be a reparse point."
  $VersionLines = @(Get-Content -LiteralPath $VersionPath)
  if ($VersionLines.Count -ne 1) { throw "The OpenSlideX release version must be one line." }
  $Version = [string]$VersionLines[0]
  if (-not (Test-SafeVersion $Version)) { throw "The OpenSlideX release has an invalid version. Nothing was installed." }
  try { $Manifest = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json }
  catch { throw "The OpenSlideX release manifest is invalid. Nothing was installed." }
  if ($Manifest.schemaVersion -ne 1 -or $Manifest.version -cne $Version -or
      $Manifest.target -cne $ExpectedTarget -or $Manifest.platform -cne 'win32' -or
      $Manifest.architecture -cne 'x64' -or $Manifest.asset -cne $Asset -or
      $Manifest.installer -cne 'install.ps1') {
    throw "The OpenSlideX release identity does not match this Windows installer. Nothing was installed."
  }

  $Node = Join-Path $ReleaseFull "node\node.exe"
  $Cli = Join-Path $ReleaseFull "app\node_modules\open-slidex\dist\cli.mjs"
  $ArchiveInstaller = Join-Path $ReleaseFull "install.ps1"
  foreach ($RequiredFile in @($Node, $Cli, $ArchiveInstaller)) {
    if (-not (Test-Path -LiteralPath $RequiredFile -PathType Leaf)) { throw "The OpenSlideX release runtime is incomplete. Nothing was installed." }
    Assert-NotReparsePoint $RequiredFile "The OpenSlideX release runtime contains an unsafe reparse point."
  }
  & $Node $Cli --version | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "The OpenSlideX release failed its pre-activation check. The installed version was not changed." }

  Assert-NotReparsePoint $InstallRoot "The OpenSlideX install root must not be a reparse point."
  $VersionsRoot = Join-Path $InstallRoot "versions"
  New-Item -ItemType Directory -Path $VersionsRoot -Force | Out-Null
  $InstallRoot = [IO.Path]::GetFullPath($InstallRoot).TrimEnd('\', '/')
  $VersionsRoot = [IO.Path]::GetFullPath($VersionsRoot).TrimEnd('\', '/')
  $VersionRoot = [IO.Path]::GetFullPath((Join-Path $VersionsRoot $Version)).TrimEnd('\', '/')
  if ([IO.Path]::GetDirectoryName($VersionRoot) -ine $VersionsRoot) { throw "Invalid OpenSlideX version path." }
  Get-ChildItem -LiteralPath $VersionsRoot -Directory -Force | Where-Object {
    $_.Name -cne $Version -and $_.Name.TrimEnd('.', ' ') -ieq $Version.TrimEnd('.', ' ')
  } | ForEach-Object { throw "The OpenSlideX version conflicts with an existing Windows path." }

  $CurrentPath = Join-Path $InstallRoot "current"
  $CurrentVersion = ""
  if (Test-Path -LiteralPath $CurrentPath -PathType Leaf) {
    Assert-NotReparsePoint $CurrentPath "The installed current-version pointer is unsafe."
    $CurrentLines = @(Get-Content -LiteralPath $CurrentPath)
    if ($CurrentLines.Count -ne 1 -or -not (Test-SafeVersion ([string]$CurrentLines[0]))) { throw "The installed current-version pointer is invalid." }
    $CurrentVersion = [string]$CurrentLines[0]
  }

  $StagedVersion = Join-Path $VersionsRoot (".install-{0}-{1}" -f $Version, $PID)
  Remove-Item -LiteralPath $StagedVersion -Recurse -Force -ErrorAction SilentlyContinue
  Move-Item -LiteralPath $ReleaseFull -Destination $StagedVersion

  $InstallerTemporary = Join-Path $InstallRoot (".installer.ps1.{0}" -f $PID)
  Copy-Item -LiteralPath (Join-Path $StagedVersion "install.ps1") -Destination $InstallerTemporary -Force

  $Manager = @'
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
if (-not (Test-Path -LiteralPath (Join-Path $Root ".open-slidex-install"))) {
  throw "OpenSlideX installation metadata is missing. Reinstall OpenSlideX."
}

function Test-SafeVersion([string]$Version) {
  return $Version -cmatch '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z]+([.-][0-9A-Za-z]+)*)?$'
}

function Set-AtomicText([string]$Path, [string]$Value) {
  $Temporary = "$Path.tmp.$PID"
  [IO.File]::WriteAllText($Temporary, "$Value`n", [Text.UTF8Encoding]::new($false))
  if (Test-Path -LiteralPath $Path) {
    $Backup = "$Temporary.backup"
    Remove-Item -LiteralPath $Backup -Force -ErrorAction SilentlyContinue
    try { [IO.File]::Replace($Temporary, $Path, $Backup) }
    finally { Remove-Item -LiteralPath $Backup -Force -ErrorAction SilentlyContinue }
  }
  else { [IO.File]::Move($Temporary, $Path) }
}

$Command = if ($args.Count -gt 0) { $args[0] } else { "" }
if ($Command -eq "update") {
  $InstallerPath = Join-Path $Root "installer.ps1"
  if (-not (Test-Path -LiteralPath $InstallerPath -PathType Leaf) -or
      ((Get-Item -LiteralPath $InstallerPath -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "The verified OpenSlideX updater is missing. Reinstall from a release asset."
  }
  $env:OPEN_SLIDEX_INSTALL_ROOT = $Root
  & $InstallerPath -Update
  exit $LASTEXITCODE
}
if ($Command -eq "rollback") {
  $CurrentPath = Join-Path $Root "current"
  $PreviousPath = Join-Path $Root "previous"
  if (-not (Test-Path -LiteralPath $CurrentPath) -or -not (Test-Path -LiteralPath $PreviousPath)) {
    throw "No previous OpenSlideX version is available for rollback."
  }
  $Current = (Get-Content -Raw -LiteralPath $CurrentPath).Trim()
  $Previous = (Get-Content -Raw -LiteralPath $PreviousPath).Trim()
  if (-not (Test-SafeVersion $Current) -or -not (Test-SafeVersion $Previous) -or $Current -ceq $Previous) {
    throw "OpenSlideX rollback metadata is invalid."
  }
  $PreviousRoot = Join-Path (Join-Path $Root "versions") $Previous
  if (-not (Test-Path -LiteralPath (Join-Path $PreviousRoot "node\node.exe")) -or
      -not (Test-Path -LiteralPath (Join-Path $PreviousRoot "app\node_modules\open-slidex\dist\cli.mjs"))) {
    throw "The previous OpenSlideX version is incomplete."
  }
  Set-AtomicText $CurrentPath $Previous
  Set-AtomicText $PreviousPath $Current
  Write-Host "OpenSlideX rolled back to $Previous."
  exit 0
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
if (-not (Test-SafeVersion $Version)) { throw "The installed OpenSlideX version pointer is invalid. Reinstall OpenSlideX." }
$ReleaseRoot = Join-Path (Join-Path $Root "versions") $Version
$Node = Join-Path $ReleaseRoot "node\node.exe"
$Cli = Join-Path $ReleaseRoot "app\node_modules\open-slidex\dist\cli.mjs"
if (-not (Test-Path -LiteralPath $Node) -or -not (Test-Path -LiteralPath $Cli)) {
  throw "OpenSlideX $Version is incomplete. Run slidex rollback or reinstall."
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
  $ManagerTemporary = Join-Path $InstallRoot (".manager.ps1.{0}" -f $PID)
  [IO.File]::WriteAllText($ManagerTemporary, $Manager, [Text.UTF8Encoding]::new($false))

  $Launcher = @'
@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0manager.ps1" %*
'@
  $LauncherTemporary = Join-Path $InstallRoot (".slidex.cmd.{0}" -f $PID)
  [IO.File]::WriteAllText($LauncherTemporary, $Launcher, [Text.ASCIIEncoding]::new())

  if ($CurrentVersion -ceq $Version -and (Test-Path -LiteralPath $VersionRoot -PathType Container)) {
    Remove-Item -LiteralPath $StagedVersion -Recurse -Force
  } else {
    Remove-Item -LiteralPath $VersionRoot -Recurse -Force -ErrorAction SilentlyContinue
    Move-Item -LiteralPath $StagedVersion -Destination $VersionRoot
  }
  Move-Item -LiteralPath $InstallerTemporary -Destination (Join-Path $InstallRoot "installer.ps1") -Force
  Move-Item -LiteralPath $ManagerTemporary -Destination (Join-Path $InstallRoot "manager.ps1") -Force
  Move-Item -LiteralPath $LauncherTemporary -Destination (Join-Path $InstallRoot "slidex.cmd") -Force

  $PreviousPath = Join-Path $InstallRoot "previous"
  if ($CurrentVersion -and $CurrentVersion -cne $Version -and (Test-Path -LiteralPath (Join-Path $VersionsRoot $CurrentVersion) -PathType Container)) {
    Set-AtomicText $PreviousPath $CurrentVersion
  } else {
    Remove-Item -LiteralPath $PreviousPath -Force -ErrorAction SilentlyContinue
  }
  Set-AtomicText $CurrentPath $Version

  $PreviousVersion = if (Test-Path -LiteralPath $PreviousPath) { (Get-Content -Raw -LiteralPath $PreviousPath).Trim() } else { "" }
  Get-ChildItem -LiteralPath $VersionsRoot -Directory -Force | Where-Object {
    -not $_.Name.StartsWith('.install-') -and $_.Name -cne $Version -and $_.Name -cne $PreviousVersion
  } | Remove-Item -Recurse -Force
  Set-AtomicText (Join-Path $InstallRoot ".open-slidex-install") "open-slidex-standalone"

  if (-not (Test-Path -LiteralPath (Join-Path $InstallRoot "workspace"))) {
    $Documents = [Environment]::GetFolderPath("MyDocuments")
    $Workspace = if ($env:OPEN_SLIDEX_WORKSPACE) { $env:OPEN_SLIDEX_WORKSPACE } else { Join-Path $Documents "OpenSlideX Workspace" }
    New-Item -ItemType Directory -Path $Workspace -Force | Out-Null
    Set-AtomicText (Join-Path $InstallRoot "workspace") $Workspace
  }

  $SkipPath = $env:OPEN_SLIDEX_SKIP_PATH_UPDATE -eq "1"
  $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $PathEntries = @($UserPath -split ';' | Where-Object { $_ })
  $HasPath = $PathEntries | Where-Object { $_.TrimEnd('\') -ieq $InstallRoot.TrimEnd('\') }
  if (-not $HasPath -and -not $SkipPath) {
    [Environment]::SetEnvironmentVariable("Path", (($PathEntries + $InstallRoot) -join ';'), "User")
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
  Write-Host "Rollback with: slidex rollback"
  Write-Host "Uninstall with: slidex uninstall"
} finally {
  Remove-Item -LiteralPath $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
}
