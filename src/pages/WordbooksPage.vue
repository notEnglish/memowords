<script setup lang="ts">
// ============================================================
// MemoWords — 词库管理页
// 新流程：
//   1. 点击「添加词库」→ 只填写名称、描述、是否内置
//      → 写入 Supabase wordbooks 表 + 本地
//   2. 词库列表中显示「导入单词」
//      → 选择 CSV/JSON 文件，按 words 表格式保存到云端 + 本地
// ============================================================

import { onMounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useWordbookStore } from '@/stores/wordbookStore';
import type { WordbookRecord } from '@/types';

const router = useRouter();
const wordbookStore = useWordbookStore();

// ---------------- 添加词库弹窗（第一步） ----------------
const showAddWordbook = ref(false);
const newWbName = ref('');
const newWbDesc = ref('');
const newWbBuiltin = ref(false);
const isAddingWordbook = ref(false);
const addWordbookMsg = ref('');

// ---------------- 导入单词弹窗（第二步） ----------------
const showImport = ref(false);
const importTargetWordbook = ref<WordbookRecord | null>(null);
const importFiles = ref<File[]>([]);
const isImporting = ref(false);
const importMsg = ref('');

// ---------------- 详情弹窗 ----------------
const showDetail = ref(false);
const detailWordbook = ref<WordbookRecord | null>(null);

onMounted(async () => {
  await wordbookStore.init();
});

function openAddWordbook(): void {
  newWbName.value = '';
  newWbDesc.value = '';
  newWbBuiltin.value = false;
  addWordbookMsg.value = '';
  showAddWordbook.value = true;
}

async function doAddWordbook(): Promise<void> {
  if (!newWbName.value.trim()) {
    addWordbookMsg.value = '请填写词库名称';
    return;
  }

  isAddingWordbook.value = true;
  addWordbookMsg.value = '';

  const result = await wordbookStore.createWordbookMeta(
    newWbName.value,
    newWbDesc.value,
    newWbBuiltin.value,
  );

  isAddingWordbook.value = false;

  if (result.success) {
    addWordbookMsg.value = '添加成功！接下来可以点击「导入单词」将单词写入词库';
    // 1 秒后关闭弹窗
    setTimeout(() => {
      showAddWordbook.value = false;
    }, 1200);
  } else {
    addWordbookMsg.value = result.message;
  }
}

function openImportFor(wb: WordbookRecord): void {
  importTargetWordbook.value = wb;
  importFiles.value = [];
  importMsg.value = '';
  showImport.value = true;
}

function handleImportFileChange(e: Event): void {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    importFiles.value = Array.from(input.files);
  }
}

async function doImportWords(): Promise<void> {
  if (!importTargetWordbook.value) {
    importMsg.value = '未选择目标词库';
    return;
  }
  if (importFiles.value.length === 0) {
    importMsg.value = '请选择至少一个文件';
    return;
  }

  isImporting.value = true;
  importMsg.value = '';

  const result = await wordbookStore.importWordsToWordbook(
    importTargetWordbook.value.id,
    importFiles.value,
  );

  isImporting.value = false;
  importMsg.value = result.message;

  if (result.success) {
    setTimeout(() => {
      showImport.value = false;
    }, 1200);
  }
}

function selectWordbook(id: string): void {
  wordbookStore.setActiveWordbook(id);
}

async function showWordbookDetail(wb: WordbookRecord): Promise<void> {
  detailWordbook.value = wb;
  showDetail.value = true;
}

function viewWordbook(id: string): void {
  router.push({ path: '/wordlist', query: { id } });
}

async function handleDelete(id: string): Promise<void> {
  const wb = wordbookStore.wordbooks.find((w) => w.id === id);
  if (!wb || wb.isBuiltin) return;

  const confirmed = confirm(`确定删除词库「${wb.name}」吗？`);
  if (!confirmed) return;

  await wordbookStore.deleteWordbook(id);
}

async function handlePullFromCloud(): Promise<void> {
  await wordbookStore.init();
}

const sortedWordbooks = computed(() => {
  return [...wordbookStore.wordbooks].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
});
</script>

