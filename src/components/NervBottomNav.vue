<template>
  <nav class="h-14 sm:h-16 bg-[#0a0a0a]/95 backdrop-blur-md border-t border-slate-800/80 px-2 sm:px-4 flex items-center justify-around z-40 shrink-0 select-none pb-[env(safe-area-inset-bottom)]">
    <button
      v-for="item in navItems"
      :key="item.id"
      @click="$emit('update:modelValue', item.id)"
      class="flex-1 py-1 flex flex-col items-center justify-center gap-0.5 sm:gap-1 transition-all relative"
      :class="modelValue === item.id ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'"
    >
      <!-- アクティブ上部インジケーター -->
      <span
        v-if="modelValue === item.id"
        class="absolute -top-1 w-7 sm:w-8 h-0.5 bg-cyan-400 rounded-full shadow-[0_0_8px_#22d3ee]"
      ></span>

      <span class="text-base sm:text-lg leading-none">{{ item.icon }}</span>
      <span class="text-[10px] sm:text-[11px] tracking-tight whitespace-nowrap">{{ item.label }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string;
}>();

defineEmits<{
  (e: 'update:modelValue', val: string): void;
}>();

const navItems = [
  { id: 'map', label: 'マップ', icon: '🗺️' },
  { id: 'alerts', label: '避難指示・解析', icon: '⚡' },
  { id: 'simulator', label: '台風検証', icon: '🌀' },
  { id: 'settings', label: '設定', icon: '⚙️' }
];
</script>
