#requires -Version 5.1
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Version = "0.1.0"
$MinimumNodeVersion = "20.18.1"
$PackageUrl = "https://cdn.healock.cc/cs2stream/releases/cs2stream-$Version.tgz"
$ExpectedSha256 = "9fa3a0089ae72e31ef039818d68ab3171e9338e16447b2e95695f3aea2c6cdbd"
$PackagePath = Join-Path $env:TEMP "cs2stream-$Version.tgz"

function Write-Step {
  param([string]$Message)
  Write-Host "[CS2Stream] $Message"
}

function Fail {
  param([string]$Message)
  Write-Host "[CS2Stream] Install failed: $Message" -ForegroundColor Red
  exit 1
}

function Get-CommandPath {
  param([string]$Name)
  if ($Name -eq "npm") {
    $npmCmd = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
    if ($npmCmd) {
      return $npmCmd.Source
    }
  }

  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $command) {
    return $null
  }

  if ($command.Source -and $command.Source.EndsWith(".ps1", [StringComparison]::OrdinalIgnoreCase)) {
    $cmdSibling = [IO.Path]::ChangeExtension($command.Source, ".cmd")
    if (Test-Path $cmdSibling) {
      return $cmdSibling
    }
  }

  if ($command.Source) {
    return $command.Source
  }

  return $command.Path
}

function Get-NpmPrefix {
  param([string]$NpmCommand)

  $prefix = (& $NpmCommand config get prefix).Trim()
  if (-not $prefix) {
    Fail "Could not determine npm global prefix."
  }

  return $prefix
}

