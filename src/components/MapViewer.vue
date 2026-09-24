<template>
  <div class="relative w-full h-full bg-black overflow-hidden select-none">
    <!-- 地図コンテナ (全画面) -->
    <div ref="mapContainer" class="w-full h-full z-10"></div>

    <!-- 上部 NERV風 ミニマルヘッダー ＆ 凡例 (画像に完全一致) -->
    <div class="absolute top-2 left-0 right-0 z-20 pointer-events-none flex justify-center">
      <slot name="hud" />
    </div>

    <!-- 下部 NERV風 マップコントロールバー (時刻・災害種別・レイヤー・現在地) -->
    <div class="absolute bottom-2 left-0 right-0 z-20 pointer-events-none flex justify-center">
      <slot name="bottom-controls">
        <NervMapControls
          :time="currentTime"
          :current-preset-id="currentPresetId"
          :is-inside="analysis.status === 'INSIDE'"
          @select-scenario="$emit('select-scenario', $event)"
          @toggle-layer-panel="showLayerPanel = !showLayerPanel"
        />
      </slot>
    </div>

    <!-- 洪水浸水想定区域（浸水深）インライン公式凡例 -->
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="layersVisible.mlitFlood && isFloodActive"
        class="absolute bottom-16 left-3 z-20 bg-black/90 backdrop-blur-md border border-neutral-800 rounded-lg px-2.5 py-1.5 shadow-2xl text-[10px] text-slate-200 pointer-events-auto max-w-[calc(100vw-24px)]"
      >
        <div class="font-bold text-cyan-300 text-[10px] flex items-center justify-between gap-2 mb-1">
          <span class="flex items-center gap-1">
            <span>🌊</span>
            <span>国交省 洪水浸水想定区域（浸水深）</span>
          </span>
          <span class="text-[9px] text-purple-300 bg-purple-950/90 px-1.5 py-0.5 rounded border border-purple-700/80 font-bold">50cm以上 避難指示</span>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <div v-for="item in FLOOD_DEPTH_LEGEND" :key="item.range" class="flex items-center gap-1">
            <span class="w-2.5 h-2.5 rounded-sm border" :style="{ backgroundColor: item.color, borderColor: item.border }"></span>
            <span :class="item.alert ? 'font-bold text-slate-100' : 'text-slate-400'">{{ item.range }}</span>
            <span v-if="item.alert" class="text-[8px] text-purple-400 font-mono">Lv.4</span>
          </div>
        </div>
      </div>
    </transition>

    <!-- 気象庁キキクル実演比較中バナー（タップでOFF） -->
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="layersVisible.kikikuruMesh"
        class="absolute top-16 left-1/2 -translate-x-1/2 z-20 backdrop-blur-md border rounded-full px-3 py-1 shadow-2xl text-[11px] pointer-events-auto flex items-center gap-2 max-w-[92vw]"
        :class="kikikuruStatusInfo.hasData ? 'bg-purple-950/90 border-purple-500/80 text-purple-200' : 'bg-slate-900/90 border-slate-700 text-slate-300'"
      >
        <span
          class="inline-block w-2 h-2 rounded-full flex-shrink-0"
          :class="kikikuruStatusInfo.hasData ? 'bg-purple-400 animate-ping' : 'bg-slate-500'"
        ></span>
        <span class="font-bold truncate">{{ kikikuruStatusInfo.label }}</span>
        <button
          @click="layersVisible.kikikuruMesh = false; toggleKikikuruLayer()"
          class="ml-1 text-slate-400 hover:text-white text-xs px-1 rounded hover:bg-white/10 flex-shrink-0"
          title="キキクル表示を消す"
        >
          ✕
        </button>
      </div>
    </transition>

    <!-- レイヤー切替＆凡例ドロワー（右下） -->
    <div
      v-if="showLayerPanel"
      class="absolute bottom-16 right-4 z-30 w-72 bg-black/95 backdrop-blur-md border border-neutral-800 rounded-xl p-3.5 shadow-2xl text-xs text-slate-200 pointer-events-auto transition-all animate-in fade-in slide-in-from-bottom-2"
    >
      <div class="flex items-center justify-between border-b border-neutral-800 pb-2 mb-2.5">
        <span class="font-extrabold flex items-center gap-1.5 text-cyan-400">
          <span>🗺️ 地図レイヤー ＆ 凡例</span>
        </span>
        <button @click="showLayerPanel = false" class="text-slate-400 hover:text-white text-base">✕</button>
      </div>

      <!-- ベースマップ選択 -->
      <div class="mb-3">
        <label class="block text-[11px] font-bold text-slate-400 mb-1">ベースマップ</label>
        <select
          v-model="selectedBaseMapKey"
          @change="updateBaseMap"
          class="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
        >
          <option value="esriDark">ESRI Dark Gray（ダーク）</option>
          <option value="gsiPale">国土地理院 淡色地図</option>
          <option value="gsiStandard">国土地理院 標準地図</option>
          <option value="gsiPhoto">国土地理院 航空オルソ写真</option>
          <option value="osm">OpenStreetMap（標準カラー）</option>
        </select>
      </div>

      <!-- 重ねるハザードマップ（国交省）タイル -->
      <div class="mb-3 space-y-1.5">
        <label class="block text-[11px] font-bold text-slate-400 mb-1">国交省 重ねるハザードマップ</label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" v-model="layersVisible.mlitFlood" @change="toggleMlitLayers" class="rounded bg-neutral-800 border-neutral-600 text-rose-500 focus:ring-0" />
          <span class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded bg-rose-500/70 border border-rose-400 inline-block"></span>
            <span>洪水浸水想定区域（浸水深）</span>
          </span>
        </label>
        <!-- 浸水深の内訳パレット -->
        <div v-if="layersVisible.mlitFlood" class="pl-5 pt-0.5 pb-1 grid grid-cols-2 gap-1 text-[9px] text-slate-300 bg-neutral-900/60 p-1.5 rounded border border-neutral-800">
          <div v-for="item in FLOOD_DEPTH_LEGEND" :key="item.range" class="flex items-center gap-1">
            <span class="w-2 h-2 rounded-sm border shrink-0" :style="{ backgroundColor: item.color, borderColor: item.border }"></span>
            <span>{{ item.range }}: {{ item.depth }}</span>
          </div>
        </div>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" v-model="layersVisible.mlitSlope" @change="toggleMlitLayers" class="rounded bg-neutral-800 border-neutral-600 text-amber-500 focus:ring-0" />
          <span class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded bg-amber-500/70 border border-amber-400 inline-block"></span>
            <span>急傾斜地崩壊危険区域</span>
          </span>
        </label>
      </div>

      <!-- 避難指示ベクターポリゴン＆キキクル -->
      <div class="space-y-1.5 border-t border-neutral-800 pt-2">
        <label class="block text-[11px] font-bold text-slate-400 mb-1">動的ハザード＆キキクル</label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" v-model="layersVisible.hazardPolygons" @change="toggleVectorHazardLayer" class="rounded bg-neutral-800 border-neutral-600 text-cyan-400 focus:ring-0" />
          <span class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded bg-rose-600 border border-white inline-block"></span>
            <span>避難指示対象エリア（危険区域）</span>
          </span>
        </label>
        <div class="space-y-1">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" v-model="layersVisible.kikikuruMesh" @change="toggleKikikuruLayer" class="rounded bg-neutral-800 border-neutral-600 text-purple-500 focus:ring-0" />
            <span class="flex items-center gap-1.5">
              <span class="w-3 h-3 rounded bg-purple-600/50 border border-purple-400 inline-block"></span>
              <span class="text-xs font-bold text-purple-200">気象庁キキクル危険度（参考・実演比較）</span>
            </span>
          </label>
          <div class="text-[10px] text-slate-400 pl-5 leading-tight">
            ※実録スクショが存在する12:32土砂・14:23浸水のみ1マス単位で厳密再現。他の時間帯は客観的証拠に乏しいため非表示です。
          </div>
        </div>

      </div>

      <!-- 現在地・全体表示 ＆ GPS再測位ショートカット -->
      <div class="mt-3 pt-2.5 border-t border-neutral-800 grid grid-cols-3 gap-1.5">
        <button
          @click="focusUserLocation"
          class="py-1.5 bg-neutral-900 hover:bg-neutral-800 text-cyan-300 border border-neutral-700/80 rounded-lg text-center font-bold text-[11px] flex items-center justify-center gap-1 shadow transition"
          title="現在地にフォーカス"
        >
          <span>🎯 現在地</span>
        </button>
        <button
          @click="fitToHazards"
          class="py-1.5 bg-neutral-900 hover:bg-neutral-800 text-slate-200 border border-neutral-700/80 rounded-lg text-center font-bold text-[11px] flex items-center justify-center gap-1 shadow transition"
          title="危険エリア全体を表示"
        >
          <span>🔍 全体</span>
        </button>
        <button
          @click="$emit('request-gps')"
          class="py-1.5 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 rounded-lg text-center font-bold text-[11px] flex items-center justify-center gap-1 shadow transition"
          title="GPS再測位"
        >
          <span>📡 GPS</span>
        </button>
      </div>

      <!-- データ出典注記 -->
      <div class="mt-2.5 pt-2 border-t border-neutral-800 text-[10px] text-slate-400 flex items-center justify-between">
        <span class="text-slate-400">データ出典: 地理院 / 国交省 / Esri / OSM</span>
      </div>
    </div>

    <!-- 地図出典・アトリビューション表示 (NERV HUD調・利用規約準拠) -->
    <div class="absolute bottom-1 right-1.5 z-20 pointer-events-auto text-[9px] text-slate-400/90 bg-black/75 backdrop-blur-xs px-1.5 py-0.5 rounded border border-neutral-800/80 tracking-tight select-none">
      <span>出典: 国土地理院 / 国交省 / Esri / &copy; OSM</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed, watch, reactive, nextTick } from 'vue';
