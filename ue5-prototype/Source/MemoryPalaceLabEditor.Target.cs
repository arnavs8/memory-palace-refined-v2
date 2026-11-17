using UnrealBuildTool;
public class MemoryPalaceLabEditorTarget : TargetRules {
  public MemoryPalaceLabEditorTarget(TargetInfo Target) : base(Target) {
    Type = TargetType.Editor;
    DefaultBuildSettings = BuildSettingsVersion.Latest;
    ExtraModuleNames.Add("MemoryPalaceLab");
  }
}