<template>
  <div class="space-y-6">
    <!-- 顶部标题与按钮 -->
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold text-gray-800">词库管理</h1>
      <div class="flex space-x-2">
        <button @click="handlePullFromCloud" class="btn-secondary text-xs">
          从云端刷新
        </button>
        <button @click="openAddWordbook" class="btn-primary text-xs">
          添加词库
        </button>
      </div>
    </div>

    <!-- 词库列表 -->
    <div
      v-if="sortedWordbooks.length === 0"
      class="card py-10 text-center text-gray-400"
    >
      <p>暂无词库，请点击「添加词库」创建</p>
      <p class="mt-2 text-xs">创建词库后，可在词库卡片上「导入单词」</p>
    </div>

    <div class="space-y-3">
      <div
        v-for="wb in sortedWordbooks"
        :key="wb.id"
        :class="[
          'card flex cursor-pointer items-center justify-between transition-colors hover:bg-gray-50',
          wordbookStore.activeWordbookId === wb.id ? 'ring-2 ring-primary-500' : '',
        ]"
        @click="selectWordbook(wb.id)"
      >
        <div class="flex-1">
          <div class="flex items-center space-x-2">
            <h3 class="font-semibold text-gray-800">{{ wb.name }}</h3>
            <span
              v-if="wb.isBuiltin"
              class="rounded bg-primary-50 px-2 py-0.5 text-xs text-primary-600"
            >
              内置
            </span>
          </div>
          <p class="mt-1 text-xs text-gray-400">{{ wb.description || '无描述' }}</p>
        </div>

        <div class="flex items-center space-x-3">
          <span class="text-sm text-gray-400">{{ wb.wordCount }} 词</span>

          <!-- 第二步：导入单词按钮 -->
          <button
            @click.stop="openImportFor(wb)"
            class="text-xs text-green-600 hover:text-green-700"
          >
            {{ wb.wordCount === 0 ? '导入单词' : '重新导入' }}
          </button>

          <button
            @click.stop="viewWordbook(wb.id)"
            class="text-xs text-primary-500 hover:text-primary-700"
          >
            查看
          </button>

          <button
            v-if="!wb.isBuiltin"
            @click.stop="handleDelete(wb.id)"
            class="text-xs text-red-400 hover:text-red-600"
          >
            删除
          </button>
        </div>
      </div>
    </div>

    <!-- ================= 添加词库弹窗（第一步） ================= -->
    <div
      v-if="showAddWordbook"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      @click.self="showAddWordbook = false"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 class="mb-1 text-lg font-semibold">添加词库</h3>
        <p class="mb-4 text-xs text-gray-500">
          先创建词库基本信息（名称、描述、是否内置），保存后可在词库卡片上导入单词。
        </p>

        <div class="mb-4 space-y-3">
          <div>
            <label class="mb-1 block text-xs text-gray-500">词库名称 <span class="text-red-500">*</span></label>
            <input v-model="newWbName" class="input-field" placeholder="例如：四级核心词汇" />
          </div>

          <div>
            <label class="mb-1 block text-xs text-gray-500">词库描述</label>
            <input v-model="newWbDesc" class="input-field" placeholder="可选" />
          </div>

          <div>
            <label class="mb-1 block text-xs text-gray-500">是否内置词库</label>
            <div class="flex space-x-4 text-sm">
              <label class="flex items-center space-x-2">
                <input type="radio" v-model="newWbBuiltin" :value="false" />
                <span>否（自定义词库）</span>
              </label>
              <label class="flex items-center space-x-2">
                <input type="radio" v-model="newWbBuiltin" :value="true" />
                <span>是</span>
              </label>
            </div>
          </div>
        </div>

        <p v-if="addWordbookMsg" :class="['mb-3 text-xs', addWordbookMsg.includes('成功') ? 'text-green-600' : 'text-red-500']">
          {{ addWordbookMsg }}
        </p>

        <div class="flex justify-end space-x-2">
          <button @click="showAddWordbook = false" class="btn-secondary text-xs">
            取消
          </button>
          <button @click="doAddWordbook" :disabled="isAddingWordbook" class="btn-primary text-xs">
            {{ isAddingWordbook ? '保存中...' : '保存词库' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ================= 导入单词弹窗（第二步） ================= -->
    <div
      v-if="showImport && importTargetWordbook"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      @click.self="showImport = false"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 class="mb-1 text-lg font-semibold">
          导入单词到「{{ importTargetWordbook.name }}」
        </h3>
        <p class="mb-4 text-xs text-gray-500">
          支持 CSV 和 JSON 格式。导入的数据将同时保存到云端数据库和本地。
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
          <button @click="showImport = false" class="btn-secondary text-xs">
            取消
          </button>
          <button
            @click="doImportWords"
            :disabled="isImporting || importFiles.length === 0"
            class="btn-primary text-xs"
          >
            {{ isImporting ? '导入中...' : '开始导入' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <div
      v-if="showDetail && detailWordbook"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      @click.self="showDetail = false"
    >
      <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 class="mb-4 text-lg font-semibold text-gray-800">{{ detailWordbook.name }}</h3>
        <div class="space-y-2 text-sm text-gray-600">
          <p><span class="text-gray-400">描述：</span>{{ detailWordbook.description || '无' }}</p>
          <p><span class="text-gray-400">单词数：</span>{{ detailWordbook.wordCount }}</p>
          <p><span class="text-gray-400">类型：</span>{{ detailWordbook.isBuiltin ? '内置词库' : '自定义词库' }}</p>
        </div>

        <div class="mt-5 flex space-x-2">
          <button @click="openImportFor(detailWordbook); showDetail = false" class="btn-primary text-xs flex-1">
            导入单词
          </button>
          <button @click="showDetail = false" class="btn-secondary text-xs flex-1">
            关闭
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
