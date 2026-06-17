<script setup lang="ts">
// ============================================================
// MemoWords — 三按钮反馈组件
// ============================================================

const emit = defineEmits<{
  feedback: [type: 'correct' | 'hazy' | 'forgot'];
}>();
</script>

<template>
  <div class="flex items-center justify-center space-x-3">
    <button
      @click="emit('feedback', 'forgot')"
      class="flex-1 rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 transition-all hover:border-red-400 hover:bg-red-100 active:scale-95"
    >
      <span class="block text-lg">✗</span>
      忘记
    </button>
    <button
      @click="emit('feedback', 'hazy')"
      class="flex-1 rounded-xl border-2 border-yellow-200 bg-yellow-50 px-4 py-3 text-sm font-semibold text-yellow-600 transition-all hover:border-yellow-400 hover:bg-yellow-100 active:scale-95"
    >
      <span class="block text-lg">~</span>
      模糊
    </button>
    <button
      @click="emit('feedback', 'correct')"
      class="flex-1 rounded-xl border-2 border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-600 transition-all hover:border-green-400 hover:bg-green-100 active:scale-95"
    >
      <span class="block text-lg">✓</span>
      认识
    </button>
  </div>
</template>
