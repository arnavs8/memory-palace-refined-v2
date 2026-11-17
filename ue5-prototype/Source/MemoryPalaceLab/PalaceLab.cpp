#include "PalaceLab.h"
#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "GameFramework/FloatingPawnMovement.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/GameUserSettings.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "EngineUtils.h"
#include "HttpModule.h"
#include "Interfaces/IHttpResponse.h"
#include "Interfaces/IHttpRequest.h"
#include "Misc/EngineVersion.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "HAL/FileManager.h"
#include "Engine/GameViewportClient.h"
#include "UnrealClient.h"
#if PLATFORM_WINDOWS
#include "Windows/AllowWindowsPlatformTypes.h"
#include <commdlg.h>
#include "Windows/HideWindowsPlatformTypes.h"
#endif

APalaceLabMode::APalaceLabMode() { DefaultPawnClass = APalaceLabPawn::StaticClass(); HUDClass = APalaceLabHUD::StaticClass(); }
APalaceLabPawn::APalaceLabPawn() {
  PrimaryActorTick.bCanEverTick = true;
  Capsule = CreateDefaultSubobject<UCapsuleComponent>(TEXT("Body"));
  Capsule->InitCapsuleSize(28, 88); Capsule->SetCollisionProfileName(TEXT("Pawn")); RootComponent = Capsule;
  Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Eyes")); Camera->SetupAttachment(RootComponent); Camera->SetRelativeLocation(FVector(0,0,65)); Camera->bUsePawnControlRotation = true;
  Movement = CreateDefaultSubobject<UFloatingPawnMovement>(TEXT("Movement")); Movement->MaxSpeed = 220;
  AutoPossessPlayer = EAutoReceiveInput::Player0;
}
void APalaceLabPawn::BeginPlay() {
  Super::BeginPlay();
  FString Port; FParse::Value(FCommandLine::Get(), TEXT("LabPort="), Port); FParse::Value(FCommandLine::Get(), TEXT("LabToken="), BridgeToken);
  BridgeUrl = TEXT("http://127.0.0.1:") + Port;
  for(int32 i=0;i<8;i++) {
    const FName Tag(*FString::Printf(TEXT("MemoryStation%d"), i));
    for(TActorIterator<AActor> It(GetWorld());It;++It) if(It->ActorHasTag(Tag)) { Stations.Add(It->GetActorLocation()); break; }
  }
  if(Stations.Num()!=8) Status = TEXT("Scene is not built. Run Scripts/Build-Scene.ps1 before testing.");
  if(auto* PC=Cast<APlayerController>(Controller)) { PC->SetInputMode(FInputModeGameOnly()); PC->bShowMouseCursor=false; }
  Quality(0);
  FString Saved;
  if(FFileHelper::LoadFileToString(Saved,*(FPaths::ProjectSavedDir()/TEXT("StudyCards.json")))) {
    TSharedPtr<FJsonObject> Result; auto Reader=TJsonReaderFactory<>::Create(Saved);
    if(FJsonSerializer::Deserialize(Reader,Result)) LoadCards(Result);
  }
}
void APalaceLabPawn::SetupPlayerInputComponent(UInputComponent* Input) {
  Super::SetupPlayerInputComponent(Input);
  Input->BindAxis("Forward",this,&APalaceLabPawn::Forward); Input->BindAxis("Right",this,&APalaceLabPawn::Right);
  Input->BindAxis("LookX",this,&APalaceLabPawn::LookX); Input->BindAxis("LookY",this,&APalaceLabPawn::LookY);
  Input->BindKey(EKeys::E,IE_Pressed,this,&APalaceLabPawn::Interact); Input->BindKey(EKeys::I,IE_Pressed,this,&APalaceLabPawn::Import);
  Input->BindKey(EKeys::Y,IE_Pressed,this,&APalaceLabPawn::ConfirmImport); Input->BindKey(EKeys::N,IE_Pressed,this,&APalaceLabPawn::RejectImport);
  Input->BindKey(EKeys::T,IE_Pressed,this,&APalaceLabPawn::Test); Input->BindKey(EKeys::L,IE_Pressed,this,&APalaceLabPawn::Learn);
  Input->BindKey(EKeys::Escape,IE_Pressed,this,&APalaceLabPawn::ToggleCursor);
  Input->BindKey(EKeys::One,IE_Pressed,this,&APalaceLabPawn::Low); Input->BindKey(EKeys::Two,IE_Pressed,this,&APalaceLabPawn::Medium); Input->BindKey(EKeys::Three,IE_Pressed,this,&APalaceLabPawn::High);
  Input->BindKey(EKeys::B,IE_Pressed,this,&APalaceLabPawn::Benchmark);
  Input->BindKey(EKeys::PageUp,IE_Pressed,this,&APalaceLabPawn::ScrollUp); Input->BindKey(EKeys::PageDown,IE_Pressed,this,&APalaceLabPawn::ScrollDown);
}
void APalaceLabPawn::ScrollUp() { if(bReading) ScrollLines=FMath::Max(0,ScrollLines-5); }
void APalaceLabPawn::ScrollDown() { if(bReading) ScrollLines=FMath::Min(100,ScrollLines+5); }
void APalaceLabPawn::Forward(float V) { if(!bCursor&&!bReading&&!bConsent&&!IsBenchmarking()) AddMovementInput(FRotationMatrix(FRotator(0,GetControlRotation().Yaw,0)).GetUnitAxis(EAxis::X),V); }
void APalaceLabPawn::Right(float V) { if(!bCursor&&!bReading&&!bConsent&&!IsBenchmarking()) AddMovementInput(FRotationMatrix(FRotator(0,GetControlRotation().Yaw,0)).GetUnitAxis(EAxis::Y),V); }
void APalaceLabPawn::LookX(float V) { if(!bCursor&&!bReading&&!bConsent&&!IsBenchmarking()) AddControllerYawInput(V); }
void APalaceLabPawn::LookY(float V) { if(!bCursor&&!bReading&&!bConsent&&!IsBenchmarking()) AddControllerPitchInput(V); }
void APalaceLabPawn::ToggleCursor() { bCursor=!bCursor; if(auto* PC=Cast<APlayerController>(Controller)) { PC->bShowMouseCursor=bCursor; if(bCursor) PC->SetInputMode(FInputModeGameAndUI()); else PC->SetInputMode(FInputModeGameOnly()); } }
int32 APalaceLabPawn::NearestStation() const {
  float Best=200.f; int32 Index=INDEX_NONE;
  for(int32 i=0;i<FMath::Min(Stations.Num(),Cards.Num());i++) {
    const float Distance=FVector::Dist2D(GetActorLocation(),Stations[i]);
    if(Distance<Best) { Best=Distance; Index=i; }
  }
  return Index;
}
void APalaceLabPawn::Interact() {
  if(bBusy||bConsent||IsBenchmarking()) return;
  if(bReading) { bReading=false; return; }
  const int32 Index=NearestStation(); if(Index==INDEX_NONE) { Status=TEXT("Walk within two metres of a memory object."); return; }
  if(bTest) {
    if(TestStep>=TestOrder.Num()) return;
    const bool Match=Index==TestOrder[TestStep]; Correct+=Match?1:0; TestStep++;
    Status=FString::Printf(TEXT("%s  Score: %d / %d. %s"),Match?TEXT("Correct location."):TEXT("Different location."),Correct,TestStep,TestStep==TestOrder.Num()?TEXT("Test complete. L returns to Learn mode."):TEXT("Find the next memory."));
  } else { OpenCard=Index; ScrollLines=0; bReading=true; Movement->StopMovementImmediately(); }
}
void APalaceLabPawn::Learn() { bTest=false; bReading=false; Status=TEXT("Learn mode. Walk to an object and press E."); }
void APalaceLabPawn::Test() {
  if(Cards.IsEmpty()||bBusy) return;
  bTest=true; bReading=false; Correct=0; TestStep=0; TestOrder.Empty();
  for(int32 i=0;i<Cards.Num();i++) TestOrder.Add(i);
  for(int32 i=TestOrder.Num()-1;i>0;i--) TestOrder.Swap(i,FMath::RandRange(0,i));
  Status=TEXT("Test mode: find the remembered object and press E. Explanations stay hidden.");
}
void APalaceLabPawn::Import() {
  if(bBusy||IsBenchmarking()) return;
  Movement->StopMovementImmediately();
#if PLATFORM_WINDOWS
  wchar_t Filename[32768]={0}; OPENFILENAMEW Dialog={0}; Dialog.lStructSize=sizeof(Dialog); Dialog.lpstrFile=Filename; Dialog.nMaxFile=32768;
  Dialog.lpstrFilter=L"Study files (*.pdf;*.txt;*.md)\0*.pdf;*.txt;*.md\0"; Dialog.Flags=OFN_FILEMUSTEXIST|OFN_PATHMUSTEXIST|OFN_NOCHANGEDIR;
  if(GetOpenFileNameW(&Dialog)) { SelectedFile=FString(Filename); bConsent=true; bReading=false; }
#else
  Status=TEXT("The prototype file picker currently supports Windows only.");
#endif
}
void APalaceLabPawn::RejectImport() { bConsent=false; if(bBusy) { Request(TEXT("/cancel"),TEXT("POST"),TEXT("{}"),[](bool,TSharedPtr<FJsonObject>){}); Status=TEXT("Cancelling analysis…"); } }
void APalaceLabPawn::ConfirmImport() {
  if(!bConsent) return; bConsent=false;
  if(BridgeToken.IsEmpty()) { Status=TEXT("Start the prototype with Scripts/Run-Lab.ps1 to connect PDF and AI services."); return; }
  TSharedPtr<FJsonObject> Body=MakeShared<FJsonObject>(); Body->SetStringField(TEXT("filePath"),SelectedFile); Body->SetStringField(TEXT("objective"),TEXT("Identify the central concepts and main exam-relevant ideas. Choose eight distinct concepts for a small memory palace.")); Body->SetBoolField(TEXT("consent"),true);
  FString Json; auto Writer=TJsonWriterFactory<>::Create(&Json); FJsonSerializer::Serialize(Body.ToSharedRef(),Writer);
  bBusy=true; bReading=false; Status=TEXT("Importing study material…");
  TWeakObjectPtr<APalaceLabPawn> Weak(this);
  Request(TEXT("/analyze"),TEXT("POST"),Json,[Weak](bool OK,TSharedPtr<FJsonObject> Result){ if(!Weak.IsValid()) return; if(!OK) { Weak->bBusy=false; Weak->Status=Result.IsValid()&&Result->HasField(TEXT("error"))?Result->GetStringField(TEXT("error")):TEXT("Local helper unavailable. Restart with Run-Lab.ps1."); } });
}
void APalaceLabPawn::Request(const FString& Route,const FString& Verb,const FString& Body,TFunction<void(bool,TSharedPtr<FJsonObject>)> Done) {
  auto Req=FHttpModule::Get().CreateRequest(); Req->SetURL(BridgeUrl+Route); Req->SetVerb(Verb); Req->SetHeader(TEXT("Authorization"),TEXT("Bearer ")+BridgeToken); Req->SetHeader(TEXT("Content-Type"),TEXT("application/json")); if(!Body.IsEmpty()) Req->SetContentAsString(Body);
  Req->OnProcessRequestComplete().BindLambda([Done](FHttpRequestPtr,FHttpResponsePtr Response,bool Connected){ TSharedPtr<FJsonObject> Json; if(Response.IsValid()) { auto Reader=TJsonReaderFactory<>::Create(Response->GetContentAsString()); FJsonSerializer::Deserialize(Reader,Json); } Done(Connected&&Response.IsValid()&&Response->GetResponseCode()<300,Json); }); Req->ProcessRequest();
}
void APalaceLabPawn::Poll() {
  if(bPollInFlight) return; bPollInFlight=true; TWeakObjectPtr<APalaceLabPawn> Weak(this);
  Request(TEXT("/status"),TEXT("GET"),TEXT(""),[Weak](bool OK,TSharedPtr<FJsonObject> Root){
    if(!Weak.IsValid()) return; Weak->bPollInFlight=false;
    if(!OK||!Root.IsValid()) { Weak->bBusy=false; Weak->Status=TEXT("Lost connection to local helper. Start again with Run-Lab.ps1."); return; }
    const auto Job=Root->GetObjectField(TEXT("job")); Weak->Status=Job->GetStringField(TEXT("progress")); const FString State=Job->GetStringField(TEXT("state"));
    if(State==TEXT("complete")) { Weak->bBusy=false; Weak->LoadCards(Job->GetObjectField(TEXT("result"))); }
    else if(State==TEXT("failed")) Weak->bBusy=false;
  });
}
void APalaceLabPawn::LoadCards(const TSharedPtr<FJsonObject>& Result) {
  const TArray<TSharedPtr<FJsonValue>>* Values=nullptr; if(!Result.IsValid()||!Result->TryGetArrayField(TEXT("cards"),Values)) return;
  TArray<FPalaceLabCard> Imported;
  for(const auto& Value:*Values) {
    const auto Obj=Value->AsObject(); if(!Obj.IsValid()) continue;
    FPalaceLabCard Card; if(!Obj->TryGetStringField(TEXT("title"),Card.Title)||!Obj->TryGetStringField(TEXT("body"),Card.Body)) continue;
    Obj->TryGetStringField(TEXT("question"),Card.Question); Obj->TryGetStringField(TEXT("evidence"),Card.Evidence); Obj->TryGetStringField(TEXT("source"),Card.Source); Obj->TryGetNumberField(TEXT("page"),Card.Page); Imported.Add(Card); if(Imported.Num()==8) break;
  }
  if(Imported.IsEmpty()) { Status=TEXT("No valid concepts were returned."); return; }
  Cards=MoveTemp(Imported); Learn();
  FString Json; auto Writer=TJsonWriterFactory<>::Create(&Json); FJsonSerializer::Serialize(Result.ToSharedRef(),Writer); FFileHelper::SaveStringToFile(Json,*(FPaths::ProjectSavedDir()/TEXT("StudyCards.json")));
  Status=FString::Printf(TEXT("%d concepts attached to the eight room landmarks. E to read, T to test."),Cards.Num());
}
void APalaceLabPawn::Low(){Quality(0);} void APalaceLabPawn::Medium(){Quality(1);} void APalaceLabPawn::High(){Quality(2);}
void APalaceLabPawn::Quality(int32 Level) {
  if(IsBenchmarking()) return; auto* Settings=GEngine->GetGameUserSettings(); if(!Settings) return;
  Settings->SetOverallScalabilityLevel(Level); Settings->SetScreenResolution(Level==2?FIntPoint(1920,1080):FIntPoint(1280,720)); Settings->SetFullscreenMode(EWindowMode::Windowed); Settings->SetVSyncEnabled(false); Settings->SetFrameRateLimit(60); Settings->ApplySettings(false);
  if(auto* PC=Cast<APlayerController>(Controller)) {
    PC->ConsoleCommand(Level==2?TEXT("r.DynamicGlobalIlluminationMethod 1"):TEXT("r.DynamicGlobalIlluminationMethod 0")); PC->ConsoleCommand(Level==2?TEXT("r.ReflectionMethod 1"):TEXT("r.ReflectionMethod 0")); PC->ConsoleCommand(Level==0?TEXT("r.ScreenPercentage 75"):Level==1?TEXT("r.ScreenPercentage 100"):TEXT("r.ScreenPercentage 67"));
  }
  Preset=Level==0?TEXT("Low / 720p / 75% / no Lumen"):Level==1?TEXT("Medium / 720p / 100% / no Lumen"):TEXT("High / 1080p / 67% / software Lumen");
  Status=TEXT("Graphics changed. Wait for shaders to settle, then press B for the 35-second benchmark.");
}
void APalaceLabPawn::Benchmark() {
  if(IsBenchmarking()||bBusy||bConsent) return; bReading=false; BenchmarkTime=0; FrameTimes.Empty(); OriginalPosition=GetActorLocation(); OriginalRotation=GetControlRotation(); Movement->StopMovementImmediately();
  if(auto* Settings=GEngine->GetGameUserSettings()) Settings->SetFrameRateLimit(0);
}
void APalaceLabPawn::Tick(float DeltaSeconds) {
  Super::Tick(DeltaSeconds);
  if(bBusy) { PollTime+=DeltaSeconds; if(PollTime>1) { PollTime=0; Poll(); } }
  if(IsBenchmarking()) {
    BenchmarkTime+=DeltaSeconds;
    const float Angle=BenchmarkTime*2*PI/30;
    SetActorLocation(FVector(280*FMath::Cos(Angle),230*FMath::Sin(Angle),90),false);
    if(Controller) Controller->SetControlRotation((FVector(0,0,130)-Camera->GetComponentLocation()).Rotation());
    if(BenchmarkTime>5) FrameTimes.Add(DeltaSeconds*1000.0);
    Status=FString::Printf(TEXT("Benchmark: %.0f / 35 seconds. First 5 seconds are warm-up."),BenchmarkTime);
    if(BenchmarkTime>=35) FinishBenchmark();
  }
}
void APalaceLabPawn::FinishBenchmark() {
  BenchmarkTime=-1; SetActorLocation(OriginalPosition); if(Controller) Controller->SetControlRotation(OriginalRotation); if(auto* S=GEngine->GetGameUserSettings()) S->SetFrameRateLimit(60);
  if(FrameTimes.IsEmpty()) return; FrameTimes.Sort(); double Total=0; for(double T:FrameTimes) Total+=T;
  const double Mean=Total/FrameTimes.Num(); const double P99=FrameTimes[FMath::Clamp(FMath::CeilToInt(FrameTimes.Num()*.99)-1,0,FrameTimes.Num()-1)];
  TSharedPtr<FJsonObject> Json=MakeShared<FJsonObject>(); Json->SetStringField(TEXT("preset"),Preset); Json->SetStringField(TEXT("engine"),FEngineVersion::Current().ToString()); Json->SetNumberField(TEXT("frames"),FrameTimes.Num()); Json->SetNumberField(TEXT("mean_frame_ms"),Mean); Json->SetNumberField(TEXT("p99_frame_ms"),P99); Json->SetNumberField(TEXT("average_fps"),1000/Mean); Json->SetBoolField(TEXT("editor_build"),WITH_EDITOR!=0);
  FString Text; auto Writer=TJsonWriterFactory<>::Create(&Text); FJsonSerializer::Serialize(Json.ToSharedRef(),Writer);
  const FString Dir=FPaths::ProjectSavedDir()/TEXT("Benchmarks"); IFileManager::Get().MakeDirectory(*Dir,true); const FString Stem=Dir/FDateTime::Now().ToString(TEXT("%Y%m%d-%H%M%S")); FFileHelper::SaveStringToFile(Text,*(Stem+TEXT(".json"))); FScreenshotRequest::RequestScreenshot(Stem+TEXT(".png"),false,false);
  BenchmarkResult=FString::Printf(TEXT("%.1f average FPS; %.1f ms p99 frame time. Results saved under Saved/Benchmarks."),1000/Mean,P99); Status=BenchmarkResult;
}
void APalaceLabHUD::DrawHUD() {
  Super::DrawHUD(); const auto* Pawn=Cast<APalaceLabPawn>(GetOwningPawn()); if(!Pawn||!Canvas) return;
  const float Width=FMath::Min(Canvas->SizeX-40.f,1050.f); float Y=24; bool bPanelClip=false;
  const auto Line=[&](const FString& Text,FLinearColor Color=FLinearColor::White) {
    TArray<FString> Words; Text.ParseIntoArray(Words,TEXT(" "),true); FString Row;
    const int32 Limit=FMath::Max(35,FMath::FloorToInt(Width/9.5f));
    for(const auto& Word:Words) { if(Row.Len()+Word.Len()>Limit) { if(!bPanelClip||(Y>=190&&Y<Canvas->SizeY-30)) DrawText(Row,Color,28,Y,GEngine->GetSmallFont(),1.35f); Y+=22; Row.Empty(); } Row+=Word+TEXT(" "); }
    if(!Row.IsEmpty()) { if(!bPanelClip||(Y>=190&&Y<Canvas->SizeY-30)) DrawText(Row,Color,28,Y,GEngine->GetSmallFont(),1.35f); Y+=22; }
  };
  DrawRect(FLinearColor(0.015,0.025,0.025,.86),16,12,Width+16,160);
  Line(TEXT("MEMORY PALACE / UE5 FEASIBILITY LAB"),FLinearColor(.7,1,.8));
  Line(TEXT("WASD move | Mouse look | E read/place | I import | T test | L learn | Esc release mouse"));
  Line(TEXT("1 Low | 2 Medium | 3 High + Lumen | B benchmark (35s) | N cancel analysis"));
  Line(Pawn->Preset); Line(Pawn->Status);
  if(Pawn->bConsent) {
    Y=195; DrawRect(FLinearColor(0,0,0,.92),16,180,Width+16,220); Line(TEXT("IMPORT: ")+FPaths::GetCleanFilename(Pawn->SelectedFile));
    Line(TEXT("This sends extracted document text to OpenRouter and the selected free model provider. Automatic retries may use other free providers. Your API key stays in the local helper.")); Line(TEXT("Y: consent and analyze eight concepts. N: cancel."),FLinearColor(1,.85,.5));
  } else if(Pawn->bReading&&Pawn->Cards.IsValidIndex(Pawn->OpenCard)) {
    const auto& Card=Pawn->Cards[Pawn->OpenCard]; Y=195-Pawn->ScrollLines*22; bPanelClip=true; DrawRect(FLinearColor(.02,.04,.03,.96),16,180,Width+16,Canvas->SizeY-200);
    Line(Card.Title,FLinearColor(.7,1,.8)); Line(Card.Body); Y+=15; Line(Card.Question,FLinearColor(1,.85,.5)); Y+=15; Line(FString::Printf(TEXT("Source: %s / page %d"),*Card.Source,Card.Page)); Line(Card.Evidence); Line(TEXT("Page Up/Down: scroll. E: close and continue walking."));
  } else if(Pawn->bTest&&Pawn->TestOrder.IsValidIndex(Pawn->TestStep)) {
    Y=195; DrawRect(FLinearColor(0,0,0,.88),16,180,Width+16,160); const auto& Card=Pawn->Cards[Pawn->TestOrder[Pawn->TestStep]];
    Line(FString::Printf(TEXT("Recall %d / %d"),Pawn->TestStep+1,Pawn->TestOrder.Num()),FLinearColor(1,.85,.5)); Line(Card.Question.IsEmpty()?Card.Title:Card.Question); Line(TEXT("Walk to the original object and press E."));
  } else if(!Pawn->bTest&&!Pawn->IsBenchmarking()) {
    const int32 Index=Pawn->NearestStation(); if(Index!=INDEX_NONE) { Y=Canvas->SizeY-70; DrawRect(FLinearColor(0,0,0,.8),16,Y-8,Width+16,55); Line(TEXT("E: ")+Pawn->Cards[Index].Title,FLinearColor(.7,1,.8)); }
  }
}
