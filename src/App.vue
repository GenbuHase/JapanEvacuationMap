<template>
  <div class="h-[100dvh] w-screen flex flex-col overflow-hidden bg-black text-slate-100 select-none font-['Inter','Noto_Sans_JP',sans-serif]">
    <!-- トップバー (1行固定・改行防止) -->
    <header class="h-11 bg-black/95 border-b border-slate-900 px-3 sm:px-4 flex items-center justify-between z-30 shrink-0 select-none whitespace-nowrap overflow-hidden">
      <!-- 左側: タイトル -->
      <div class="flex items-center gap-2 shrink-0">
        <span class="text-xs sm:text-sm font-black tracking-wider text-slate-100 flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]"></span>
          <span>避難情報マップ</span>
        </span>
      </div>

      <!-- 右側: 現在地 ＆ 標高バッジ (クリックでフォーカス) -->
      <div class="flex items-center gap-1 sm:gap-2.5 text-xs font-mono shrink-0">
        <button
          @click="focusUserLocationFromHeader"
          class="flex items-center gap-1 sm:gap-1.5 text-[11px] text-slate-300 bg-slate-900/90 hover:bg-slate-800 active:bg-slate-700 px-2 sm:px-2.5 py-1 rounded-full border border-slate-800 hover:border-slate-700 transition cursor-pointer shrink-0"
          title="タップで現在地にフォーカス"
        >
          <span class="w-2 h-2 rounded-full shrink-0" :class="analysis.status === 'INSIDE' ? 'bg-rose-500 animate-ping' : 'bg-emerald-400'"></span>
          <span class="font-bold truncate max-w-[85px] xs:max-w-[120px] sm:max-w-[160px]">{{ currentLocationName }}</span>
          <span class="text-slate-600 shrink-0">|</span>
          <span class="text-cyan-400 font-bold shrink-0">{{ currentElevation }}m</span>
          <span class="text-[10px] text-cyan-400 shrink-0 ml-0.5" title="現在地にフォーカス">📍</span>
        </button>
      </div>
    </header>

    <!-- メインコンテンツ領域（タブに応じた全画面表示） -->
    <div class="flex-1 relative overflow-hidden">
      <!-- 1. マップ画面 (全画面NERVスタイル) -->
      <div
        v-show="currentTab === 'map'"
        class="w-full h-full absolute inset-0 z-10"
      >
        <MapViewer
          ref="mapViewerRef"
          :user-coords="userCoords"
          :current-location-name="currentLocationName"
          :elevation="currentElevation"
          :hazard-geo-json="hazardGeoJson"
          :analysis="analysis"
          :current-time="parsedData.effectiveTime"
          :current-preset-id="currentPresetId"
          :active-hazard-tab="activeHazardTab"
          :is-map-tab-active="currentTab === 'map'"
          @update-location="onLocationUpdated"
          @request-gps="onRequestGps"
          @select-scenario="onSelectPreset"
          @select-hazard-tab="onSelectHazardTab"
        >
          <template #hud>
            <MapHUD
              :title="currentScenarioHudTitle"
              :level="currentScenario.level"
              :time="parsedData.effectiveTime"
              :active-hazard-tab="activeHazardTab"
            />
          </template>
        </MapViewer>
      </div>

      <!-- 2. 避難指示・LLM構造化解析画面 -->
      <div
        v-show="currentTab === 'alerts'"
        class="w-full h-full absolute inset-0 z-10"
      >
        <TextParserPanel
          v-model:raw-text="rawText"
          :parsed-data="parsedData"
          :is-parsing="isParsing"
          @run-parse="onRunParse"
          @switch-to-map="currentTab = 'map'"
        />
      </div>

      <!-- 3. 台風25号実録検証 ＆ シミュレーション画面 -->
      <div
        v-show="currentTab === 'simulator'"
        class="w-full h-full absolute inset-0 z-10"
      >
        <SimulatorPanel
          :presets="SCENARIO_PRESETS"
          :preset-locations="PRESET_LOCATIONS"
          :current-preset-id="currentPresetId"
          :current-location-id="currentLocationId"
          :current-location-name="currentLocationName"
          :analysis="analysis"
          @select-preset="onSelectPreset"
          @select-location="onSelectLocation"
          @request-gps="onRequestGps"
          @switch-to-map="currentTab = 'map'"
        />
      </div>

      <!-- 4. 設定画面 -->
      <div
        v-show="currentTab === 'settings'"
        class="w-full h-full absolute inset-0 z-10"
      >
        <SettingsPanel
          v-model:api-key="settings.apiKey"
          v-model:model-name="settings.modelName"
          v-model:nearby-threshold="settings.nearbyThreshold"
          v-model:auto-speak="settings.autoSpeak"
        />
      </div>
    </div>

    <!-- NERV風 ボトムナビゲーションバー -->
    <NervBottomNav v-model="currentTab" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick, watch } from 'vue';