import L from 'leaflet';
import NervMapControls from './NervMapControls.vue';
import {
  BASE_MAP_LAYERS,
  MLIT_HAZARD_TILE_LAYERS,
  FLOOD_DEPTH_LEGEND,
  type SpatialAnalysisResult
} from '../services/geoService';
import { getKikikuruMeshForScenario } from '../data/hazardPresets';

const props = withDefaults(
  defineProps<{
    userCoords: [number, number]; // [lat, lng]
    currentLocationName: string;
    elevation: number;
    hazardGeoJson: any;
    analysis: SpatialAnalysisResult;
    currentTime?: string;
    currentPresetId?: string;
    activeHazardTab?: string;
    isMapTabActive?: boolean;
  }>(),
  {
    currentTime: '14:23',
    currentPresetId: 'typhoon25_1144_kikidai',
    activeHazardTab: 'flood',
    isMapTabActive: true
  }
);

const emit = defineEmits<{
  (e: 'update-location', coords: [number, number]): void;
  (e: 'request-gps'): void;
  (e: 'select-scenario', id: string): void;
  (e: 'select-hazard-tab', id: string): void;
}>();

const mapContainer = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let currentBaseLayer: L.TileLayer | null = null;
let userMarker: L.Marker | null = null;
let hazardLayerGroup: L.LayerGroup | null = null;
let mlitFloodLayer: L.TileLayer | null = null;
let mlitSlopeLayer: L.TileLayer | null = null;
let kikikuruLayerGroup: L.LayerGroup | null = null;
let selectedHazardLayer: L.Path | null = null;
let originalHazardStyle: any = null;

