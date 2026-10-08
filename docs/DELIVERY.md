# 第一階段交付紀錄

日期：2026-10-08（Asia/Taipei）。範圍限定 Phase 1 + Phase 2 + Motion Debug Playground。

## 1. 現有架構分析

工作資料夾最初為空的 Git Repository，`master` 無 commit、無 remote。透過既有 GitHub 連線確認 GameHome、CuteDart、Eat。使用者指定目標 `katherineyang193/NinjaRun`，該遠端初始為空，預設 `main`。NinjaRun 沒有需保留的既有程式；未建立新 GitHub Repository。GameHome 是純 HTML / CSS / JavaScript，CuteDart 是同類靜態 ES Modules，MediaPipe Tasks Vision 固定 0.10.18。維持這個環境，不引入 WebGL 或前端框架。

## 2. 沿用的模組與來源

尚未取得 CuteDash Repository 或本機原始碼。實際可取得的是 CuteDart，不能將兩者稱為同一專案。

共用 CameraManager 抽取自 [CuteDart game.js](https://github.com/katherineyang193/CuteDart/blob/a9755b7d43384770284974a242d8b8c5cb20631a/game.js) 的 requestCamera / stopCamera：HTTPS、mediaDevices 檢查、getUserMedia、facingMode user、audio:false、video.play、釋放 tracks 與中文權限錯誤。新增取消與逾時清理，將遊戲 DOM 移到 UI 層。NinjaRun 只有一個 CameraManager；其他遊戲可 import 同一份。未修改 CuteDart / GameHome。

PoseManager 採用 [CuteDart gesture.js](https://github.com/katherineyang193/CuteDart/blob/a9755b7d43384770284974a242d8b8c5cb20631a/gesture.js) 的固定 MediaPipe Tasks Vision 版本、FilesetResolver、GPU → CPU 相容策略。CuteDart 為 HandLandmarker，全身 PoseLandmarker 是本次新增，不能沿用手部模型當全身模型。AudioManager 延伸既有 Web Audio oscillator 回饋方式，加入音量包絡與更清楚的短音階。

## 3. 新增模組

CameraManager、PoseManager、MirrorController、CalibrationManager、PlayerCoordinateMapper、MotionDetector、TrackingManager、AudioManager、SettingsManager 各自獨立匯出；沒有 GameHome DOM 依賴。GameHome 只透過可修改的 HTTPS 網址返回。新增姿勢特徵、Worker、合成測試和 UI。

## 4. Camera 初始化

玩家按開始後才要求相機，640×480 / 30 FPS 是 ideal，允許設備自行降級。只開 video、audio:false。權限等待 30 秒可重試；若關閉後權限才被同意，遲到的 stream 仍會被釋放。離開頁面或結束練習會關閉相機。分頁背景暫停推論與計时，回來後重新建立連續追蹤。

## 5. Pose 初始化

按順序先 Camera、再模型，最後站位。MediaPipe 0.10.18 + Pose Lite float16 / version 1。優先用 Worker 隔離同步推論，GPU 失敗轉 CPU；Worker 不相容轉主執行緒模式並限制推論頻率。Render 使用獨立 requestAnimationFrame。畫面不需大型材質或外部圖片。

參考 [Google 官方 Web Pose Landmarker 文件](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js)：detectForVideo 是同步操作，Worker 用於降低主執行緒阻塞。

## 6. Mirror / Player Coordinate Mapping

CameraCoordinate 是 video 原始像素；PoseCoordinate 是原始正規化 0–1 座標；PlayerCoordinate 使用校正取得的 playerRightSign 和站位平均，正值永遠是玩家右、負值永遠是玩家左；GameCoordinate 把左／右映射到 ← / → 與角色動作。

mirrorMode 的 auto / mirror / normal 只控制 preview 是否翻轉；auto 前鏡頭預覽使用鏡像。mirrorDirection 表示模型左右標籤是否需反轉，由舉手校正決定。這兩個概念獨立，切換 preview 不會變動判定。測試涵蓋原始影像 x 翻轉和左右 landmark 標籤反轉的四種組合。

## 7. 左右校正

先舉自己的左手，至少 5 幀且 250 ms；雙手同時舉起不接受。以被舉起手所屬肩膀與另一肩的 x 差取得本人左方向，不使用手腕 x（手可能跨過胸前）。雙手放下保持 250 ms，才要求右手；必須是另一手、方向相反。矛盾會回到左手重試。設定綁定相機 deviceId 與畫面比例，換相機或橫直比例變動重做。家長可清除／關閉記憶校正，練習時可重新校正。

## 8. 人體站位確認

頭、雙肩、雙髖、雙膝需 visibility / presence ≥ .5，且在影像內。腳踝可選；看不到時提示「我還看不到你的腳」，但膝蓋可可靠辨識仍可開始，使用膝到髖距離估計身高。顯示「再退後一點」、「再靠近一點」、「請站到中央」、「準備完成！」。基準取 24 幀、至少 750 ms、關鍵數值範圍差小於 .028；丟幀間隔超過 250 ms 或追蹤遺失會重新累積。基準本身不跨局保存。

## 9. RUN

以每邊 Hip-to-Knee 相對基準的縮短判斷膝蓋抬起，左右差超過身高 .028、抬升至少 .025，2 幀 / 45 ms 確認。每次有效步伐至少間隔 170 ms。1.6 秒内至少 3 次交替、最後一次在 750 ms 內，才 RUNNING；同一腳反覆抬不算跑。runIntensity 0–1，停止後退出，站著不動不會保持活動。判定不要求高抬腿。

## 10. JUMP

Hip rise > 身高 .065，Shoulder rise > .055，兩者差 < .09；3 幀 / 65 ms 確認，且最近 240 ms 有向上速度 > .22 身高/秒。避免慢慢站直、晃頭或抬單腿誤判。700 ms 冷卻，落回接近基準再啟用；一次騰空只發出一個 JUMP。家長關閉後不發出 JUMP。

## 11. CROUCH

Hip 下降 > .085、Shoulder 下降 > .07，且膝角 < 157° 或 Hip-to-Knee 距離縮至基準 .72 以内。3 幀 / 100 ms 確認，450 ms 冷卻、站直後才能再觸發。無腳踝時依相對高度運作。角度計算納入影像比例。只低頭不算。

## 12. LEFT / RIGHT

校正後 Hip playerX 幅度 > .12 身高，Shoulder 同方向 > .085，3 幀 / 95 ms 確認。中央 release zone Hip ±.055、Shoulder ±.075，保持 120 ms 才重新啟用；420 ms 冷卻。持續站左／右或直接由左移到右都不能連續得分。先 CENTER → DODGE → CENTER。

## 13. Motion Debug Playground

沒有键盤動作捷徑。Camera → 模型 → 站位 → 左手 → 放手 → 右手 → 基準平均 → 3/2/1 → 五招練習。招式卡立即亮起 ✓，角色同步動作、短音階与星星文字回饋。關閉 Jump 時卡片清楚停用。1/2/3 分鐘练習结束显示时间與计数；第三次完整练习后显示休息页。這不是完整森林遊戲。

## 14. Developer Debug Panel

Render FPS、Pose FPS、confidence、Hip X/Y、baseline X/Y、24 frames、motionState、runState、runIntensity、mirrorMode、displayMirrored、mirrorDirection、playerRightSign、playerX、trackingState、流程 phase 与五招計数。骨架預設隱藏。合成測試 RUN ✓ / JUMP ✓ / CROUCH ✓ / LEFT ✓ / RIGHT ✓，不混入玩家資料；另有模型載入檢查。

## 15. 錯誤處理

不安全来源、不支援、權限拒絕、找不到相機、相機被占用、逾時、相機拔除、模型 / Worker 中斷與 localStorage 拒絕都有可恢复提示。追蹤遺失立即停計時與角色動作，4 幀 / 100 ms 連續有效人體恢復；不 Game Over、不扣分。恢復後先回中央，避免瞬間發出 Dodge。偵測結果超過 450 ms 無更新同樣暫停。

## 16. GitHub Pages

目標是 `https://katherineyang193.github.io/NinjaRun/`，只在部署成功且公開頁面驗證後標示成功。靜態相對資源路徑支援 Repository 子路徑。實際部署與公開測試結果記錄在文件末尾。

## 17. 測試結果

自動測試驗證全套五招、噪音／單幀、晃頭／抬腿、慢慢站直、冷卻、優先順序、單邊站住、回中央、停止跑、交替跑、低信心／越界、掉追蹤／恢復、四種左右翻轉、校正矛盾、24 幀平均、腳踝可選、localStorage 保存／損壞／拒絕、Camera 請求 audio:false 與遲到 stream 釋放。JavaScript 使用 `node --check`。公開 browser 測試與自動測試分開紀錄。

## 18. 已知限制與後續驗收

未提供 CuteDash 程式，無法保證沿用其獨有核心或與其完全相同。v0.1 屬於動作原型；真人動作容錯需不同身高、衣著、光線、鏡頭角度與不同 Webcam 實測。正常正面站姿較穩，側身或多人同時入鏡不在範圍。不能只依合成數據宣稱真實人體辨識全部通過。

模型與 WASM 初次需網路，企業環境可能阻擋 CDN 或 Google 儲存體。Worker 或 GPU 不可用會相容降級，效能需觀察 Debug FPS；主執行緒 fallback 仍會短暫阻塞。難度只保存，不改動姿態要求；音樂預留但未實作。完整森林、Boss、Combo 與障礙替換是後續階段；關閉跳躍的障礙替換尚未適用，因本階段沒有障礙。

## 實際驗證紀錄

本機測試與 Pages 公開驗證正在進行，尚未列為真人 Webcam 驗收完成。
