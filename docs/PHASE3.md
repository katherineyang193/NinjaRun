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
成功 +100 分，Combo bonus 最多+30；持续 RUN +2分／秒。成功+活力值，RUN缓慢增加；MISS只减3点活力值、Combo归零，不扣分不Game Over。自动前进星星+10分，成功路线星星3颗（RUN区段1颗）。
MISS 角色失衡500ms，之后继续；成功大图示回馈700ms，不遮住下个事件。主图示／HUD／右下 Camera Preview 与 Debug 分层，Debug 在关卡下方。
Canvas目标30FPS，Pose FPS低于12时自动降为20FPS；DPR上限1.5，Pose loop与场景loop分离。Debug显示Canvas cost与Scene FPS。无新Camera Engine，无录像／上传，无模型缓存进Git。

## 测试与验收边界
70项自动测试通过，包括整局104秒真实MotionDetector合成输入、全MISS仍完成、提前／错误／超时动作、一次计分、同笔成功碰撞通过、回中央等待、追踪暂停恢复、RUN速度能量星星、禁用Jump与恢复间隔。
整局合成动作五种成功率均100%（RUN2/2、JUMP4/4、CROUCH4/4、LEFT3/3、RIGHT3/3）。这不是真人结果。
新增森林时序预览页面，标示CAMERA OFF／合成，支持成功重播、全部MISS、暂停、木箱预告与跳至合成结果，使用同一ForestStage和MotionDetector。
真人全身站位连续104秒的动作成功率、平均反应时间、Pose FPS、游戏自然度尚待用户试玩。此前64秒真人测试的RUN67%、其余100%不能作为本关卡成功率。
每局真人结束后Developer Mode显示总事件、SUCCESS/MISS、各动作成功率、平均反应时间、最早动作／最晚成功、Pose/Render FPS及每次动作忽略原因。数据只在本次页面内存，不保存影像。

## 建议的真人复测
先用Easy玩一局；结束打开开发模式，复制森林试玩纪录。记录是否有「已经做对但MISS」及是哪一招，核对其动作戳记与ACTIVE范围。另比较64秒提示挑战和森林关的平均Pose FPS；若森林明显下降，先降低场景刷新率／DPR。
完成Phase3实现后停止，等自然度与实际FPS确认，再考虑Phase4追逐和Boss。