function resetHazardHighlight() {
  if (selectedHazardLayer && originalHazardStyle) {
    try {
      selectedHazardLayer.setStyle(originalHazardStyle);
    } catch (err) {
      console.warn('Failed to reset hazard style', err);
    }
    selectedHazardLayer = null;
    originalHazardStyle = null;
  }
}

const showLayerPanel = ref(false);
const selectedBaseMapKey = ref<keyof typeof BASE_MAP_LAYERS>('esriDark');

const layersVisible = reactive({
  mlitFlood: true,
  mlitSlope: false,
  hazardPolygons: true,
  kikikuruMesh: false // 案B: 実演比較用の参考レイヤーとして初期値OFF
});

// 現在のシナリオやタブが洪水に関連しているかの判定
const isFloodActive = computed(() => {
  const p = props.currentPresetId || '';
  const t = props.activeHazardTab || '';
  return p.includes('flood') || t === 'flood' || t === 'river' || p === 'typhoon25_all_combined';
});

// キキクル比較バナーの表示情報（12:32と14:23の実録スクショ厳密連動）
const kikikuruStatusInfo = computed(() => {
  const p = props.currentPresetId || '';
  if (p === 'typhoon25_1232_yamate') {
    return {
      hasData: true,
      label: '📡 実録スクショ完全一致：キキクル土砂（12:40実況・169セル重畳中）',
      hint: 'スクショの通り、山手崖地＝赤、平地中華街＝黄、戸塚栄＝紫を完全再現'
    };
  }
  if (p === 'typhoon25_1423_flood_5wards') {
    return {
      hasData: true,
      label: '📡 実録スクショ完全一致：キキクル浸水（14:10実況・133セル重畳中）',
      hint: 'スクショの通り、低地＝紫直撃、周囲＝赤を完全再現'
    };
  }
  return {
    hasData: false,
    label: '📡 当時スクショなし（推測を排して非表示中）',
    hint: '客観的証拠スクショが残る12:32土砂・14:23浸水で比較可能です'
  };
});

// シナリオに応じたMLITハザードレイヤーの自動最適化連動
function syncHazardLayersForScenario() {
  const preset = props.currentPresetId || '';
  const tab = props.activeHazardTab || '';

  const isAll = preset === 'typhoon25_all_combined';
  const isFlood = preset.includes('flood') || tab === 'flood' || tab === 'river';
  const isLandslide = preset.includes('yamate') || preset.includes('kikidai') || preset.includes('atami') || preset.includes('ito') || tab === 'landslide';

  if (isAll) {
    layersVisible.mlitFlood = true;
    layersVisible.mlitSlope = true;
  } else if (isFlood) {
    // 洪水シナリオ時は、洪水浸水想定区域タイルをONにし、土砂災害急傾斜地メッシュをOFFにしてクリアにする
    layersVisible.mlitFlood = true;
    layersVisible.mlitSlope = false;
  } else if (isLandslide) {
    // 土砂災害シナリオ時は、急傾斜地警戒区域をONにし、洪水タイルはOFFにする
    layersVisible.mlitFlood = false;
    layersVisible.mlitSlope = true;
  }

  toggleMlitLayers();
}

