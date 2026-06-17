<script setup lang="ts">
// ============================================================
// MemoWords — Chart.js 统计图表
// ============================================================

import { computed } from 'vue';
import { Line, Bar } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

export interface TrendItem {
  date: string;
  newLearned: number;
  reviewed: number;
  correct: number;
  hazy: number;
  forgot: number;
}

export interface HeatmapItem {
  day: string;
  date: string;
  total: number;
}

const props = defineProps<{
  trend: TrendItem[];
  heatmap: HeatmapItem[];
}>();

const trendChartData = computed(() => ({
  labels: props.trend.map((t) => t.date),
  datasets: [
    {
      label: '新学',
      data: props.trend.map((t) => t.newLearned),
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      fill: true,
      tension: 0.3,
      pointRadius: 3,
    },
    {
      label: '复习',
      data: props.trend.map((t) => t.reviewed),
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      fill: true,
      tension: 0.3,
      pointRadius: 3,
    },
  ],
}));

const trendChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
      labels: { usePointStyle: true, boxWidth: 8 },
    },
  },
  scales: {
    y: { beginAtZero: true, ticks: { stepSize: 5 } },
    x: { ticks: { maxTicksLimit: 10 } },
  },
};

const heatmapChartData = computed(() => ({
  labels: props.heatmap.map((h) => h.day + '\n' + h.date),
  datasets: [
    {
      label: '学习量',
      data: props.heatmap.map((h) => h.total),
      backgroundColor: props.heatmap.map((h) => {
        if (h.total === 0) return '#f1f5f9';
        if (h.total < 20) return '#93c5fd';
        if (h.total < 50) return '#60a5fa';
        return '#3b82f6';
      }),
      borderRadius: 6,
    },
  ],
}));

const heatmapOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
  },
  scales: {
    y: { beginAtZero: true, ticks: { stepSize: 10 } },
    x: { grid: { display: false } },
  },
};
</script>

<template>
  <div class="space-y-8">
    <!-- 学习趋势折线图 -->
    <div class="card">
      <h3 class="mb-4 text-sm font-semibold text-gray-700">学习趋势（近 30 天）</h3>
      <div class="h-64">
        <Line :data="trendChartData" :options="trendChartOptions" />
      </div>
    </div>

    <!-- 本周热力图 -->
    <div class="card">
      <h3 class="mb-4 text-sm font-semibold text-gray-700">本周学习热力</h3>
      <div class="h-48">
        <Bar :data="heatmapChartData" :options="heatmapOptions" />
      </div>
    </div>
  </div>
</template>
