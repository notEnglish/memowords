<script setup lang="ts">
// ============================================================
// MemoWords — 学习进度条
// ============================================================

defineProps<{
  newProgress: { current: number; total: number };
  reviewProgress: { current: number; total: number };
}>();
</script>

<template>
  <div class="w-full space-y-3">
    <!-- 新词进度 -->
    <div>
      <div class="mb-1 flex items-center justify-between text-xs">
        <span class="text-gray-500">新词</span>
        <span class="text-gray-600">{{ newProgress.current }} / {{ newProgress.total }}</span>
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          class="h-full rounded-full bg-primary-500 transition-all duration-300"
          :style="{ width: newProgress.total > 0 ? (newProgress.current / newProgress.total) * 100 + '%' : '0%' }"
        ></div>
      </div>
    </div>

    <!-- 复习进度 -->
    <div>
      <div class="mb-1 flex items-center justify-between text-xs">
        <span class="text-gray-500">复习</span>
        <span class="text-gray-600">{{ reviewProgress.current }} / {{ reviewProgress.total }}</span>
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          class="h-full rounded-full bg-amber-400 transition-all duration-300"
          :style="{ width: reviewProgress.total > 0 ? (reviewProgress.current / reviewProgress.total) * 100 + '%' : '0%' }"
        ></div>
      </div>
    </div>
  </div>
</template>
