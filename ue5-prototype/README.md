# Memory Palace — Unreal Engine feasibility lab

An isolated experiment, not a replacement for the released Electron app. The target engine is UE5.8. The project source is prepared; native compilation, scene import and graphics measurements are still pending the engine/toolchain installation. Do not treat this as a tested Unreal build yet.

## What is implemented in source

- One 12 × 10 metre furnished study room, prepared by an editor Python script, with eight stable memory landmarks. Fourteen existing CC0 Poly Haven assets are converted to FBX with materials and textures; nothing is purchased.
- First-person walking, object-proximity interaction, scrollable study text, randomized location recall and a score.
- A native Windows file picker for PDF/TXT/Markdown. Explicit in-game consent precedes cloud analysis. The lab requests eight concepts.
- A loopback HTTP helper reuses the tested desktop PDF/OpenRouter pipeline. The Unreal process receives a short-lived local session token, never the OpenRouter key. The helper uses an isolated copy of OS-encrypted settings and does not change the released app's profile.
- Three graphics presets and a 35-second automated camera-route benchmark, including five seconds of warm-up. JSON results record average FPS, p99 frame time, engine version, preset and whether the build includes editor code. No performance numbers have been measured yet.

## Prerequisites

1. Complete the UE5.8 installation. Keep Windows support; Android, iOS, Linux, editor symbols and large sample projects are unnecessary for this lab.
2. Install Visual Studio 2022 **17.14 or later** with **Game development with C++**, an MSVC x64/x86 toolset supported by the installed engine, and a current Windows SDK. Alternatively, `Scripts/Install-CppTools.ps1` prepares a smaller VS2022 Build Tools installation without the full IDE. The first setup attempt was cancelled (exit code 1602); the required tools are not installed yet. It requires the engine download to finish and at least 15 GB free before proceeding. The existing VS2019 installation is not supported for UE5.8. The new tools can coexist with VS2019. Check the exact engine release requirements before selecting toolset versions.
3. Root repository dependencies must be installed (`npm install`). The helper uses the root Electron and PDF.js dependencies.
4. Configure **Free AI setup** in the released Memory Palace app. This lab reuses that encrypted key and selected free model. Do not put keys in `.uproject`, `.ini`, Blueprints, Git or command-line arguments.
5. Blender is used only for asset conversion; the local scripts default to the existing Blender 3.1 installation. Change `-Blender` if needed.

Run `Scripts/Check-Prerequisites.ps1` to inspect the local setup. Disk free space needs room for engine files, the compiler/SDK, generated shaders, build outputs and the packaged copy. Measure again after the engine download finishes before starting another large installation.

Official references:
- [Epic: Visual Studio setup](https://dev.epicgames.com/documentation/en-us/unreal-engine/setting-up-visual-studio-development-environment-for-cplusplus-projects-in-unreal-engine)
- [Epic: UE5.8 release notes](https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-5-8-release-notes)
- [Epic: hardware recommendations](https://dev.epicgames.com/documentation/en-us/unreal-engine/hardware-and-software-specifications-for-unreal-engine)

## Build and run

From this folder in PowerShell:

```powershell
.\Scripts\Check-Prerequisites.ps1
.\Scripts\Build-Scene.ps1 -EngineRoot 'C:\Program Files\Epic Games\UE_5.8'
.\Scripts\Run-Lab.ps1 -EngineRoot 'C:\Program Files\Epic Games\UE_5.8'
```

`Build-Scene.ps1` regenerates **this prototype's** StudyRoom map. It must not be used to preserve manual edits to that generated map: save a separate map before making manual design changes. Converted FBX files, imported assets, maps, binaries and shader caches are generated locally and ignored by Git. Their source assets are already in the root repository.

The first run can spend significant time compiling shaders. Leave the editor/game alone until compilation has settled before judging smoothness.

Controls: WASD and mouse to walk/look; **I** chooses a study file; **Y** confirms cloud text sharing; **N** cancels; **E** reads or places a memory; **Page Up/Down** scrolls study text; **T** begins recall; **L** returns to learning; **Esc** releases/captures the cursor. The source file remains on the computer; extracted text goes to OpenRouter and the model providers only after consent.

The lab saves the last successful cards to `Saved/StudyCards.json`. This is local study data and is ignored by Git. A successful live bridge test has already written eight concepts from the user's test PDF there; remove that file if a fresh empty session is wanted.

## Packaged-app benchmark

```powershell
.\Scripts\Package-Lab.ps1
.\Scripts\Run-Lab.ps1 -GameExecutable '<absolute path to the packaged MemoryPalaceLab.exe>'
```

Press **1**, **2**, or **3**, wait for shader/texture activity to settle, then press **B**. Repeat each preset twice. Results and a screenshot go into `Saved/Benchmarks` for the running build. The camera follows the same 30-second route after five seconds of warm-up. Ordinary gameplay is capped at 60 FPS; benchmarking removes the cap and then restores it.

Confirm the Unreal log selected the NVIDIA GPU rather than Intel integrated graphics. Record whether the laptop is plugged in, and use the same power conditions for every preset.

| Preset | Window | Internal resolution scale | Lighting |
|---|---|---|---|
| 1 Low | 1280 × 720 | 75% | Conventional dynamic lighting; no Lumen |
| 2 Medium | 1280 × 720 | 100% | Conventional dynamic lighting; no Lumen |
| 3 High experiment | 1920 × 1080 | 67% | Software Lumen GI/reflections; no hardware ray tracing |

These are experimental settings, not a promise of a particular FPS. The room uses ordinary static meshes rather than requiring Nanite. On this GTX1650/8GB-RAM laptop, editor responsiveness and packaged-game performance must be reported separately. The benchmark measures frame time, not direct GPU utilization or VRAM usage.

## Decision criteria

Proceed toward a port only after the following are demonstrated:

- PDF import → eight reviewable concepts → eight room locations → learn/test works through the Unreal client, including error and cancellation paths.
- At least one visually acceptable preset holds around 30 FPS or better in the packaged app, with p99 frame times under roughly 50 ms after warm-up. These are proposed acceptance thresholds, not measured results.
- Lighting, navigation and object placement are visibly more convincing than the current app in a side-by-side review.
- Memory pressure, load times and disk footprint are acceptable on the target laptop. Record any crashes or long stalls, not just average FPS.

If the scene looks good but the editor struggles, assess the packaged build before rejecting UE5. If even the low preset remains unsuitable, reduce the scene/lighting budget or keep the existing app and invest in authored environments instead.

## Tests completed / remaining

See `VERIFICATION.md`. Helper tests run from the repository root:

```powershell
node --experimental-strip-types --test ue5-prototype/tests/bridge.test.cjs ue5-prototype/tests/pdf-import.test.mjs
node ue5-prototype/tests/live-bridge.mjs
# Explicit live inference, consumes free-provider requests:
node ue5-prototype/tests/live-bridge.mjs --live '--pdf=C:\path\to\study.pdf'
```

The in-game UI is deliberately basic for the experiment. This is not yet a polished product onboarding flow, an installer containing its own helper runtime, or a completed UE5 port.
