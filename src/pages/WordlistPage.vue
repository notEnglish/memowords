<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '@/supabase/client';
import { useWordbookStore } from '@/stores/wordbookStore';
import { useAuthStore } from '@/stores/authStore';
import type { WordRecord } from '@/types';

const route = useRoute();
const router = useRouter();
const wordbookStore = useWordbookStore();
const authStore = useAuthStore();

const wordbookId = computed(() => route.query.id as string);
const wordbookName = ref('');
const wordCount = ref(0);
const words = ref<WordRecord[]>([]);
const isLoading = ref(true);
const searchQuery = ref('');
const isRefreshing = ref(false);
const isImporting = ref(false);
const importFiles = ref<File[]>([]);
const importMsg = ref('');
const showImportModal = ref(false);

const pageSize = ref(20);
const currentPage = ref(1);
const totalPages = ref(1);

const isCurrentWordbook = computed(() => {
  return authStore.profile?.currentWordbookId === wordbookId.value;
});

const paginatedWords = computed(() => {
  if (!searchQuery.value.trim()) {
    const start = (currentPage.value - 1) * pageSize.value;
    return words.value.slice(start, start + pageSize.value);
  }
  return filteredWords.value;
});

const filteredWords = computed(() => {
  if (!searchQuery.value.trim()) {
    return words.value;
  }
  const query = searchQuery.value.toLowerCase();
  return words.value.filter(w => {
    const headWord = w.content?.word?.wordHead?.toLowerCase() || '';
    const meaning = getMeaning(w).toLowerCase();
    return headWord.includes(query) || meaning.includes(query);
  });
});

onMounted(async () => {
  if (!wordbookId.value) {
    router.push('/wordbooks');
    return;
  }

  await loadWordbookInfo();
  await loadWords(1);
  isLoading.value = false;
});

async function loadWordbookInfo(): Promise<void> {
  const wb = wordbookStore.wordbooks.find(w => w.id === wordbookId.value);
  if (wb) {
    wordbookName.value = wb.name;
    wordCount.value = wb.wordCount;
    return;
  }

  try {
    const { data } = await supabase
      .from('wordbooks')
      .select('name, word_count')
      .eq('id', wordbookId.value)
      .single();
    if (data) {
      wordbookName.value = data.name;
      wordCount.value = data.word_count ?? 0;
    }
  } catch {}
}

async function loadWords(page: number): Promise<void> {
  currentPage.value = page;

  if (isCurrentWordbook.value) {
    const cachedWords = wordbookStore.getWordsForWordbook(wordbookId.value);
    if (cachedWords.length > 0) {
      const start = (page - 1) * pageSize.value;
      words.value = cachedWords.slice(start, start + pageSize.value);
      totalPages.value = Math.ceil(cachedWords.length / pageSize.value);
      return;
    }
  }

  const start = (page - 1) * pageSize.value;
  const end = start + pageSize.value - 1;

  const { data, error, count } = await supabase
    .from('words')
    .select('*', { count: 'exact' })
    .eq('wordbook_id', wordbookId.value)
    .order('sort_order', { ascending: true })
    .range(start, end);

  if (!error && data) {
    words.value = data.map((row) => ({
      id: row.id,
      wordbookId: row.wordbook_id,
      wordRank: row.word_rank ?? 0,
      headWord: row.head_word,
      content: row.content ?? { word: { wordHead: row.head_word, wordId: row.id, content: {} } },
      bookId: row.book_id ?? row.wordbook_id,
      sortOrder: row.sort_order ?? 0,
    }));
    totalPages.value = Math.ceil((count ?? wordCount.value) / pageSize.value);
  }
}

async function handleRefresh(): Promise<void> {
  if (isRefreshing.value) return;
  isRefreshing.value = true;

  try {
    if (isCurrentWordbook.value) {
      await wordbookStore.pullWordsForWordbook(wordbookId.value);
    }
    await loadWordbookInfo();
    await loadWords(1);
  } finally {
    isRefreshing.value = false;
  }
}

function openImport(): void {
  importFiles.value = [];
  importMsg.value = '';
  showImportModal.value = true;
}

function handleImportFileChange(e: Event): void {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    importFiles.value = Array.from(input.files);
  }
}

async function doImport(): Promise<void> {
  if (importFiles.value.length === 0) {
    importMsg.value = '请选择至少一个文件';
    return;
  }

  isImporting.value = true;
  importMsg.value = '';

  const result = await wordbookStore.importWordsToWordbook(wordbookId.value, importFiles.value);
  isImporting.value = false;
  importMsg.value = result.message;

  if (result.success) {
    await loadWordbookInfo();
    await loadWords(1);
    setTimeout(() => {
      showImportModal.value = false;
    }, 1200);
  }
}