import MapViewer from './components/MapViewer.vue';
import MapHUD from './components/MapHUD.vue';
import TextParserPanel from './components/TextParserPanel.vue';
import SimulatorPanel from './components/SimulatorPanel.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import NervBottomNav from './components/NervBottomNav.vue';

import {
  PRESET_LOCATIONS,
  SCENARIO_PRESETS,
  FLOOD_HAZARD_GEOJSON,
  LANDSLIDE_HAZARD_GEOJSON,
  RIVER_FLOOD_HAZARD_GEOJSON,
  YOKOHAMA_SOUTH_KAMAKURA_LANDSLIDE_GEOJSON,
  YOKOHAMA_5WARDS_FLOOD_GEOJSON,
  KANAGAWA_WARD_FLOOD_GEOJSON,
  ATAMI_CITY_EVACUATION_GEOJSON,
  ITO_CITY_ELDERLY_GEOJSON
} from './data/hazardPresets';
import {
  parseEvacuationTextLocally,
  parseEvacuationTextWithGemini,
  sanitizeModelName,
  type ParsedEvacuationAlert
} from './services/geminiParser';
import {
  analyzeUserHazardSpatialIntersection,
  type SpatialAnalysisResult
} from './services/geoService';
import { generateDynamicHazardGeoJson } from './services/dynamicHazardService';

// MapViewer コンポーネント参照（fitToHazards 呼び出し用）
const mapViewerRef = ref<InstanceType<typeof MapViewer> | null>(null);

// 現在のアクティブタブ ('map' | 'alerts' | 'simulator' | 'settings')
const currentTab = ref<'map' | 'alerts' | 'simulator' | 'settings'>('map');

// マップ下部タブでの災害種別 ('flood' | 'landslide' | 'river' | 'rain')
const activeHazardTab = ref<'flood' | 'landslide' | 'river' | 'rain'>('landslide');

// 設定（旧世代モデルがキャッシュに残っていた場合は gemini-3.1-flash-lite へ自動マイグレーション）
const rawSavedModel = localStorage.getItem('evac_gemini_model');
const initialModelName = sanitizeModelName(rawSavedModel || 'gemini-3.1-flash-lite');
if (rawSavedModel !== initialModelName) {
  localStorage.setItem('evac_gemini_model', initialModelName);
}

const settings = reactive({
  apiKey: localStorage.getItem('evac_gemini_api_key') || '',
  modelName: initialModelName,
  nearbyThreshold: Number(localStorage.getItem('evac_nearby_threshold')) || 350,
  autoSpeak: localStorage.getItem('evac_auto_speak') === 'true'
});

// 設定の自動保存（変更された瞬間にローカルストレージへ即時永続化）
watch(
  settings,
  (newVal) => {
    const cleanModel = sanitizeModelName(newVal.modelName);
    localStorage.setItem('evac_gemini_api_key', newVal.apiKey.trim());
    localStorage.setItem('evac_gemini_model', cleanModel);
    localStorage.setItem('evac_nearby_threshold', String(newVal.nearbyThreshold));
    localStorage.setItem('evac_auto_speak', String(newVal.autoSpeak));
  },
  { deep: true }
);

// 現在地ステート（初期値: 横浜中華街・王府井酒家）
const userCoords = ref<[number, number]>([35.4428, 139.6453]);
const currentLocationId = ref('chinatown');
const currentLocationName = ref('横浜中華街（王府井酒家）');
const currentElevation = ref(2.3);

// 避難指示シナリオステート（初期値: 台風25号 11:44更新 気象台土砂災害危険警報）
const currentPresetId = ref('typhoon25_1144_kikidai');
const rawText = ref(SCENARIO_PRESETS[0].rawText);
const isParsing = ref(false);

// 解析結果データ
const parsedData = ref<ParsedEvacuationAlert>(
  parseEvacuationTextLocally(rawText.value)
);

// 表示中のGeoJSONポリゴン
const hazardGeoJson = ref<any>(YOKOHAMA_SOUTH_KAMAKURA_LANDSLIDE_GEOJSON);

