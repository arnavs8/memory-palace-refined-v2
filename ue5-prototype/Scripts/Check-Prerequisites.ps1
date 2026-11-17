param([string]$EngineRoot = 'C:\Program Files\Epic Games\UE_5.8')
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$vswhere = 'C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe'
$vs = if(Test-Path $vswhere) { & $vswhere -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -format json | ConvertFrom-Json } else { @() }
[pscustomobject]@{
  EngineRoot = $EngineRoot
  EditorPresent = Test-Path (Join-Path $EngineRoot 'Engine\Binaries\Win64\UnrealEditor.exe')
  EngineVersion = if(Test-Path (Join-Path $EngineRoot 'Engine\Build\Build.version')) { Get-Content (Join-Path $EngineRoot 'Engine\Build\Build.version') -Raw | ConvertFrom-Json } else { $null }
  VisualStudioWithCpp = @($vs | Select-Object displayName,installationVersion,installationPath)
  WindowsSDKs = @(Get-ChildItem 'C:\Program Files (x86)\Windows Kits\10\Include' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name)
  FreeDiskGB = [math]::Round((Get-PSDrive C).Free/1GB,1)
  RAMGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory/1GB,1)
  GPUs = @(Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name)
  PreparedAssets = @(Get-ChildItem (Join-Path $root 'AssetSources') -Filter '*.fbx' -ErrorAction SilentlyContinue).Count
} | ConvertTo-Json -Depth 6
