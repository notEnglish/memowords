<script setup lang="ts">
// ============================================================
// MemoWords — 学习统计页
// ============================================================

import { onMounted, computed } from 'vue';
import { useStatsStore } from '@/stores/statsStore';
import StatsChart from '@/components/StatsChart.vue';

const statsStore = useStatsStore();

onMounted(async () => {
  await statsStore.loadStats(30);
});

const trend = computed(() => statsStore.getTrend());
const heatmap = computed(() => statsStore.getWeekHeatmap());
const streak = computed(() => statsStore.getStreak());

function generateCalendarGrid(): ({ day: number; hasData: boolean } | null)[] {
  const today = new Date();
  const daysToShow = 14;

  const recentDates = new Set<string>();
  for (let i = 0; i < daysToShow; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    recentDates.add(d.toISOString().slice(0, 10));
  }

  const start = new Date(today);
  start.setDate(start.getDate() - (daysToShow - 1));
  const startDay = start.getDay();
  start.setDate(start.getDate() - startDay);

  const grid: ({ day: number; hasData: boolean } | null)[] = [];
  const totalCells = 14 + startDay > 28 ? 35 : 28;

  for (let i = 0; i < totalCells; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);

    if (d > today) {
      grid.push(null);
    } else {
      grid.push({
        day: d.getDate(),
        hasData: recentDates.has(dateStr) && statsStore.stats.some((s) => s.statDate === dateStr),
      });
    }
  }

  return grid;
}

const calendarGrid = computed(() => generateCalendarGrid());
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-xl font-bold text-gray-800">学习统计</h1>

    <!-- 累计面板 -->
    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div class="card flex flex-col items-center py-4">
        <span class="text-2xl font-bold text-primary-600">{{ statsStore.totalNewLearned }}</span>
        <span class="mt-1 text-xs text-gray-400">累计新学</span>
      </div>
      <div class="card flex flex-col items-center py-4">
        <span class="text-2xl font-bold text-amber-500">{{ statsStore.totalReviewed }}</span>
        <span class="mt-1 text-xs text-gray-400">累计复习</span>
      </div>
      <div class="card flex flex-col items-center py-4">
        <span class="text-2xl font-bold text-green-500">{{ statsStore.correctRate }}%</span>
        <span class="mt-1 text-xs text-gray-400">正确率</span>
      </div>
      <div class="card flex flex-col items-center py-4">
        <span class="text-2xl font-bold text-purple-500">{{ streak }}</span>
        <span class="mt-1 text-xs text-gray-400">连续打卡</span>
      </div>
    </div>

    <!-- 图表区域 -->
    <StatsChart :trend="trend" :heatmap="heatmap" />

    <!-- 学习日历 -->
    <div class="card">
      <h3 class="mb-4 text-sm font-semibold text-gray-700">学习日历（最近 14 天）</h3>
      <div class="grid grid-cols-7 gap-1 text-center">
        <span class="py-1 text-xs text-gray-400">日</span>
        <span class="py-1 text-xs text-gray-400">一</span>
        <span class="py-1 text-xs text-gray-400">二</span>
        <span class="py-1 text-xs text-gray-400">三</span>
        <span class="py-1 text-xs text-gray-400">四</span>
        <span class="py-1 text-xs text-gray-400">五</span>
        <span class="py-1 text-xs text-gray-400">六</span>

        <template v-for="(cell, idx) in calendarGrid" :key="idx">
          <div
            v-if="cell"
            :class="[
              'rounded py-1.5 text-xs',
              cell.hasData
                ? 'bg-primary-100 font-medium text-primary-700'
                : 'bg-gray-100 text-gray-300',
            ]"
          >
            {{ cell.day }}
          </div>
          <div v-else class="py-1.5"></div>
        </template>
      </div>
    </div>
  </div>
</template>