onMounted(() => {
  initMap();
});

function initMap() {
  if (!mapContainer.value) return;

  // Leaflet初期化 (NERV風全画面マップ)
  map = L.map(mapContainer.value, {
    zoomControl: false,
    attributionControl: false
  }).setView(props.userCoords, 14);

  // 国交省ハザードマップタイル専用ペイン (zIndex 300: ベースマップ(200)の上、ベクターポリゴン(400)の下)
  map.createPane('hazardTilePane');
  const hazardPane = map.getPane('hazardTilePane');
  if (hazardPane) {
    hazardPane.style.zIndex = '300';
    hazardPane.style.pointerEvents = 'none';
  }

  // 避難指示対象エリア（危険区域ベクターポリゴン）専用ペイン (zIndex 350: 国交省タイルの上、キキクルの下)
  map.createPane('hazardVectorPane');
  const hazardVectorPane = map.getPane('hazardVectorPane');
  if (hazardVectorPane) {
    hazardVectorPane.style.zIndex = '350';
  }

  // キキクル1kmメッシュ専用ペイン (zIndex 450: 避難指示想定区の上・最前面。表示ON時にメッシュを直接タップ可能)
  map.createPane('kikikuruPane');
  const kikikuruPane = map.getPane('kikikuruPane');
  if (kikikuruPane) {
    kikikuruPane.style.zIndex = '450';
  }

  updateBaseMap();

  // レイヤーグループ追加順序: 避難指示想定区を下層、キキクルを上層（前面）に配置
  hazardLayerGroup = L.layerGroup().addTo(map);
  kikikuruLayerGroup = L.layerGroup().addTo(map);

  mlitFloodLayer = L.tileLayer(
    MLIT_HAZARD_TILE_LAYERS.flood.url,
    {
      ...MLIT_HAZARD_TILE_LAYERS.flood.options,
      pane: 'hazardTilePane'
    }
  );
  mlitSlopeLayer = L.tileLayer(
    MLIT_HAZARD_TILE_LAYERS.steepSlope.url,
    {
      ...MLIT_HAZARD_TILE_LAYERS.steepSlope.options,
      pane: 'hazardTilePane'
    }
  );

  // シナリオに応じたレイヤー状態を初期適用
  syncHazardLayersForScenario();

  map.on('popupclose', () => {
    resetHazardHighlight();
  });

  initUserMarker();
  renderKikikuru();
  renderHazardPolygons();

  // 初回に対象エリア全体を綺麗に画面内にフィット
  setTimeout(() => {
    fitToHazards();
  }, 400);
}

function updateBaseMap() {
  if (!map) return;
  if (currentBaseLayer) {
    map.removeLayer(currentBaseLayer);
  }
  const baseConfig = BASE_MAP_LAYERS[selectedBaseMapKey.value];
  currentBaseLayer = L.tileLayer(baseConfig.url, {
    ...baseConfig.options
  }).addTo(map);
  currentBaseLayer.bringToBack();
}

