// ============================================================
// MemoWords — 统计管理 Store
// 新架构：所有操作直接通过 Supabase，数据缓存到 Pinia
// ============================================================

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { DailyStatRecord } from '@/types';
import { supabase } from '@/supabase/client';
import { useAuthStore } from './authStore';

export interface TrendItem {
  date: string;
  newLearned: number;
  reviewed: number;
  correct: number;
  hazy: number;
  forgot: number;
}

export const useStatsStore = defineStore('stats', () => {
  const stats = ref<DailyStatRecord[]>([]);
  const isLoading = ref(false);

  const totalNewLearned = computed(() => stats.value.reduce((sum, s) => sum + s.newLearned, 0));
  const totalReviewed = computed(() => stats.value.reduce((sum, s) => sum + s.reviewed, 0));
  const totalCorrect = computed(() => stats.value.reduce((sum, s) => sum + s.correct, 0));
  const totalHazy = computed(() => stats.value.reduce((sum, s) => sum + s.hazy, 0));
  const totalForgot = computed(() => stats.value.reduce((sum, s) => sum + s.forgot, 0));

  const correctRate = computed(() => {
    const total = totalCorrect.value + totalHazy.value + totalForgot.value;
    return total > 0 ? Math.round((totalCorrect.value / total) * 100) : 0;
  });

  async function loadStats(days: number = 30): Promise<void> {
    isLoading.value = true;
    const authStore = useAuthStore();
    if (!authStore.user) {
      isLoading.value = false;
      return;
    }

    try {
      const { data, error } = await supabase
        .from('daily_stats')
        .select('*')
        .eq('user_id', authStore.user.id)
        .order('stat_date', { ascending: false })
        .limit(days);

      if (!error && data !== null) {
        stats.value = data.map(row => ({
          id: row.id,
          userId: row.user_id,
          statDate: row.stat_date,
          newLearned: row.new_learned ?? 0,
          reviewed: row.reviewed ?? 0,
          correct: row.correct ?? 0,
          hazy: row.hazy ?? 0,
          forgot: row.forgot ?? 0,
          durationSec: row.duration_sec ?? 0,
          updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
        }));
      } else {
        stats.value = [];
      }
    } catch (e) {
      stats.value = [];
    }

    isLoading.value = false;
  }

  function getTrend(): TrendItem[] {
    return stats.value
      .slice()
      .reverse()
      .map((s) => ({
        date: s.statDate.slice(5),
        newLearned: s.newLearned,
        reviewed: s.reviewed,
        correct: s.correct,
        hazy: s.hazy,
        forgot: s.forgot,
      }));
  }

  function getStreak(): number {
    if (stats.value.length === 0) return 0;

    const sorted = [...stats.value].sort((a, b) => b.statDate.localeCompare(a.statDate));
    let streak = 0;
    const today = new Date().toISOString().slice(0, 10);

    if (sorted[0].statDate !== today) return 0;

    for (let i = 0; i < sorted.length; i++) {
      const expected = new Date();
      expected.setDate(expected.getDate() - i);
      const expectedStr = expected.toISOString().slice(0, 10);

      if (sorted[i] && sorted[i].statDate === expectedStr) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  function getWeekHeatmap(): { day: string; date: string; total: number }[] {
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    const result: { day: string; date: string; total: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const stat = stats.value.find((s) => s.statDate === dateStr);
      result.push({
        day: dayNames[d.getDay()],
        date: dateStr.slice(5),
        total: stat ? stat.newLearned + stat.reviewed : 0,
      });
    }

    return result;
  }

  return {
    stats,
    isLoading,
    totalNewLearned,
    totalReviewed,
    totalCorrect,
    totalHazy,
    totalForgot,
    correctRate,
    loadStats,
    getTrend,
    getStreak,
    getWeekHeatmap,
  };
});