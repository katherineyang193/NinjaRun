# Ninja Run v0.1 · 小忍者衝衝衝

第一階段：Camera / Pose / 左右校正 / 五種動作 / Motion Debug Playground。

公開遊戲：https://katherineyang193.github.io/NinjaRun/

使用 Windows 11 的 Chrome 或 Edge，允許相機，退後到頭、肩、髖與膝蓋入鏡。依序舉起自己的左手、放下雙手、舉起右手，站穩後倒數開始。箭頭代表玩家自己的左右。家長可關閉跳躍；鏡頭畫面不會儲存、錄影或上傳。

## 開發與測試

純靜態 HTML / CSS / ES Modules；沒有 runtime npm 依賴或 build step。開發者用 Node.js 24：

```sh
npm test
npm start
```

本機測試網址 `http://localhost:4173`。請勿直接雙擊 HTML：ES Modules 與相機需 HTTP localhost 或 HTTPS。一般玩家只需公開網址，不需安裝 Node 或其他軟體。

「開發模式」提供骨架、Pose / Render FPS、信心值、原始 Hip、站位平均、玩家座標、狀態機、RUN 強度及五種動作合成測試；合成測試不會增加玩家計數。

## 原始碼

- `src/camera/CameraManager.js`：從既有 CuteDart 的 requestCamera / stopCamera 抽出共用生命週期。
- `src/pose/`：MediaPipe Pose Lite、Worker 優先、GPU / CPU 與主執行緒相容模式。
- `src/motion/`：左右映射、兩手校正、24 幀站位平均、追蹤恢復與獨立動作狀態機。
- `src/audio/`、`src/settings/`：Web Audio 回饋與 localStorage。
- `src/ui/`、`src/app.js`：練習場與流程。
- `tests/`：不需 Webcam 的判定、校正、隱私與相機生命週期測試。
- [交付與驗收紀錄](./docs/DELIVERY.md)：架構、沿用來源、判定規則、測試結果、限制。
- [真人驗收步驟](./docs/ACCEPTANCE.md)：不同相機的公開版驗收。

## 部署

使用既有 `katherineyang193/NinjaRun` Repository 的 `main` 分支，GitHub Pages 從根目錄發佈；`.nojekyll` 保留靜態 ES Modules。GitHub Actions 跑動作測試。每次修改需先 `npm test`，再 commit / push。模型由固定版本 jsDelivr / Google 官方網址下載，不將模型快取提交到 Git。

Camera 與姿勢推論只在本機執行。網路用途是載入靜態檔、MediaPipe WASM 與模型。localStorage 只含家長設定、相機識別碼與方向偏好，不保存任何影像或每幀姿勢。

本階段不含森林關卡、Boss、排行榜或帳號；難度與音樂選項預留給後续關卡。未取得 CuteDash 原始碼，因此無法宣稱已直接沿用 CuteDash 的 Pose Engine。
