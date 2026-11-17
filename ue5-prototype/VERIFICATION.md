# UE5 feasibility verification record

## Completed before Unreal installation

- Created a separate prototype branch and folder; production app source and release remain unchanged.
- Six Node tests passed: localhost authentication, browser-origin rejection, consent gating, async job polling, concurrent-job rejection/cancellation, provider failures, real PDF/TXT parsing and invalid-file rejection (some checks share a test).
- Live helper startup successfully read a copy of the existing OS-encrypted key configuration without returning the key to the client.
- A live import of the user's 19-page mechanics PDF returned **8 study concepts in 7 provider requests**. This run recovered from an unavailable Google provider and malformed model output; successful models were Cohere North Mini Code and Dots3-Note Preview. The local result is in ignored `Saved/StudyCards.json`. The PDF and generated study data are not committed.
- Fourteen existing CC0 assets were converted to FBX (about 27 MB total). A separate Blender import check passed for all fourteen meshes, totaling 316,691 vertices. This is a file-integrity check, not an Unreal material/visual check. Original source URLs/licenses remain in the root asset catalogue and generated local `AssetSources/sources.json`.
- Python and PowerShell scripts passed syntax checks. This does not validate Unreal Python API calls or native C++ compilation.

## Installation / compilation gate

Hardware observed: Intel i5-9300H, about 8 GB RAM, NVIDIA GTX1650 plus integrated UHD630 graphics. Disk space is changing while UE5.8 downloads; recheck it before installing further tools.

The Epic Launcher was updated and the user started the UE5 download. An older UE5.0 directory was also found, despite the launcher's installed-engine manifest being empty. Attempting an early compilation with that older engine stopped before compiling project source because the .NET Framework SDK was missing. Existing tools are Visual Studio 2019 16.11.3 and Windows SDK 10.0.16299.0; they are not the supported toolchain for UE5.8.

UE5.8.4 files subsequently appeared on disk while the install manifest was still empty; presence of UnrealEditor.exe alone does not establish installation completion. The signed Microsoft VS2022 Build Tools bootstrapper was downloaded and started, but exited with cancellation code 1602 at the Windows approval stage. No toolchain installation success is claimed and the installer was not retried. The setup script now also checks the launcher's completed-install manifest before starting another large installation.

## Not yet verified

- UE5.8 C++ compilation and linking.
- Unreal asset import, material appearance and generated map layout.
- Native file-picker/consent UI, in-engine HTTP polling and object interactions.
- In-engine learn/test behavior, collision/navigation and saved-card loading.
- Packaged build, graphics presets, shader warm-up behavior and benchmark results.

No FPS, VRAM usage, visual-quality improvement or successful Unreal gameplay is claimed. Complete these checks before deciding whether to port the production app.