function initUserMarker() {
  if (!map) return;

  const userIcon = L.divIcon({
    className: 'user-pulse-container',
    html: '<div class="user-pulse-marker cursor-pointer" title="現在地（クリックで情報表示）"></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  // 現在地ピンは当時の場所に固定（誤操作・誤移動を防止）
  userMarker = L.marker(props.userCoords, {
    icon: userIcon,
    draggable: false
  }).addTo(map);

  userMarker.on('click', (e) => {
    L.DomEvent.stopPropagation(e);
    openUserPopup();
  });
}

function openUserPopup() {
  if (!map || !userMarker) return;
  const isDanger = props.analysis.status === 'INSIDE';
  const isNearby = props.analysis.status === 'NEARBY';

  const badgeColor = isDanger ? '#ef4444' : isNearby ? '#f59e0b' : '#10b981';
  const badgeLabel = isDanger ? '避難指示直撃' : isNearby ? '近接警戒' : '区域外';

  const popupHtml = `
    <div style="padding: 6px 10px; font-size: 12px; font-weight: bold; color: #fff; line-height: 1.3;">
      <div style="display: flex; align-items: center; gap: 6px; font-size: 13px;">
        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${badgeColor};"></span>
        <span>${badgeLabel}</span>
      </div>
      <div style="font-size: 11px; color: #e2e8f0; margin-top: 3px;">📍 ${props.currentLocationName}</div>
      <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">
        標高 ${props.elevation}m | ${props.analysis.status === 'INSIDE' ? '危険エリア内（直撃）' : '危険エリアまで ' + props.analysis.distanceToNearestMeters + 'm'}
      </div>
    </div>
  `;

  L.popup({
    className: 'nerv-popup',
    offset: [0, -10],
    closeButton: false
  })
    .setLatLng(props.userCoords)
    .setContent(popupHtml)
    .openOn(map);
}

// 危険区域ベクターポリゴンを描画＆クリック時NERV吹き出しポップアップ提示
function renderHazardPolygons() {
  if (map) map.closePopup();
  resetHazardHighlight();
  if (!hazardLayerGroup || !props.hazardGeoJson) return;
  hazardLayerGroup.clearLayers();

  if (!layersVisible.hazardPolygons) return;

  // 広域メッシュ(kikikuru/isBroadMesh)は奥(下層)、具体的な個別警戒区域は手前(上層)にソート
  const rawFeatures = props.hazardGeoJson.features || [];
  const sortedFeatures = [...rawFeatures].sort((a: any, b: any) => {
    const aIsBroad = a?.properties?.hazardType === 'kikikuru' || a?.properties?.isBroadMesh;
    const bIsBroad = b?.properties?.hazardType === 'kikikuru' || b?.properties?.isBroadMesh;
    if (aIsBroad && !bIsBroad) return -1;
    if (!aIsBroad && bIsBroad) return 1;
    return 0;
  });

  const geoJsonData = {
    ...props.hazardGeoJson,
    features: sortedFeatures
  };

  L.geoJSON(geoJsonData, {
    pane: 'hazardVectorPane',
    style: (feature) => {
      const dangerLevel = feature?.properties?.dangerLevel || 4;
      const hType = feature?.properties?.hazardType;
      const isLandslide = hType === 'landslide';
      const isKikikuru = hType === 'kikikuru';

      // 内閣府 避難情報ガイドラインに基づく警戒レベル配色
      let levelColor = '#a855f7';
      let levelFill = '#7c3aed';

      if (dangerLevel === 5) {
        levelColor = '#000000';
        levelFill = '#171717';
      } else if (dangerLevel === 3) {
        levelColor = '#ef4444';
        levelFill = '#dc2626';
      } else {
        levelColor = '#a855f7';
        levelFill = '#7c3aed';
      }

      const isWardBoundary = feature?.properties?.isWardBoundary || (!isLandslide && !isKikikuru && hType === 'flood');
      const finalColor = feature?.properties?.color || levelColor;
      const finalFill = feature?.properties?.fillColor || levelFill;

      return {
        color: finalColor,
        weight: isWardBoundary ? 2.2 : (isLandslide ? 2.8 : 3),
        fillColor: finalFill,
        fillOpacity: isWardBoundary ? (feature?.properties?.fillOpacity || 0.08) : (isKikikuru ? 0.18 : (feature?.properties?.fillOpacity || 0.48)),
        dashArray: isWardBoundary ? '6, 6' : (isLandslide ? '5, 5' : undefined),
        className: isWardBoundary ? 'danger-polygon-ward-boundary' : (isLandslide ? 'danger-polygon-landslide' : 'danger-polygon-flood')
      };
    },
    pointToLayer: (feature, latlng) => {
      if (feature?.properties?.type === 'shelter') {
        const shelterIcon = L.divIcon({
          className: 'shelter-marker-icon',
          html: `
            <div style="background: rgba(6, 78, 59, 0.95); color: #34d399; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 800; border: 1.5px solid #10b981; box-shadow: 0 0 12px rgba(16, 185, 129, 0.6); display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; transform: translate(-50%, -50%); cursor: pointer;">
              <span style="font-size: 12px;">🏫</span>
              <span>${feature.properties.name || '避難所'}</span>
            </div>
          `,
          iconSize: [0, 0]
        });
        return L.marker(latlng, { icon: shelterIcon });
      }
      return L.circleMarker(latlng, { radius: 6 });
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties || {};
      const hType = p.hazardType;
      const isLandslide = hType === 'landslide';
      const isKikikuru = hType === 'kikikuru' || p.isBroadMesh;
      const isWardBoundary = p.isWardBoundary || (!isLandslide && !isKikikuru && hType === 'flood');

      // 広域メッシュは確実に最背面に配置
      if (isKikikuru) {
        (layer as any).bringToBack?.();
      }

      // エリアまたは避難所押下（タップ/クリック）でNERV吹き出しポップアップを提示
      layer.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        if (!map) return;

        if (p.type === 'shelter') {
          const shelterPopupHtml = `
            <div style="padding: 8px 12px; font-size: 12px; font-weight: bold; color: #fff; line-height: 1.35; min-width: 220px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px;">
                <span style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;">
                  <span>🏫</span> 開設中避難所（安全施設）
                </span>
                <span style="font-size: 10px; color: #10b981; font-family: monospace; font-weight: 800;">OPEN</span>
              </div>
              <div style="font-size: 13.5px; font-weight: 900; color: #ffffff; letter-spacing: 0.02em;">${p.name}</div>
              ${p.address ? `<div style="font-size: 10.5px; color: #94a3b8; margin-top: 3px; font-family: monospace;">${p.address}</div>` : ''}
              <div style="font-size: 10px; color: #cbd5e1; margin-top: 5px; padding: 4px 6px; background: rgba(16, 185, 129, 0.1); border-radius: 4px;">
                電文抽出：避難可能施設（収容目安: ${p.capacity || '約150〜300'}人）
              </div>
            </div>
          `;
          L.popup({
            className: 'nerv-popup',
            offset: [0, -10],
            closeButton: false
          })
            .setLatLng(e.latlng)
            .setContent(shelterPopupHtml)
            .openOn(map);
          return;
        }

        // 既存のハイライトをリセット
        resetHazardHighlight();

        const dangerLevel = p.dangerLevel || 4;
        const isLevel4 = dangerLevel >= 4;

        let popupHtml = '';

        if (isKikikuru) {
          // 【A. 広域気象警報メッシュをクリックした時の挙動】
          popupHtml = `
            <div style="padding: 8px 12px; font-size: 12px; line-height: 1.4; color: #fff; min-width: 250px; max-width: 310px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <span style="background: rgba(168, 85, 247, 0.25); color: #d8b4fe; border: 1px solid rgba(168, 85, 247, 0.5); font-weight: 800; font-size: 10px; padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;">
                  <span>🌐</span> 広域気象警報メッシュ
                </span>
                <span style="color: #c084fc; font-size: 10px; font-weight: 800; font-family: monospace;">Lv.4相当（極めて危険）</span>
              </div>
              <div style="font-size: 13px; font-weight: 900; color: #f8fafc; letter-spacing: 0.02em;">
                ${p.name || '横浜地方気象台 土砂災害危険警報発表地域'}
              </div>
              <div style="font-size: 11px; color: #cbd5e1; margin-top: 4px;">
                発表市町村：<strong style="color: #fbbf24;">横浜南部、鎌倉 全域</strong>
              </div>
              <div style="font-size: 10px; color: #94a3b8; margin-top: 4px; line-height: 1.35;">
                ${p.categoryText || '横浜地方気象台 レベル4土砂災害危険警報発表地域'}
              </div>
              <div style="margin-top: 8px; padding: 6px 8px; background: rgba(245, 158, 11, 0.14); border-left: 3px solid #f59e0b; border-radius: 4px; font-size: 10.5px; color: #fef3c7; line-height: 1.4;">
                📍 <strong>個別地域の詳細確認:</strong><br>
                メッシュ内の<strong>橙色エリア（横浜南部／鎌倉）</strong>を直接タップすると、それぞれの急傾斜地警戒区域の詳細が表示されます。
              </div>
            </div>
          `;
        } else {
          // 【B. 具体的な個別警戒地域（横浜南部・鎌倉等）をクリックした時の挙動】
          // クリックされたポリゴンを白枠線でハイライト強調
          if ((layer as any).setStyle) {
            selectedHazardLayer = layer as L.Path;
            originalHazardStyle = {
              weight: (layer as any).options.weight,
              color: (layer as any).options.color,
              fillOpacity: (layer as any).options.fillOpacity
            };
            (layer as L.Path).setStyle({
              weight: 3.5,
              color: '#ffffff',
              fillOpacity: Math.min(0.72, ((originalHazardStyle.fillOpacity as number) || 0.48) + 0.18)
            });
            (layer as any).bringToFront?.();
          }

          // 地区名の判別バッジ
          let districtBadge = p.districtBadge || '';
          if (!districtBadge) {
            if (p.id?.includes('yokohama-south') || p.name?.includes('横浜市南部')) {
              districtBadge = '横浜南部';
            } else if (p.id?.includes('kamakura') || p.name?.includes('鎌倉')) {
              districtBadge = '鎌倉';
            } else if (p.id?.includes('yamate') || p.name?.includes('山手')) {
              districtBadge = '中区山手';
            } else if (p.id?.includes('motomachi') || p.name?.includes('元町')) {
              districtBadge = '中区元町';
            } else if (p.id?.includes('uchikoshi') || p.name?.includes('打越')) {
              districtBadge = '中区打越';
            } else if (p.id?.includes('negishi') || p.name?.includes('根岸')) {
              districtBadge = '中区根岸';
            } else if (p.id?.includes('atami') || p.name?.includes('熱海')) {
              districtBadge = '熱海市';
            } else if (p.id?.includes('ito') || p.name?.includes('伊東')) {
              districtBadge = '伊東市';
            } else {
              districtBadge = isWardBoundary ? '浸水想定区' : '個別警戒区域';
            }
          }

          const badgeBg = isLandslide ? '#f59e0b' : (isWardBoundary ? '#0ea5e9' : '#ef4444');
          const badgeTextColor = isLandslide ? '#000000' : '#ffffff';
          const levelText = dangerLevel === 3 ? '警戒レベル3 高齢者等避難' : (isLevel4 ? '警戒レベル4 避難指示' : '警戒情報');
          const levelColor = dangerLevel === 3 ? '#fca5a5' : '#c084fc';

          popupHtml = `
            <div style="padding: 8px 12px; font-size: 12px; line-height: 1.4; color: #fff; min-width: 250px; max-width: 320px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <span style="background: ${badgeBg}; color: ${badgeTextColor}; font-weight: 900; font-size: 11px; padding: 2px 7px; border-radius: 4px; letter-spacing: 0.04em; box-shadow: 0 0 10px rgba(245, 158, 11, 0.4);">
                  📍 【${districtBadge}】個別指定区域
                </span>
                <span style="color: ${levelColor}; font-size: 10px; font-weight: 800; font-family: monospace;">
                  ${levelText}
                </span>
              </div>
              <div style="font-size: 13.5px; font-weight: 900; color: #ffffff; letter-spacing: 0.02em; line-height: 1.35;">
                ${p.name || '指定危険区域'}
              </div>
              ${p.districtSubtitle ? `<div style="font-size: 11px; color: #93c5fd; margin-top: 3px; font-weight: bold;">対象地区：${p.districtSubtitle}</div>` : ''}
              ${p.targetHills ? `<div style="font-size: 10.5px; color: #fde68a; margin-top: 2px;">⛰️ 対象山林・崖地：${p.targetHills}</div>` : ''}
              <div style="font-size: 10.5px; color: #cbd5e1; margin-top: 4px; line-height: 1.35;">
                ${p.categoryText || '国交省ハザードマップ指定区域'}
              </div>
              ${isWardBoundary ? '<div style="font-size: 10px; color: #38bdf8; margin-top: 4px;">🌊 川沿いの着色エリア（黄色・ピンク・赤）にいる方は直ちに避難</div>' : ''}
              <div style="margin-top: 8px; padding: 6px 8px; background: rgba(239, 68, 68, 0.16); border-left: 3px solid ${badgeBg}; border-radius: 4px; font-size: 10px; color: #fecaca; line-height: 1.35;">
                ⚠️ <strong>避難・警戒行動:</strong><br>
                ${p.recommendedAction || (isLandslide ? '急傾斜地・崖地から直ちに離隔し、頑丈な建物2階以上または避難所へ緊急避難' : '浸水想定低地からの離隔・垂直避難')}
              </div>
            </div>
          `;
        }

        L.popup({
          className: 'nerv-popup',
          offset: [0, -6],
          closeButton: false
        })
          .setLatLng(e.latlng)
          .setContent(popupHtml)
          .openOn(map);
      });
    }
  }).addTo(hazardLayerGroup);
}

