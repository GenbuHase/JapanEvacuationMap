<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in"
  >
    <div class="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 class="font-bold text-base text-white flex items-center gap-2">
          <span>⚙️ システム設定 ＆ API連携</span>
        </h3>
        <button
          @click="$emit('close')"
          class="text-slate-400 hover:text-white p-1 rounded-lg text-lg transition"
        >
          ✕
        </button>
      </div>

      <!-- Gemini API Key -->
      <div class="space-y-1.5">
        <label class="block text-xs font-bold text-slate-300">
          Gemini API Key (Google AI Studio)
        </label>
        <input
          v-model="localApiKey"
          type="password"
          placeholder="AIzaSy..."
          class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
        />
        <p class="text-[11px] text-slate-400 leading-relaxed">
          ※ 空欄の場合でも、内蔵の<strong>高精度ローカルNLPパーサー</strong>により、オフライン・完全無料で瞬時に解析されます。
        </p>
      </div>

      <!-- 近接警戒判定しきい値スライダー -->
      <div class="space-y-1.5 pt-2 border-t border-slate-800">
        <div class="flex justify-between items-center text-xs">
          <label class="font-bold text-slate-300">近接警戒（バッファ）判定距離</label>
          <span class="font-mono text-sky-400 font-bold">{{ localThreshold }} m</span>
        </div>
        <input
          type="range"
          min="100"
          max="800"
          step="50"
          v-model.number="localThreshold"
          class="w-full accent-sky-500"
        />
        <p class="text-[10px] text-slate-400">
          危険区域境界からこの距離以内に入ると「⚠️ 近接警戒」が発令されます。
        </p>
      </div>

      <!-- 自動音声アラート -->
      <div class="space-y-2 pt-2 border-t border-slate-800">
        <label class="flex items-center justify-between cursor-pointer">
          <span class="text-xs font-semibold text-slate-300">🚨 直撃時の自動音声警告</span>
          <input
            type="checkbox"
            v-model="localAutoSpeak"
            class="toggle-checkbox rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0"
          />
        </label>
      </div>

      <!-- ボタン群 -->
      <div class="pt-3 border-t border-slate-800 flex justify-end gap-2">
        <button
          @click="$emit('close')"
          class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
        >
          キャンセル
        </button>
        <button
          @click="saveSettings"
          class="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow-lg shadow-sky-600/30"
        >
          設定を保存
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  isOpen: boolean;
  apiKey: string;
  nearbyThreshold: number;
  autoSpeak: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', payload: { apiKey: string; nearbyThreshold: number; autoSpeak: boolean }): void;
}>();

const localApiKey = ref(props.apiKey);
const localThreshold = ref(props.nearbyThreshold);
const localAutoSpeak = ref(props.autoSpeak);

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      localApiKey.value = props.apiKey;
      localThreshold.value = props.nearbyThreshold;
      localAutoSpeak.value = props.autoSpeak;
    }
  }
);

function saveSettings() {
  emit('save', {
    apiKey: localApiKey.value,
    nearbyThreshold: localThreshold.value,
    autoSpeak: localAutoSpeak.value
  });
  emit('close');
}
</script>
