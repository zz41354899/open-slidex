$ErrorActionPreference = "Stop"
$RepositoryRoot = Split-Path -Parent $PSScriptRoot
$Root = Join-Path ([IO.Path]::GetTempPath()) ("open-slidex-windows-test-" + [guid]::NewGuid().ToString("N"))

try {
  $ReleaseRoot = Join-Path $Root "release"
  $PayloadRoot = Join-Path $Root "payload\open-slidex"
  $FakeCli = Join-Path $PayloadRoot "app\node_modules\open-slidex\dist\cli.mjs"
  New-Item -ItemType Directory -Path (Split-Path -Parent $FakeCli), (Join-Path $PayloadRoot "node"), (Join-Path $PayloadRoot "browsers"), $ReleaseRoot -Force | Out-Null
  Copy-Item -LiteralPath (Get-Command node).Source -Destination (Join-Path $PayloadRoot "node\node.exe")
  Copy-Item -LiteralPath (Join-Path $RepositoryRoot "install.sh") -Destination (Join-Path $PayloadRoot "install.sh")
  Copy-Item -LiteralPath (Join-Path $RepositoryRoot "install.ps1") -Destination (Join-Path $PayloadRoot "install.ps1")
  Set-Content -LiteralPath $FakeCli -Value 'process.stdout.write(process.argv.slice(2).join("|") || "empty");' -Encoding UTF8
  Set-Content -LiteralPath (Join-Path $PayloadRoot "VERSION") -Value "9.9.9" -Encoding ASCII

  function Set-ReleaseManifest([string]$Version, [string]$Target = "windows-x64") {
    $Manifest = [ordered]@{
      architecture = "x64"
      asset = "open-slidex-windows-x64.zip"
      installer = "install.ps1"
      platform = "win32"
      schemaVersion = 1
      target = $Target
      version = $Version
    }
    Set-Content -LiteralPath (Join-Path $PayloadRoot "release.json") -Value ($Manifest | ConvertTo-Json) -Encoding ASCII
  }
  Set-ReleaseManifest "9.9.9"

  $Asset = "open-slidex-windows-x64.zip"
  $ArchivePath = Join-Path $ReleaseRoot $Asset

  function New-TestArchive {
    param([string]$SourceRoot, [string]$Destination)

    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    Remove-Item -LiteralPath $Destination -Force -ErrorAction SilentlyContinue
    $Zip = [IO.Compression.ZipFile]::Open($Destination, [IO.Compression.ZipArchiveMode]::Create)
    try {
      $Zip.CreateEntry("open-slidex/") | Out-Null
      Get-ChildItem -LiteralPath $SourceRoot -Recurse -File | ForEach-Object {
        $RelativePath = [IO.Path]::GetRelativePath($SourceRoot, $_.FullName).Replace("\", "/")
        $Entry = $Zip.CreateEntry("open-slidex/$RelativePath", [IO.Compression.CompressionLevel]::Optimal)
        $Input = [IO.File]::OpenRead($_.FullName)
        $Output = $Entry.Open()
        try { $Input.CopyTo($Output) }
        finally {
          $Output.Dispose()
          $Input.Dispose()
        }
      }
    } finally {
      $Zip.Dispose()
    }
  }

  New-TestArchive $PayloadRoot $ArchivePath
  $Digest = (Get-FileHash -Algorithm SHA256 -LiteralPath $ArchivePath).Hash.ToLowerInvariant()
  Set-Content -LiteralPath (Join-Path $ReleaseRoot "SHA256SUMS.txt") -Value "$Digest  $Asset" -Encoding ASCII

  $env:OPEN_SLIDEX_INSTALL_ROOT = Join-Path $Root "installed"
  $env:OPEN_SLIDEX_RELEASE_BASE_URL = $ReleaseRoot
  $env:OPEN_SLIDEX_SKIP_PATH_UPDATE = "1"
  $env:OPEN_SLIDEX_WORKSPACE = Join-Path $Root "workspace"
  & (Join-Path $RepositoryRoot "install.ps1")
  if ($LASTEXITCODE) { throw "Windows installer exited with $LASTEXITCODE" }

  $Launcher = Join-Path $env:OPEN_SLIDEX_INSTALL_ROOT "slidex.cmd"
  $LaunchOutput = & $Launcher --version
  if ($LaunchOutput -ne "--version") { throw "Unexpected launcher output: $LaunchOutput" }

  Set-Content -LiteralPath (Join-Path $PayloadRoot "VERSION") -Value "9.9.10" -Encoding ASCII
  Set-ReleaseManifest "9.9.10" "darwin-x64"
  New-TestArchive $PayloadRoot $ArchivePath
  $Digest = (Get-FileHash -Algorithm SHA256 -LiteralPath $ArchivePath).Hash.ToLowerInvariant()
  Set-Content -LiteralPath (Join-Path $ReleaseRoot "SHA256SUMS.txt") -Value "$Digest  $Asset" -Encoding ASCII
  $BadUpdateOutput = & $Launcher update 2>&1
  if ($LASTEXITCODE -eq 0) { throw "Wrong-target update unexpectedly succeeded." }
  if (($BadUpdateOutput -join "`n") -notmatch "release identity does not match") { throw "Wrong-target update failed for the wrong reason: $BadUpdateOutput" }
  if ((Get-Content -Raw -LiteralPath (Join-Path $env:OPEN_SLIDEX_INSTALL_ROOT "current")).Trim() -ne "9.9.9") { throw "Failed update changed the current version." }

  Set-ReleaseManifest "9.9.10"
  New-TestArchive $PayloadRoot $ArchivePath
  $Digest = (Get-FileHash -Algorithm SHA256 -LiteralPath $ArchivePath).Hash.ToLowerInvariant()
  Set-Content -LiteralPath (Join-Path $ReleaseRoot "SHA256SUMS.txt") -Value "$Digest  $Asset" -Encoding ASCII
  $UpdateOutput = & $Launcher update
  $UpdateOutputText = $UpdateOutput -join "`n"
  if ($UpdateOutputText -notmatch "updated to 9.9.10") { throw "Update did not complete: $UpdateOutputText" }
  if ((Get-Content -Raw -LiteralPath (Join-Path $env:OPEN_SLIDEX_INSTALL_ROOT "current")).Trim() -ne "9.9.10") { throw "Current version was not switched." }
  if (-not (Test-Path -LiteralPath (Join-Path $env:OPEN_SLIDEX_INSTALL_ROOT "versions\9.9.9"))) { throw "Previous version was not retained." }
  $RollbackOutput = & $Launcher rollback
  if (($RollbackOutput -join "`n") -notmatch "rolled back to 9.9.9") { throw "Rollback did not complete: $RollbackOutput" }
  if ((Get-Content -Raw -LiteralPath (Join-Path $env:OPEN_SLIDEX_INSTALL_ROOT "current")).Trim() -ne "9.9.9") { throw "Rollback did not switch current." }
  if ((Get-Content -Raw -LiteralPath (Join-Path $env:OPEN_SLIDEX_INSTALL_ROOT "previous")).Trim() -ne "9.9.10") { throw "Rollback did not preserve the replaced version." }
  $UninstallOutput = & $Launcher uninstall
  if ($UninstallOutput -notmatch "Workspace presentations were kept") { throw "Uninstall did not complete: $UninstallOutput" }
  Start-Sleep -Seconds 2
  if (Test-Path -LiteralPath $env:OPEN_SLIDEX_INSTALL_ROOT) { throw "Install root still exists after uninstall." }
  if (-not (Test-Path -LiteralPath $env:OPEN_SLIDEX_WORKSPACE)) { throw "Workspace was removed during uninstall." }

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $Sentinel = Join-Path $Root "outside-sentinel"
  Set-Content -LiteralPath $Sentinel -Value "safe" -Encoding ASCII
  Remove-Item -LiteralPath $ArchivePath -Force
  $Zip = [IO.Compression.ZipFile]::Open($ArchivePath, [IO.Compression.ZipArchiveMode]::Create)
  try {
    $Entry = $Zip.CreateEntry("../outside-sentinel")
    $Writer = [IO.StreamWriter]::new($Entry.Open())
    try { $Writer.Write("owned") } finally { $Writer.Dispose() }
  } finally {
    $Zip.Dispose()
  }
  $Digest = (Get-FileHash -Algorithm SHA256 -LiteralPath $ArchivePath).Hash.ToLowerInvariant()
  Set-Content -LiteralPath (Join-Path $ReleaseRoot "SHA256SUMS.txt") -Value "$Digest  $Asset" -Encoding ASCII
  $env:OPEN_SLIDEX_INSTALL_ROOT = Join-Path $Root "malicious-install"
  $TraversalRejected = $false
  try {
    & (Join-Path $RepositoryRoot "install.ps1")
  } catch {
    if ($_.Exception.Message -match "unsafe path|unexpected root") { $TraversalRejected = $true }
    else { throw }
  }
  if (-not $TraversalRejected) { throw "Traversal archive unexpectedly installed." }
  if ((Get-Content -Raw -LiteralPath $Sentinel).Trim() -ne "safe") { throw "Traversal archive modified the outside sentinel." }
  if (Test-Path -LiteralPath (Join-Path $env:OPEN_SLIDEX_INSTALL_ROOT "current")) { throw "Traversal archive changed the active version." }
  Write-Host "Windows standalone install, update, launch, and uninstall smoke passed."
} finally {
  Remove-Item -LiteralPath $Root -Recurse -Force -ErrorAction SilentlyContinue
}
