<template>
  <div class="h-full w-full bg-black/95 overflow-y-auto p-4 md:p-8 flex justify-center">
    <div class="max-w-3xl w-full space-y-6">
      <!-- ヘッダー -->
      <div class="border-b border-slate-800 pb-4">
        <div class="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
          <span>⚡ LLM PARSER & STRUCTURED INGESTION</span>
        </div>
        <h2 class="text-lg md:text-xl font-black text-white flex items-center gap-2">
          <span>避難指示速報テキストのLLM構造化解析</span>
        </h2>
        <p class="text-xs md:text-sm text-slate-400 mt-1 leading-relaxed">
          エリアメールやLアラートの自然言語から【自治体・町丁・警戒レベル・災害種別】を抽出し、国交省オープンデータと突合するGeoJSONポリゴンを生成します。
        </p>
      </div>

      <!-- 速報テキスト入力フォーム -->
      <div class="p-4 md:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <div class="flex justify-between items-center">
          <label class="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <span>受信速報テキスト（自由編集・貼付）</span>
          </label>
          <span class="text-xs text-slate-400 font-mono">{{ rawText.length }} 文字</span>
        </div>

        <textarea
          :value="rawText"
          @input="$emit('update:rawText', ($event.target as HTMLTextAreaElement).value)"
          rows="6"
          class="w-full bg-black border border-slate-800 rounded-xl p-3.5 text-xs md:text-sm text-slate-200 focus:outline-none focus:border-cyan-400 transition leading-relaxed font-mono"
          placeholder="【緊急速報・避難指示（警戒レベル4）】こちらは○○市です..."
        ></textarea>

        <div class="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            @click="$emit('run-parse')"
            :disabled="isParsing"
            class="flex-1 py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-slate-950 font-black text-xs md:text-sm rounded-xl shadow-xl shadow-cyan-500/20 transition flex items-center justify-center gap-2"
          >
            <span v-if="isParsing" class="animate-spin text-base">🔄</span>
            <span v-else>🤖</span>
            <span>{{ isParsing ? 'LLM解析中 (Gemini 3.1 Flash-Lite)...' : 'LLM構造化解析 ＆ 空間ポリゴン展開を実行' }}</span>
          </button>

          <button
            @click="$emit('switch-to-map')"
            class="py-3 px-6 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs md:text-sm rounded-xl transition flex items-center justify-center gap-1.5"
          >
            <span>🗺️ マップ表示</span>
          </button>
        </div>
      </div>

      <!-- LLM構造化抽出結果カード -->
      <div class="p-5 rounded-2xl bg-black border border-slate-800 space-y-4 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <span class="text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
            <span>🤖 構造化抽出結果</span>
          </span>
          <span
            class="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border"
            :class="parsedData.parseMethod === 'gemini'
              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'"
          >
            {{ parsedData.parseMethod === 'gemini'
              ? `GEMINI (${parsedData.modelUsed || 'gemini-3.1-flash-lite'})`
              : 'LOCAL FAST NLP ENGINE' }}
          </span>
        </div>

        <!-- APIエラー時の警告・フォールバック通知バナー -->
        <div
          v-if="parsedData.apiError"
          class="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs leading-relaxed space-y-1"
        >
          <div class="font-bold flex items-center gap-1.5 text-amber-300">
            <span>⚠️ Gemini API未接続（ローカルNLPで自動解析）</span>
          </div>
          <div class="text-[11px] opacity-90 font-mono">
            理由: {{ parsedData.apiError }}
          </div>
          <div class="text-[11px] text-slate-400">
            ※ 設定画面でGemini APIキーやモデル（gemini-3.1-flash-lite）をご確認ください。
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <!-- 自治体名 -->
          <div class="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span class="text-slate-400 block text-[11px] mb-1">対象自治体</span>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-extrabold text-sm text-white">{{ parsedData.issuingAuthority }}</span>
              <span
                v-if="parsedData.isEntireArea"
                class="px-2 py-0.5 rounded text-[10px] font-black bg-rose-600/30 text-rose-300 border border-rose-500/50 uppercase tracking-wider"
              >
                🚨 市内全域一括発令
              </span>
            </div>
          </div>

          <!-- 警戒レベル -->
          <div class="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span class="text-slate-400 block text-[11px] mb-1">警戒レベル</span>
            <span
              class="font-black text-sm px-2 py-0.5 rounded inline-block"
              :class="parsedData.alertLevel >= 4 ? 'bg-rose-600 text-white' : 'bg-amber-500 text-black'"
            >
              {{ parsedData.alertLevelText }}
            </span>
          </div>

          <!-- 災害種別 -->
          <div class="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span class="text-slate-400 block text-[11px] mb-1">災害種別</span>
            <span class="font-bold text-sm text-amber-300">{{ parsedData.disasterTypeText }}</span>
          </div>

          <!-- 発令時刻 -->
          <div class="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span class="text-slate-400 block text-[11px] mb-1">発令時刻</span>
            <span class="font-mono text-sm font-bold text-cyan-300">{{ parsedData.effectiveTime }}</span>
          </div>
        </div>

        <!-- 抽出町丁 -->
        <div class="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <span class="text-slate-400 block text-[11px] mb-2 font-bold">抽出された対象町丁・地区名</span>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="district in parsedData.targetDistricts"
              :key="district"
              class="bg-slate-800 text-cyan-300 border border-slate-700 px-2 py-1 rounded-lg text-xs font-mono font-bold"
            >
              📍 {{ district }}
            </span>
          </div>
        </div>

        <!-- 開設避難所リスト（存在する場合） -->
        <div
          v-if="parsedData.shelters && parsedData.shelters.length > 0"
          class="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/50 space-y-2"
        >
          <div class="flex items-center justify-between">
            <span class="text-emerald-400 block text-[11px] font-bold flex items-center gap-1.5">
              <span>🏫 開設避難所（マップ上に安全マーカーとしてプロット）</span>
            </span>
            <span class="text-[10px] text-emerald-300 font-mono font-bold">{{ parsedData.shelters.length }} 箇所</span>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="shelter in parsedData.shelters"
              :key="shelter"
              class="bg-emerald-900/40 text-emerald-200 border border-emerald-700/60 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1"
            >
              <span>🟢</span>
              <span>{{ shelter }}</span>
            </span>
          </div>
        </div>

        <!-- 避難条件 ＆ 推奨アクション -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div class="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span class="text-slate-400 block text-[11px] mb-1 font-bold">避難基準・ハザード条件</span>
            <span class="text-slate-200 text-xs leading-relaxed">{{ parsedData.hazardCondition }}</span>
          </div>
          <div class="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60">
            <span class="text-rose-400 block text-[11px] mb-1 font-bold">推奨避難行動</span>
            <span class="text-rose-200 text-xs font-extrabold leading-relaxed">{{ parsedData.recommendedAction }}</span>
          </div>
        </div>
      </div>

      <!-- 防災DXアーキテクチャの解説 -->
      <div class="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 text-xs text-slate-400 space-y-1 leading-relaxed">
        <strong class="text-cyan-400 block mb-1">💡 なぜこのテキスト構造化が必要なのか？</strong>
        自治体が配信する緊急速報メール（エリアメール）は文字情報に限定されています。住民や旅行者は「山手町・元町等の急傾斜地」と書かれていても自分が今そこにいるか直感できません。本システムはテキストをLLMで空間情報へと瞬時に逆引き変換し、ハザードマップと突合します。
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ParsedEvacuationAlert } from '../services/geminiParser';

defineProps<{
  rawText: string;
  parsedData: ParsedEvacuationAlert;
  isParsing: boolean;
}>();

defineEmits<{
  (e: 'update:rawText', val: string): void;
  (e: 'run-parse'): void;
  (e: 'switch-to-map'): void;
}>();
</script>