// 空間解析結果（Point-in-Polygon & 最短距離計算）
const analysis = computed<SpatialAnalysisResult>(() => {
  return analyzeUserHazardSpatialIntersection(
    userCoords.value[0],
    userCoords.value[1],
    hazardGeoJson.value,
    settings.nearbyThreshold
  );
});

// 現在選択されているシナリオとHUD用タイトル
const currentScenario = computed(() => {
  return SCENARIO_PRESETS.find((s) => s.id === currentPresetId.value) || SCENARIO_PRESETS[0];
});

const currentScenarioHudTitle = computed(() => {
  if (currentPresetId.value === 'typhoon25_1144_kikidai') {
    return '土砂災害危険警報【発表市町村：横浜南部、鎌倉】';
  } else if (currentPresetId.value === 'typhoon25_1232_yamate') {
    return '横浜市【警戒レベル４】避難指示〔中区崖地6町丁〕';
  } else if (currentPresetId.value === 'typhoon25_1423_flood_5wards') {
    return '横浜市【警戒レベル４】避難指示〔5区浸水深50cm以上〕';
  } else if (currentPresetId.value === 'typhoon25_1502_flood_kanagawa') {
    return '横浜市【警戒レベル４】避難指示〔神奈川区浸水深50cm以上〕';
  } else if (currentPresetId.value === 'typhoon25_atami_evac') {
    return '熱海市【警戒レベル４】避難指示〔市内全域土砂危険警報〕';
  } else if (currentPresetId.value === 'typhoon25_ito_elderly') {
    return '伊東市【警戒レベル３】高齢者等避難〔市内全域土砂特別警戒区域〕';
  } else if (currentPresetId.value === 'typhoon25_all_combined') {
    return '広域避難情報重畳【ALL】避難指示(横浜/熱海)＋高齢者等避難(伊東)';
  }
  return parsedData.value.issuingAuthority
    ? `${parsedData.value.issuingAuthority}【警戒レベル${parsedData.value.alertLevel}】${parsedData.value.actionType || '避難指示'}`
    : '避難指示対象エリア';
});

// マップ下部ピルタブ（雨・土砂・洪水・浸水）の切り替えハンドラー
function onSelectHazardTab(tabId: string) {
  activeHazardTab.value = tabId as 'flood' | 'landslide' | 'river' | 'rain';

  if (tabId === 'landslide') {
    onSelectPreset('typhoon25_1144_kikidai', false);
  } else if (tabId === 'flood') {
    onSelectPreset('typhoon25_1423_flood_5wards', false);
  } else if (tabId === 'river') {
    onSelectPreset('typhoon25_1502_flood_kanagawa', false);
  } else if (tabId === 'rain') {
    // キキクル紫メッシュ中心の豪雨シナリオ（全種別重畳表示）
    hazardGeoJson.value = {
      type: 'FeatureCollection',
      features: [
        ...FLOOD_HAZARD_GEOJSON.features,
        ...LANDSLIDE_HAZARD_GEOJSON.features,
        ...RIVER_FLOOD_HAZARD_GEOJSON.features
      ]
    };
    // 現在地を当時の場所（横浜中華街 王府井酒家）に設定
    const chinatownLoc = PRESET_LOCATIONS.find((l) => l.id === 'chinatown');
    if (chinatownLoc) {
      currentLocationId.value = chinatownLoc.id;
      currentLocationName.value = chinatownLoc.name;
      currentElevation.value = chinatownLoc.elevation;
      userCoords.value = [...chinatownLoc.coords];
    }
  }

  // 描画後に対象ポリゴン全体へスムーズ自動ズームフィット
  nextTick(() => {
    mapViewerRef.value?.fitToHazards();
  });
}

