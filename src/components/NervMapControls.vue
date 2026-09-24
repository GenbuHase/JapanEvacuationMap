<template>
  <div class="pointer-events-none w-full flex items-center justify-between px-1.5 sm:px-4 md:px-6 pb-2 gap-1 select-none">
    <!-- 左側: 時刻表示 (電文発表時刻) -->
    <div class="pointer-events-auto bg-black border border-slate-800 px-2 sm:px-3.5 py-1 sm:py-1.5 md:py-2 rounded-md flex items-center gap-1 shadow-2xl font-mono shrink-0">
      <span class="text-[11px] sm:text-base md:text-lg font-black tracking-wider text-white">{{ time }}</span>
    </div>

    <!-- 中央: 避難情報 時系列タイムラインピル (#1 11:44 / #2 12:32 / #3 熱海 / #4 14:23 / #5 15:02 / #6 伊東 / #7 ALL) -->
    <div class="pointer-events-auto bg-black border border-slate-800 rounded-md flex items-center shadow-2xl overflow-x-auto no-scrollbar mx-0.5 sm:mx-2 shrink">
      <button
        v-for="step in timelineSteps"
        :key="step.id"
        @click="$emit('select-scenario', step.id)"
        class="shrink-0 px-1 xs:px-1.5 sm:px-2.5 md:px-3 py-1 sm:py-1.5 md:py-2 text-[10px] xs:text-[11px] sm:text-xs md:text-sm font-black transition-all flex items-center gap-0.5 sm:gap-1"
        :class="currentPresetId === step.id
          ? (step.id === 'typhoon25_ito_elderly' ? 'bg-red-600 text-white font-black shadow-inner' : 'bg-purple-600 text-white font-black shadow-inner')
          : 'text-slate-300 hover:text-white hover:bg-slate-900'"
        :title="step.title"
      >
        <span class="text-[7.5px] xs:text-[8px] sm:text-[9px] opacity-75 font-mono">#{{ step.stepNumber }}</span>
        <span class="whitespace-nowrap">{{ step.time }}</span>
        <span class="hidden xl:inline text-[11px] font-normal opacity-90">({{ step.shortLabel }})</span>
      </button>
    </div>

    <!-- 右側: レイヤー切替ボタン -->
    <div class="pointer-events-auto flex items-center shrink-0">
      <button
        @click="$emit('toggle-layer-panel')"
        class="w-8 h-8 sm:w-9 sm:h-9 md:w-11 md:h-11 rounded-full bg-black hover:bg-slate-900 text-cyan-400 border border-slate-800 flex items-center justify-center shadow-2xl transition"
        title="地図レイヤー ＆ 凡例"
      >
        <!-- レイヤーアイコン (SVG) -->
        <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
          <polyline points="2 17 12 22 22 17"></polyline>
          <polyline points="2 12 12 17 22 12"></polyline>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  time: string;
  currentPresetId?: string;
  isInside?: boolean;
}>();

defineEmits<{
  (e: 'select-scenario', id: string): void;
  (e: 'toggle-layer-panel'): void;
}>();

const timelineSteps = [
  { stepNumber: 1, id: 'typhoon25_1144_kikidai', time: '11:44', shortLabel: '南部・鎌倉', title: '11:44 気象台 土砂災害危険警報' },
  { stepNumber: 2, id: 'typhoon25_1232_yamate', time: '12:32', shortLabel: '中区崖地', title: '12:32 横浜市中区 避難指示' },
  { stepNumber: 3, id: 'typhoon25_atami_evac', time: '熱海', shortLabel: '避難指示', title: '13:17 静岡県熱海市 避難指示（警戒レベル4）' },
  { stepNumber: 4, id: 'typhoon25_1423_flood_5wards', time: '14:23', shortLabel: '5区浸水', title: '14:23 横浜市5区 避難指示' },
  { stepNumber: 5, id: 'typhoon25_1502_flood_kanagawa', time: '15:02', shortLabel: '神奈川区', title: '15:02 横浜市神奈川区 避難指示' },
  { stepNumber: 6, id: 'typhoon25_ito_elderly', time: '伊東', shortLabel: '高齢者避難', title: '12:32 静岡県伊東市 高齢者等避難（警戒レベル3）' },
  { stepNumber: 7, id: 'typhoon25_all_combined', time: 'ALL', shortLabel: '広域全重畳', title: 'ALL 広域全避難情報重畳（神奈川〜熱海・伊東）' }
];
</script>
