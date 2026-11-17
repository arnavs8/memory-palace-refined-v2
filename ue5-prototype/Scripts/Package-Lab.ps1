param([string]$EngineRoot = 'C:\Program Files\Epic Games\UE_5.8')
$ErrorActionPreference = 'Stop'
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (!(Test-Path -LiteralPath (Join-Path $project 'Content\Maps\StudyRoom.umap'))) { throw 'Run Build-Scene.ps1 first.' }
& (Join-Path $EngineRoot 'Engine\Build\BatchFiles\RunUAT.bat') BuildCookRun "-project=$(Join-Path $project 'MemoryPalaceLab.uproject')" -noP4 -platform=Win64 -clientconfig=Development -build -cook -stage -pak -archive "-archivedirectory=$(Join-Path $project 'Builds')" -unattended -utf8output
if ($LASTEXITCODE -ne 0) { throw 'Packaging failed. Review the AutomationTool log.' }