function Add-ToProcessPath {
  param([string]$PathEntry)

  if ([string]::IsNullOrWhiteSpace($PathEntry)) {
    return
  }

  $entries = @($env:Path -split ";" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  if ($entries | Where-Object { $_ -ieq $PathEntry }) {
    return
  }

  $env:Path = "$PathEntry;$env:Path"
}

function Add-ToUserPath {
  param([string]$PathEntry)

  if ([string]::IsNullOrWhiteSpace($PathEntry)) {
    return $false
  }

  Add-ToProcessPath $PathEntry

  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $entries = @($userPath -split ";" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  if ($entries | Where-Object { $_ -ieq $PathEntry }) {
    return $false
  }

  $newUserPath = if ([string]::IsNullOrWhiteSpace($userPath)) {
    $PathEntry
  } else {
    "$userPath;$PathEntry"
  }
  [Environment]::SetEnvironmentVariable("Path", $newUserPath, "User")
  return $true
}

function Refresh-ProcessPath {
  $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$machinePath;$userPath;$env:Path"
}

function Get-WindowsNodeArchitecture {
  foreach ($architecture in @($env:PROCESSOR_ARCHITEW6432, $env:PROCESSOR_ARCHITECTURE)) {
    if ($architecture -match "ARM64") {
      return "arm64"
    }
  }

  return "x64"
}

function Get-CS2StreamDepsRoot {
  $localAppData = $env:LOCALAPPDATA
  if ([string]::IsNullOrWhiteSpace($localAppData)) {
    $localAppData = [Environment]::GetFolderPath("LocalApplicationData")
  }
  if ([string]::IsNullOrWhiteSpace($localAppData)) {
    $localAppData = Join-Path ([Environment]::GetFolderPath("UserProfile")) "AppData\Local"
  }

  return (Join-Path $localAppData "CS2Stream\deps")
}

function Get-PortableNodeRoot {
  return (Join-Path (Get-CS2StreamDepsRoot) "portable-node")
}

function Get-PortableNodeCommandPath {
  $candidate = Join-Path (Get-PortableNodeRoot) "node.exe"
  if (Test-Path $candidate) {
    return $candidate
  }

  return $null
}

function Use-PortableNodeIfPresent {
  $nodeCommand = Get-PortableNodeCommandPath
  if (-not $nodeCommand) {
    return $false
  }

  Add-ToProcessPath (Split-Path -Parent $nodeCommand)
  return [bool](Get-NodeRuntime)
}

function Ensure-PortableNodeOnUserPath {
  $nodeCommand = Get-PortableNodeCommandPath
  if (-not $nodeCommand) {
    return
  }

  $nodeDir = Split-Path -Parent $nodeCommand
  if (Add-ToUserPath $nodeDir) {
    Write-Host "[CS2Stream] Added portable Node.js to user PATH. Open a new terminal if commands are not found." -ForegroundColor Yellow
  }
}

function Resolve-PortableNodeDownload {
  $architecture = Get-WindowsNodeArchitecture
  $index = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json"
  $fileKey = "win-$architecture-zip"
  $release = $index |
    Where-Object { $_.version -match '^v24\.' -and $_.files -contains $fileKey } |
    Select-Object -First 1

  if (-not $release -or -not $release.version) {
    throw "Could not resolve latest Node.js 24 release metadata."
  }

  $name = "node-$($release.version)-win-$architecture.zip"
  return @{
    Version = $release.version
    Name = $name
    Url = "https://nodejs.org/dist/$($release.version)/$name"
  }
}

function Expand-PortableNodeArchive {
  param(
    [string]$ZipPath,
    [string]$DestinationPath
  )

  $tarCommand = Get-Command tar -ErrorAction SilentlyContinue
  if ($tarCommand -and $tarCommand.Source) {
    New-Item -ItemType Directory -Force -Path $DestinationPath | Out-Null
    & $tarCommand.Source -xf $ZipPath -C $DestinationPath --strip-components 1
    if ($LASTEXITCODE -eq 0) {
      return
    }

    if (Test-Path $DestinationPath) {
      Remove-Item -Recurse -Force $DestinationPath
    }
  }

  $extractPath = Join-Path (Split-Path -Parent $DestinationPath) ("portable-node-extract-" + [guid]::NewGuid().ToString("N"))
  try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($ZipPath, $extractPath)
    $nodeDir = Get-ChildItem -Path $extractPath -Directory |
      Where-Object { Test-Path (Join-Path $_.FullName "node.exe") } |
      Select-Object -First 1

    if (-not $nodeDir) {
      throw "Node.js archive did not contain node.exe."
    }

    Copy-Item -LiteralPath $nodeDir.FullName -Destination $DestinationPath -Recurse -Force
  } finally {
    if (Test-Path $extractPath) {
      Remove-Item -Recurse -Force $extractPath
    }
  }
}

function Install-PortableNode {
  if (Use-PortableNodeIfPresent) {
    Ensure-PortableNodeOnUserPath
    return $true
  }

  Write-Step "No package manager completed Node.js setup; bootstrapping user-local portable Node.js."
  $download = Resolve-PortableNodeDownload
  $portableRoot = Get-PortableNodeRoot
  $portableParent = Split-Path -Parent $portableRoot
  $zipPath = Join-Path $env:TEMP $download.Name

  New-Item -ItemType Directory -Force -Path $portableParent | Out-Null
  if (Test-Path $portableRoot) {
    Remove-Item -Recurse -Force $portableRoot
  }

  try {
    Write-Step "Downloading Node.js $($download.Version)."
    Invoke-WebRequest -Uri $download.Url -OutFile $zipPath -UseBasicParsing
    Expand-PortableNodeArchive -ZipPath $zipPath -DestinationPath $portableRoot
  } finally {
    Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
  }

  if (Use-PortableNodeIfPresent) {
    Ensure-PortableNodeOnUserPath
    return $true
  }

  return $false
}

function Get-NodeRuntime {
  $nodeCommand = Get-CommandPath "node"
  $npmCommand = Get-CommandPath "npm"

  if (-not $nodeCommand -or -not $npmCommand) {
    return $null
  }

  try {
    $nodeVersionText = (& $nodeCommand -p "process.versions.node" 2>$null).Trim()
    $nodeVersion = [Version]$nodeVersionText
  } catch {
    return $null
  }

  if ($nodeVersion -lt [Version]$MinimumNodeVersion) {
    return $null
  }

  return @{
    Node = $nodeCommand
    Npm = $npmCommand
    NodeVersion = $nodeVersionText
  }
}

function Install-Node {
  Write-Step "Node.js is missing or older than $MinimumNodeVersion; trying automatic setup."

  if (Use-PortableNodeIfPresent) {
    Ensure-PortableNodeOnUserPath
    return $true
  }

  if (Get-Command winget -ErrorAction SilentlyContinue) {
    Write-Step "Trying Node.js install with winget."
    winget install OpenJS.NodeJS.LTS --source winget --accept-package-agreements --accept-source-agreements
    Refresh-ProcessPath
    if (Get-NodeRuntime) {
      return $true
    }

    Write-Step "Trying Node.js upgrade with winget."
    winget upgrade OpenJS.NodeJS.LTS --source winget --accept-package-agreements --accept-source-agreements
    Refresh-ProcessPath
    if (Get-NodeRuntime) {
      return $true
    }
  }

  if (Get-Command choco -ErrorAction SilentlyContinue) {
    Write-Step "Trying Node.js install with Chocolatey."
    choco install nodejs-lts -y
    Refresh-ProcessPath
    if (Get-NodeRuntime) {
      return $true
    }
  }

  if (Get-Command scoop -ErrorAction SilentlyContinue) {
    Write-Step "Trying Node.js install with Scoop."
    scoop install nodejs-lts
    Refresh-ProcessPath
    if (Get-NodeRuntime) {
      return $true
    }
  }

  try {
    if (Install-PortableNode) {
      return $true
    }
  } catch {
    Write-Host "[CS2Stream] Portable Node.js bootstrap failed: $($_.Exception.Message)" -ForegroundColor Yellow
  }

  Write-Host ""
  Write-Host "[CS2Stream] Could not install Node.js automatically." -ForegroundColor Red
  Write-Host "Install Node.js $MinimumNodeVersion or newer, then run this installer again:" -ForegroundColor Yellow
  Write-Host "  https://nodejs.org/" -ForegroundColor Cyan
  return $false
}

function Assert-NodeRuntime {
  $runtime = Get-NodeRuntime
  if ($runtime) {
    return $runtime
  }

  if (-not (Install-Node)) {
    Fail "Node.js $MinimumNodeVersion or newer is required."
  }

  $runtime = Get-NodeRuntime
  if ($runtime) {
    return $runtime
  }

  Fail "Node.js installation may require a terminal restart. Open a new PowerShell window and run this installer again."
}

function Download-Package {
  if ([Net.ServicePointManager]::SecurityProtocol -band [Net.SecurityProtocolType]::Tls12) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol
  } else {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  }

  Remove-Item $PackagePath -Force -ErrorAction SilentlyContinue
  Write-Step "Downloading $PackageUrl"
  Invoke-WebRequest -Uri $PackageUrl -OutFile $PackagePath -UseBasicParsing
}

