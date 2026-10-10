# Phase 3 森林試玩關（2026-10-10）

入口為首頁「森林試玩 · 104 秒」，開發模式另有 Test Stage Mode。兩者均使用既有 CameraManager、PoseManager、鏡像左右校正、站位檢查、MotionDetector；不是鍵盤模擬遊戲。64 秒提示挑戰與自由練習保留。尚無 Boss／追逐模式。

## 104 秒關卡
A 起跑暖身 12 秒，B 基礎障礙 28 秒，C 連續組合 36 秒，D 最後衝刺 28 秒。最後 6.5 秒 FINAL RUN。
16 個事件：RUN 持續區段 2、JUMP 4、CROUCH 4、LEFT 3、RIGHT 3。區段間仍以 RUN 控制速度，RUN 不是只做一次就能維持全局跑動。所有障礙都有預告及回復時間，同一時刻只有一個主要動作。

## 同步規則
ForestStage 的 game time（毫秒）統一控制 previewStart / activeStart / activeEnd / impactTime / recoveryEnd / resolved / result。Pose callback 將實際動作戳記為目前 game time；在 ACTIVE 內成功後直接保存 SUCCESS，impact 不會再次要求動作。PREVIEW／窗外動作只記錄原因、不計成功。
Easy 預告 2 秒、有效窗 1.8 秒；Normal 1.7／1.5 秒；Hard 1.4／1.2 秒。暖身及最後 RUN 有更長持續區段。姿勢門檻完全沿用。RUN 區段需要真實 RUNNING 累積 1 秒，最多250ms中斷容忍，不計缺失時間。
JUMP 恢復 1.4 秒、CROUCH 1.1 秒、DODGE .9 秒。下一個 Dodge 的 ACTIVE 會等玩家在自己的中心連續約160ms；未回中央不會強迫下一個方向。
追蹤遺失、離開分頁、家長設定視窗開啟時停止時間軸、碰撞與計分。恢復不重開關卡、不扣分；仍需真實新動作。

## 場景、計分及效能
原創簡化 Canvas 森林含天空、遠樹、近樹、地面、木箱、低樹枝、左右路障，沿用原創 ninja.svg。角色 RUN / JUMP / CROUCH / DODGE_LEFT / DODGE_RIGHT / HIT 狀態。
IDLE 速度 .6x，RUN 1.0～1.15x，最後衝刺上限1.2x；不用真的往前走。場景依移動距離滾動，障礙進度則直接依事件的 preview→impact 時間，以保持碰撞同步。
成功 +100 分，Combo bonus 最多+30；持續 RUN +2分／秒。成功+活力值，RUN緩慢增加；MISS只減3點活力值、Combo歸零，不扣分不Game Over。自動前进星星+10分，成功路線星星3顆（RUN区段1顆）。
MISS 角色失衡500ms，之後繼續；成功大圖示回饋700ms，不遮住下一個事件。主圖示／HUD／右下 Camera Preview 與 Debug 分層，Debug 在關卡下方。
Canvas目標30FPS，Pose FPS低于12時自動降為20FPS；DPR上限1.5，Pose loop與场景loop分離。Debug顯示Canvas cost與Scene FPS。無新Camera Engine，無錄影／上传，無模型快取进Git。

## 測試與验收边界
71項自動測試通過，包括整局104秒真實MotionDetector合成输入、全MISS仍完成、提前／錯誤／超時動作、一次計分、同筆成功碰撞通過、回中央等待、追蹤暫停恢复、RUN速度能量星星、禁用Jump與恢复間隔。
整局合成動作五種成功率均100%（RUN2/2、JUMP4/4、CROUCH4/4、LEFT3/3、RIGHT3/3）。這不是真人結果。
新增森林時序预览頁面，標示CAMERA OFF／合成，支援成功重播、全部MISS、暫停、木箱预告與跳至合成結果，使用同一ForestStage和MotionDetector。
真人全身站位连续104秒的動作成功率、平均反應時间、Pose FPS、游戏自然度尚待使用者試玩。此前64秒真人測試的RUN67%、其余100%不能作為本關卡成功率。
每局真人結束后Developer Mode顯示總事件、SUCCESS/MISS、各動作成功率、平均反應時间、最早動作／最晚成功、Pose/Render FPS及每次動作忽略原因。資料只在本次頁面記憶體，不保存影像。

## 建議的真人複測
先用Easy玩一局；結束開啟开发模式，複製森林試玩紀錄。記錄是否有「已經做對但MISS」及是哪一招，核對其動作戳記與ACTIVE範圍。另比較64秒提示挑戰和森林關的平均Pose FPS；若森林明顯下降，先降低场景更新率／DPR。
完成Phase3實作后停止，等自然度與實際FPS確認，再考慮Phase4追逐和Boss。

時序修正：衝刺障礙延長間距，消除 150ms 回復重疊；RUN 只累計 ACTIVE 內真正推進的遊戲時間，同一時間重複收到 Pose 不會多算。

## 真人回饋後節奏修正
關卡延長至120秒（12／32／40／36秒），12個障礙＋2個RUN區段。障礙間距8秒，站穩緩衝Jump/Crouch 2.2秒、Dodge 1.8秒，接回RUN後至少2秒再預告下一招。RUN預告2秒。恢復提示不再催促立即跑；姿勢門檻未改。角色與障礙放大，RUN圖示新增踏步動感。此前真人104秒測試RUN2/2、Jump3/4、Crouch3/4、左右3/3；新版真人效果待複測。

RUN-4：維持120秒但將障礙改為8個＋2段RUN。障礙預告每12秒一次；每次站穩後RUN圖示至少連續顯示6秒，再切到下一個障礙。預留視覺反應約1秒、交替步伐辨識啟動與持續跑動時間，不更動人體辨識門檻。頁首RUN-4用於確認版本。

RUN-5（依使用者縮小範圍）：恢復原版12個障礙＋2個RUN區段，不減少障礙。所有非RUN事件保留原先預告／有效窗／恢復時間，只在事件之間補足至少6秒RUN圖示時間；總時長因此為166.8秒（約167秒），難度會依原有效窗造成少量差異。RUN-4的8障礙安排已撤回。
