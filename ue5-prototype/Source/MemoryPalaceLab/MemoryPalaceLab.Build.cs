using UnrealBuildTool;
public class MemoryPalaceLab : ModuleRules {
  public MemoryPalaceLab(ReadOnlyTargetRules Target) : base(Target) {
    PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
    PublicDependencyModuleNames.AddRange(new[]{"Core","CoreUObject","Engine","InputCore","HTTP","Json","JsonUtilities","Slate","SlateCore"});
    if(Target.Platform == UnrealTargetPlatform.Win64) PublicSystemLibraries.Add("Comdlg32.lib");
  }
}
