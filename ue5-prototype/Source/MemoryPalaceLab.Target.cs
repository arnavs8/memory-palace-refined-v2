using UnrealBuildTool;
public class MemoryPalaceLabTarget : TargetRules {
  public MemoryPalaceLabTarget(TargetInfo Target) : base(Target) {
    Type = TargetType.Game;
    DefaultBuildSettings = BuildSettingsVersion.Latest;
    ExtraModuleNames.Add("MemoryPalaceLab");
  }
}
