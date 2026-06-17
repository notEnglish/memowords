// ============================================================
// MemoWords — 词库管理 Store
// 新架构：所有操作直接通过 Supabase，数据缓存到 Pinia
// ============================================================

import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { WordbookRecord, WordRecord, ImportWordItem } from '@/types';
import { supabase } from '@/supabase/client';
import { v4 } from '@/composables/uuid';
import { useAuthStore } from '@/stores/authStore';

interface JsonFullWord {
  wordRank: number;
  headWord: string;
  content: Record<string, unknown>;
  bookId: string;
}

export const useWordbookStore = defineStore('wordbook', () => {
  const wordbooks = ref<WordbookRecord[]>([]);
  const activeWordbookId = ref<string | null>(null);
  const isLoading = ref(false);
  const error = ref<string>('');
  const wordsCache = ref<Map<string, WordRecord[]>>(new Map());
  let isInitialized = false;
  let isInitializing = false;

  async function init(loadWords: boolean = false): Promise<void> {
    if (isInitializing) {
      while (isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return;
    }
    if (isInitialized) {
      return;
    }

    isInitializing = true;
    isLoading.value = true;
    error.value = '';

    try {
      const { data, error: sbErr } = await supabase
        .from('wordbooks')
        .select('*')
        .order('created_at', { ascending: false });

      if (!sbErr && data !== null) {
        if (data.length > 0) {
          const cloudData = data.map((row) => ({
            id: row.id,
            name: row.name,
            description: row.description ?? '',
            wordCount: row.word_count ?? 0,
            isBuiltin: row.is_builtin ?? false,
            sourceFile: row.source_file ?? '',
            createdAt: row.created_at ? new Date(row.created_at) : new Date(),
            updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
          }));
          wordbooks.value = cloudData;

          const authStore = useAuthStore();
          const currentWbId = authStore.profile?.currentWordbookId;
          let targetId: string;

          if (currentWbId && cloudData.some((wb) => wb.id === currentWbId)) {
            targetId = currentWbId;
          } else {
            targetId = cloudData[0].id;
          }

          activeWordbookId.value = targetId;
          
          if (loadWords) {
            await pullWordsForWordbook(targetId);
          }
        } else {
          wordbooks.value = [];
          activeWordbookId.value = null;
        }
      } else {
        wordbooks.value = [];
        activeWordbookId.value = null;
      }

      isInitialized = true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : '词库初始化失败';
    } finally {
      isLoading.value = false;
      isInitializing = false;
    }
  }

  async function pullWordsForWordbook(wordbookId: string): Promise<void> {
    if (!wordbookId) return;

    try {
      const { data, error: sbErr } = await supabase
        .from('words')
        .select('*')
        .eq('wordbook_id', wordbookId)
        .order('sort_order', { ascending: true })
        .limit(50000);

      if (sbErr) {
        return;
      }

      if (!data || data.length === 0) {
        wordsCache.value.set(wordbookId, []);
        return;
      }

      const mapped: WordRecord[] = data.map((row) => ({
        id: row.id,
        wordbookId: row.wordbook_id,
        wordRank: row.word_rank ?? 0,
        headWord: row.head_word,
        content: row.content ?? { word: { wordHead: row.head_word, wordId: row.id, content: {} } },
        bookId: row.book_id ?? row.wordbook_id,
        sortOrder: row.sort_order ?? 0,
      }));

      wordsCache.value.set(wordbookId, mapped);
    } catch (e) {
    }
  }

  async function createWordbookMeta(
    name: string,
    description: string,
    isBuiltin: boolean = false,
  ): Promise<{ success: boolean; message: string; wordbook?: WordbookRecord }> {
    if (!name.trim()) {
      return { success: false, message: '请填写词库名称' };
    }

    const now = new Date();
    const wbId = v4();
    const wb: WordbookRecord = {
      id: wbId,
      name: name.trim(),
      description: description.trim(),
      wordCount: 0,
      isBuiltin,
      sourceFile: '',
      createdAt: now,
      updatedAt: now,
    };

    try {
      const { error: sbErr } = await supabase.from('wordbooks').insert({
        id: wb.id,
        name: wb.name,
        description: wb.description,
        word_count: 0,
        is_builtin: wb.isBuiltin,
        source_file: '',
        created_at: wb.createdAt.toISOString(),
        updated_at: wb.updatedAt.toISOString(),
      });

      if (sbErr) {
        return { success: false, message: '创建词库失败：' + sbErr.message };
      }

      wordbooks.value = [wb, ...wordbooks.value];
      return { success: true, message: '词库创建成功！', wordbook: wb };
    } catch (e) {
      return { success: false, message: '创建词库失败：' + (e instanceof Error ? e.message : String(e)) };
    }
  }

  async function importWordsToWordbook(
    wordbookId: string,
    files: File[],
  ): Promise<{ success: boolean; message: string; wordCount?: number }> {
    if (!wordbookId) {
      return { success: false, message: '词库 ID 不能为空' };
    }
    if (!files || files.length === 0) {
      return { success: false, message: '请选择至少一个文件' };
    }

    const seen = new Set<string>();
    const bulkWords: WordRecord[] = [];

    for (const file of files) {
      try {
        const text = await file.text();

        if (file.name.toLowerCase().endsWith('.json')) {
          try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
              const arr = parsed as JsonFullWord[];
              for (let i = 0; i < arr.length; i++) {
                const hw = arr[i].headWord?.trim();
                if (!hw) continue;
                const key = hw.toLowerCase();
                if (seen.has(key)) continue;
                seen.add(key);
                bulkWords.push({
                  id: v4(),
                  wordbookId,
                  wordRank: arr[i].wordRank ?? i + 1,
                  headWord: hw,
                  content: arr[i].content as WordRecord['content'],
                  bookId: wordbookId,
                  sortOrder: bulkWords.length,
                });
              }
            } else if (parsed.words && Array.isArray(parsed.words)) {
              const items = parsed.words as ImportWordItem[];
              for (const item of items) {
                if (!item.word || !item.meaning) continue;
                const key = item.word.toLowerCase().trim();
                if (seen.has(key)) continue;
                seen.add(key);
                bulkWords.push(buildRecordForSimpleFormat(wordbookId, item.word, item.meaning, item.phonetic, bulkWords.length));
              }
            } else {
              return { success: false, message: `${file.name} JSON 格式不支持` };
            }
          } catch (e) {
            return { success: false, message: `${file.name} JSON 解析失败` };
          }
        } else if (file.name.toLowerCase().endsWith('.csv')) {
          const lines = text.split(/\r?\n/).filter((l) => l.trim());
          if (lines.length < 2) continue;

          const header = parseCSVLine(lines[0]);
          const wordIdx = header.findIndex((h) => h.toLowerCase() === 'word');
          const meaningIdx = header.findIndex((h) => h.toLowerCase() === 'meaning');
          const phoneticIdx = header.findIndex((h) => h.toLowerCase() === 'phonetic');

          if (wordIdx === -1 || meaningIdx === -1) {
            return { success: false, message: 'CSV 必须包含 word 和 meaning 列' };
          }

          for (let i = 1; i < lines.length; i++) {
            const cols = parseCSVLine(lines[i]);
            const word = cols[wordIdx]?.trim();
            const meaning = cols[meaningIdx]?.trim();
            if (!word || !meaning) continue;
            const key = word.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            bulkWords.push(buildRecordForSimpleFormat(
              wordbookId,
              word,
              meaning,
              phoneticIdx >= 0 ? cols[phoneticIdx]?.trim() : undefined,
              bulkWords.length,
            ));
          }
        } else {
          return { success: false, message: `${file.name} 格式不支持（仅支持 .json / .csv）` };
        }
      } catch (e) {
        return { success: false, message: `处理 ${file.name} 时出错` };
      }
    }

    if (bulkWords.length === 0) {
      return { success: false, message: '未解析到有效单词数据' };
    }
    if (bulkWords.length > 10000) {
      return { success: false, message: '单次导入不能超过 10,000 个单词' };
    }

    try {
      const chunks: Array<Array<Record<string, unknown>>> = [];
      const CHUNK_SIZE = 500;
      for (let i = 0; i < bulkWords.length; i += CHUNK_SIZE) {
        const chunk = bulkWords.slice(i, i + CHUNK_SIZE).map((w) => ({
          id: w.id,
          wordbook_id: w.wordbookId,
          word_rank: w.wordRank,
          head_word: w.headWord,
          content: w.content,
          book_id: w.bookId,
          sort_order: w.sortOrder,
        }));
        chunks.push(chunk);
      }

      for (let i = 0; i < chunks.length; i++) {
        const { error: sbErr } = await supabase.from('words').insert(chunks[i]);
        if (sbErr) {
          return { success: false, message: '导入失败：' + sbErr.message };
        }
      }

      const wbIdx = wordbooks.value.findIndex((w) => w.id === wordbookId);
      if (wbIdx >= 0) {
        wordbooks.value[wbIdx].wordCount = bulkWords.length;
        wordbooks.value[wbIdx].updatedAt = new Date();
      }

      const { error: updateErr } = await supabase
        .from('wordbooks')
        .update({ word_count: bulkWords.length, updated_at: new Date().toISOString() })
        .eq('id', wordbookId);

      if (updateErr) {
      }

      wordsCache.value.set(wordbookId, bulkWords);
      return { success: true, message: `成功导入 ${bulkWords.length} 个单词`, wordCount: bulkWords.length };
    } catch (e) {
      return { success: false, message: '导入失败：' + (e instanceof Error ? e.message : String(e)) };
    }
  }

  async function setActiveWordbook(id: string): Promise<void> {
    activeWordbookId.value = id;
    await pullWordsForWordbook(id);

    const authStore = useAuthStore();
    if (authStore.profile && authStore.profile.currentWordbookId !== id) {
      await authStore.updateProfile({ currentWordbookId: id });
    }
  }

  function getActiveWordbook(): WordbookRecord | undefined {
    return wordbooks.value.find((wb) => wb.id === activeWordbookId.value);
  }

  function getWordsForWordbook(wordbookId: string): WordRecord[] {
    return wordsCache.value.get(wordbookId) ?? [];
  }

  async function deleteWordbook(id: string): Promise<boolean> {
    const wb = wordbooks.value.find((w) => w.id === id);
    if (!wb) return false;

    try {
      await supabase.from('words').delete().eq('wordbook_id', id);
      await supabase.from('wordbooks').delete().eq('id', id);
    } catch (e) {
      return false;
    }

    wordsCache.value.delete(id);
    wordbooks.value = wordbooks.value.filter((w) => w.id !== id);
    if (activeWordbookId.value === id) {
      activeWordbookId.value = wordbooks.value.length > 0 ? wordbooks.value[0].id : null;
    }
    return true;
  }

  return {
    wordbooks,
    activeWordbookId,
    isLoading,
    error,
    init,
    pullWordsForWordbook,
    createWordbookMeta,
    importWordsToWordbook,
    setActiveWordbook,
    getActiveWordbook,
    getWordsForWordbook,
    deleteWordbook,
  };
});

function buildRecordForSimpleFormat(
  wordbookId: string,
  word: string,
  meaning: string,
  phonetic: string | undefined,
  sortOrder: number,
): WordRecord {
  return {
    id: v4(),
    wordbookId,
    wordRank: sortOrder + 1,
    headWord: word.trim(),
    content: {
      word: {
        wordHead: word.trim(),
        wordId: word.trim(),
        content: {
          sentence: { sentences: [], desc: '例句' },
          usphone: phonetic || '',
          ukphone: '',
          ukspeech: word.trim(),
          phrase: { phrases: [], desc: '短语' },
          syno: { synos: [], desc: '同近' },
          relWord: { rels: [], desc: '同根' },
          usspeech: word.trim(),
          trans: [{ tranCn: meaning.slice(0, 1000), descOther: '', pos: '', descCn: '中释', tranOther: '' }],
        },
      },
    },
    bookId: wordbookId,
    sortOrder,
  };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}