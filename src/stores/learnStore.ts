// ============================================================
// MemoWords — 学习状态管理
// 新架构：所有操作直接通过 Supabase，数据缓存到 Pinia
// 队列持久化：跨页面导航保留队列状态
// 单词顺序：复习词优先，新词在后
// ============================================================

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { WordRecord, UserWordRecord, Feedback, QueueItem, LearnSummary, SM2Result } from '@/types';
import { supabase } from '@/supabase/client';
import { computeSM2, createInitialSM2State } from '@/algorithms/sm2';
import { computeSSPMC } from '@/algorithms/ssp-mmc';
import { useAuthStore } from './authStore';
import { useWordbookStore } from './wordbookStore';
import { v4 } from '@/composables/uuid';

export const useLearnStore = defineStore('learn', () => {
  const queue = ref<QueueItem[]>([]);
  const currentIndex = ref(0);
  const isComplete = ref(false);
  const dailyNewCount = ref(0);
  const dailyReviewCount = ref(0);
  const isLoading = ref(false);

  const sessionNewCount = ref(0);
  const sessionReviewCount = ref(0);
  const sessionCorrect = ref(0);
  const sessionHazy = ref(0);
  const sessionForgot = ref(0);

  const initialReviewCount = ref(0);
  const initialNewCount = ref(0);
  const completedReviewWordIds = ref(new Set<string>());
  const completedNewWordIds = ref(new Set<string>());

  const currentItem = computed<QueueItem | null>(() => {
    if (currentIndex.value >= queue.value.length) return null;
    return queue.value[currentIndex.value];
  });

  const progressNew = computed(() => {
    const total = initialNewCount.value || (useAuthStore().profile?.dailyNewLimit ?? 20);
    return { current: completedNewWordIds.value.size, total };
  });

  const progressReview = computed(() => {
    const now = new Date();
    let completedCount = 0;
    for (const id of completedReviewWordIds.value) {
      const item = queue.value.find(q => q.userWordId === id);
      if (item && item.userWordRecord.nextReviewAt > now) {
        completedCount++;
      }
    }
    return { current: completedCount, total: initialReviewCount.value };
  });

  async function buildQueue(forceRebuild: boolean = false): Promise<void> {
    const authStore = useAuthStore();
    const wordbookStore = useWordbookStore();

    if (!authStore.user || !wordbookStore.activeWordbookId) {
      queue.value = [];
      currentIndex.value = 0;
      isComplete.value = true;
      return;
    }

    if (!forceRebuild && queue.value.length > 0 && !isComplete.value) {
      const hasReviewWords = queue.value.some(q => q.userWordRecord.state !== 'new');
      if (hasReviewWords) {
        return;
      }
    }

    isLoading.value = true;

    try {
      const userId = authStore.user.id;
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const activeWordbookId = wordbookStore.activeWordbookId;
      const dailyLimit = authStore.profile?.dailyNewLimit ?? 20;

      const [userWordsResult, learnedIdsResult, todayStatsResult] = await Promise.all([
        supabase
          .from('user_words')
          .select('id, word_id, state, ease_factor, interval, repetitions, next_review_at, total_reviews')
          .eq('user_id', userId)
          .eq('wordbook_id', activeWordbookId),

        supabase
          .from('user_words')
          .select('word_id')
          .eq('user_id', userId)
          .eq('wordbook_id', activeWordbookId),

        supabase
          .from('daily_stats')
          .select('new_learned')
          .eq('user_id', userId)
          .eq('stat_date', today)
          .single(),
      ]);

      dailyNewCount.value = todayStatsResult.data?.new_learned ?? 0;

      const allUserWords: UserWordRecord[] = (userWordsResult.data ?? []).map(row => {
        const nextReviewAt = row.next_review_at ? new Date(row.next_review_at) : new Date();
        return {
          id: row.id,
          userId,
          wordId: row.word_id,
          headWord: '',
          wordbookId: activeWordbookId,
          state: row.state,
          step: 0,
          easeFactor: row.ease_factor ?? 2.5,
          interval: row.interval ?? 0,
          repetitions: row.repetitions ?? 0,
          nextReviewAt,
          totalReviews: row.total_reviews ?? 0,
          totalCorrect: 0,
          totalHazy: 0,
          totalForgot: 0,
          lastReviewAt: null,
          lastFeedback: '',
          updatedAt: new Date(),
        };
      });

      const learnedWordIds = new Set((learnedIdsResult.data ?? []).map((row: { word_id: string }) => row.word_id));

      const reviewUserWords = allUserWords.filter(
        (uw) => {
          const isLearningOrReview = uw.state === 'learning' || uw.state === 'review';
          const hasReviewed = uw.repetitions > 0;
          const isDue = uw.nextReviewAt <= now;
          return (isLearningOrReview || hasReviewed) && isDue;
        },
      );

      const newUserWords = allUserWords.filter(
        (uw) => uw.state === 'new',
      );

      const reviewWordIds = reviewUserWords.map(uw => uw.wordId);
      const newWordIds = newUserWords.map(uw => uw.wordId);
      const allNeededWordIds = [...new Set([...reviewWordIds, ...newWordIds])];

      let wordRecordById = new Map<string, WordRecord>();
      if (allNeededWordIds.length > 0) {
        const wordsResult = await supabase
          .from('words')
          .select('id, wordbook_id, head_word, content')
          .eq('wordbook_id', activeWordbookId)
          .in('id', allNeededWordIds);

        for (const row of wordsResult.data ?? []) {
          wordRecordById.set(row.id, {
            id: row.id,
            wordbookId: row.wordbook_id,
            wordRank: 0,
            headWord: row.head_word,
            content: row.content ?? { word: { wordHead: row.head_word, wordId: row.id, content: {} } },
            bookId: row.wordbook_id,
            sortOrder: 0,
          });
        }
      }

      const newQueue: QueueItem[] = [];

      for (const uw of reviewUserWords) {
        const wordRecord = wordRecordById.get(uw.wordId);
        if (wordRecord) {
          newQueue.push({ userWordId: uw.id, wordRecord, userWordRecord: uw });
        }
      }

      const neededNewWords = Math.max(0, dailyLimit - dailyNewCount.value);

      if (neededNewWords > 0) {
        for (const uw of newUserWords.slice(0, neededNewWords)) {
          const wordRecord = wordRecordById.get(uw.wordId);
          if (wordRecord) {
            newQueue.push({ userWordId: uw.id, wordRecord, userWordRecord: uw });
          }
        }

        const remainingNewWords = neededNewWords - newUserWords.length;
        if (remainingNewWords > 0) {
          const availableWordsResult = await supabase
            .from('words')
            .select('id, wordbook_id, head_word, content')
            .eq('wordbook_id', activeWordbookId)
            .not('id', 'in', `(${Array.from(learnedWordIds).join(',')})`)
            .order('sort_order', { ascending: true })
            .limit(remainingNewWords);

          for (const row of availableWordsResult.data ?? []) {
            const wordRecord: WordRecord = {
              id: row.id,
              wordbookId: row.wordbook_id,
              wordRank: 0,
              headWord: row.head_word,
              content: row.content ?? { word: { wordHead: row.head_word, wordId: row.id, content: {} } },
              bookId: row.wordbook_id,
              sortOrder: 0,
            };

            const sm2State = createInitialSM2State();
            const userWordId = v4();
            const newUserWord: UserWordRecord = {
              id: userWordId,
              userId,
              wordId: row.id,
              headWord: row.head_word,
              wordbookId: activeWordbookId,
              state: 'new',
              step: 0,
              easeFactor: sm2State.easeFactor,
              interval: sm2State.interval,
              repetitions: sm2State.repetitions,
              nextReviewAt: sm2State.nextReviewAt,
              totalReviews: 0,
              totalCorrect: 0,
              totalHazy: 0,
              totalForgot: 0,
              lastReviewAt: null,
              lastFeedback: '',
              updatedAt: new Date(),
            };

            try {
              await supabase.from('user_words').insert({
                id: userWordId,
                user_id: userId,
                word_id: row.id,
                wordbook_id: activeWordbookId,
                state: 'new',
                step: 0,
                ease_factor: sm2State.easeFactor,
                interval: sm2State.interval,
                repetitions: sm2State.repetitions,
                next_review_at: sm2State.nextReviewAt.toISOString(),
                total_reviews: 0,
                total_correct: 0,
                total_hazy: 0,
                total_forgot: 0,
                last_review_at: null,
                last_feedback: '',
                updated_at: new Date().toISOString(),
              });
            } catch (e) {
            }

            newQueue.push({ userWordId, wordRecord, userWordRecord: newUserWord });
          }
        }
      }

      queue.value = newQueue;
      currentIndex.value = 0;
      isComplete.value = newQueue.length === 0;

      initialReviewCount.value = newQueue.filter((item) => item.userWordRecord.state !== 'new').length;
      initialNewCount.value = newQueue.filter((item) => item.userWordRecord.state === 'new').length;
      completedReviewWordIds.value = new Set();
      completedNewWordIds.value = new Set();
    } catch (e) {
      queue.value = [];
      currentIndex.value = 0;
      isComplete.value = true;
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function cleanupOrphanNewWords(userId: string, wordbookId: string): Promise<void> {
    try {
      const { data } = await supabase
        .from('user_words')
        .select('id')
        .eq('user_id', userId)
        .eq('wordbook_id', wordbookId)
        .eq('state', 'new');

      for (const row of data ?? []) {
        await supabase.from('user_words').delete().eq('id', row.id);
      }
    } catch (e) {
    }
  }

  async function submitFeedback(feedback: Feedback): Promise<void> {
    const item = currentItem.value;
    if (!item) return;

    const authStore = useAuthStore();
    const userId = authStore.user?.id!;
    const uw = item.userWordRecord;

    const algorithm = authStore.profile?.forgettingAlgorithm ?? 'sm2';

    const sm2State = {
      easeFactor: uw.easeFactor,
      interval: uw.interval,
      repetitions: uw.repetitions,
      nextReviewAt: uw.nextReviewAt,
    };

    let result: SM2Result;
    if (algorithm === 'ssp-mmc') {
      result = computeSSPMC(sm2State, feedback, 10);
    } else {
      result = computeSM2(sm2State, feedback);
    }

    const currentHeadWord = uw.headWord || item.wordRecord.headWord;
    const updatedUW: UserWordRecord = {
      ...uw,
      headWord: currentHeadWord,
      state: result.repetitions >= 2 ? 'review' : 'learning',
      easeFactor: result.easeFactor,
      interval: result.interval,
      repetitions: result.repetitions,
      nextReviewAt: result.nextReviewAt,
      totalReviews: uw.totalReviews + 1,
      totalCorrect: uw.totalCorrect + (feedback === 'correct' ? 1 : 0),
      totalHazy: uw.totalHazy + (feedback === 'hazy' ? 1 : 0),
      totalForgot: uw.totalForgot + (feedback === 'forgot' ? 1 : 0),
      lastReviewAt: new Date(),
      lastFeedback: feedback,
      updatedAt: new Date(),
    };

    // 先更新本地状态（立即生效）
    item.userWordRecord = updatedUW;

    // 异步同步到 Supabase（非阻塞）
    supabase
      .from('user_words')
      .update({
        state: updatedUW.state,
        ease_factor: updatedUW.easeFactor,
        interval: updatedUW.interval,
        repetitions: updatedUW.repetitions,
        next_review_at: updatedUW.nextReviewAt.toISOString(),
        total_reviews: updatedUW.totalReviews,
        total_correct: updatedUW.totalCorrect,
        total_hazy: updatedUW.totalHazy,
        total_forgot: updatedUW.totalForgot,
        last_review_at: updatedUW.lastReviewAt?.toISOString(),
        last_feedback: updatedUW.lastFeedback,
        updated_at: updatedUW.updatedAt.toISOString(),
      })
      .eq('id', updatedUW.id)
      .then(() => {});

    if (uw.state === 'new') {
      dailyNewCount.value++;
      sessionNewCount.value++;
      completedNewWordIds.value.add(updatedUW.id);
    } else {
      dailyReviewCount.value++;
      sessionReviewCount.value++;
      completedReviewWordIds.value.add(updatedUW.id);
    }

    if (feedback === 'correct') sessionCorrect.value++;
    else if (feedback === 'hazy') sessionHazy.value++;
    else sessionForgot.value++;

    // 异步触发每日统计（不阻塞 UI 响应）
    queueMicrotask(() => {
      updateDailyStats(userId, feedback, uw.state).catch(() => {});
    });

    // 如果用户点击"忘记"，单词应该立即再次出现（重新加入队列末尾）
    if (feedback === 'forgot') {
      queue.value.push(item);
    }

    currentIndex.value++;
    if (currentIndex.value >= queue.value.length) {
      isComplete.value = true;
    }
  }

  async function updateDailyStats(userId: string, feedback: Feedback, prevState: string): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);

    const { data: existingData, error: selectErr } = await supabase
      .from('daily_stats')
      .select('id, new_learned, reviewed, correct, hazy, forgot')
      .eq('user_id', userId)
      .eq('stat_date', today)
      .single();

    let stat: {
      id: string;
      userId: string;
      statDate: string;
      newLearned: number;
      reviewed: number;
      correct: number;
      hazy: number;
      forgot: number;
      durationSec: number;
      updatedAt: Date;
    };

    if (!selectErr && existingData) {
      stat = {
        id: existingData.id,
        userId,
        statDate: today,
        newLearned: existingData.new_learned ?? 0,
        reviewed: existingData.reviewed ?? 0,
        correct: existingData.correct ?? 0,
        hazy: existingData.hazy ?? 0,
        forgot: existingData.forgot ?? 0,
        durationSec: 0,
        updatedAt: new Date(),
      };
    } else {
      stat = {
        id: v4(),
        userId,
        statDate: today,
        newLearned: 0,
        reviewed: 0,
        correct: 0,
        hazy: 0,
        forgot: 0,
        durationSec: 0,
        updatedAt: new Date(),
      };
    }

    if (feedback === 'correct') stat.correct++;
    else if (feedback === 'hazy') stat.hazy++;
    else stat.forgot++;

    if (currentItem.value?.userWordRecord.state === 'new') {
      stat.newLearned++;
    } else {
      stat.reviewed++;
    }

    try {
      if (existingData) {
        await supabase
          .from('daily_stats')
          .update({
            new_learned: stat.newLearned,
            reviewed: stat.reviewed,
            correct: stat.correct,
            hazy: stat.hazy,
            forgot: stat.forgot,
            updated_at: stat.updatedAt.toISOString(),
          })
          .eq('id', stat.id);
      } else {
        await supabase.from('daily_stats').insert({
          id: stat.id,
          user_id: stat.userId,
          stat_date: stat.statDate,
          new_learned: stat.newLearned,
          reviewed: stat.reviewed,
          correct: stat.correct,
          hazy: stat.hazy,
          forgot: stat.forgot,
          updated_at: stat.updatedAt.toISOString(),
        });
      }
    } catch (e) {
    }
  }

  function getSummary(): LearnSummary {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const nextDayReviewCount = queue.value.filter((q) => {
      return q.userWordRecord.nextReviewAt <= tomorrow;
    }).length;

    const streakDays = calculateStreak();

    return {
      newLearned: sessionNewCount.value,
      reviewedCount: sessionReviewCount.value,
      correctCount: sessionCorrect.value,
      hazyCount: sessionHazy.value,
      forgotCount: sessionForgot.value,
      nextDayReviewCount,
      streakDays,
    };
  }

  function calculateStreak(): number {
    return 0;
  }

  function reset(): void {
    queue.value = [];
    currentIndex.value = 0;
    isComplete.value = false;
    sessionNewCount.value = 0;
    sessionReviewCount.value = 0;
    sessionCorrect.value = 0;
    sessionHazy.value = 0;
    sessionForgot.value = 0;
    initialReviewCount.value = 0;
    initialNewCount.value = 0;
    completedReviewWordIds.value = new Set();
    completedNewWordIds.value = new Set();
  }

  return {
    queue,
    currentIndex,
    isComplete,
    dailyNewCount,
    dailyReviewCount,
    isLoading,
    currentItem,
    progressNew,
    progressReview,
    sessionNewCount,
    sessionReviewCount,
    sessionCorrect,
    sessionHazy,
    sessionForgot,
    buildQueue,
    submitFeedback,
    getSummary,
    reset,
  };
});