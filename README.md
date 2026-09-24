# 避難指示リアルタイムマップ化DX (EvacuationMap DX)

[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Turf.js](https://img.shields.io/badge/Turf.js-Spatial%20Analysis-2ecc71)](https://turfjs.org/)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa&logoColor=white)](https://vite-pwa-org.netlify.app/)

> **「文字の壁」を突破する。テキストの避難指示を1秒で地図ポリゴンへ。**  
> 自治体のシステム改修を待たず、住民・旅行者のスマホ端末側で文字速報（エリアメール・Lアラート）を空間情報へ逆引き変換し、ハザードマップと重畳判定する防災PWAアプリケーション。

---

## 🌟 主な機能・特徴

1. **高速テキスト構造化パイプライン (LLM & Local Fast NLP)**
   - 自治体の緊急速報メール（エリアメール）やLアラートの自然言語文から【自治体名・警戒レベル・災害種別・対象町丁・避難条件・推奨アクション】を自動抽出。
   - **Google Gemini Flash API** 連携（設定画面でAPIキー設定可）。
   - **超高速ローカルルールベースNLP** を標準搭載（オフライン・APIキーなしでも即時完全動作）。

2. **国交省ハザードマップ・キキクル重畳マップエンジン**
   - **ESRI Dark Canvas / 地理院標準・淡色地図 / 航空写真 / OSM** のワンクリック切り替え。
   - **国土交通省「重ねるハザードマップ」タイル**（洪水浸水想定区域、急傾斜地崩壊危険箇所、土石流警戒区域）を重畳描画。
   - **気象庁キキクル危険度分布**（紫メッシュ）のシミュレーション描画。

3. **現在地内外判定（Turf.js Point-in-Polygon ＆ 最短距離測定）**
   - 端末GPS（または地図クリック・ドラッグによる任意指定）から緯度経度・標高を取得。
   - 危険ポリゴン内部にいる場合：**「🚨 避難指示対象エリア直撃・即時垂直退避」**の緊急HUD警報（赤色点滅、音声合成読み上げ対応）。
   - 危険区域境界から350m以内の場合：**「⚠️ 近接警戒」**（最短距離ライン＆離隔距離バッジを自動描画）。
   - 区域外の場合：**「ℹ️ 避難指示区域外」**（安全確認＆周囲警戒案内）。

4. **台風25号実録検証プリセット**
   - **12:32 土砂災害避難指示（山手町・元町崖地）**: 中華街滞在時、背後約300mの崖地崩壊警戒区域を検知するシナリオ。
   - **14:23 内水氾濫避難指示（中区低地帯 浸水想定深0.5m以上）**: 時間降雨52mmによる下水管渠満管・道路冠水直撃シナリオ。
   - **現在地ワンタップ移動シミュレーター**: 中華街（標高2.3m）、元町商店街（標高3.1m）、港の見える丘公園（標高36.8m）、横浜駅西口（標高1.8m）を瞬時に行き来して検証可能。

5. **モバイルファースト ＆ PWA対応**
   - スマートフォン画面に最適化されたボトムタブバー（危険マップ ⇄ 避難指示・LLM解析）。
   - オフラインキャッシュおよびホーム画面追加対応（Service Worker / Web App Manifest完備）。

---

## 🚀 起動・開発手順

```bash
# ディレクトリ移動
cd evacuation-map-dx

# 依存パッケージインストール（初回のみ）
npm install

# 開発サーバー起動 (Local: http://localhost:5173/)
npm run dev

# 本番ビルド＆PWAアセット生成
npm run build

# 本番プレビュー
npm run preview
```

---

## 🏛️ ディレクトリ構成

```text
evacuation-map-dx/
├── index.html                   # エントリーHTML (PWA Meta・フォント設定)
├── package.json                 # 依存定義 (Vue 3, Leaflet, Turf.js, Tailwind v4, PWA)
├── vite.config.js               # Vite設定 (Tailwind v4 プラグイン, VitePWA)
├── public/                      # 静的アイコン・ファビコン
└── src/
    ├── main.js                  # アプリケーション初期化
    ├── App.vue                  # メインコンポーネント (状態管理・レイアウト制御)
    ├── style.css                # Tailwind CSS v4, Leaflet, パルスアニメーション定義
    ├── components/
    │   ├── AppHeader.vue        # トップナビゲーション（現在地・標高・設定）
    │   ├── MapHUD.vue           # 緊急直撃/近接警戒 HUDバナー（音声警告付き）
    │   ├── MapViewer.vue        # Leafletマップ（国交省タイル、GeoJSON、距離ライン）
    │   ├── TextParserPanel.vue  # テキスト入力・プリセット・LLM構造化カード
    │   └── SettingsModal.vue    # Gemini APIキー設定・近接警戒距離スライダー
    ├── services/
    │   ├── geminiParser.ts      # Gemini Flash API ＆ ローカルNLPパーサー
    │   └── geoService.ts        # Turf.js 幾何解析・国交省/ベースタイル定義
    └── data/
        └── hazardPresets.ts     # 台風25号GeoJSONポリゴン・プリセットシナリオ
```