function renderKikikuru() {
  if (!kikikuruLayerGroup) return;
  kikikuruLayerGroup.clearLayers();

  if (!layersVisible.kikikuruMesh) return;

  const currentMeshGeoJson = getKikikuruMeshForScenario(props.currentPresetId);

  L.geoJSON(currentMeshGeoJson as any, {
    pane: 'kikikuruPane',
    style: (feature) => {
      const p = feature?.properties || {};
      const dangerLevel = p.dangerLevel || 4;
      const isLevel3 = dangerLevel === 3;
      const isLevel2 = dangerLevel === 2;
      const color = p.color || (isLevel3 ? '#ef4444' : (isLevel2 ? '#eab308' : '#a855f7'));
      const fillColor = p.fillColor || (isLevel3 ? '#dc2626' : (isLevel2 ? '#ca8a04' : '#7e22ce'));
      const fillOpacity = p.fillOpacity ?? 0.28;

      return {
        color,
        weight: 1.2,
        fillColor,
        fillOpacity,
        className: 'kikikuru-grid-cell'
      };
    },
    onEachFeature: (feature, layer) => {
      // ホバー時に枠線をやや強調
      layer.on('mouseover', () => {
        (layer as L.Path).setStyle({
          weight: 2.2,
          fillOpacity: 0.42
        });
      });
      layer.on('mouseout', () => {
        const p = feature?.properties || {};
        const isLevel3 = p.dangerLevel === 3;
        const isLevel2 = p.dangerLevel === 2;
        const color = p.color || (isLevel3 ? '#ef4444' : (isLevel2 ? '#eab308' : '#a855f7'));
        const fillOpacity = p.fillOpacity ?? 0.28;
        (layer as L.Path).setStyle({
          weight: 1.2,
          color,
          fillOpacity
        });
      });

      layer.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        if (!map) return;

        const p = feature.properties || {};
        const isLevel3 = p.dangerLevel === 3;
        const badgeBg = isLevel3 ? '#ef4444' : '#a855f7';
        const badgeText = isLevel3 ? '警戒レベル3相当（警戒・赤）' : '警戒レベル4相当（極めて危険・紫）';
        const kindLabel = p.kikikuruKind === 'flood' ? '🌊 キキクル浸水害' : (p.kikikuruKind === 'combined' ? '🌪️ キキクル複合' : '⛰️ キキクル土砂');

        const popupHtml = `
          <div style="padding: 8px 12px; font-size: 12px; line-height: 1.4; color: #fff; min-width: 260px; max-width: 320px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <span style="background: ${badgeBg}; color: #ffffff; font-weight: 900; font-size: 10.5px; padding: 2px 7px; border-radius: 4px; box-shadow: 0 0 10px rgba(168, 85, 247, 0.4);">
                📡 ${kindLabel}
              </span>
              <span style="color: ${isLevel3 ? '#fca5a5' : '#e9d5ff'}; font-size: 10px; font-weight: 800; font-family: monospace;">
                ${p.timeText || '実況メッシュ'}
              </span>
            </div>

            <div style="font-size: 13px; font-weight: 900; color: #ffffff; letter-spacing: 0.02em; line-height: 1.35;">
              ${p.name || '気象庁 危険度分布メッシュ'}
            </div>
            ${p.targetArea ? `<div style="font-size: 11px; color: #cbd5e1; margin-top: 3px;">📍 対象地域: ${p.targetArea}</div>` : ''}
            <div style="font-size: 10.5px; color: #a78bfa; margin-top: 2px;">
              ${badgeText}（1km四方メッシュ単位）
            </div>

            ${p.comparisonNote ? `
              <div style="margin-top: 8px; padding: 6px 8px; background: rgba(147, 51, 234, 0.18); border-left: 3px solid #a855f7; border-radius: 4px; font-size: 10.5px; color: #e9d5ff; line-height: 1.4;">
                🔍 <strong>実演比較・問題提起:</strong><br>
                ${p.comparisonNote}
              </div>
            ` : ''}

            <div style="margin-top: 6px; font-size: 9.5px; color: #94a3b8; line-height: 1.3;">
              ※本メッシュは実演比較用の気象庁実況再現データです。現在地内外判定（直撃/近接）には影響しません。
            </div>
          </div>
        `;

        L.popup({
          className: 'nerv-popup',
          offset: [0, -6],
          closeButton: false
        })
          .setLatLng(e.latlng)
          .setContent(popupHtml)
          .openOn(map);
      });
    }
  }).addTo(kikikuruLayerGroup);
}



