最新版本 CHASE-21：非RUN成功後完成900ms角色／障礙動畫，立即顯示下一招灰色100ms後亮燈，不再補足六秒空檔。RUN預備與判讀不變；20招全局最多120秒，成功越早全局越短。

# Ninja Run v0.1 · 小忍者衝衝衝

目前版本 CHASE-19：Phase 4A 森林追逐。公開遊戲：https://katherineyang193.github.io/NinjaRun/?v=chase19

Windows 11 + Chrome / Edge + Webcam；GitHub Pages 純靜態網站。一般玩家不需安裝軟體。原創角色與森林怪獸，沒有 Boss、帳號或排行榜。

## 玩法

森林關使用最多120秒遊戲時鐘、20個事件，出題次數為左右閃40%／跳蹲40%／RUN20%；依動作完成時間銜接，實際區段時間另列於紀錄。相機站位檢查、玩家自己的左右校正、24幀站位平均、5秒個人RUN校正後出發。五種動作為 RUN、JUMP、CROUCH、DODGE_LEFT、DODGE_RIGHT；大型灰色預告在ACTIVE亮起，本機中文TTS播報。RUN仍需累積1秒有效跑動，主判讀2.8秒加0.4秒補判；不是提高動作門檻。

Score／Combo／活力值／星星沿用現有關卡。第24秒原創圓滾滾怪獸登場，正確跑動拉開距離，成功障礙有小幅獎勵，MISS讓怪獸靠近。被追上有1秒搞笑失衡與散星，最多扣5顆星、活力值5點、Combo歸零，距離恢復50，遊戲繼續。結尾怪獸停下，顯示「逃出來了！」。家長設定可關閉追逐（下局生效）、跳躍、動作音效與語音。64秒提示挑戰及自由練習保留。

鏡頭保留完整有效影像、不裁掉膝蓋；人體節點及中央十字預設顯示。正式森林關提示在右上、鏡頭在右下且使用原生比例。開發模式可查看動作原因、Pose／Render FPS、追逐距離、Catch及事件紀錄。所有紀錄只在本次頁面記憶體，不錄影、不保存或上傳影像／姿勢。

## 開發

純HTML／CSS／ES Modules，無runtime npm依賴或build step。Node.js24：

~~~sh
npm test
npm start
~~~

本機 http://localhost:4173，禁止直接雙擊HTML。Webcam使用localhost或HTTPS。沿用既有CuteDart Camera生命週期抽取模組；沒有取得CuteDash原始碼，不能宣稱直接沿用它的Pose Engine。

- src/camera、src/pose：CameraManager、MediaPipe Lite Worker優先與相容模式。
- src/motion：校正、座標映射、MotionDetector、RunRhythm；Phase4A沒有改動。
- src/game/ForestStage.js：同一遊戲時鐘控制提示、判定、障礙、分數與追逐。
- src/game/ChaseState.js：只讀既有動作結果，沒有新的體感引擎。
- src/ui/ForestView.js：原有Canvas30FPS森林／怪獸，與Pose loop分離。
- src/audio、src/settings：Web Audio、本機中文TTS及localStorage偏好。
- tests：不需Webcam的判定與追逐回歸測試。
- [Phase3現況](docs/PHASE3.md)、[Phase4A規則與驗收](docs/PHASE4A.md)。

## 部署與驗收

既有Repository katherineyang193/NinjaRun、main分支、GitHub Pages根目錄發布，保留.nojekyll與既有Motion checks。先npm test，再commit／push；不得force push。模型使用固定版本CDN，模型快取不進Git。

合成預覽：src/dev/forest-preview.html，清楚標示CAMERA OFF，支援追逐登場、Catch、全MISS與追逐OFF。自動測試不代表真人成功率；Easy與Normal的真人自然度、Camera／RUN校正、Pose FPS仍需使用者站在全身入鏡距離驗收。Phase4A交付後停止，不進入Boss。
