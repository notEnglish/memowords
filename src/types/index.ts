// ============================================================
// MemoWords — TypeScript 类型定义
// ============================================================

/** 用户反馈类型 */
export type Feedback = 'correct' | 'hazy' | 'forgot';

/** 学习状态 */
export type WordState = 'new' | 'learning' | 'review' | 'mastered';

// ---- 数据记录类型 ----

// json-full 格式的句子
export interface Sentence {
  sContent: string;
  sCn: string;
}

// json-full 格式的释义
export interface Trans {
  tranCn: string;
  descOther: string;
  pos: string;
  descCn: string;
  tranOther: string;
}

// json-full 格式的同义词
export interface Synonym {
  pos: string;
  tran: string;
  hwds: { w: string }[];
}

// json-full 格式的同根词
export interface RelativeWord {
  hwd: string;
  tran: string;
}

// json-full 格式的同根词组
export interface RelativeWordGroup {
  pos: string;
  words: RelativeWord[];
}

// json-full 格式的短语
export interface Phrase {
  pContent: string;
  pCn: string;
}

// json-full 格式的单词内容
export interface WordContent {
  sentence: {
    sentences: Sentence[];
    desc: string;
  };
  usphone: string;
  syno: {
    synos: Synonym[];
    desc: string;
  };
  ukphone: string;
  ukspeech: string;
  phrase: {
    phrases: Phrase[];
    desc: string;
  };
  relWord: {
    rels: RelativeWordGroup[];
    desc: string;
  };
  usspeech: string;
  trans: Trans[];
}

// json-full 格式的单词数据
export interface WordData {
  wordHead: string;
  wordId: string;
  content: WordContent;
}

// json-full 格式的主结构
export interface WordRecord {
  id: string;
  wordbookId: string;
  wordRank: number;
  headWord: string;
  content: {
    word: WordData;
  };
  bookId: string;
  sortOrder: number;
}

export interface UserWordRecord {
  id: string;
  userId: string;
  wordId: string;
  headWord: string;  // 新增：单词原文，用于 words 表 id 变化时的匹配
  wordbookId: string;
  state: WordState;
  step: number;
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewAt: Date;
  totalReviews: number;
  totalCorrect: number;
  totalHazy: number;
  totalForgot: number;
  lastReviewAt: Date | null;
  lastFeedback: string;
  updatedAt: Date;
}

export interface DailyStatRecord {
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
}

export interface UserProfileRecord {
  id: string;
  userId: string;
  nickname: string;
  avatarUrl: string;
  currentWordbookId: string | null;  // 当前学习的词库ID
  dailyNewLimit: number;
  dailyReviewLimit: number;
  autoPronounce: boolean;
  forgettingAlgorithm: ForgettingAlgorithm;  // 遗忘算法类型
  updatedAt: Date;
}

export interface WordbookRecord {
  id: string;
  name: string;
  description: string;
  wordCount: number;
  isBuiltin: boolean;
  sourceFile: string;
  createdAt: Date;
  updatedAt: Date;
}

// ---- SM-2 算法类型 ----

export interface SM2State {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewAt: Date;
}

export interface SM2Result {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewAt: Date;
  feedback: Feedback;
}

// ---- 词库导入 ----

export interface ImportWordItem {
  word: string;
  phonetic?: string;
  meaning: string;
  example?: string;
  example_cn?: string;
}

export interface ImportWordbookJSON {
  name: string;
  description?: string;
  words: ImportWordItem[];
}

// ---- 学习队列 ----

export interface QueueItem {
  userWordId: string;
  wordRecord: WordRecord;
  userWordRecord: UserWordRecord;
}

// ---- 学习小结 ----

export interface LearnSummary {
  newLearned: number;
  reviewedCount: number;
  correctCount: number;
  hazyCount: number;
  forgotCount: number;
  nextDayReviewCount: number;
  streakDays: number;
}

// ---- 遗忘算法类型 ----

/** 遗忘算法类型 */
export type ForgettingAlgorithm = 'sm2' | 'ssp-mmc';

/** 算法信息 */
export interface AlgorithmInfo {
  id: ForgettingAlgorithm;
  name: string;
  description: string;
}

/** 算法列表 */
export const ALGORITHMS: AlgorithmInfo[] = [
  {
    id: 'sm2',
    name: 'SM-2',
    description: '经典间隔重复算法，简单可靠',
  },
  {
    id: 'ssp-mmc',
    name: 'SSP-MMC',
    description: '基于随机最短路径的优化算法，更智能的复习规划',
  },
];