function toggleMlitLayers() {
  if (!map) return;
  if (layersVisible.mlitFlood && mlitFloodLayer) {
    if (!map.hasLayer(mlitFloodLayer)) map.addLayer(mlitFloodLayer);
  } else if (mlitFloodLayer && map.hasLayer(mlitFloodLayer)) {
    map.removeLayer(mlitFloodLayer);
  }

  if (layersVisible.mlitSlope && mlitSlopeLayer) {
    if (!map.hasLayer(mlitSlopeLayer)) map.addLayer(mlitSlopeLayer);
  } else if (mlitSlopeLayer && map.hasLayer(mlitSlopeLayer)) {
    map.removeLayer(mlitSlopeLayer);
  }
}

function toggleVectorHazardLayer() {
  renderHazardPolygons();
}

function toggleKikikuruLayer() {
  renderKikikuru();
}

function focusUserLocation() {
  if (!map) return;
  map.flyTo(props.userCoords, 16, { duration: 1.0 });
  setTimeout(() => {
    openUserPopup();
  }, 1100);
}

// 画面全体に対象エリアを表示する（全体フィット）
function fitToHazards() {
  if (!map || !hazardLayerGroup) return;
  const layers = hazardLayerGroup.getLayers();
  if (layers.length > 0) {
    const group = L.featureGroup(layers);
    map.fitBounds(group.getBounds().pad(0.25), {
      duration: 1.0,
      maxZoom: 15
    });
  }
}

// 外部（親コンポーネント）から fitToHazards を呼び出せるように公開
defineExpose({
  fitToHazards,
  focusUserLocation
});

// マップタブがアクティブになったときに自動フィット
watch(
  () => props.isMapTabActive,
  (isActive) => {
    if (isActive && map) {
      nextTick(() => {
        map?.invalidateSize();
        fitToHazards();
      });
    }
  }
);

// ユーザー座標変化の監視
watch(
  () => props.userCoords,
  (newCoords) => {
    if (userMarker) {
      userMarker.setLatLng(newCoords);
    }
  },
  { deep: true }
);

// ハザードデータ、災害種別タブ、シナリオが変更された時、再描画・レイヤー自動連動・ズーム・キキクル同期
watch(
  () => [props.hazardGeoJson, props.activeHazardTab, props.currentPresetId],
  () => {
    syncHazardLayersForScenario();
    renderHazardPolygons();
    renderKikikuru();
    fitToHazards();
  },
  { deep: true }
);
</script>
