<script setup lang="ts">
// ============================================================
// MemoWords — 首页仪表盘
// ============================================================

import { onMounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { useWordbookStore } from '@/stores/wordbookStore';
import { useStatsStore } from '@/stores/statsStore';

const router = useRouter();
const authStore = useAuthStore();
const wordbookStore = useWordbookStore();
const statsStore = useStatsStore();

const todayReviewCount = ref(0);
const todayNewLearned = ref(0);

onMounted(async () => {
  // 统计今日数据
  const today = new Date().toISOString().slice(0, 10);
  
  await statsStore.loadStats();
  
  const todayStat = statsStore.stats.find((s) => s.statDate === today);
  if (todayStat) {
    todayReviewCount.value = todayStat.reviewed;
    todayNewLearned.value = todayStat.newLearned;
  }
});

const activeWordbook = computed(() => wordbookStore.getActiveWordbook());
const streak = computed(() => statsStore.getStreak());
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold text-gray-800">今日学习</h1>

    <!-- 进度卡片 -->
    <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
      <div class="card flex flex-col items-center py-4">
        <span class="text-3xl font-bold text-primary-600">{{ todayNewLearned }}</span>
        <span class="mt-1 text-xs text-gray-400">今日新学</span>
      </div>
      <div class="card flex flex-col items-center py-4">
        <span class="text-3xl font-bold text-amber-500">{{ todayReviewCount }}</span>
        <span class="mt-1 text-xs text-gray-400">今日复习</span>
      </div>
      <div class="card flex flex-col items-center py-4">
        <span class="text-3xl font-bold text-green-500">{{ statsStore.correctRate }}%</span>
        <span class="mt-1 text-xs text-gray-400">正确率</span>
      </div>
      <div class="card flex flex-col items-center py-4">
        <span class="text-3xl font-bold text-purple-500">{{ streak }}</span>
        <span class="mt-1 text-xs text-gray-400">连续打卡</span>
      </div>
    </div>

    <!-- 快捷入口 -->
    <div class="card">
      <div class="flex flex-col items-center space-y-4 py-4">
        <p class="text-sm text-gray-500">
          {{ activeWordbook ? `当前词库：${activeWordbook.name}` : '暂无词库' }}
        </p>
        <button
          @click="router.push('/learn')"
          class="btn-primary px-10 py-3 text-base"
          :disabled="!activeWordbook"
        >
          开始背单词
        </button>
      </div>
    </div>

    <!-- 累计统计 -->
    <div class="card">
      <h3 class="mb-4 text-sm font-semibold text-gray-700">累计统计</h3>
      <div class="grid grid-cols-3 gap-4 text-center">
        <div>
          <span class="block text-xl font-bold text-gray-800">{{ statsStore.totalNewLearned }}</span>
          <span class="text-xs text-gray-400">累计新学</span>
        </div>
        <div>
          <span class="block text-xl font-bold text-gray-800">{{ statsStore.totalReviewed }}</span>
          <span class="text-xs text-gray-400">累计复习</span>
        </div>
        <div>
          <span class="block text-xl font-bold text-gray-800">{{ statsStore.totalCorrect }}</span>
          <span class="text-xs text-gray-400">累计正确</span>
        </div>
      </div>
    </div>
  </div>
</template>