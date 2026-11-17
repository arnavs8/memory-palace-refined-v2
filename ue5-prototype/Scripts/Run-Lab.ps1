param(
  [string]$EngineRoot = 'C:\Program Files\Epic Games\UE_5.8',
  [string]$GameExecutable = ''
)
$ErrorActionPreference = 'Stop'
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$repo = [IO.Path]::GetFullPath((Join-Path $project '..'))
$electron = Join-Path $repo 'node_modules\electron\dist\electron.exe'
$entry = Join-Path $project 'bridge\main.cjs'
$uproject = Join-Path $project 'MemoryPalaceLab.uproject'
if (!$GameExecutable -and (!(Test-Path -LiteralPath (Join-Path $project 'Content\Maps\StudyRoom.umap')) -or !(Test-Path -LiteralPath (Join-Path $project 'Binaries\Win64\UnrealEditor-MemoryPalaceLab.dll')))) {
  throw 'The native prototype has not been built yet. Run Build-Scene.ps1 after installing UE5 and the C++ tools.'
}
$saved = Join-Path $project 'Saved'
New-Item -ItemType Directory -Force $saved | Out-Null
if (!(Test-Path -LiteralPath $electron)) { throw 'Install the root project dependencies with npm install first.' }
if (!(Test-Path -LiteralPath (Join-Path $env:APPDATA 'Memory Palace\ai-settings.json'))) { throw 'Configure Free AI setup in the existing Memory Palace app first.' }
$random = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create(); $rng.GetBytes($random); $rng.Dispose()
$token = [BitConverter]::ToString($random).Replace('-','').ToLower()
$ready = Join-Path $saved ('bridge-' + [guid]::NewGuid().ToString('N') + '.json')
$previousElectronMode = $env:ELECTRON_RUN_AS_NODE
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
$helper = $null
try {
  $helperArgs = @(('"'+$entry+'"'),('--lab-token='+$token),('"--lab-ready='+$ready+'"'))
  $helper = Start-Process -FilePath $electron -ArgumentList $helperArgs -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $saved 'bridge.stdout.log') -RedirectStandardError (Join-Path $saved 'bridge.stderr.log')
  $deadline = (Get-Date).AddSeconds(30)
  while (!(Test-Path -LiteralPath $ready)) {
    if ($helper.HasExited) { throw ('PDF/AI helper failed. '+(Get-Content (Join-Path $saved 'bridge.stderr.log') -Raw)) }
    if ((Get-Date) -gt $deadline) { throw 'Timed out starting PDF/AI helper.' }
    Start-Sleep -Milliseconds 300
  }
  $connection = Get-Content -LiteralPath $ready -Raw | ConvertFrom-Json
  $labArgs = @('-windowed','-ResX=1280','-ResY=720',('-LabPort='+$connection.port),('-LabToken='+$token))
  if ($GameExecutable) {
    if (!(Test-Path -LiteralPath $GameExecutable)) { throw 'Packaged executable not found.' }
    $game = Start-Process -FilePath $GameExecutable -ArgumentList $labArgs -PassThru
  } else {
    $editor = Join-Path $EngineRoot 'Engine\Binaries\Win64\UnrealEditor.exe'
    if (!(Test-Path -LiteralPath $editor)) { throw 'Unreal Editor not found. Finish installing UE5 or pass -EngineRoot.' }
    $game = Start-Process -FilePath $editor -ArgumentList (@(('"'+$uproject+'"'),'-game')+$labArgs) -PassThru
  }
  Wait-Process -Id $game.Id
} finally {
  if ($helper -and !$helper.HasExited) { Stop-Process -Id $helper.Id -ErrorAction SilentlyContinue }
  if ($helper) {
    $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    $profile = [IO.Path]::GetFullPath((Join-Path $tempRoot ('MemoryPalaceUE5Bridge-'+$helper.Id)))
    if ($profile.StartsWith($tempRoot,[StringComparison]::OrdinalIgnoreCase) -and (Split-Path $profile -Leaf) -eq ('MemoryPalaceUE5Bridge-'+$helper.Id)) {
      Remove-Item -LiteralPath $profile -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
  Remove-Item -LiteralPath $ready -Force -ErrorAction SilentlyContinue
  if ($null -ne $previousElectronMode) { $env:ELECTRON_RUN_AS_NODE = $previousElectronMode }
}