// プリセットシナリオ選択ハンドラー
function onSelectPreset(presetId: string, updateTab = true) {
  currentPresetId.value = presetId;
  const scenario = SCENARIO_PRESETS.find((s) => s.id === presetId);
  if (!scenario) return;

  rawText.value = scenario.rawText;
  hazardGeoJson.value = scenario.expectedGeoJson;

  // 各電文シナリオ選択時、現在地を当時の場所へ自動設定
  if (presetId === 'typhoon25_ito_elderly') {
    // 伊東市シナリオ選択時は伊東市役所・大原武道場周辺に設定
    const itoLoc = PRESET_LOCATIONS.find((l) => l.id === 'ito_city_center');
    if (itoLoc) {
      currentLocationId.value = itoLoc.id;
      currentLocationName.value = itoLoc.name;
      currentElevation.value = itoLoc.elevation;
      userCoords.value = [...itoLoc.coords];
    }
  } else if (presetId === 'typhoon25_atami_evac') {
    // 熱海市シナリオ選択時は熱海市役所・第一小学校周辺に設定
    const atamiLoc = PRESET_LOCATIONS.find((l) => l.id === 'atami_city_center');
    if (atamiLoc) {
      currentLocationId.value = atamiLoc.id;
      currentLocationName.value = atamiLoc.name;
      currentElevation.value = atamiLoc.elevation;
      userCoords.value = [...atamiLoc.coords];
    }
  } else {
    // 横浜実録電文またはALL選択時は横浜中華街 王府井酒家に設定
    const chinatownLoc = PRESET_LOCATIONS.find((l) => l.id === 'chinatown');
    if (chinatownLoc) {
      currentLocationId.value = chinatownLoc.id;
      currentLocationName.value = chinatownLoc.name;
      currentElevation.value = chinatownLoc.elevation;
      userCoords.value = [...chinatownLoc.coords];
    }
  }

  // タブ更新フラグが立っている場合のみ activeHazardTab をシナリオ種別に合わせる
  if (updateTab) {
    if (scenario.disasterType === 'river') {
      activeHazardTab.value = 'river';
    } else if (scenario.disasterType === 'flood') {
      activeHazardTab.value = 'flood';
    } else if (scenario.disasterType === 'rain') {
      activeHazardTab.value = 'rain';
    } else {
      activeHazardTab.value = 'landslide';
    }
  }

  // ローカルNLPで即座に構造化
  parsedData.value = parseEvacuationTextLocally(scenario.rawText);

  // GeoJSONが空（熱海市など動的生成プリセット）の場合は即時動的生成
  if (!scenario.expectedGeoJson.features || scenario.expectedGeoJson.features.length === 0) {
    generateDynamicHazardGeoJson(parsedData.value).then((dynamicResult) => {
      hazardGeoJson.value = dynamicResult.geoJson;
      userCoords.value = [dynamicResult.center[0], dynamicResult.center[1]];
      currentLocationName.value = `${parsedData.value.issuingAuthority}（市内全域避難指示）`;
      nextTick(() => {
        mapViewerRef.value?.fitToHazards();
      });
    });
  }

  // 端末バイブレーション（対応機種）
  if (navigator.vibrate) {
    try {
      navigator.vibrate(scenario.level >= 4 ? [200, 100, 200] : 100);
    } catch (_) {}
  }

  // 自動ズームフィット
  nextTick(() => {
    mapViewerRef.value?.fitToHazards();
  });
}

// 代表地点選択ハンドラー
function onSelectLocation(loc: (typeof PRESET_LOCATIONS)[number]) {
  currentLocationId.value = loc.id;
  currentLocationName.value = loc.name;
  currentElevation.value = loc.elevation;
  userCoords.value = [...loc.coords];
}

// 地図クリック・マーカードラッグによる現在地更新
function onLocationUpdated(newCoords: [number, number]) {
  userCoords.value = newCoords;
  currentLocationId.value = 'custom';
  currentLocationName.value = `任意指定地点 (${newCoords[0].toFixed(4)}, ${newCoords[1].toFixed(4)})`;

  // 簡易標高推定
  if (newCoords[0] < 35.4410 && newCoords[1] > 139.6480) {
    currentElevation.value = 32.5; // 山手台地
  } else {
    currentElevation.value = 2.1; // 低地
  }
}

