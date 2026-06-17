<script setup lang="ts">
// ============================================================
// MemoWords — 背词主界面
// ============================================================

import { onMounted, onBeforeUnmount, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useLearnStore } from '@/stores/learnStore';
import { useWordbookStore } from '@/stores/wordbookStore';
import { useAuthStore } from '@/stores/authStore';
import type { Feedback, LearnSummary, WordRecord } from '@/types';
import WordCard from '@/components/WordCard.vue';
import ProgressBar from '@/components/ProgressBar.vue';

const router = useRouter();
const learnStore = useLearnStore();
const wordbookStore = useWordbookStore();
const authStore = useAuthStore();

const flipped = ref(false);
const isLoading = ref(true);
const loadError = ref('');
const showSummary = ref(false);
const summary = ref<LearnSummary | null>(null);

// 继续学习相关
const showContinueLearn = ref(false);
const continueLearnCount = ref(10);
const isContinuingLearn = ref(false);

// 空状态细分
const emptyState = ref<'none' | 'noWordbook' | 'noWords' | 'quotaReached' | 'error'>('none');
const wordbookWordCount = ref(0);
const learnedCount = ref(0);
const reviewDueCount = ref(0);

let isDestroyed = false;

async function doLoad(): Promise<void> {
  const timeoutId = setTimeout(() => {
    if (isLoading.value) {
      loadError.value = '加载超时，请检查网络连接';
      emptyState.value = 'error';
      isLoading.value = false;
    }
  }, 15000);

  try {
    if (!wordbookStore.activeWordbookId) {
      try {
        await wordbookStore.init(false);
      } catch (e) {
      }
    }

    if (isDestroyed) return;

    if (!wordbookStore.activeWordbookId) {
      emptyState.value = 'noWordbook';
      isLoading.value = false;
      return;
    }

    await learnStore.buildQueue();

    if (isDestroyed) return;

    const wb = wordbookStore.wordbooks.find((w) => w.id === wordbookStore.activeWordbookId);
    if (wb) wordbookWordCount.value = wb.wordCount;

    if (wb && wb.wordCount === 0) {
      emptyState.value = 'noWords';
      isLoading.value = false;
      return;
    }

    if (learnStore.queue.length === 0) {
      emptyState.value = 'quotaReached';
      isLoading.value = false;
      return;
    }

    isLoading.value = false;
  } catch (e) {
    if (isDestroyed) return;
    loadError.value = e instanceof Error ? e.message : '加载失败';
    emptyState.value = 'error';
    isLoading.value = false;
  } finally {
    clearTimeout(timeoutId);
  }
}

onMounted(() => {
  // 后台加载，不阻塞页面渲染
  isLoading.value = true;
  doLoad();
});

onBeforeUnmount(() => {
  isDestroyed = true;
});

// 旧格式字段兼容：新旧格式均能正确读取 headWord
interface OldWordRecord {
  id: string;
  wordbookId: string;
  word?: string;
  phonetic?: string;
  meaning?: string;
  example?: string;
  exampleCn?: string;
  sortOrder: number;
  headWord?: string;
}

function getHeadWord(wr: WordRecord | OldWordRecord | null | undefined): string {
  if (!wr) return '';
  // 新格式
  if ((wr as WordRecord).content?.word?.wordHead) return (wr as WordRecord).content!.word!.wordHead;
  // 旧格式
  if ((wr as OldWordRecord).headWord) return (wr as OldWordRecord).headWord!;
  if ((wr as OldWordRecord).word) return (wr as OldWordRecord).word!;
  return '';
}

const currentWord = computed(() => {
  const wr = learnStore.currentItem?.wordRecord as WordRecord | OldWordRecord | undefined;
  if (!wr) return null;
  return getHeadWord(wr) ? wr as WordRecord : null;
});

function handleFlip(): void {
  flipped.value = !flipped.value;
}

function handleFeedback(feedback: Feedback): void {
  learnStore.submitFeedback(feedback);
  flipped.value = false;
  if (learnStore.isComplete) {
    summary.value = learnStore.getSummary();
    showSummary.value = true;
  }
}

