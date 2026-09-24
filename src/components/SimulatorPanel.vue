<template>
  <div class="h-full w-full bg-black/95 overflow-y-auto p-4 md:p-8 flex justify-center">
    <div class="max-w-3xl w-full space-y-6">
      <!-- セクションヘッダー -->
      <div class="border-b border-slate-800 pb-4">
        <div class="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
          <span>🌀 SIMULATION & DISASTER SCENARIOS</span>
        </div>
        <h2 class="text-lg md:text-xl font-black text-white flex items-center gap-2">
          <span>台風25号 実録シナリオ ＆ 現在地シミュレーター</span>
        </h2>
        <p class="text-xs md:text-sm text-slate-400 mt-1 leading-relaxed">
          被災実録タイムライン（12:32土砂、14:23内水）と滞在地点（平地中華街、元町崖地直下、山手町台地）を切り替えて、空間判定とHUD警報の変化を検証します。
        </p>
      </div>

      <!-- シナリオプリセット選択 -->
      <div class="space-y-3">
        <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider">
          1. 台風25号 被災実録シナリオ
        </label>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div
            v-for="scenario in presets"
            :key="scenario.id"
            @click="$emit('select-preset', scenario.id)"
            class="p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between"
            :class="currentPresetId === scenario.id
              ? (scenario.level === 3 ? 'border-red-500 bg-red-950/40 ring-1 ring-red-500/60' : 'border-purple-500 bg-purple-950/40 ring-1 ring-purple-500/60')
              : 'border-slate-800 bg-slate-900/60 hover:bg-slate-800/80'"
          >
            <div>
              <div class="flex items-center justify-between mb-2">
                <span
                  class="px-2 py-0.5 rounded text-[11px] font-mono font-bold"
                  :class="scenario.level === 3
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                    : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'"
                >
                  {{ scenario.time }}
                </span>
                <span
                  class="text-xs font-bold px-1.5 py-0.5 rounded"
                  :class="scenario.level === 3 ? 'bg-red-900/60 text-red-300' : 'bg-purple-900/60 text-purple-300'"
                >
                  警戒レベル{{ scenario.level }}
                </span>
              </div>
              <h3 class="font-black text-sm text-white">{{ scenario.title }}</h3>
              <p class="text-xs text-slate-400 mt-1.5 leading-relaxed">{{ scenario.subtitle }}</p>
            </div>

            <div class="mt-3 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400">
              <strong class="text-slate-300">検証要点:</strong> {{ scenario.explanation }}
            </div>
          </div>
        </div>
      </div>

      <!-- 現在地シミュレーション地点選択 -->
      <div class="space-y-3 pt-2">
        <div class="flex items-center justify-between">
          <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider">
            2. 現在地ロケーション切替（標高差と危険エリアまでの距離検証）
          </label>
          <button
            @click="$emit('request-gps')"
            class="text-xs px-2.5 py-1 rounded-lg bg-cyan-950/70 hover:bg-cyan-900/70 text-cyan-300 border border-cyan-700/50 flex items-center gap-1 transition"
          >
            <span>📡 実機GPS現在地を測位</span>
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            v-for="loc in presetLocations"
            :key="loc.id"
            @click="$emit('select-location', loc)"
            class="p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between"
            :class="currentLocationId === loc.id
              ? 'border-cyan-400 bg-cyan-950/30 ring-1 ring-cyan-400/50'
              : 'border-slate-800 bg-slate-900/60 hover:bg-slate-800/80'"
          >
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <span class="font-bold text-sm text-white">{{ loc.name }}</span>
                <span class="font-mono text-xs font-bold text-cyan-400">標高 {{ loc.elevation }}m</span>
              </div>
              <div class="text-[11px] text-slate-400 font-mono">{{ loc.address }}</div>
              <p class="text-xs text-slate-300 mt-2 leading-relaxed">{{ loc.description }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 現在の判定ステータス要約カード -->
      <div class="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
        <div class="text-xs font-bold text-slate-400 uppercase tracking-wider">
          リアルタイム空間判定ステータス
        </div>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span
              class="px-2 py-0.5 rounded text-xs font-black"
              :class="analysis.status === 'INSIDE'
                ? 'bg-rose-600 text-white animate-pulse'
                : (analysis.status === 'NEARBY' ? 'bg-amber-500 text-black font-black' : 'bg-emerald-600 text-white')"
            >
              {{ analysis.hudMessage.badge }}
            </span>
            <span class="text-xs text-white font-bold">{{ currentLocationName }}</span>
          </div>
          <div class="text-xs font-mono text-cyan-300">
            危険エリアまで: {{ analysis.distanceToNearestMeters === Infinity ? '十分' : analysis.distanceToNearestMeters + 'm' }}
          </div>
        </div>
      </div>

      <!-- マップへ戻るアクションボタン -->
      <div class="pt-2 flex justify-center">
        <button
          @click="$emit('switch-to-map')"
          class="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-sm shadow-xl shadow-cyan-500/20 transition flex items-center justify-center gap-2"
        >
          <span>🗺️ 全画面マップで結果を確認</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PRESET_LOCATIONS, SCENARIO_PRESETS } from '../data/hazardPresets';
import type { SpatialAnalysisResult } from '../services/geoService';

defineProps<{
  presets: typeof SCENARIO_PRESETS;
  presetLocations: typeof PRESET_LOCATIONS;
  currentPresetId: string;
  currentLocationId: string;
  currentLocationName: string;
  analysis: SpatialAnalysisResult;
}>();

defineEmits<{
  (e: 'select-preset', id: string): void;
  (e: 'select-location', loc: (typeof PRESET_LOCATIONS)[number]): void;
  (e: 'request-gps'): void;
  (e: 'switch-to-map'): void;
}>();
</script>
