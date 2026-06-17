// ============================================================
// MemoWords — Dexie.js IndexedDB 数据库定义
// 注意：新架构已取消本地存储，此文件保留备用
// ============================================================

import Dexie, { type Table } from 'dexie';
import type {
  WordRecord,
  UserWordRecord,
  WordbookRecord,
  DailyStatRecord,
  UserProfileRecord,
} from '@/types';

export class MemoWordsDB extends Dexie {
  words!: Table<WordRecord, string>;
  wordbooks!: Table<WordbookRecord, string>;
  userWords!: Table<UserWordRecord, string>;
  dailyStats!: Table<DailyStatRecord, string>;
  userProfile!: Table<UserProfileRecord, string>;
  meta!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super('MemoWordsDB');
    this.version(1).stores({
      words: 'id, wordbookId, word',
      wordbooks: 'id, isBuiltin',
      userWords: 'id, userId, wordId, state, nextReviewAt, updatedAt',
      dailyStats: 'id, userId, statDate, updatedAt',
      userProfile: 'id, userId',
      meta: 'key',
    });
  }
}

export const db = new MemoWordsDB();

// ============================================================
// 清空本地数据辅助方法（用于切换到云端数据前）
// ============================================================

/** 清空本地词库与单词数据（不影响用户配置） */
export async function clearLocalWordData(): Promise<void> {
  await db.wordbooks.clear();
  await db.words.clear();
  await db.userWords.clear();
}

/** 清空全部用户学习相关本地数据（保留 profile） */
export async function clearLocalLearningData(): Promise<void> {
  await db.userWords.clear();
  await db.dailyStats.clear();
}

/** 清空全部本地用户相关表（切换用户时调用） */
export async function clearAllLocalUserData(): Promise<void> {
  await db.wordbooks.clear();
  await db.words.clear();
  await db.userWords.clear();
  await db.dailyStats.clear();
  await db.userProfile.clear();
}

// ============================================================
// 内置词库种子信息（仅作为信息参考，不再自动写入本地）
// ============================================================

export interface SeededWordbook {
  id: string;
  name: string;
  description: string;
  wordCount: number;
  isBuiltin: boolean;
  sourceFile: string;
}

export const BUILTIN_WORDBOOKS: SeededWordbook[] = [];
