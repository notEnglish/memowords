<script setup lang="ts">
import { computed, ref } from 'vue';

interface WordRecord {
  id: string;
  headWord: string;
  content?: {
    word?: {
      content?: {
        usphone?: string;
        ukphone?: string;
        trans?: {
          tranCn?: string;
          pos?: string;
          tranOther?: string;
        }[];
        sentence?: {
          sentences?: {
            sContent?: string;
            sCn?: string;
          }[];
        };
        phrase?: {
          phrases?: {
            pContent?: string;
            pCn?: string;
          }[];
        };
        syno?: {
          synos?: {
            pos?: string;
            tran?: string;
            hwds?: { w: string }[];
          }[];
        };
        relWord?: {
          rels?: {
            pos?: string;
            words?: { hwd: string; tran: string }[];
          }[];
        };
      };
    };
  };
}

interface UserWordRecord {
  state: string;
}

const props = defineProps<{
  word: WordRecord;
  flipped: boolean;
  showFeedback: boolean;
  autoPronounce?: boolean;
  userWordRecord?: UserWordRecord | null;
}>();

const emit = defineEmits<{
  flip: [];
  feedback: [feedback: 'correct' | 'hazy' | 'forgot'];
}>();

const isSpeaking = ref(false);

const headWord = computed(() => props.word.headWord);

const usPhonetic = computed(() => props.word.content?.word?.content?.usphone || '');
const ukPhonetic = computed(() => props.word.content?.word?.content?.ukphone || '');

const transList = computed(() => {
  const list = props.word.content?.word?.content?.trans || [];
  return list.map((t) => ({
    pos: t.pos || '',
    cn: t.tranCn || '',
  })).filter((t) => t.pos && t.cn);
});

const sentences = computed(() => {
  const list = props.word.content?.word?.content?.sentence?.sentences || [];
  return list.map((s) => ({ en: s.sContent || '', cn: s.sCn || '' }));
});

const phrases = computed(() => {
  const list = props.word.content?.word?.content?.phrase?.phrases || [];
  return list.map((p) => ({ en: p.pContent || '', cn: p.pCn || '' }));
});

const synos = computed(() => {
  const list = props.word.content?.word?.content?.syno?.synos || [];
  return list.map((s) => ({
    pos: s.pos || '',
    tran: s.tran || '',
    words: (s.hwds || []).map((h) => h.w).join('、'),
  }));
});

const relWords = computed(() => {
  const groups = props.word.content?.word?.content?.relWord?.rels || [];
  return groups.map((g) => ({
    pos: g.pos || '',
    words: (g.words || []).map((w) => `${w.hwd} ${w.tran}`).join('；'),
  }));
});

const expandedSections = ref({
  sentence: true,
  phrase: true,
  syno: true,
  relWord: true,
});

function toggle(key: keyof typeof expandedSections.value): void {
  expandedSections.value[key] = !expandedSections.value[key];
}

function speak(): void {
  if (isSpeaking.value) return;
  isSpeaking.value = true;
  const utterance = new SpeechSynthesisUtterance(headWord.value);
  utterance.lang = 'en-US';
  utterance.onend = () => {
    isSpeaking.value = false;
  };
  utterance.onerror = () => {
    isSpeaking.value = false;
  };
  window.speechSynthesis.speak(utterance);
}

function pronounce(word: string): void {
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'en-US';
  window.speechSynthesis.speak(utterance);
}

if (props.autoPronounce && props.flipped === false) {
  setTimeout(() => {
    pronounce(headWord.value);
  }, 300);
}

const feedbackLabels: { key: 'correct' | 'hazy' | 'forgot'; label: string; cls: string; intervalText: string }[] = [
  { key: 'forgot', label: '忘记', cls: 'bg-red-100 text-red-600 hover:bg-red-200', intervalText: '再次复习' },
  { key: 'hazy', label: '模糊', cls: 'bg-amber-100 text-amber-600 hover:bg-amber-200', intervalText: '1天后' },
  { key: 'correct', label: '认识', cls: 'bg-green-100 text-green-600 hover:bg-green-200', intervalText: '1天后' },
];
</script>

