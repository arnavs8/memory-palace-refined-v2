param(
  [string]$EngineRoot = 'C:\Program Files\Epic Games\UE_5.8',
  [string]$Blender = 'C:\Program Files\Blender Foundation\Blender 3.1\blender.exe'
)
$ErrorActionPreference = 'Stop'
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$uproject = Join-Path $project 'MemoryPalaceLab.uproject'
$versionFile = Join-Path $EngineRoot 'Engine\Build\Build.version'
if (!(Test-Path -LiteralPath $versionFile)) { throw 'Engine installation is incomplete.' }
$version = Get-Content -LiteralPath $versionFile -Raw | ConvertFrom-Json
$settings = Get-Content -LiteralPath $uproject -Raw | ConvertFrom-Json
$settings.EngineAssociation = "$($version.MajorVersion).$($version.MinorVersion)"
$settings | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $uproject
& $Blender --background --factory-startup --python (Join-Path $PSScriptRoot 'prepare_assets.py')
if ($LASTEXITCODE -ne 0) { throw 'Asset conversion failed.' }
& (Join-Path $EngineRoot 'Engine\Build\BatchFiles\Build.bat') MemoryPalaceLabEditor Win64 Development "-Project=$uproject" -WaitMutex -MaxParallelActions=2
if ($LASTEXITCODE -ne 0) { throw 'C++ build failed. Check the Visual Studio/Windows SDK prerequisites.' }
& (Join-Path $EngineRoot 'Engine\Binaries\Win64\UnrealEditor-Cmd.exe') $uproject '-run=pythonscript' "-script=$(Join-Path $PSScriptRoot 'build_scene.py')" -unattended -nop4 -nosplash -stdout -FullStdOutLogOutput
if ($LASTEXITCODE -ne 0) { throw 'Scene creation failed; inspect Saved/Logs.' }
if (!(Test-Path -LiteralPath (Join-Path $project 'Content\Maps\StudyRoom.umap'))) { throw 'StudyRoom map was not generated.' }
Write-Host 'Scene built. Run Scripts/Run-Lab.ps1 to test.'
