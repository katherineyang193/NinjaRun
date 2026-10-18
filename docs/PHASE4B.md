# Phase 4B · BOSS-22

基準 main c44fa18（CHASE-21）。ForestStage、ChaseState、所有motion/camera/pose模組原檔保留，沒有改動判定門檻、校正或玩家左右映射。

## 架構與流程
AdventureStage協調既有ForestStage → 6秒ESCAPE喘息 → BossStage → COMPLETE。Camera及Pose持續使用原本instance，不重新開啟相機、不重做校正。app原有RAF依相同暫停條件驅動當前stage。ForestView原畫布委派BossView繪製森林空地及原創森林胖胖王，原忍者DOM／SVG動畫沿用。PromptView、SettingsManager、AudioManager與本機SpeechManager沿用。

## 時序及攻擊
Boss Intro 2秒，主回合9招，每招4.5秒；至少完成主回合後才能必殺。前四招JUMP、CROUCH、DODGE_LEFT、DODGE_RIGHT；後五招從兩組合法腳本擇一。最多2招加賽，必殺4秒。正常全成功46.5秒，全MISS55.5秒。追蹤／設定／分頁暫停不計遊戲時間。

Easy灰色預告1300ms、ACTIVE2600ms；Normal1000/2200ms；Hard800/1800ms。碰撞在有效窗結束後100ms；其餘為Recovery（至少500ms）。成功立即顯示勾勾及原忍者900ms動作，攻擊於成功後600ms通過。未成功會播放500ms HIT，繼續下一招。所有時間均為BossStage clock，沒有setTimeout判定。

地面震波要求JUMP ↑；飛葉掃擊要求CROUCH ↓；玩家左側攻擊要求DODGE_RIGHT →；玩家右側攻擊要求DODGE_LEFT ←。箭頭是玩家要做的方向。Boss抬腳／舉手／向攻擊側蓄力是輔助預告。Jump關閉後未完成的JUMP改成CROUCH。

Dodge須回CENTER連續160ms才進入ACTIVE，沿用ForestStage中心條件。等待中心會順延剩餘攻擊，但第56秒結束未完成腳本、進入4秒溫和退場，保證最多60秒且不無限等待。未出題事件標SKIPPED，報告不算成MISS。

## 疲勞、能量與結束
初始Energy保留森林一半，最低30；成功+10，上限100；MISS -3最低0、Combo歸零。每成功一次Boss疲勞+15，上限100；MISS不增加疲勞。無HP、傷害或新體感姿勢。

主回合結束，成功至少6招、疲勞100、Energy100時進入自動旋風必殺。否則最多加賽2招；仍不足則溫和旋風讓Boss滑走。兩種均完成，不Game Over。Energy達100播一次Ready提示音，不中斷正在進行的攻擊。必殺只觸發一次，最後1秒忍者慶祝。正式結果整合森林分數／星星／跑動／Catch與Boss成功／失誤／Combo／各招成果、總時間。

## 音效、效能與隱私
沿用Web Audio triangle oscillator新增登場／蓄力／震波／飛葉／側擊／疲勞／Ready／必殺／Victory音型；成功與Miss沿用。TTS只在ACTIVE播短句，暫停取消，不傳影像或姿勢。無新增正式RAF或Pose loop，Canvas仍30FPS、Pose低時20FPS、DPR最高1.5。有限12顆星星粒子，不使用WebGL或外部素材。

## 測試與真人驗收
新增Boss單元測試：四招ACTIVE成功／錯窗拒絕、方向、Energy與疲勞、全成功及全MISS、加賽與必殺一次、禁止跳躍、追蹤／設定／分頁暫停、回中央與60秒上限、Forest→喘息→Boss→Summary、實際MotionDetector合成姿勢串接、MotionDetector與RunRhythm基準雜湊。完整npm test必須保留所有Forest／Chase／Camera／Motion／Calibration回歸。

公開boss-preview.html標示CAMERA OFF / SYNTHETIC TEST，可選全成功、全MISS、四種單招、Ninja Power、禁止跳躍、Tracking／Settings Pause、難度、森林接Boss及完整結果。合成結果不能當真人成功率。

真人仍須以Windows Chrome/Edge Webcam全身入鏡驗收：Camera與RUN校正、森林CHASE-21節奏、6秒喘息、Boss四招左右、語音音量、離框恢復與設定暫停、必殺／Victory／結果；比較Boss前後Pose FPS。自動環境沒有真人姿勢，不能宣稱人體成功率或實體Pose FPS。

## 已知限制
Boss採簡化原創Canvas美術；動畫時間固定，不使用骨骼模型。無本機中文voice時只播提示音。中心久未回復會以溫和結尾完成；此時可能少於9個實際攻擊，SKIPPED保留於事件紀錄。手機仍非主要驗收裝置。資料僅本局記憶體，不上傳。

Phase4B完成後停止，未開發Phase5。

## 公開版自動驗證（2026-10-17）
136項測試通過（既有116＋Boss20）。公開頁全成功9/9、全MISS0/11但完成、Jump Disabled蹲5/5左右各2/2、森林→Boss合成完整流程完成，Console無致命錯誤。成功46.5秒／全MISS55.5秒；均只觸發一次退場。合成Scene代表樣本約26～29FPS、Canvas約0.4～1.7ms，跳時／背景節流影響樣本；不是真人Pose FPS。
公開正式入口已驗證CAMERA ON、WORKER與CALIBRATION，未有人入鏡時Pose約20.6～21.9FPS、Render約54～60FPS；完成後關閉相機。首次模型獨立probe曾失敗，但隨後實際相機模型初始化與持續推論成功，冷啟動穩定性仍列真人複測。此數據不是Boss真人FPS。

## Phase 4B+ Boss 戰鬥演出升級
BOSS-23 沿用 Phase 4B 的判定與時間軸，新增深藍／青白少年忍者、木甲藤蔓關主、符文石柱與能量平台。Boss 專用 hero SVG；森林跑走服裝同步青藍配色。

成功事件後 160ms 自動投擲、440ms 命中，飛刃、Boss 後仰、裝甲亮光與投擲／命中音效都取自同一遊戲時鐘，暫停時一起停止。Combo 1–2／3–4／5–7／8+ 對應一至四道旋轉飛刃與拖尾，不改得分與姿勢。震波增加裂光塵土、飛葉增加風切線、左右衝擊增加方向拖尾；成功後攻擊於220ms掠過，忍者保持原900ms閃避曲線。Ninja Power 增加青白聚光、三重旋風與原本Boss翻滾退場。

Boss HUD 保留大箭頭及原位置，新增能量描邊；灰色仍僅為預告。疲勞上升後增加搖晃與汗滴。無血腥、外部IP或新增攻擊手勢。

效能：沿用單一 Canvas 更新及30/20FPS節流，最多4飛刃、8命中線、7塵土與原12星星；不使用WebGL、全畫面模糊或額外RAF。Camera、Pose、MotionDetector、RunRhythm、左右mapping及ForestStage完全不改。138項自動測試通過；新增反擊時序、只播一次、暫停與Combo分級驗證。真人Boss中Pose FPS及音效聽感仍須實測，合成預覽不是人體成功率。
