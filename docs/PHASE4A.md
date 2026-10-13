# Phase 4A 森林追逐 · CHASE-19

## 範圍
沿用ForestStage與既有120秒時間軸，沒有第二Game Engine、Canvas或RAF loop。MotionDetector／RunRhythm／Camera／Pose／Calibration／左右mapping完全未改。無Boss。

## 規則
初始距離65（0～100），第24秒登場，2.5秒入場。僅RUN ACTIVE後的slot根據既有RUNNING緩慢增加距離；PREVIEW不要求跑。非RUN時段距離保持，不同時要求Jump或Dodge加跑步。RUN slot靜止緩慢減距離。

Easy：跑動每秒+3.2～3.5、停止-1、RUN成功+4、RUN MISS-8、障礙成功+3、MISS-6。
Normal：+3～3.3、停止-1.4、RUN成功+3.5、RUN MISS-9、障礙成功+2.5、MISS-7。
Hard：+2.8～3.1、停止-1.8、RUN成功+3、RUN MISS-10、障礙成功+2、MISS-8。
距離變化只根據現有結果，困難度不改姿勢門檻。低於40靠近、低於25危險：距離條黃色邊光，沒有紅屏或警報。視覺距離以300ms指數插值，遊戲暫停時不移動。

距離0：單次Catch，1秒CAUGHT動畫、星星散落、搞笑音效。最多扣5顆星不為負數、活力值-5不為負數、Combo歸零。恢復距離50，另1秒RECOVER保護。時間軸及有效動作判定繼續，不Game Over。結尾怪獸停下、忍者向前、「逃出來了！」保留在森林。追逐OFF不繪怪獸、不改原分數與時序。設定下局生效。

## 開發紀錄
Debug：chaseDistance／chaseState／catchCount／lastChaseDelta／chaseDanger／monsterX／playerX（畫布CSS像素）。本局記憶體報告：最低／最高距離、登場次數、Catch時間、RUN成功／障礙MISS距離delta。只顯示於Developer Mode；一般結果只顯示Catch次數。

## 驗證
113項npm test通過（97原有＋16追逐測試），包括clamp、一次Catch、恢復、不Game Over、ChaseOFF、暫停／追蹤遺失／設定共用pause、禁Jump及120秒完成。暫停測試驗證ForestStage.pause契約，不宣稱已以真人開啟設定視窗測試。
公開合成预覽可選登場、Catch、全MISS、OFF；不是Webcam驗收。Easy／Normal真人結果、真人Catch次數、PoseFPS及RenderFPS尚未取得，不能用上一版數據代填。

## 真人驗收
用Chrome／Edge開公開版本。Easy與Normal各玩一局，檢查CameraON、RUN校正、大箭頭、方向、24秒登場、距離變化、追逐自然度、結尾；結束打開Developer Mode複製報告。Catch可先看合成預覽，避免刻意站著造成真人運動不足。核對正常60～70%成功時Catch是否過頻，再調追逐數值，禁止動作門檻修改。

## 公開合成驗證紀錄
GitHub Pages已實際開啟CHASE-19：登場、Catch、全MISS120秒結尾、右上圖示及右下鏡頭位置預覽皆可載入，Console未見致命錯誤。全成功Easy／Normal各20/20（五種動作各4/4）、登場1次、Catch0次；70%合成各14/20、Catch0次；全MISS Easy Catch1次、Normal2次。合成預覽代表樣本Canvas約0.1～0.6ms，Scene约25～30FPS，受分頁節流／跳時操作影響，不能當真人FPS。真人Easy／Normal、相機與校正仍待實體驗收。

## CHASE-20 提示節奏
跳躍、蹲下、左右閃的正式灰色預備縮至100ms，RUN仍1450ms（最後1400ms），有效判定時間及RUN 400ms補判不變。前一招恢復期不再把下一招放大為灰色；仍保留小型動作隊列。單一ForestStage時鐘仍同步障礙、亮燈、語音與判定；120秒及40/40/20配置不變。左右閃仍須回到中央才啟動判定。所有體感門檻未改。
