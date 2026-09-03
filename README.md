# 星際戰機 STARDRIFT

一個用純 HTML + CSS + JavaScript 寫嘅太空射擊小遊戲。冇框架、冇 build step、冇任何相依套件 —— 打開就玩得。

開發過程遇到嘅問題同解決方法,記錄喺 [DEVLOG.md](DEVLOG.md)（英文)。

## 試玩

直接 double-click `index.html`,或者去 GitHub Pages 版本。

## 操作

| 操作 | 按鍵 |
|---|---|
| 移動 | 方向鍵 或 WASD |
| 射擊 | 空白鍵（可長按） |
| 暫停 | P |
| 重新開始 | R |
| 切換語言 | L 或者撳開始畫面下面嘅按鈕 |

亦可以用滑鼠拖住玩 —— 撳住即自動開火。

## 內容

- 三種敵機：直衝、俯衝、會瞄準你射擊嘅炮台
- 每 5 波一隻 BOSS,有三種攻擊模式（追蹤三連發、圓形彈幕、掃射）
- 掉寶：黃色 P 加火力（最高 5 級）、藍色 S 加護盾、粉色 ♥ 加命
- 粒子爆炸、震屏、星空視差背景
- 最高分紀錄（存喺瀏覽器 localStorage）
- 三種語言：繁體中文 / 简体中文 / English

## 檔案結構

```
index.html        頁面外殼:一個 canvas + script 載入次序
css/style.css     canvas 擺位同外框
js/core.js        共用狀態（player / enemies / bullets…）同工具函數
js/i18n.js        三種語言嘅文字表
js/input.js       鍵盤同滑鼠狀態
js/entities.js    遊戲邏輯:波次、敵機、BOSS、子彈、碰撞、掉寶
js/render.js      全部繪圖:戰機、敵機、HUD、標題畫面
js/main.js        主迴圈:每幀 update(dt) → draw()
```

設計原則係**邏輯同畫面分離**:`entities.js` 只管「嘢喺邊、發生咩事」,`render.js` 只管「點樣畫出嚟」。改難度就開 `entities.js`,改畫風就開 `render.js`。

用普通 `<script>` 標籤而唔用 ES module,咁樣 `file://` 直接開都行(module 會被 CORS 擋住)。代價係載入次序有關係 —— `core.js` 一定要排第一。

## 授權

MIT