function Assert-PackageHash {
  $actualSha256 = (Get-FileHash $PackagePath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualSha256 -ne $ExpectedSha256.ToLowerInvariant()) {
    Remove-Item $PackagePath -Force -ErrorAction SilentlyContinue
    Fail "Package checksum mismatch."
  }

  Write-Step "Package checksum verified."
}

function Install-Package {
  param([string]$NpmCommand)

  Write-Step "Installing package globally with npm."
  & $NpmCommand install -g $PackagePath --omit=dev --no-audit --fund=false
  if ($LASTEXITCODE -ne 0) {
    Fail "npm global install failed."
  }
}

function Remove-BlockedPowerShellShims {
  param([string]$NpmCommand)

  if ($PSVersionTable.PSVersion.Major -ge 6 -and -not $IsWindows) {
    return
  }

  $npmPrefix = Get-NpmPrefix -NpmCommand $NpmCommand
  foreach ($commandName in @("cs2stream", "cs2stream-cli")) {
    $psShim = Join-Path $npmPrefix "$commandName.ps1"
    if (Test-Path $psShim) {
      Remove-Item $psShim -Force
    }
  }
}

function Show-Result {
  param([string]$NpmCommand)

  $cs2streamCommand = Get-Command cs2stream -ErrorAction SilentlyContinue
  Write-Host ""
  Write-Host "[CS2Stream] Installed CS2Stream $Version." -ForegroundColor Green

  if ($cs2streamCommand) {
    Write-Host "Run it with:"
    Write-Host "  cs2stream"
  } else {
    $npmPrefix = Get-NpmPrefix -NpmCommand $NpmCommand
    Write-Host "The cs2stream command was installed, but it is not visible in the current PATH." -ForegroundColor Yellow
    Write-Host "Add the npm global prefix to PATH, then open a new terminal:"
    Write-Host "  $npmPrefix"
  }
}

try {
  Write-Step "Installing CS2Stream $Version."
  $runtime = Assert-NodeRuntime
  Write-Step "Using Node.js $($runtime.NodeVersion)."
  Download-Package
  Assert-PackageHash
  Install-Package -NpmCommand $runtime.Npm
  Remove-BlockedPowerShellShims -NpmCommand $runtime.Npm
  Remove-Item $PackagePath -Force -ErrorAction SilentlyContinue
  Show-Result -NpmCommand $runtime.Npm
} catch {
  Remove-Item $PackagePath -Force -ErrorAction SilentlyContinue
  Fail $_.Exception.Message
}