function backToDashboard(): void {
  router.push('/');
}

function goToWordbooks(): void {
  router.push('/wordbooks');
}

function openContinueLearn(): void {
  continueLearnCount.value = 10;
  showContinueLearn.value = true;
}

async function handleContinueLearn(): Promise<void> {
  isContinuingLearn.value = true;
  showContinueLearn.value = false;
  showSummary.value = false;

  const originalProfile = authStore.profile;
  if (originalProfile) {
    await authStore.updateProfile({
      dailyNewLimit: continueLearnCount.value,
    });
  }

  learnStore.reset();
  await learnStore.buildQueue();

  if (originalProfile) {
    await authStore.updateProfile({
      dailyNewLimit: originalProfile.dailyNewLimit ?? 20,
    });
  }

  if (isDestroyed) return;

  if (learnStore.queue.length > 0) {
    isLoading.value = false;
    flipped.value = false;
    emptyState.value = 'none';
  } else {
    emptyState.value = 'quotaReached';
    isLoading.value = false;
  }

  isContinuingLearn.value = false;
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- 正常学习界面 -->
    <template v-if="!isLoading && !showSummary && currentWord && emptyState === 'none'">
      <!-- 顶部固定区域 -->
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-bold text-gray-800">背单词</h1>
        <span class="text-sm text-gray-400">
          {{ learnStore.currentIndex + 1 }} / {{ learnStore.queue.length }}
        </span>
      </div>

      <ProgressBar
        :new-progress="learnStore.progressNew"
        :review-progress="learnStore.progressReview"
      />

      <div class="mb-2 text-center">
        <span
          v-if="learnStore.currentItem?.userWordRecord.state === 'new'"
          class="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-600"
        >
          新词
        </span>
        <span
          v-else
          class="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-600"
        >
          复习
        </span>
      </div>

      <!-- 卡片区域：自适应填充剩余空间 -->
      <div class="flex-1 min-h-0 flex items-center justify-center p-4">
        <WordCard
          :word="currentWord"
          :flipped="flipped"
          :show-feedback="flipped"
          :auto-pronounce="authStore.profile?.autoPronounce ?? true"
          :user-word-record="learnStore.currentItem?.userWordRecord ?? null"
          @flip="handleFlip"
          @feedback="handleFeedback"
        />
      </div>
    </template>

    <!-- 加载中 - 骨架屏 -->
    <div v-if="isLoading" class="flex-1 min-h-0 space-y-6 py-8">
      <!-- 标题骨架 -->
      <div class="flex items-center justify-between">
        <div class="h-7 w-32 rounded bg-gray-200 animate-pulse"></div>
        <div class="h-5 w-20 rounded bg-gray-200 animate-pulse"></div>
      </div>

      <!-- 进度条骨架 -->
      <div class="space-y-2">
        <div class="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
          <div class="h-full w-1/3 bg-gray-200 animate-pulse"></div>
        </div>
        <div class="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
          <div class="h-full w-1/4 bg-gray-200 animate-pulse"></div>
        </div>
      </div>

      <!-- 单词状态标签骨架 -->
      <div class="flex justify-center">
        <div class="h-6 w-16 rounded-full bg-gray-200 animate-pulse"></div>
      </div>

      <!-- 单词卡片骨架 -->
      <div class="card p-6">
        <div class="h-16 w-full rounded bg-gray-100 animate-pulse mb-4"></div>
        <div class="space-y-2">
          <div class="h-4 w-3/4 rounded bg-gray-100 animate-pulse"></div>
          <div class="h-4 w-1/2 rounded bg-gray-100 animate-pulse"></div>
          <div class="h-4 w-5/6 rounded bg-gray-100 animate-pulse"></div>
        </div>
        <div class="mt-6 flex justify-center space-x-3">
          <div class="h-10 w-20 rounded-lg bg-gray-200 animate-pulse"></div>
          <div class="h-10 w-20 rounded-lg bg-gray-200 animate-pulse"></div>
          <div class="h-10 w-20 rounded-lg bg-gray-200 animate-pulse"></div>
        </div>
      </div>

      <!-- 加载提示 -->
      <div class="text-center">
        <p class="text-sm text-gray-400">正在准备今日学习内容...</p>
        <div class="mt-2 flex justify-center space-x-1">
          <span class="inline-block h-2 w-2 animate-bounce rounded-full bg-primary-500"></span>
          <span class="inline-block h-2 w-2 animate-bounce rounded-full bg-primary-500" style="animation-delay: 0.1s"></span>
          <span class="inline-block h-2 w-2 animate-bounce rounded-full bg-primary-500" style="animation-delay: 0.2s"></span>
        </div>
        <div class="mt-4 flex justify-center space-x-2">
          <button @click="backToDashboard" class="btn-secondary text-xs">返回首页</button>
          <button @click="goToWordbooks" class="btn-secondary text-xs">词库管理</button>
        </div>
      </div>
    </div>

    <!-- 调试诊断：显示当前状态 -->
    <div v-if="!isLoading && !showSummary && emptyState === 'none' && !currentWord" class="card mx-auto max-w-sm py-10 text-center">
      <div class="mb-3 text-3xl">🔍</div>
      <h2 class="mb-2 text-lg font-semibold text-gray-800">加载异常</h2>
      <div class="mt-4 text-left text-xs text-gray-500 space-y-1 bg-gray-50 p-3 rounded">
        <p>isLoading: {{ isLoading }}</p>
        <p>emptyState: {{ emptyState }}</p>
        <p>showSummary: {{ showSummary }}</p>
        <p>currentWord: {{ !!currentWord }}</p>
        <p>wordbookStore.wordbooks.length: {{ wordbookStore.wordbooks.length }}</p>
        <p>wordbookStore.activeWordbookId: {{ wordbookStore.activeWordbookId }}</p>
        <p>learnStore.queue.length: {{ learnStore.queue.length }}</p>
        <p>authStore.user: {{ !!authStore.user }}</p>
        <p>wordbookStore.isLoading: {{ wordbookStore.isLoading }}</p>
        <!-- 诊断：打印队列第一个item的字段结构 -->
        <p v-if="learnStore.queue.length > 0">queue[0] keys: {{ Object.keys(learnStore.queue[0]?.wordRecord || {}) }}</p>
        <p v-if="learnStore.queue.length > 0">queue[0].wordRecord.headWord: {{ learnStore.queue[0]?.wordRecord?.headWord }}</p>
        <p v-if="learnStore.queue.length > 0">queue[0].wordRecord.word (旧): {{ (learnStore.queue[0]?.wordRecord as OldWordRecord | undefined)?.word }}</p>
        <p v-if="learnStore.queue.length > 0">queue[0].wordRecord.content: {{ typeof learnStore.queue[0]?.wordRecord?.content }}</p>
      </div>
      <div class="mt-4 space-y-2">
        <button @click="isLoading = true; emptyState = 'none'; doLoad()" class="btn-primary w-full py-2.5 text-xs">
          重试
        </button>
        <button @click="backToDashboard" class="btn-secondary w-full py-2.5 text-xs">返回首页</button>
      </div>
    </div>

    <!-- 加载错误 -->
    <div v-if="emptyState === 'error'" class="card mx-auto max-w-sm py-10 text-center">
      <div class="mb-3 text-3xl">⚠️</div>
      <h2 class="mb-2 text-lg font-semibold text-gray-800">加载失败</h2>
      <p class="mb-6 text-sm text-gray-500">{{ loadError || '词库加载出现问题，请稍后重试' }}</p>
      <div class="space-y-2">
        <button @click="isLoading = true; emptyState = 'none'; doLoad()" class="btn-primary w-full py-2.5 text-xs">
          重试
        </button>
        <button @click="backToDashboard" class="btn-secondary w-full py-2.5 text-xs">返回首页</button>
      </div>
    </div>

    <!-- 没有激活的词库 -->
    <div v-if="emptyState === 'noWordbook'" class="card mx-auto max-w-sm py-10 text-center">
      <div class="mb-3 text-3xl">📚</div>
      <h2 class="mb-2 text-lg font-semibold text-gray-800">还没有选择词库</h2>
      <p class="mb-6 text-sm text-gray-500">请先去词库管理选择一个词库</p>
      <button @click="goToWordbooks" class="btn-primary w-full py-2.5">
        去选择词库
      </button>
    </div>

    <!-- 词库中没有单词 -->
    <div v-if="emptyState === 'noWords'" class="card mx-auto max-w-sm py-10 text-center">
      <div class="mb-3 text-3xl">📭</div>
      <h2 class="mb-2 text-lg font-semibold text-gray-800">词库为空</h2>
      <p class="mb-6 text-sm text-gray-500">当前激活的词库中没有单词，请导入新的词库</p>
      <button @click="goToWordbooks" class="btn-primary w-full py-2.5">
        去词库管理
      </button>
    </div>

    <!-- 今日配额用尽 -->
    <div v-if="emptyState === 'quotaReached'" class="card mx-auto max-w-sm py-10 text-center">
      <div class="mb-3 text-3xl">✨</div>
      <h2 class="mb-2 text-lg font-semibold text-gray-800">今日学习已就绪</h2>
      <p class="mb-6 text-sm text-gray-500">
        词库共 {{ wordbookWordCount }} 个单词。<br />
        已学 {{ learnedCount }} 个，当前没有到期复习的单词。<br />
        可以提高每日新词上限，或稍后再来查看复习单词。
      </p>
      <div class="space-y-2">
        <button @click="router.push('/settings')" class="btn-secondary w-full py-2.5 text-sm">
          调整每日学习目标
        </button>
        <button @click="backToDashboard" class="btn-primary w-full py-2.5">
          返回首页
        </button>
      </div>
    </div>

    <!-- 学习完成弹窗 -->
    <div v-if="showSummary && summary" class="card mx-auto max-w-sm text-center">
      <div class="mb-4 text-4xl">🎉</div>
      <h2 class="mb-6 text-xl font-bold text-gray-800">今日任务完成！</h2>

      <div class="mb-6 space-y-2 text-sm">
        <div class="flex justify-between">
          <span class="text-gray-500">新学单词</span>
          <span class="font-semibold">{{ summary.newLearned }} 个</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">复习单词</span>
          <span class="font-semibold">{{ summary.reviewedCount }} 个</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">正确率</span>
          <span class="font-semibold text-green-600">
            {{ summary.correctCount + summary.hazyCount + summary.forgotCount > 0
              ? Math.round((summary.correctCount / (summary.correctCount + summary.hazyCount + summary.forgotCount)) * 100)
              : 0 }}%
          </span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">预计明天复习</span>
          <span class="font-semibold">{{ summary.nextDayReviewCount }} 个</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">连续打卡</span>
          <span class="font-semibold text-purple-600">{{ summary.streakDays }} 天</span>
        </div>
      </div>

      <div class="flex space-x-3">
        <button @click="backToDashboard" class="btn-secondary flex-1 py-2.5">
          返回首页
        </button>
        <button @click="openContinueLearn" class="btn-primary flex-1 py-2.5">
          继续学习
        </button>
      </div>
    </div>

    <!-- 继续学习弹窗 -->
    <div v-if="showContinueLearn" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h3 class="mb-4 text-lg font-semibold text-gray-800">继续学习</h3>
        <p class="mb-4 text-sm text-gray-500">请选择本次新增学习单词数：</p>
        <div class="mb-6 flex space-x-2">
          <button
            v-for="count in [5, 10, 20, 30]"
            :key="count"
            @click="continueLearnCount = count"
            :class="[
              'flex-1 rounded-lg py-2 text-sm font-medium transition-colors',
              continueLearnCount === count
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            ]"
          >
            {{ count }}词
          </button>
        </div>
        <div class="flex space-x-3">
          <button @click="showContinueLearn = false" class="flex-1 rounded-lg bg-gray-100 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200">
            取消
          </button>
          <button @click="handleContinueLearn" :disabled="isContinuingLearn" class="flex-1 rounded-lg bg-primary-500 py-2.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50">
            {{ isContinuingLearn ? '加载中...' : '开始学习' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