<template>
  <div class="card-wrapper w-full max-w-md h-full min-h-[320px]">
    <div class="card-flip-container h-full">
      <div :class="['card-flip-inner h-full', { flipped }]">

        <!-- 正面：单词 + 音标 + 发音 -->
        <div class="card-face flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-white to-gray-50 p-6 shadow-lg h-full">
          <p class="mb-3 text-4xl font-bold text-gray-800 select-none">{{ headWord }}</p>
          <div class="mb-1 flex items-center space-x-3 text-sm text-gray-400">
            <span v-if="usPhonetic">美 {{ usPhonetic }}</span>
            <span v-if="ukPhonetic">英 {{ ukPhonetic }}</span>
          </div>
          <button
            @click="speak"
            :disabled="isSpeaking"
            class="my-4 rounded-full bg-primary-50 p-3 text-primary-600 transition-colors hover:bg-primary-100 active:scale-95"
            title="发音"
          >
            <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M6.5 8.5H3.75A.75.75 0 003 9.25v5.5c0 .414.336.75.75.75H6.5l4.5 4V4l-4.5 4.5z" />
            </svg>
          </button>
          <button
            v-if="!showFeedback"
            @click="emit('flip')"
            class="mt-2 text-xs text-gray-400 hover:text-primary-500"
          >
            点击翻转查看释义
          </button>
        </div>

        <!-- 背面：完整释义（可滚动） -->
        <div class="card-face card-face-back flex flex-col rounded-2xl bg-white p-4 shadow-lg h-full">
          <!-- 顶部：单词 + 音标 + 发音 + 翻转按钮 -->
          <div class="mb-3 flex items-center justify-between border-b border-gray-100 pb-3">
            <div class="flex items-center space-x-2">
              <span class="text-xl font-bold text-gray-800">{{ headWord }}</span>
              <span v-if="usPhonetic" class="text-xs text-gray-400">{{ usPhonetic }}</span>
              <span v-if="ukPhonetic" class="text-xs text-gray-400">{{ ukPhonetic }}</span>
            </div>
            <div class="flex items-center space-x-2">
              <button
                @click="speak"
                :disabled="isSpeaking"
                class="rounded-full bg-primary-50 p-1.5 text-primary-600 hover:bg-primary-100"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072M6.5 8.5H3.75A.75.75 0 003 9.25v5.5c0 .414.336.75.75.75H6.5l4.5 4V4l-4.5 4.5z" />
                </svg>
              </button>
              <button
                @click="emit('flip')"
                class="rounded-full bg-gray-100 p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m0 0a8.001 8.001 0 0115.356 2M4.582 9H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          <!-- 可滚动内容区 -->
          <div class="flex-1 overflow-y-auto text-sm">
            <!-- 释义（始终显示） -->
            <div class="mb-3">
              <p class="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">释义</p>
              <div class="space-y-1">
                <div
                  v-for="(t, i) in transList"
                  :key="i"
                  class="flex items-start"
                >
                  <span v-if="t.pos" class="mr-1.5 shrink-0 rounded bg-primary-50 px-1.5 py-0.5 text-xs font-medium text-primary-600">{{ t.pos }}</span>
                  <p class="text-gray-700">{{ t.cn }}</p>
                </div>
                <p v-if="transList.length === 0" class="text-gray-400">暂无释义</p>
              </div>
            </div>

            <!-- 例句 -->
            <div v-if="sentences.length > 0" class="mb-3">
              <button
                @click="toggle('sentence')"
                class="mb-1.5 flex w-full items-center justify-between text-xs font-medium uppercase tracking-wide text-gray-400 hover:text-gray-600"
              >
                <span>例句 ({{ sentences.length }})</span>
                <svg :class="['h-3 w-3 transition-transform', expandedSections.sentence ? 'rotate-180' : '']" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div v-if="expandedSections.sentence" class="space-y-2">
                <div
                  v-for="(s, i) in sentences"
                  :key="i"
                  class="rounded-lg bg-gray-50 p-2.5"
                >
                  <p class="text-gray-700">{{ s.en }}</p>
                  <p v-if="s.cn" class="mt-1 text-xs text-gray-400">{{ s.cn }}</p>
                </div>
              </div>
            </div>

            <!-- 短语 -->
            <div v-if="phrases.length > 0" class="mb-3">
              <button
                @click="toggle('phrase')"
                class="mb-1.5 flex w-full items-center justify-between text-xs font-medium uppercase tracking-wide text-gray-400 hover:text-gray-600"
              >
                <span>短语 ({{ phrases.length }})</span>
                <svg :class="['h-3 w-3 transition-transform', expandedSections.phrase ? 'rotate-180' : '']" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div v-if="expandedSections.phrase" class="space-y-1">
                <div
                  v-for="(p, i) in phrases"
                  :key="i"
                  class="flex items-start gap-2 rounded bg-gray-50 p-2"
                >
                  <span class="text-gray-700">{{ p.en }}</span>
                  <span class="text-xs text-gray-400">{{ p.cn }}</span>
                </div>
              </div>
            </div>

            <!-- 同义词 -->
            <div v-if="synos.length > 0" class="mb-3">
              <button
                @click="toggle('syno')"
                class="mb-1.5 flex w-full items-center justify-between text-xs font-medium uppercase tracking-wide text-gray-400 hover:text-gray-600"
              >
                <span>同义词 ({{ synos.length }})</span>
                <svg :class="['h-3 w-3 transition-transform', expandedSections.syno ? 'rotate-180' : '']" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div v-if="expandedSections.syno" class="space-y-1.5">
                <div
                  v-for="(s, i) in synos"
                  :key="i"
                  class="flex flex-wrap items-start rounded bg-blue-50 p-2"
                >
                  <span v-if="s.pos" class="mr-1.5 shrink-0 text-xs font-medium text-blue-600">{{ s.pos }}</span>
                  <div class="text-gray-700">
                    <span v-if="s.words" class="text-xs text-blue-600">{{ s.words }}</span>
                    <span v-if="s.tran" class="ml-1 text-xs text-gray-500">{{ s.tran }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 同根词 -->
            <div v-if="relWords.length > 0" class="mb-3">
              <button
                @click="toggle('relWord')"
                class="mb-1.5 flex w-full items-center justify-between text-xs font-medium uppercase tracking-wide text-gray-400 hover:text-gray-600"
              >
                <span>同根词 ({{ relWords.length }})</span>
                <svg :class="['h-3 w-3 transition-transform', expandedSections.relWord ? 'rotate-180' : '']" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div v-if="expandedSections.relWord" class="space-y-1.5">
                <div
                  v-for="(r, i) in relWords"
                  :key="i"
                  class="flex flex-wrap items-start rounded bg-purple-50 p-2"
                >
                  <span v-if="r.pos" class="mr-1.5 shrink-0 text-xs font-medium text-purple-600">{{ r.pos }}</span>
                  <span class="text-xs text-purple-700">{{ r.words }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 底部：反馈按钮（固定在底部） -->
          <div v-if="showFeedback" class="mt-3 flex items-center justify-center space-x-2 border-t border-gray-100 pt-3">
            <button
              v-for="btn in feedbackLabels"
              :key="btn.key"
              @click="emit('feedback', btn.key)"
              :class="['flex-1 rounded-lg py-2 text-sm font-medium transition-colors active:scale-95', btn.cls]"
            >
              <div class="flex flex-col items-center">
                <span>{{ btn.label }}</span>
                <span class="text-xs opacity-70">{{ btn.intervalText }}</span>
              </div>
            </button>
          </div>

          <button
            v-else
            @click="emit('flip')"
            class="mt-3 text-center text-xs text-gray-400 hover:text-gray-600"
          >
            点击翻回正面
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
