#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Pawn.h"
#include "GameFramework/GameModeBase.h"
#include "GameFramework/HUD.h"
#include "PalaceLab.generated.h"

USTRUCT()
struct FPalaceLabCard {
  GENERATED_BODY()
  FString Title, Body, Question, Evidence, Source;
  int32 Page = 0;
};

UCLASS()
class MEMORYPALACELAB_API APalaceLabPawn : public APawn {
  GENERATED_BODY()
public:
  APalaceLabPawn();
  virtual void BeginPlay() override;
  virtual void Tick(float DeltaSeconds) override;
  virtual void SetupPlayerInputComponent(UInputComponent* Input) override;
  UPROPERTY() class UCapsuleComponent* Capsule;
  UPROPERTY() class UCameraComponent* Camera;
  UPROPERTY() class UFloatingPawnMovement* Movement;
  TArray<FPalaceLabCard> Cards;
  TArray<FVector> Stations;
  FString Status = TEXT("I: import a PDF or text file. Existing desktop API settings are reused.");
  FString SelectedFile, Preset = TEXT("Low"), BenchmarkResult;
  bool bReading = false, bTest = false, bConsent = false, bBusy = false, bCursor = false;
  int32 OpenCard = INDEX_NONE, Correct = 0, TestStep = 0, ScrollLines = 0;
  TArray<int32> TestOrder;
  int32 NearestStation() const;
  bool IsBenchmarking() const { return BenchmarkTime >= 0; }
private:
  FString BridgeUrl, BridgeToken;
  float PollTime = 0, BenchmarkTime = -1;
  bool bPollInFlight = false;
  TArray<double> FrameTimes;
  FVector OriginalPosition;
  FRotator OriginalRotation;
  void Forward(float Value); void Right(float Value); void LookX(float Value); void LookY(float Value);
  void Interact(); void Import(); void ConfirmImport(); void RejectImport(); void Test(); void Learn(); void ToggleCursor();
  void ScrollUp(); void ScrollDown();
  void Low(); void Medium(); void High(); void Quality(int32 Level); void Benchmark(); void FinishBenchmark();
  void Poll(); void LoadCards(const TSharedPtr<class FJsonObject>& Result);
  void Request(const FString& Route, const FString& Verb, const FString& Body, TFunction<void(bool, TSharedPtr<FJsonObject>)> Done);
};

UCLASS()
class MEMORYPALACELAB_API APalaceLabHUD : public AHUD {
  GENERATED_BODY()
public:
  virtual void DrawHUD() override;
};

UCLASS()
class MEMORYPALACELAB_API APalaceLabMode : public AGameModeBase {
  GENERATED_BODY()
public:
  APalaceLabMode();
};
