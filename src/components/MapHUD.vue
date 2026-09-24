<template>
  <div class="pointer-events-none w-full px-3 sm:px-4 flex flex-col items-center pt-2 select-none">
    <div class="pointer-events-auto flex flex-col items-center">
      <!-- メインタイトル（発令中の避難情報・警報） -->
      <h2 class="text-xs sm:text-sm md:text-base font-black text-white tracking-wider flex items-center gap-1.5 sm:gap-2 drop-shadow-md text-center max-w-[94vw]">
        <span
          class="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-black tracking-wide shrink-0 shadow"
          :class="alertLevelClass"
        >
          {{ alertLevelBadgeText }}
        </span>
        <span class="truncate">{{ displayTitle }}</span>
      </h2>

      <!-- 避難情報 警戒レベル指標（内閣府避難情報ガイドライン: 高齢者等避難 / 避難指示 / 緊急安全確保） -->
      <div class="flex items-center gap-2 sm:gap-3.5 text-[10px] sm:text-xs font-bold text-slate-300 mt-1 drop-shadow">
        <!-- レベル3 高齢者等避難 (内閣府ポスター: 赤) -->
        <span
          class="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 rounded transition-all"
          :class="currentLevel === 3
            ? 'ring-1 ring-red-400/80 bg-red-950/70 text-white font-black shadow-[0_0_12px_rgba(239,68,68,0.4)]'
            : 'opacity-70'"
        >
          <span class="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444] shrink-0"></span>
          <span>高齢者等避難 <span class="text-[9px] sm:text-[10px] font-mono text-red-300 font-normal">Lv.3</span></span>
        </span>

        <!-- レベル4 避難指示 (内閣府ポスター: 紫) -->
        <span
          class="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 rounded transition-all"
          :class="currentLevel === 4
            ? 'ring-1 ring-purple-400/80 bg-purple-950/70 text-white font-black shadow-[0_0_12px_rgba(168,85,247,0.4)]'
            : 'opacity-70'"
        >
          <span class="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-purple-500 shadow-[0_0_8px_#a855f7] shrink-0"></span>
          <span>避難指示 <span class="text-[9px] sm:text-[10px] font-mono text-purple-300 font-normal">Lv.4</span></span>
        </span>

        <!-- レベル5 緊急安全確保 (内閣府ポスター: 黒) -->
        <span
          class="flex items-center gap-1 sm:gap-1.5 transition-all"
          :class="currentLevel === 5 ? 'text-slate-100 font-black' : 'opacity-70'"
        >
          <span class="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-sm bg-black border border-white flex items-center justify-center text-[7px] font-black text-white shrink-0">
            ✕
          </span>
          <span>緊急安全確保 <span class="text-[9px] sm:text-[10px] font-mono text-slate-400 font-normal">Lv.5</span></span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  title?: string;
  level?: number;
  time?: string;
  activeHazardTab?: string;
}>();

const currentLevel = computed(() => props.level || 4);

const alertLevelBadgeText = computed(() => {
  if (currentLevel.value === 5) return '警戒レベル5';
  if (currentLevel.value === 4) return '警戒レベル4';
  if (currentLevel.value === 3) return '警戒レベル3';
  return '警報発表';
});

const alertLevelClass = computed(() => {
  if (currentLevel.value === 5) return 'bg-black text-white ring-1 ring-white';
  if (currentLevel.value === 4) return 'bg-purple-600 text-white shadow-[0_0_10px_rgba(147,51,234,0.5)]';
  if (currentLevel.value === 3) return 'bg-red-600 text-white';
  return 'bg-purple-600 text-white';
});

const displayTitle = computed(() => {
  if (props.title) return props.title;
  if (props.activeHazardTab === 'landslide') {
    return '土砂災害危険警報 / 避難指示';
  } else if (props.activeHazardTab === 'flood') {
    return '浸水想定区域（浸水深50cm以上）避難指示';
  }
  return '避難指示対象エリア';
});
</script>