function getHeadWord(w: WordRecord): string {
  return w.content?.word?.wordHead || w.headWord || '';
}

function getMeaning(w: WordRecord): string {
  const trans = w.content?.word?.content?.trans;
  if (trans && trans.length > 0) {
    return trans.map((t: { tranCn?: string; pos?: string }) => `${t.pos ? t.pos + '. ' : ''}${t.tranCn || ''}`).join('；');
  }
  return '';
}

function goBack(): void {
  router.push('/wordbooks');
}

function goToPage(page: number): void {
  if (page >= 1 && page <= totalPages.value && page !== currentPage.value) {
    loadWords(page);
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <button @click="goBack" class="text-gray-400 hover:text-gray-600">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 class="text-xl font-bold text-gray-800">{{ wordbookName }}</h1>
      </div>
      <div class="flex items-center space-x-2">
        <span class="text-sm text-gray-400">共 {{ wordCount }} 词</span>
        <button
          @click="handleRefresh"
          :disabled="isRefreshing"
          class="btn-secondary text-xs flex items-center space-x-1"
        >
          <svg class="h-4 w-4" :class="{ 'animate-spin': isRefreshing }" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>{{ isRefreshing ? '刷新中...' : '刷新' }}</span>
        </button>
        <button
          @click="openImport"
          class="btn-primary text-xs"
        >
          导入
        </button>
      </div>
    </div>

    <div class="relative">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="搜索单词..."
        class="input-field pl-10"
        @input="loadWords(1)"
      />
      <svg class="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </div>

    <div v-if="isLoading" class="py-10 text-center text-gray-400">
      加载中...
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="word in (searchQuery ? filteredWords : paginatedWords)"
        :key="word.id"
        class="card flex items-center justify-between py-3 px-4"
      >
        <div class="flex-1">
          <div class="flex items-center space-x-2">
            <span class="font-semibold text-gray-800">{{ getHeadWord(word) }}</span>
          </div>
          <p class="mt-1 text-sm text-gray-500">{{ getMeaning(word) }}</p>
        </div>
      </div>

      <div v-if="(!searchQuery && paginatedWords.length === 0) || (searchQuery && filteredWords.length === 0)" class="py-10 text-center text-gray-400">
        <template v-if="searchQuery">没有找到匹配的单词</template>
        <template v-else>词库中暂无单词</template>
      </div>
    </div>

    <div v-if="!isLoading && !searchQuery && totalPages > 1" class="flex items-center justify-center space-x-1">
      <button
        @click="goToPage(currentPage - 1)"
        :disabled="currentPage <= 1"
        class="btn-secondary text-xs px-3 py-1 disabled:opacity-30"
      >
        上一页
      </button>
      <span class="text-xs text-gray-500">
        {{ currentPage }} / {{ totalPages }}
      </span>
      <button
        @click="goToPage(currentPage + 1)"
        :disabled="currentPage >= totalPages"
        class="btn-secondary text-xs px-3 py-1 disabled:opacity-30"
      >
        下一页
      </button>
    </div>

    <div
      v-if="showImportModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      @click.self="showImportModal = false"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 class="mb-1 text-lg font-semibold">
          导入单词到「{{ wordbookName }}」
        </h3>
        <p class="mb-4 text-xs text-gray-500">
          支持 CSV 和 JSON 格式，可多选文件自动合并。导入的数据将保存到云端数据库。
        </p>

        <div class="mb-4 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
          <p class="font-medium">CSV 格式要求：</p>
          <p>首行表头必须包含 word、meaning，可选 phonetic / example / example_cn</p>
          <p class="mt-2 font-medium">JSON 格式要求：</p>
          <p>支持两种：{name, words:[{word, meaning,...}]} 或 json-full 数组格式</p>
        </div>

        <div class="mb-4">
          <input
            type="file"
            accept=".csv,.json"
            multiple
            @change="handleImportFileChange"
            class="block w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-primary-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-700"
          />
          <p v-if="importFiles.length > 0" class="mt-2 text-xs text-gray-500">
            已选择 {{ importFiles.length }} 个文件：{{ importFiles.map((f) => f.name).join('、') }}
          </p>
        </div>

        <p v-if="importMsg" :class="['mb-3 text-xs', importMsg.includes('成功') ? 'text-green-600' : 'text-red-500']">
          {{ importMsg }}
        </p>

        <div class="flex justify-end space-x-2">
          <button @click="showImportModal = false" class="btn-secondary text-xs">
            取消
          </button>
          <button
            @click="doImport"
            :disabled="isImporting || importFiles.length === 0"
            class="btn-primary text-xs"
          >
            {{ isImporting ? '导入中...' : '开始导入' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>