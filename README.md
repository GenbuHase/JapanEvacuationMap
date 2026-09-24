# 避難情報マップ (JapanEvacuationMap)

[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Turf.js](https://img.shields.io/badge/Turf.js-Spatial%20Analysis-2ecc71)](https://turfjs.org/)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa&logoColor=white)](https://vite-pwa-org.netlify.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **「文字の壁」を突破する。テキストの避難指示を1秒で地図ポリゴンへ。**  
> 自治体の緊急速報メール（エリアメール）やLアラートの自然言語テキストを、端末側で空間情報へ逆引き変換し、ハザードマップと重畳判定する防災PWAプロトタイプ。

---

## ⚠️ 防災利用に関する免責事項・注意事項（Disclaimer）

本アプリケーションをご利用・検証される際は、以下の事項をご了承ください。

1. **研究・アイデア実証用プロトタイプ**:  
   本システムは、「文字形式の避難指示文を即座に地図ポリゴン化する」という防災DXの社会的意義を形として残すための研究・実証用プロトタイプです。完成された実用防災システムではありません。
2. **自動取得機能は未搭載**:  
   **現在の実装状況では、自治体のエリアメールやLアラート等の外部避難情報をリアルタイムに自動取得する機能は備えておりません。** ユーザーによるテキストの手動入力、または検証用プリセットシナリオによる動作となります。
3. **自治体・気象庁の公式発表の最優先**:  
   実際の災害時においては、必ず各自治体の防災無線、広報車、公式ウェブサイト、気象庁等の一次情報を最優先に確認し、速やかに命を守る避難行動をとってください。
4. **測位・解析結果の免責**:  
   スマートフォンのGPS測位誤差、通信障害、AI（Gemini API）およびローカルNLPエンジンによるテキスト解釈の誤認や不完全性等に起因する判断・損害について、開発者は一切の責任を負いません。

---

## 🌟 背景と解決する課題

### 「文字情報トラップ」による避難行動の遅れ
自治体が発令する避難指示は極めて重要ですが、その多くは**「○○地区、△△町周辺の急傾斜地崩壊危険箇所・土砂災害警戒区域等」という自然言語テキスト（文字情報）**で配信されます。

* **地理的迷子**: 土地鑑のない旅行者、出張者、外国人滞在者は、「自分が今いる場所が対象区域なのか」を文字から瞬時に判断することが困難です。
* **平地からの死角**: 平坦な繁華街に滞在していても、わずか数百メートル背後に崖地や土砂警戒区域が存在するケースがあり、文字情報だけでは危険の切迫度が直感できません。

本プロジェクトは、**「文字を読ませて考えさせる防災」から「一目で直感できる空間防災HUD」への転換**を検証するために開発されました。

---

## 🚀 主な機能・特徴

1. **高速テキスト構造化パイプライン (LLM & Local Fast NLP)**
   - 自治体の速報文から【自治体名・警戒レベル・災害種別・対象町丁・避難条件・推奨アクション】を自動抽出。
   - **Google Gemini 3.1 Flash-Lite API** 連携（設定画面でAPIキー設定可・ブラウザ内ローカル保存）。
   - **超高速ローカルルールベースNLP** 標準搭載（オフライン・APIキーなしでも即時完全動作）。

2. **国交省ハザードマップ・キキクル重畳マップエンジン**
   - **ESRI Dark Canvas / 地理院標準地図 / 淡色地図 / 航空写真 / OpenStreetMap** のワンタップ切り替え。
   - **国土交通省「重ねるハザードマップ」公式タイル**（洪水浸水想定区域、急傾斜地崩壊危険箇所、土石流警戒区域）をレイヤー重畳。
   - **気象庁キキクル危険度分布**（紫メッシュ）のシミュレーション描画。

3. **現在地内外判定（Turf.js Point-in-Polygon ＆ 最短離隔距離測定）**
   - 端末GPS（または地図クリック・ドラッグ指定）から緯度経度・標高を取得。
   - **直撃（赤点滅HUD）**: 危険ポリゴン内部にいる場合、即時垂直退避アラートを発令（Web Speech APIによる音声合成読み上げ対応）。
   - **近接警戒（黄HUD）**: 危険区域境界から設定距離（標準350m）以内の場合、最短距離ラインと離隔距離バッジを描画。
   - **区域外（緑HUD）**: 周囲警戒と安全確保の指針を表示。

4. **実録検証シナリオシミュレーター**
   - 台風災害を想定した各種避難指示シナリオ（土砂災害、内水氾濫、河川洪水等）をワンタップでシミュレート可能。
   - 代表的な検証地点（低地商店街、台地公園、ターミナル駅周辺等）の標高差・リスク変化を瞬時に検証可能。

5. **モバイルファースト ＆ PWA対応**
   - スマートフォン片手操作に最適化したボトムタブバー（危険マップ ⇄ 避難指示解析 ⇄ シミュレータ ⇄ 設定）。
   - Service Worker と Web App Manifest によるオフラインキャッシュ・ホーム画面追加対応。

---

## 🏛️ ディレクトリ構成

```text
JapanEvacuationMap/
├── index.html                   # エントリーHTML (PWA Meta・OGP・フォント)
├── package.json                 # プロジェクト定義 (Vue 3, Leaflet, Turf.js, Tailwind v4)
├── vite.config.js               # Vite設定 (Tailwind v4, VitePWA, GitHub Pages base)
├── public/                      # 静的アイコン・PWAアセット (SVG / PNG)
├── docs/                        # ドキュメント・仕様書・プロトタイプ
│   ├── evacuation_map_dx_spec.md
│   └── prototype/               # 初期HTMLプロトタイプ
└── src/
    ├── main.js                  # アプリケーション起動
    ├── App.vue                  # メイン画面 (NERV風HUD・タブ制御・状態管理)
    ├── style.css                # Tailwind CSS v4, Leaflet, アニメーション定義
    ├── components/
    │   ├── MapViewer.vue        # Leafletマップ（国交省タイル、GeoJSON、距離ライン、出典表示）
    │   ├── MapHUD.vue           # 緊急直撃/近接警戒 HUDバナー
    │   ├── NervBottomNav.vue    # ボトムタブナビゲーションバー
    │   ├── NervMapControls.vue  # マップ下部コントロール（シナリオ・レイヤー・現在地）
    │   ├── TextParserPanel.vue  # 避難指示テキスト入力・プリセット・LLM構造化カード
    │   ├── SimulatorPanel.vue   # 検証シナリオ・現在地切り替えシミュレーター
    │   └── SettingsPanel.vue    # API設定・近接警戒距離・免責事項・データ出典
    ├── services/
    │   ├── geminiParser.ts      # Gemini Flash-Lite API ＆ 高速ローカルNLPエンジン
    │   ├── geoService.ts        # Turf.js 幾何空間解析・地図レイヤー定義
    │   └── dynamicHazardService.ts # 動的ハザードポリゴン生成サービス
    └── data/
        ├── hazardPresets.js     # 検証シナリオGeoJSONポリゴン・プリセットデータ
        └── floodWardBoundaries.js # 浸水想定区域バウンダリデータ
```

---

## 💻 起動・開発手順

### 動作要件
* Node.js 18.0 以上
* npm 9.0 以上

```bash
# 依存パッケージのインストール
npm install

# ローカル開発サーバーの起動 (http://localhost:5173/)
npm run dev

# 本番ビルド (dist/ 出力)
npm run build

# ビルド成果物のプレビュー
npm run preview
```

---

## 🏛️ データ出典・ライセンス・謝辞

本アプリケーションで参照している空間データおよび地図タイルは、以下のオープンデータや仕様に基づいています。

* **[国土交通省 重ねるハザードマップ](https://disaportal.gsi.go.jp/)**: 洪水浸水想定区域、土砂災害警戒区域（急傾斜地・土石流）タイル
* **[国土地理院](https://maps.gsi.go.jp/development/ichiran.html)**: 地理院タイル（標準地図、淡色地図、航空オルソ写真）
* **[気象庁](https://www.jma.go.jp/bosai/risk/)**: 危険度分布（キキクル）仕様参考
* **[OpenStreetMap](https://www.openstreetmap.org/copyright)**: © OpenStreetMap contributors
* **[Esri](https://www.esri.com/)**: World Dark Gray Canvas Map
* **Google Gemini API**: 自然言語避難指示テキストの構造化解析

---

## 📄 ライセンス

本ソフトウェアは [MIT License](LICENSE) のもとで公開されています。
