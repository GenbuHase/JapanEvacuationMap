<template>
  <header class="h-14 bg-slate-900/95 border-b border-slate-800 px-4 md:px-6 flex items-center justify-between z-30 backdrop-blur-md shrink-0">
    <div class="flex items-center gap-2.5">
      <div class="p-1.5 md:p-2 bg-gradient-to-br from-rose-600 via-orange-500 to-amber-500 rounded-lg text-white font-black text-xs md:text-sm shadow-lg shadow-rose-500/20 tracking-wider">
        DX
      </div>
      <div>
        <h1 class="font-bold text-sm md:text-base tracking-wide flex items-center gap-2 text-white">
          <span>避難指示リアルタイムマップ化DX</span>
          <span class="hidden sm:inline-block text-[11px] bg-sky-500/20 text-sky-400 border border-sky-500/30 px-2 py-0.5 rounded-full font-mono font-medium">
            EvacuationMap v2.0 (Vue3)
          </span>
        </h1>
      </div>
    </div>

    <div class="flex items-center gap-2 md:gap-3 text-xs">
      <!-- GPSステータス表示 -->
      <div class="hidden lg:flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-full border border-slate-800 font-mono text-[11px]">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span class="text-slate-300">現在地: {{ currentLocationName }}</span>
        <span class="text-slate-600">|</span>
        <span class="text-sky-400">標高: {{ elevation }}m</span>
      </div>

      <!-- 設定モーダルボタン -->
      <button
        @click="$emit('open-settings')"
        class="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1.5 rounded-lg transition flex items-center gap-1.5 text-xs"
        title="Gemini APIキー・警告設定"
      >
        <span>⚙️</span>
        <span class="hidden sm:inline">設定</span>
      </button>

      <!-- 防災スライドへのリンク -->
      <a
        href="../slides_slate/slide_deck.html"
        target="_blank"
        class="bg-indigo-600/90 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition flex items-center gap-1 text-xs font-medium shadow-sm shadow-indigo-500/20"
      >
        <span>📑</span>
        <span class="hidden sm:inline">防災スライド</span>
      </a>
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  currentLocationName: string;
  elevation: number;
}>();

defineEmits<{
  (e: 'open-settings'): void;
}>();
</script>
