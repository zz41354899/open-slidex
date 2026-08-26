$ErrorActionPreference = "Stop"
$RepositoryRoot = Split-Path -Parent $PSScriptRoot
$Root = Join-Path ([IO.Path]::GetTempPath()) ("open-slidex-windows-test-" + [guid]::NewGuid().ToString("N"))

try {
  $ReleaseRoot = Join-Path $Root "release"
  $PayloadRoot = Join-Path $Root "payload\open-slidex"
  $FakeCli = Join-Path $PayloadRoot "app\node_modules\open-slidex\dist\cli.mjs"
  New-Item -ItemType Directory -Path (Split-Path -Parent $FakeCli), (Join-Path $PayloadRoot "node"), (Join-Path $PayloadRoot "browsers"), $ReleaseRoot -Force | Out-Null
  Copy-Item -LiteralPath (Get-Command node).Source -Destination (Join-Path $PayloadRoot "node\node.exe")
  Set-Content -LiteralPath $FakeCli -Value 'process.stdout.write(process.argv.slice(2).join("|") || "empty");' -Encoding UTF8
  Set-Content -LiteralPath (Join-Path $PayloadRoot "VERSION") -Value "9.9.9" -Encoding ASCII
  Set-Content -LiteralPath (Join-Path $PayloadRoot "release.json") -Value '{"version":"9.9.9"}' -Encoding ASCII

  $Asset = "open-slidex-windows-x64.zip"
  $ArchivePath = Join-Path $ReleaseRoot $Asset
  Compress-Archive -Path $PayloadRoot -DestinationPath $ArchivePath -Force
  $Digest = (Get-FileHash -Algorithm SHA256 -LiteralPath $ArchivePath).Hash.ToLowerInvariant()
  Set-Content -LiteralPath (Join-Path $ReleaseRoot "SHA256SUMS.txt") -Value "$Digest  $Asset" -Encoding ASCII

  $env:OPEN_SLIDEX_INSTALL_ROOT = Join-Path $Root "installed"
  $env:OPEN_SLIDEX_INSTALLER_URL = Join-Path $RepositoryRoot "install.ps1"
  $env:OPEN_SLIDEX_RELEASE_BASE_URL = $ReleaseRoot
  $env:OPEN_SLIDEX_SKIP_PATH_UPDATE = "1"
  $env:OPEN_SLIDEX_WORKSPACE = Join-Path $Root "workspace"
  & (Join-Path $RepositoryRoot "install.ps1")
  if ($LASTEXITCODE) { throw "Windows installer exited with $LASTEXITCODE" }

  $Launcher = Join-Path $env:OPEN_SLIDEX_INSTALL_ROOT "slidex.cmd"
  $LaunchOutput = & $Launcher --version
  if ($LaunchOutput -ne "--version") { throw "Unexpected launcher output: $LaunchOutput" }

  Set-Content -LiteralPath (Join-Path $PayloadRoot "VERSION") -Value "9.9.10" -Encoding ASCII
  Set-Content -LiteralPath (Join-Path $PayloadRoot "release.json") -Value '{"version":"9.9.10"}' -Encoding ASCII
  Compress-Archive -Path $PayloadRoot -DestinationPath $ArchivePath -Force
  $Digest = (Get-FileHash -Algorithm SHA256 -LiteralPath $ArchivePath).Hash.ToLowerInvariant()
  Set-Content -LiteralPath (Join-Path $ReleaseRoot "SHA256SUMS.txt") -Value "$Digest  $Asset" -Encoding ASCII
  $UpdateOutput = & $Launcher update
  if ($UpdateOutput -notmatch "updated to 9.9.10") { throw "Update did not complete: $UpdateOutput" }
  if ((Get-Content -Raw -LiteralPath (Join-Path $env:OPEN_SLIDEX_INSTALL_ROOT "current")).Trim() -ne "9.9.10") { throw "Current version was not switched." }
  if (Test-Path -LiteralPath (Join-Path $env:OPEN_SLIDEX_INSTALL_ROOT "versions\9.9.9")) { throw "Previous version was not cleaned up." }
  $UninstallOutput = & $Launcher uninstall
  if ($UninstallOutput -notmatch "Workspace presentations were kept") { throw "Uninstall did not complete: $UninstallOutput" }
  Start-Sleep -Seconds 2
  if (Test-Path -LiteralPath $env:OPEN_SLIDEX_INSTALL_ROOT) { throw "Install root still exists after uninstall." }
  if (-not (Test-Path -LiteralPath $env:OPEN_SLIDEX_WORKSPACE)) { throw "Workspace was removed during uninstall." }
  Write-Host "Windows standalone install, update, launch, and uninstall smoke passed."
} finally {
  Remove-Item -LiteralPath $Root -Recurse -Force -ErrorAction SilentlyContinue
}
