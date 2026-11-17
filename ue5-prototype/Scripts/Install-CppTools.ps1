# Run after the engine download finishes and available disk space is checked.
# Uses Microsoft's signed VS2022 Build Tools bootstrapper. It does not remove VS2019.
param([string]$EngineRoot = 'C:\Program Files\Epic Games\UE_5.8')
$ErrorActionPreference = 'Stop'
if (!(Test-Path (Join-Path $EngineRoot 'Engine\Binaries\Win64\UnrealEditor.exe'))) { throw 'Finish the UE5 installation before allocating more disk space to build tools.' }
$launcherManifest = Join-Path $env:ProgramData 'Epic\UnrealEngineLauncher\LauncherInstalled.dat'
$registered = if(Test-Path -LiteralPath $launcherManifest) { Get-Content -LiteralPath $launcherManifest -Raw | ConvertFrom-Json } else { $null }
$completed = @($registered.InstallationList | Where-Object { $_.InstallLocation -and [IO.Path]::GetFullPath($_.InstallLocation).TrimEnd('\') -eq [IO.Path]::GetFullPath($EngineRoot).TrimEnd('\') }).Count -gt 0
if (!$completed) { throw 'Epic Launcher has not yet registered this engine as installed. Wait for its download/install verification to finish.' }
if ((Get-PSDrive C).Free -lt 15GB) { throw 'Less than 15 GB is free. Make room for the C++ toolchain and Unreal build outputs first.' }
$saved = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\Saved'))
New-Item -ItemType Directory -Force $saved | Out-Null
$installer = Join-Path $saved 'vs_buildtools.exe'
Invoke-WebRequest -Uri 'https://aka.ms/vs/17/release/vs_BuildTools.exe' -OutFile $installer
$signature = Get-AuthenticodeSignature -LiteralPath $installer
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Microsoft Corporation') { throw 'Microsoft installer signature verification failed.' }
$installerArguments = @('--quiet','--wait','--norestart','--nocache',
  '--add','Microsoft.VisualStudio.Workload.VCTools',
  '--add','Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
  '--add','Microsoft.VisualStudio.Component.Windows11SDK.26100',
  '--add','Microsoft.Net.Component.4.8.SDK',
  '--add','Microsoft.Net.Component.4.8.TargetingPack')
$install = Start-Process -FilePath $installer -ArgumentList $installerArguments -WindowStyle Hidden -Wait -PassThru
if ($install.ExitCode -eq 3010) { Write-Host 'Build tools installed; Windows reports that a restart is required.' }
elseif ($install.ExitCode -ne 0) { throw "Build Tools installer exited with code $($install.ExitCode). Check the Visual Studio installer logs." }
else { Write-Host 'Build tools installation completed. Run Check-Prerequisites.ps1 next.' }