// GPS測位リクエスト
function onRequestGps() {
  if (!navigator.geolocation) {
    alert('お使いの端末・ブラウザはGPS測位に対応していません。');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      userCoords.value = [lat, lng];
      currentLocationId.value = 'gps';
      currentLocationName.value = '端末GPS取得位置';
      currentElevation.value = pos.coords.altitude ? Math.round(pos.coords.altitude * 10) / 10 : 3.0;
    },
    (err) => {
      console.warn('GPS error:', err);
      alert('GPS位置情報の取得に失敗しました。位置情報の利用許可を確認してください。');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// LLM解析実行（Gemini 3.1 Flash-Lite または ローカルNLP ＆ 動的ポリゴン生成）
async function onRunParse() {
  isParsing.value = true;
  try {
    const result = await parseEvacuationTextWithGemini(
      rawText.value,
      settings.apiKey,
      settings.modelName
    );
    parsedData.value = result;

    const cleanRaw = rawText.value;
    const isRealScenario =
      cleanRaw.includes('横浜南部') ||
      cleanRaw.includes('鎌倉') ||
      cleanRaw.includes('打越') ||
      cleanRaw.includes('山手町') ||
      cleanRaw.includes('本牧町') ||
      cleanRaw.includes('元町') ||
      cleanRaw.includes('根岸旭台') ||
      cleanRaw.includes('西区') ||
      cleanRaw.includes('神奈川区');

    if (isRealScenario) {
      // 実録電文の場合は、現在地を当時の場所（横浜中華街 王府井酒家）に自動設定
      const chinatownLoc = PRESET_LOCATIONS.find((l) => l.id === 'chinatown');
      if (chinatownLoc) {
        currentLocationId.value = chinatownLoc.id;
        currentLocationName.value = chinatownLoc.name;
        currentElevation.value = chinatownLoc.elevation;
        userCoords.value = [...chinatownLoc.coords];
      }
    }

    // 1. 【実録電文1】横浜地方気象台 土砂災害危険警報（横浜南部、鎌倉）
    if (
      (cleanRaw.includes('横浜南部') || cleanRaw.includes('鎌倉')) &&
      (cleanRaw.includes('土砂災害') || cleanRaw.includes('気象台'))
    ) {
      hazardGeoJson.value = YOKOHAMA_SOUTH_KAMAKURA_LANDSLIDE_GEOJSON;
      activeHazardTab.value = 'landslide';
    }
    // 2. 【実録電文2】横浜市中区 即時避難対象区域（打越、山手町、本牧町、本郷町、元町、根岸旭台）
    else if (
      cleanRaw.includes('中区') &&
      (cleanRaw.includes('打越') || cleanRaw.includes('山手町') || cleanRaw.includes('本牧町') || cleanRaw.includes('本郷町') || cleanRaw.includes('元町') || cleanRaw.includes('根岸旭台') || cleanRaw.includes('即時避難対象区域'))
    ) {
      hazardGeoJson.value = LANDSLIDE_HAZARD_GEOJSON;
      activeHazardTab.value = 'landslide';
    }
    // 3. 【実録電文3】横浜市 5区浸水（西区、中区、南区、磯子区、戸塚区 浸水深50cm以上）
    else if (
      (cleanRaw.includes('西区') || cleanRaw.includes('南区') || cleanRaw.includes('磯子区') || cleanRaw.includes('戸塚区')) &&
      (cleanRaw.includes('浸水') || cleanRaw.includes('大雨') || cleanRaw.includes('50cm'))
    ) {
      hazardGeoJson.value = YOKOHAMA_5WARDS_FLOOD_GEOJSON;
      activeHazardTab.value = 'flood';
    }
    // 4. 【実録電文4】横浜市 神奈川区浸水（浸水深50cm以上）
    else if (
      cleanRaw.includes('神奈川区') &&
      (cleanRaw.includes('浸水') || cleanRaw.includes('大雨') || cleanRaw.includes('50cm'))
    ) {
      hazardGeoJson.value = KANAGAWA_WARD_FLOOD_GEOJSON;
      activeHazardTab.value = 'flood';
    }
    // 5. その他の電文（LLMを用いた解釈の実例機能として動的描画パイプラインを実行）
    else {
      const dynamicResult = await generateDynamicHazardGeoJson(result);
      hazardGeoJson.value = dynamicResult.geoJson;
      if (result.disasterTypes.includes('river') || result.disasterTypes.includes('river_flood')) {
        activeHazardTab.value = 'river';
      } else if (result.disasterTypes.includes('landslide')) {
        activeHazardTab.value = 'landslide';
      } else {
        activeHazardTab.value = 'flood';
      }

      // ユーザーピンを中心近傍へ移動（シミュレーション用）
      userCoords.value = [dynamicResult.center[0], dynamicResult.center[1]];
      currentLocationName.value = result.isEntireArea
        ? `${result.issuingAuthority}（市内全域避難指示）`
        : `${result.issuingAuthority} ${result.targetDistricts[0] || '中心部'}`;
    }

    // 自動でマップタブへ切り替え、全画面で対象エリアを表示
    currentTab.value = 'map';

    nextTick(() => {
      mapViewerRef.value?.fitToHazards();
    });
  } finally {
    isParsing.value = false;
  }
}

// ヘッダーの現在地バッジクリック時のフォーカス処理
function focusUserLocationFromHeader() {
  if (currentTab.value !== 'map') {
    currentTab.value = 'map';
    nextTick(() => {
      mapViewerRef.value?.focusUserLocation();
    });
  } else {
    mapViewerRef.value?.focusUserLocation();
  }
}

onMounted(() => {
  onSelectPreset('typhoon25_1144_kikidai');
});
</script>
