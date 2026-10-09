# 第一階段交付紀錄

日期：2026-10-08（Asia/Taipei）。範圍限定 Phase 1 + Phase 2 + Motion Debug Playground。

## 1. 現有架構分析

工作資料夾最初為空的 Git Repository，`master` 無 commit、無 remote。透過既有 GitHub 連線確認 GameHome、CuteDart、Eat。使用者指定目標 `katherineyang193/NinjaRun`，該遠端初始為空，預設 `main`。NinjaRun 沒有需保留的既有程式；未建立新 GitHub Repository。GameHome 是純 HTML / CSS / JavaScript，CuteDart 是同類靜態 ES Modules，MediaPipe Tasks Vision 固定 0.10.18。維持這個環境，不引入 WebGL 或前端框架。

## 2. 沿用的模組與來源

尚未取得 CuteDash Repository 或本機原始碼。實際可取得的是 CuteDart，不能將兩者稱為同一專案。

共用 CameraManager 抽取自 [CuteDart game.js](https://github.com/katherineyang193/CuteDart/blob/a9755b7d43384770284974a242d8b8c5cb20631a/game.js) 的 requestCamera / stopCamera：HTTPS、mediaDevices 檢查、getUserMedia、facingMode user、audio:false、video.play、釋放 tracks 與中文權限錯誤。新增取消與逾時清理，將遊戲 DOM 移到 UI 層。NinjaRun 只有一個 CameraManager；其他遊戲可 import 同一份。未修改 CuteDart / GameHome。

PoseManager 採用 [CuteDart gesture.js](https://github.com/katherineyang193/CuteDart/blob/a9755b7d43384770284974a242d8b8c5cb20631a/gesture.js) 的固定 MediaPipe Tasks Vision 版本、FilesetResolver、GPU → CPU 相容策略。CuteDart 為 HandLandmarker，全身 PoseLandmarker 是本次新增，不能沿用手部模型當全身模型。AudioManager 延伸既有 Web Audio oscillator 回饋方式，加入音量包絡與更清楚的短音階。

## 3. 新增模組

CameraManager、PoseManager、MirrorController、CalibrationManager、PlayerCoordinateMapper、MotionDetector、TrackingManager、AudioManager、SettingsManager 各自獨立匯出；沒有 GameHome DOM 依賴。GameHome 只透過可修改的 HTTPS 網址返回。新增姿勢特徵、Worker、合成測試和 UI。MotionProgress 獨立保存每局已完成招式、次數與上一招；偵測狀態回中央或遺失不會清除成果。

## 4. Camera 初始化

玩家按開始後才要求相機，640×480 / 30 FPS 是 ideal，允許設備自行降級。只開 video、audio:false。權限等待 30 秒可重試；若關閉後權限才被同意，遲到的 stream 仍會被釋放。離開頁面或結束練習會關閉相機。分頁背景暫停推論與計时，回來後重新建立連續追蹤。

## 5. Pose 初始化

按順序先 Camera、再模型，最後站位。MediaPipe 0.10.18 + Pose Lite float16 / version 1。優先用 Worker 隔離同步推論，GPU 失敗轉 CPU；Worker 不相容轉主執行緒模式並限制推論頻率。Render 使用獨立 requestAnimationFrame。畫面不需大型材質或外部圖片。

參考 [Google 官方 Web Pose Landmarker 文件](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js)：detectForVideo 是同步操作，Worker 用於降低主執行緒阻塞。

## 6. Mirror / Player Coordinate Mapping

CameraCoordinate 是 video 原始像素；PoseCoordinate 是原始正規化 0–1 座標；PlayerCoordinate 使用校正取得的 playerRightSign 和站位平均，正值永遠是玩家右、負值永遠是玩家左；GameCoordinate 把左／右映射到 ← / → 與角色動作。

mirrorMode 的 auto / mirror / normal 只控制 preview 是否翻轉；auto 校正前使用前鏡頭鏡像，校正後依 playerRightSign 選擇預覽方向，讓本人的右移在預覽往右（也支援已翻轉的虛擬鏡頭）。mirrorDirection 表示模型左右標籤是否需反轉，由舉手校正決定。這兩個概念獨立，切換 preview 不會變動判定。測試涵蓋原始影像 x 翻轉和左右 landmark 標籤反轉的四種組合。

## 7. 左右校正

先舉自己的左手，至少 5 幀且 250 ms；雙手同時舉起不接受。以被舉起手所屬肩膀與另一肩的 x 差取得本人左方向，不使用手腕 x（手可能跨過胸前）。雙手放下保持 250 ms，才要求右手；必須是另一手、方向相反。矛盾會回到左手重試。設定綁定相機 deviceId 與畫面比例，換相機或橫直比例變動重做。家長可清除／關閉記憶校正，練習時可重新校正。

## 8. 人體站位確認

頭、雙肩、雙髖、雙膝需 visibility / presence ≥ .5，且在影像內。腳踝可選；看不到時提示「我還看不到你的腳」，但膝蓋可可靠辨識仍可開始，使用膝到髖距離估計身高。顯示「再退後一點」、「再靠近一點」、「請站到中央」、「準備完成！」。基準取 24 幀、至少 750 ms、關鍵數值範圍差小於 .028；丟幀間隔超過 250 ms 或追蹤遺失會重新累積。基準本身不跨局保存。

## 9. RUN

以每邊 Hip-to-Knee 相對基準的縮短判斷膝蓋抬起。小步跑的左右差門檻為身高 .014 或站位校正時雙腿差值標準差的 3.5 倍，取較大者；單腿抬升至少 .009。2 幀 / 35 ms 確認，原始資料也須保持同方向，避免 EMA 把單幀尖峰變成有效踏步。候選釋放門檻為觸發門檻 .45 倍。有效步伐至少間隔 150 ms；2.4 秒內至少 3 次交替、最後一次在 1150 ms 內，才 RUNNING。同一腳反覆抬、雙腿一起跟身體晃動與低幅度雜訊不算跑。runIntensity 0–1，停止後退出。姿势優先順序不變。

## 10. JUMP

Hip rise > 身高 .065，Shoulder rise > .055，兩者差 < .09；3 幀 / 65 ms 確認，且最近 240 ms 有向上速度 > .22 身高/秒。避免慢慢站直、晃頭或抬單腿誤判。700 ms 冷卻，落回接近基準再啟用；一次騰空只發出一個 JUMP。家長關閉後不發出 JUMP。

## 11. CROUCH

Hip 下降 > .085、Shoulder 下降 > .07，且膝角 < 157° 或 Hip-to-Knee 距離縮至基準 .72 以内。3 幀 / 100 ms 確認，450 ms 冷卻、站直後才能再觸發。無腳踝時依相對高度運作。角度計算納入影像比例。只低頭不算。

## 12. LEFT / RIGHT

校正後 Hip playerX 幅度 > .12 身高，Shoulder 同方向 > .085，3 幀 / 95 ms 確認。中央 release zone Hip ±.055、Shoulder ±.075，保持 120 ms 才重新啟用；420 ms 冷卻。持續站左／右或直接由左移到右都不能連續得分。先 CENTER → DODGE → CENTER。

## 13. Motion Debug Playground

沒有鍵盤動作捷徑。Camera → 模型 → 站位 → 左手 → 放手 → 右手 → 基準平均 → 3/2/1 → 五招練習。招式卡「✓ 已完成」與累積次數整局保留，「● 正在做」才是即時狀態；回中央、重新校正、追蹤遺失都不清除成果，新一局才歸零。另顯示完成招式數及上一個成功動作。角色同步動作、短音階與星星文字回饋。關閉 Jump 時卡片清楚停用，目標為 4 招。1/2/3 分鐘練習結束顯示時間與計數；第三次完整練習後顯示休息頁。這不是完整森林遊戲。

採滿版視訊舞台：video、節點與辨識框佔滿舞台，校正提示、倒數、動作成功、左右箭頭與成果皆疊在舞台內。用 object-fit:contain 保留完整鏡頭影像，影像比例不同時留邊，避免裁掉膝蓋。桌面成果面板浮在右側，讓中央髖、膝與腳部清楚可見；窄視窗改為底部成果列。支援全螢幕切換，瀏覽器不允許時提示 F11。

TrackingOverlay 統一影像 contain 幾何、鏡像座標與站位框；安全範圍為原始影像 x .04–.96、y .025–.975，寬度由原先 56% 放寬至 92%。頭、肩、髖、膝可靠且在框內，連續追蹤恢復後，整框為 6px 亮黃加光暈與淺黃色填色。無有效人體或越界轉藍，並搭配 ✓／◇ 中文狀態。每個節點依即時信心值與是否在框內標黃／藍；只有部分人體時，已辨識節點仍可標黃，缺失膝蓋等標藍，整框保持藍色。影格過期時節點全轉藍；沒有座標時不捏造節點。

## 14. Developer Debug Panel

Render FPS、Pose FPS、confidence、Hip X/Y、baseline X/Y、24 frames、motionState、runState、runIntensity、mirrorMode、displayMirrored、mirrorDirection、playerRightSign、playerX、trackingState、流程 phase 與五招計數。增加踏步數、雙腿差值與當次 RUN 門檻。面板先顯示中文流程／追蹤／辨識速度，並提供可展開的術語說明。HOME + Engine OFF 時 Pose FPS 為 0 是正常的。依 2026-10-09 使用者要求，骨架節點預設顯示，舞台右上可關閉。合成測試 RUN ✓ / JUMP ✓ / CROUCH ✓ / LEFT ✓ / RIGHT ✓ 清楚標為「程式檢查（合成資料）」，不混入玩家資料；另有模型載入檢查。

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

- 自動測試：48 項通過、0 失敗；包含 Camera、Worker、五招、校正、設定、完成紀錄、小步與低 FPS 跑動、校正雜訊抑制、站位框、鏡像 contain 幾何、黃藍節點與部分人體回饋。`node --check` 通過，21 個公開靜態資源與相對 imports 存在。
- 首次同步 commit：`b4a287daaddf0a72968f6d9759a95f109ff07a1c`，`feat: add ninja pose calibration and motion playground`，分支 `main`。本機 `git push` 因無登入認證失敗，改用既有 GitHub connector 建立 tree / commit 並以非 force 更新 ref。本機 checkpoint commits 保留在 `codex/local-checkpoint`，本機 `main` 跟隨遠端。
- GitHub Motion checks：[成功](https://github.com/katherineyang193/NinjaRun/actions/runs/37796516655)。Pages 從 `main` 根目錄發佈，由使用者啟用設定；[首次 build / deployment 成功](https://github.com/katherineyang193/NinjaRun/actions/runs/37796764981)。
- 公開首頁已在內建 Chromium 瀏覽器實際開啟，可讀到標題、招式卡、家長設定與開發面板。原版模型載入成功（COMPATIBILITY）；修正 MediaPipe WASM loader 所需 classic Worker 後，本機載入成功（WORKER），增加空白影格推論測試；最新公開版本再次驗證。
- 本機 Refresh 後一分鐘、非鏡像、關閉跳躍等設定仍保留。公開版本同樣進行保存／Refresh 檢查。
- 公開 HTTPS 確實發出相機請求，但自動瀏覽器未回應相機權限，30 秒後顯示可重試提示；未得到真人 Webcam 影格。因此「HTTPS Webcam 成功啟動、真人兩手校正、真人五招、不同鏡頭方向與實測 Pose FPS」仍未完成驗收，不能以合成測試替代。
- 未修改或同步 CuteDart / GameHome；NinjaRun 有獨立公開網址與可修改 GameHome 返回入口。

## 2026-10-08 真人回饋修正

使用者回報成功提示後回中央像是成果消失、視窗和文字過小。原因是旧卡片勾勾只表示即時狀態；改為獨立每局完成紀錄，保留最後成功與全部招式進度。未降低動作門檻或取消回中央才能再次閃避的規則。

本機實際瀏覽器檢查：1366×768、1920×1080、580×800、390×844 都沒有橫向溢出。校正版型的鏡頭寬度分別約 361、594、440、314 px；主要提示字為 37、50、30、30 px。校正／練習版型採沒有 Camera 影格的靜態測試頁，僅驗證排版，不作為真人辨識證明，測試頁不發布。實際應用的開發模式、合成測試、設定保存與 Refresh、全螢幕按鈕已操作確認，Console 沒有錯誤。新 UI 的真人距離可讀性與實際 Webcam 動作仍待使用者確認。

## 2026-10-09 滿版視訊與小步跑修正

依使用者真人回饋改為單一滿版視訊舞台，全部動作文字與成果疊在舞台內；加寬有效框，預設顯示黃／藍節點與亮黃辨識框。沿用同一 CameraManager 與 PoseManager，沒有新增 Camera Engine，也沒有錄影或上傳影像。

本機 48 項自動測試通過。實際瀏覽器操作確認新版 UI、合成小步跑與其餘四招程式測試、預設節點開啟，Console 無錯誤。版型與繪圖採相同 TrackingOverlay 的合成節點測試頁，檢查亮黃／藍框、手腕越界、1366×768、1920×1080、1366×650、390×844；測試頁及圖片不發布，不能當真人辨識證明。真人小步跑的成功率與遠距可讀性仍需實際 Webcam 確認。
