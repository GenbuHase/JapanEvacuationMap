<template>
  <div class="h-full w-full bg-black/95 overflow-y-auto p-4 md:p-8 flex justify-center">
    <div class="max-w-2xl w-full space-y-6">
      <!-- ヘッダー -->
      <div class="border-b border-slate-800 pb-4">
        <div class="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
          <span>⚙️ SYSTEM CONFIGURATION & API</span>
        </div>
        <h2 class="text-lg md:text-xl font-black text-white flex items-center gap-2">
          <span>システム設定 ＆ API連携</span>
        </h2>
        <p class="text-xs md:text-sm text-slate-400 mt-1 leading-relaxed">
          Gemini 3.1 Flash-Lite API接続設定、避難指示テキスト解析モデル、近接警戒の空間バッファ距離を設定します。
        </p>
      </div>

      <!-- 保存完了通知バナー -->
      <div
        v-if="saveMessage"
        class="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-bold flex items-center gap-2 transition"
      >
        <span>✅</span>
        <span>{{ saveMessage }}</span>
      </div>

      <!-- Gemini API Key ＆ モデル設定 -->
      <div class="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div class="flex items-center justify-between">
          <label class="block text-xs font-bold text-white uppercase tracking-wider">
            1. Gemini API Key (Google AI Studio)
          </label>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            class="text-[11px] text-cyan-400 hover:text-cyan-300 underline font-mono flex items-center gap-1"
          >
            <span>Google AI Studioでキー取得 ↗</span>
          </a>
        </div>

        <div class="relative">
          <input
            :value="apiKey"
            @input="onApiKeyInput(($event.target as HTMLInputElement).value)"
            :type="showApiKey ? 'text' : 'password'"
            placeholder="AIzaSy..."
            class="w-full bg-black border border-slate-800 rounded-xl p-3 pr-11 text-xs md:text-sm text-slate-200 focus:outline-none focus:border-cyan-400 font-mono transition"
          />
          <button
            type="button"
            @click="showApiKey = !showApiKey"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-sm p-1"
            title="表示 / 非表示"
          >
            <span>{{ showApiKey ? '🙈' : '👁️' }}</span>
          </button>
        </div>

        <!-- モデル選択 -->
        <!-- モデル選択 -->
        <div class="space-y-1.5 pt-1">
          <div class="flex items-center justify-between text-xs">
            <label class="font-bold text-slate-300 uppercase tracking-wider">
              2. 解析モデル（公式最安値: Gemini 3.x シリーズ）
            </label>
            <a
              href="https://ai.google.dev/gemini-api/docs/pricing?hl=ja#gemini-3.1-flash-lite"
              target="_blank"
              class="text-[11px] text-cyan-400 hover:text-cyan-300 underline font-mono flex items-center gap-1"
            >
              <span>公式料金表 ↗</span>
            </a>
          </div>

          <select
            :value="selectedModelPreset"
            @change="onSelectModelPreset(($event.target as HTMLSelectElement).value)"
            class="w-full bg-black border border-slate-800 rounded-xl p-3 text-xs md:text-sm text-slate-200 focus:outline-none focus:border-cyan-400 transition cursor-pointer"
          >
            <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite（★公式最安値推奨: 超軽量・低遅延 Flash-Lite）</option>
            <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite（最新世代高スループット Flash-Lite）</option>
            <option value="gemini-3.8-flash">gemini-3.8-flash（最新フラッグシップ Flash）</option>
            <option value="custom">カスタム（任意のモデル名を手動入力）</option>
          </select>

          <!-- カスタムモデル名手動入力 -->
          <div v-if="selectedModelPreset === 'custom'" class="pt-2">
            <input
              :value="modelName"
              @input="onModelNameInput(($event.target as HTMLInputElement).value)"
              type="text"
              placeholder="例: gemini-3.1-flash-lite"
              class="w-full bg-black border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
            />
          </div>
        </div>

        <!-- 操作ボタン群（保存 ＆ API接続テスト） -->
        <div class="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            @click="saveSettings"
            class="flex-1 py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-600/20"
          >
            <span>💾 設定をローカル保存</span>
          </button>

          <button
            @click="runConnectionTest"
            :disabled="isTesting"
            class="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <span v-if="isTesting" class="animate-spin text-sm">🔄</span>
            <span v-else>🔌</span>
            <span>{{ isTesting ? '疎通確認中...' : 'API接続テスト' }}</span>
          </button>
        </div>

        <!-- 接続テスト結果表示 -->
        <div
          v-if="testResult"
          class="p-3 rounded-xl border text-xs leading-relaxed transition"
          :class="testResult.success
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
            : 'bg-rose-950/40 border-rose-500/40 text-rose-300'"
        >
          <div class="font-bold flex items-center gap-1.5 mb-0.5">
            <span>{{ testResult.success ? '✅ 疎通成功' : '❌ 接続失敗' }}</span>
            <span class="font-mono text-[11px] opacity-80">({{ testResult.model }})</span>
          </div>
          <div class="text-[11px] opacity-90">{{ testResult.message }}</div>
        </div>

        <!-- Gemini最安モデルに関する解説ノート -->
        <div class="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400 leading-relaxed space-y-1">
          <div class="font-bold text-cyan-400 flex items-center gap-1">
            <span>💡 Gemini 3.1 Flash-Lite と公式料金について</span>
          </div>
          <p>
            Google AI Studioの公式ドキュメント（<a href="https://ai.google.dev/gemini-api/docs/pricing?hl=ja#gemini-3.1-flash-lite" target="_blank" class="text-cyan-400 underline">#gemini-3.1-flash-lite</a>）の通り、現行提供モデルの中で最も低コスト（最安値）な軽量・高スループットモデルは <strong>Gemini 3.1 Flash-Lite</strong> です。
          </p>
          <p class="text-slate-500">
            ※ 旧世代（Gemini 1.5 や 2.0 シリーズ）は提供終了しているため、本システムでは Gemini 3.1 Flash-Lite を標準設定としています。
          </p>
        </div>
      </div>

      <!-- 近接警戒判定しきい値スライダー -->
      <div class="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <div class="flex justify-between items-center text-xs">
          <label class="font-bold text-white uppercase tracking-wider">近接警戒（空間バッファ）判定距離</label>
          <span class="font-mono text-cyan-400 font-black text-sm">{{ nearbyThreshold }} m</span>
        </div>
        <input
          type="range"
          min="100"
          max="800"
          step="50"
          :value="nearbyThreshold"
          @input="$emit('update:nearbyThreshold', Number(($event.target as HTMLInputElement).value))"
          class="w-full accent-cyan-400 cursor-pointer"
        />
        <p class="text-xs text-slate-400">
          危険区域境界からこの距離以内に入ると「⚠️ 近接警戒（イエロー/アンバー）」が発令されます。
        </p>
      </div>

      <!-- 自動音声アラート ＆ バイブレーション -->
      <div class="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <label class="flex items-center justify-between cursor-pointer">
          <div>
            <span class="text-xs md:text-sm font-bold text-white block">🚨 直撃時の自動音声アナウンス</span>
            <span class="text-[11px] text-slate-400 block mt-0.5">危険区域直撃時にWeb Speech APIで避難行動を合成音声読み上げ</span>
          </div>
          <input
            type="checkbox"
            :checked="autoSpeak"
            @change="$emit('update:autoSpeak', ($event.target as HTMLInputElement).checked)"
            class="rounded bg-black border-slate-700 text-cyan-400 focus:ring-0 w-5 h-5 cursor-pointer"
          />
        </label>
      </div>

      <!-- リンク ＆ クレジット -->
      <div class="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-3 text-xs text-slate-400">
        <div class="font-bold text-slate-200">プロジェクト資材・データ出典</div>
        <div class="flex flex-wrap gap-2 pt-1">
          <a
            href="../slides_slate/slide_deck.html"
            target="_blank"
            class="px-3 py-1.5 rounded-lg bg-indigo-600/90 hover:bg-indigo-500 text-white font-bold transition flex items-center gap-1"
          >
            <span>📑 防災教育スライド（石版テーマ）</span>
          </a>
          <a
            href="https://disaportal.gsi.go.jp/"
            target="_blank"
            class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
          >
            🌐 国交省 重ねるハザードマップ
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { testGeminiConnection, sanitizeModelName } from '../services/geminiParser';

