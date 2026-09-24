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
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" v-model="layersVisible.kikikuruMesh" @change="toggleKikikuruLayer" class="rounded bg-neutral-800 border-neutral-600 text-purple-500 focus:ring-0" />
          <span class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded bg-purple-600/50 border border-purple-400 inline-block"></span>
            <span>キキクル 危険度分布メッシュ（紫）</span>
          </span>
        </label>

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
import { KIKIKURU_MESH_GEOJSON } from '../data/hazardPresets';

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

const showLayerPanel = ref(false);
const selectedBaseMapKey = ref<keyof typeof BASE_MAP_LAYERS>('esriDark');

const layersVisible = reactive({
  mlitFlood: true,
  mlitSlope: false,
  hazardPolygons: true,
  kikikuruMesh: true
});

// 現在のシナリオやタブが洪水に関連しているかの判定
const isFloodActive = computed(() => {
  const p = props.currentPresetId || '';
  const t = props.activeHazardTab || '';
  return p.includes('flood') || t === 'flood' || t === 'river' || p === 'typhoon25_all_combined';
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

  updateBaseMap();

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
  if (!hazardLayerGroup || !props.hazardGeoJson) return;
  hazardLayerGroup.clearLayers();

  if (!layersVisible.hazardPolygons) return;

  L.geoJSON(props.hazardGeoJson, {
    style: (feature) => {
      const dangerLevel = feature?.properties?.dangerLevel || 4;
      const hType = feature?.properties?.hazardType;
      const isLandslide = hType === 'landslide';
      const isKikikuru = hType === 'kikikuru';

      // 内閣府 避難情報ガイドラインに基づく警戒レベル配色
      // レベル5（緊急安全確保）: 黒（#000000）
      // レベル4（避難指示）: 紫（#a855f7 / #7c3aed）
      // レベル3（高齢者等避難）: 赤（#ef4444 / #dc2626）
      let levelColor = '#a855f7';
      let levelFill = '#7c3aed';

      if (dangerLevel === 5) {
        levelColor = '#000000';
        levelFill = '#171717';
      } else if (dangerLevel === 3) {
        levelColor = '#ef4444';
        levelFill = '#dc2626';
      } else {
        // レベル4（避難指示）
        levelColor = '#a855f7';
        levelFill = '#7c3aed';
      }

      const isWardBoundary = feature?.properties?.isWardBoundary || (!isLandslide && !isKikikuru && hType === 'flood');
      const finalColor = feature?.properties?.color || levelColor;
      const finalFill = feature?.properties?.fillColor || levelFill;

      return {
        color: finalColor,
        weight: isWardBoundary ? 2.2 : (isLandslide ? 2.5 : 3),
        fillColor: finalFill,
        fillOpacity: isWardBoundary ? (feature?.properties?.fillOpacity || 0.08) : (isKikikuru ? 0.2 : (feature?.properties?.fillOpacity || 0.45)),
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
      const isWardBoundary = p.isWardBoundary || (p.hazardType === 'flood');

      // エリアまたは避難所押下（タップ/クリック）でNERV吹き出しポップアップを提示
      layer.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        if (!map) return;

        if (p.type === 'shelter') {
          const shelterPopupHtml = `
            <div style="padding: 6px 12px; font-size: 12px; font-weight: bold; color: #fff; line-height: 1.35;">
              <div style="display: flex; align-items: center; gap: 6px; font-size: 13px;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></span>
                <span style="color: #34d399;">開設中避難所（安全施設）</span>
              </div>
              <div style="font-size: 13px; font-weight: 900; color: #ffffff; margin-top: 3px;">${p.name}</div>
              <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">電文抽出：避難可能施設</div>
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

        const isLevel4 = (p.dangerLevel || 4) >= 4;
        const statusLabel = isWardBoundary ? '警戒レベル4 避難指示対象区' : (isLevel4 ? '危険（避難指示）' : '警戒');
        const dotColor = isLevel4 ? '#a855f7' : '#facc15';

        const popupHtml = `
          <div style="padding: 6px 12px; font-size: 12px; font-weight: bold; color: #fff; line-height: 1.35;">
            <div style="display: flex; align-items: center; gap: 6px; font-size: 13px;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${dotColor};"></span>
              <span style="color: ${isLevel4 ? '#c084fc' : '#facc15'};">${statusLabel}</span>
            </div>
            <div style="font-size: 12px; font-weight: 800; color: #f1f5f9; margin-top: 3px;">${p.name || '指定危険区域'}</div>
            <div style="font-size: 10px; color: #cbd5e1; margin-top: 2px;">
              ${p.categoryText || '国交省ハザードマップ指定区域'}
            </div>
            ${isWardBoundary ? '<div style="font-size: 10px; color: #38bdf8; margin-top: 3px;">🌊 川沿いの着色エリア（黄色・ピンク・赤）にいる方は直ちに避難</div>' : ''}
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
  }).addTo(hazardLayerGroup);
}

function renderKikikuru() {
  if (!kikikuruLayerGroup) return;
  kikikuruLayerGroup.clearLayers();

  if (!layersVisible.kikikuruMesh) return;

  L.geoJSON(KIKIKURU_MESH_GEOJSON as any, {
    style: {
      color: '#a855f7',
      weight: 1.5,
      fillColor: '#7e22ce',
      fillOpacity: 0.15,
      dashArray: '6, 6'
    },
    onEachFeature: (feature, layer) => {
      layer.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        if (!map) return;
        const popupHtml = `
          <div style="padding: 6px 10px; font-size: 12px; font-weight: bold; color: #fff; line-height: 1.3;">
            <div style="display: flex; align-items: center; gap: 6px; font-size: 13px;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #a855f7;"></span>
              <span>危険（キキクル紫メッシュ）</span>
            </div>
            <div style="font-size: 10px; color: #cbd5e1; margin-top: 2px;">気象庁 1kmメッシュ危険度分布</div>
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

// ハザードデータ、災害種別タブ、シナリオが変更された時、再描画・レイヤー自動連動・ズーム
watch(
  () => [props.hazardGeoJson, props.activeHazardTab, props.currentPresetId],
  () => {
    syncHazardLayersForScenario();
    renderHazardPolygons();
    fitToHazards();
  },
  { deep: true }
);
</script>