const props = withDefaults(
  defineProps<{
    apiKey: string;
    modelName?: string;
    nearbyThreshold: number;
    autoSpeak: boolean;
  }>(),
  {
    modelName: 'gemini-3.1-flash-lite'
  }
);

const emit = defineEmits<{
  (e: 'update:apiKey', val: string): void;
  (e: 'update:modelName', val: string): void;
  (e: 'update:nearbyThreshold', val: number): void;
  (e: 'update:autoSpeak', val: boolean): void;
  (e: 'save'): void;
}>();

const showApiKey = ref(false);
const saveMessage = ref('');
const isTesting = ref(false);
const testResult = ref<{ success: boolean; model: string; message: string } | null>(null);

const presetList = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash'
];

// 初期化時に sanitizeModelName を通して旧世代モデル（2.5等）を排除
const initialModel = sanitizeModelName(props.modelName);
const selectedModelPreset = ref(
  presetList.includes(initialModel) ? initialModel : 'gemini-3.1-flash-lite'
);

onMounted(() => {
  // 旧世代モデルが残っている場合は即座に gemini-3.1-flash-lite へ更新
  if (props.modelName && (props.modelName.includes('2.5') || props.modelName.includes('1.5') || props.modelName.includes('2.0'))) {
    emit('update:modelName', 'gemini-3.1-flash-lite');
  }
});

function onApiKeyInput(val: string) {
  emit('update:apiKey', val.trim());
}

function onSelectModelPreset(val: string) {
  selectedModelPreset.value = val;
  if (val !== 'custom') {
    emit('update:modelName', val);
  }
}

function onModelNameInput(val: string) {
  emit('update:modelName', sanitizeModelName(val.trim()));
}

function saveSettings() {
  const chosenModel = selectedModelPreset.value === 'custom'
    ? (props.modelName || 'gemini-3.1-flash-lite')
    : selectedModelPreset.value;
  const targetModel = sanitizeModelName(chosenModel);

  localStorage.setItem('evac_gemini_api_key', props.apiKey.trim());
  localStorage.setItem('evac_gemini_model', targetModel);
  localStorage.setItem('evac_nearby_threshold', String(props.nearbyThreshold));
  localStorage.setItem('evac_auto_speak', String(props.autoSpeak));

  emit('update:modelName', targetModel);
  emit('save');
  saveMessage.value = '設定をブラウザのローカルストレージに保存しました！';
  setTimeout(() => {
    saveMessage.value = '';
  }, 3500);
}

async function runConnectionTest() {
  isTesting.value = true;
  testResult.value = null;

  // 画面で選択されているモデルを確実に gemini-3.1-flash-lite 等の安全なモデルに解決
  const chosenModel = selectedModelPreset.value === 'custom'
    ? (props.modelName || 'gemini-3.1-flash-lite')
    : selectedModelPreset.value;
  const targetModel = sanitizeModelName(chosenModel);

  emit('update:modelName', targetModel);

  try {
    const res = await testGeminiConnection(props.apiKey, targetModel);
    testResult.value = res;
    if (res.success) {
      saveSettings();
    }
  } finally {
    isTesting.value = false;
  }
}
</script>
