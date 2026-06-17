// ============================================================
// MemoWords — SSP-MMC 间隔重复算法
// 基于论文: "A Stochastic Shortest Path Algorithm for 
// Optimizing Spaced Repetition Scheduling" (KDD 2022)
// GitHub: https://github.com/maimemo/SSP-MMC
// ============================================================

import type { Feedback, SM2State, SM2Result } from '@/types';

// SSP-MMC 算法常量
const RECALL_COST = 3.0;        // 记住的成本
const FORGET_COST = 9.0;        // 忘记的成本
const D_LIMIT = 18;             // 最大难度等级
const D_OFFSET = 2;             // 忘记后难度偏移
const BASE = 1.05;              // 半衰期对数基底
const MIN_INDEX = -30;
const MAX_INDEX = 122;

// SSP-MMC 状态（使用半衰期作为状态）
export interface SSPMMCState {
  halflife: number;      // 半衰期（天）
  difficulty: number;    // 难度 1-18
}

/**
 * 根据难度计算初始半衰期
 * @param difficulty 单词难度 (1-18)
 * @returns 初始半衰期（天）
 */
export function calStartHalflife(difficulty: number): number {
  const p = Math.max(0.925 - 0.05 * difficulty, 0.025);
  return -1 / Math.log2(p);
}

/**
 * 计算下一次复习时的半衰期（记住的情况下）
 * @param halflife 当前半衰期
 * @param pRecall 回忆概率
 * @param difficulty 难度
 * @returns 新的半衰期
 */
export function calRecallHalflife(
  halflife: number,
  pRecall: number,
  difficulty: number
): number {
  return halflife * (
    1 +
    Math.exp(3.81) *
    Math.pow(difficulty, -0.534) *
    Math.pow(halflife, -0.127) *
    Math.pow(1 - pRecall, 0.97)
  );
}

/**
 * 计算下一次复习时的半衰期（忘记的情况下）
 * @param halflife 当前半衰期
 * @param pRecall 回忆概率
 * @param difficulty 难度
 * @returns 新的半衰期
 */
export function calForgetHalflife(
  halflife: number,
  pRecall: number,
  difficulty: number
): number {
  return (
    Math.exp(-0.041) *
    Math.pow(difficulty, -0.041) *
    Math.pow(halflife, 0.377) *
    Math.pow(1 - pRecall, -0.227)
  );
}

/**
 * 根据半衰期计算索引
 * @param halflife 半衰期
 * @returns 索引值
 */
export function calHalflifeIndex(halflife: number): number {
  return Math.max(Math.round(Math.log(halflife) / Math.log(BASE)) - MIN_INDEX, 0);
}

/**
 * 根据索引计算半衰期
 * @param index 索引值
 * @returns 半衰期
 */
export function calIndexHalflife(index: number): number {
  return Math.exp((index + MIN_INDEX) * Math.log(BASE));
}

/**
 * 计算最优复习间隔（核心算法）
 * 使用动态规划求解 SSP 问题
 * @param halflife 当前半衰期
 * @param difficulty 难度
 * @param recallCost 记住成本
 * @param forgetCost 忘记成本
 * @returns 最优间隔（天）
 */
export function calOptimalInterval(
  halflife: number,
  difficulty: number,
  recallCost: number = RECALL_COST,
  forgetCost: number = FORGET_COST
): number {
  const indexLen = MAX_INDEX - MIN_INDEX;
  const h_index = Math.min(calHalflifeIndex(halflife), indexLen - 1);
  
  // 初始化成本表
  const costTable: number[][] = [];
  for (let d = 0; d < D_LIMIT; d++) {
    costTable[d] = [];
    for (let i = 0; i < indexLen - 1; i++) {
      costTable[d][i] = 2000;
    }
    costTable[d][indexLen - 1] = 0; // 最终状态成本为0
  }
  
  // 预计算半衰期列表
  const halflifeList: number[] = [];
  for (let i = 0; i < indexLen; i++) {
    halflifeList.push(Math.pow(BASE, i + MIN_INDEX));
  }
  
  // 动态规划迭代（简化版本，使用较少的迭代次数）
  for (let iter = 0; iter < 500; iter++) {
    for (let d = D_LIMIT - 1; d >= 0; d--) {
      for (let hIdx = indexLen - 2; hIdx >= 0; hIdx--) {
        const h = halflifeList[hIdx];
        
        // 计算合理的间隔范围
        const intervalMin = 1;
        const intervalMax = Math.max(1, Math.round((h * Math.log(0.3)) / Math.log(0.5)));
        
        let bestInterval = intervalMin;
        let bestCost = Infinity;
        
        // 遍历所有可能的间隔
        for (let interval = intervalMin; interval <= Math.min(intervalMax, 365); interval++) {
          // 回忆概率：P = 2^(-interval/halflife)
          const pRecall = Math.pow(2, -interval / h);
          
          // 记住后的半衰期
          const recallH = calRecallHalflife(h, pRecall, d + 1);
          const recallHIdx = Math.min(calHalflifeIndex(recallH), indexLen - 1);
          
          // 忘记后的半衰期
          const forgetH = calForgetHalflife(h, pRecall, d + 1);
          const forgetHIdx = Math.max(calHalflifeIndex(forgetH), 0);
          
          // 计算期望成本
          const nextD = Math.min(d + D_OFFSET, D_LIMIT - 1);
          const expCost =
            pRecall * (costTable[d][recallHIdx] + recallCost) +
            (1 - pRecall) * (costTable[nextD][forgetHIdx] + forgetCost);
          
          if (expCost < bestCost) {
            bestCost = expCost;
            bestInterval = interval;
          }
        }
        
        costTable[d][hIdx] = bestCost;
      }
    }
  }
  
  // 查找当前状态的最优间隔
  return calBestIntervalForState(costTable, halflife, difficulty - 1);
}

/**
 * 为给定状态计算最优间隔
 */
function calBestIntervalForState(
  costTable: number[][],
  halflife: number,
  difficultyIdx: number
): number {
  const indexLen = MAX_INDEX - MIN_INDEX;
  const hIdx = Math.min(calHalflifeIndex(halflife), indexLen - 1);
  const h = calIndexHalflife(hIdx);
  
  const intervalMin = 1;
  const intervalMax = Math.max(1, Math.round((h * Math.log(0.3)) / Math.log(0.5)));
  
  let bestInterval = intervalMin;
  let bestCost = Infinity;
  
  for (let interval = intervalMin; interval <= Math.min(intervalMax, 365); interval++) {
    const pRecall = Math.pow(2, -interval / h);
    
    const recallH = calRecallHalflife(h, pRecall, difficultyIdx + 1);
    const recallHIdx = Math.min(calHalflifeIndex(recallH), indexLen - 1);
    
    const forgetH = calForgetHalflife(h, pRecall, difficultyIdx + 1);
    const forgetHIdx = Math.max(calHalflifeIndex(forgetH), 0);
    
    const nextD = Math.min(difficultyIdx + D_OFFSET, D_LIMIT - 1);
    const expCost =
      pRecall * (costTable[difficultyIdx][recallHIdx] + RECALL_COST) +
      (1 - pRecall) * (costTable[nextD][forgetHIdx] + FORGET_COST);
    
    if (expCost < bestCost) {
      bestCost = expCost;
      bestInterval = interval;
    }
  }
  
  return bestInterval;
}

// 预计算的策略表（简化版，用于快速查表）
// 格式: strategy[difficulty][halflifeIndex] = optimalInterval
let strategyCache: Map<string, number> | null = null;

/**
 * 获取预计算的策略表
 */
function getStrategyCache(): Map<string, number> {
  if (strategyCache) return strategyCache;
  
  strategyCache = new Map();
  const costTable: number[][] = [];
  const indexLen = MAX_INDEX - MIN_INDEX;
  
  // 初始化成本表
  for (let d = 0; d < D_LIMIT; d++) {
    costTable[d] = [];
    for (let i = 0; i < indexLen - 1; i++) {
      costTable[d][i] = 2000;
    }
    costTable[d][indexLen - 1] = 0;
  }
  
  // 动态规划
  for (let iter = 0; iter < 200; iter++) {
    for (let d = D_LIMIT - 1; d >= 0; d--) {
      for (let hIdx = indexLen - 2; hIdx >= 0; hIdx--) {
        const h = calIndexHalflife(hIdx);
        const intervalMin = 1;
        const intervalMax = Math.max(1, Math.round((h * Math.log(0.3)) / Math.log(0.5)));
        
        let bestInterval = intervalMin;
        let bestCost = Infinity;
        
        for (let interval = intervalMin; interval <= Math.min(intervalMax, 180); interval++) {
          const pRecall = Math.pow(2, -interval / h);
          const recallH = calRecallHalflife(h, pRecall, d + 1);
          const recallHIdx = Math.min(calHalflifeIndex(recallH), indexLen - 1);
          const forgetH = calForgetHalflife(h, pRecall, d + 1);
          const forgetHIdx = Math.max(calHalflifeIndex(forgetH), 0);
          const nextD = Math.min(d + D_OFFSET, D_LIMIT - 1);
          
          const expCost =
            pRecall * (costTable[d][recallHIdx] + RECALL_COST) +
            (1 - pRecall) * (costTable[nextD][forgetHIdx] + FORGET_COST);
          
          if (expCost < bestCost) {
            bestCost = expCost;
            bestInterval = interval;
          }
        }
        
        costTable[d][hIdx] = bestCost;
      }
    }
  }
  
  // 构建策略缓存
  for (let d = 0; d < D_LIMIT; d++) {
    for (let hIdx = 0; hIdx < indexLen - 1; hIdx++) {
      const h = calIndexHalflife(hIdx);
      const intervalMin = 1;
      const intervalMax = Math.max(1, Math.round((h * Math.log(0.3)) / Math.log(0.5)));
      
      let bestInterval = intervalMin;
      let bestCost = Infinity;
      
      for (let interval = intervalMin; interval <= Math.min(intervalMax, 180); interval++) {
        const pRecall = Math.pow(2, -interval / h);
        const recallH = calRecallHalflife(h, pRecall, d + 1);
        const recallHIdx = Math.min(calHalflifeIndex(recallH), indexLen - 1);
        const forgetH = calForgetHalflife(h, pRecall, d + 1);
        const forgetHIdx = Math.max(calHalflifeIndex(forgetH), 0);
        const nextD = Math.min(d + D_OFFSET, D_LIMIT - 1);
        
        const expCost =
          pRecall * (costTable[d][recallHIdx] + RECALL_COST) +
          (1 - pRecall) * (costTable[nextD][forgetHIdx] + FORGET_COST);
        
        if (expCost < bestCost) {
          bestCost = expCost;
          bestInterval = interval;
        }
      }
      
      strategyCache.set(`${d + 1}-${hIdx}`, bestInterval);
    }
  }
  
  return strategyCache;
}

/**
 * 从预计算策略表获取最优间隔（快速版本）
 */
function getOptimalIntervalFast(halflife: number, difficulty: number): number {
  const cache = getStrategyCache();
  const hIdx = Math.min(calHalflifeIndex(halflife), MAX_INDEX - MIN_INDEX - 2);
  const key = `${Math.min(difficulty, D_LIMIT)}-${hIdx}`;
  
  if (cache.has(key)) {
    return cache.get(key)!;
  }
  
  // 缓存未命中，使用动态计算
  return calOptimalInterval(halflife, difficulty);
}

/**
 * 计算难度等级
 * 基于遗忘率和学习次数动态调整
 */
function calculateDifficulty(
  totalReviews: number,
  totalCorrect: number,
  totalForgot: number
): number {
  if (totalReviews === 0) {
    return 10; // 默认中等难度
  }
  
  // 遗忘率
  const forgetRate = totalForgot / totalReviews;
  
  // 根据遗忘率调整难度 (1-18)
  // 遗忘率高 -> 难度高, 遗忘率低 -> 难度低
  const baseDifficulty = 10;
  const adjustment = Math.round((forgetRate - 0.2) * 50);
  
  return Math.max(1, Math.min(18, baseDifficulty + adjustment));
}

/**
 * 执行 SSP-MMC 算法
 * @param sm2State 兼容 SM-2 的状态（会转换为半衰期）
 * @param feedback 用户反馈
 * @param difficulty 单词难度 (1-18)，可选
 * @returns 算法结果
 */
export function computeSSPMC(
  sm2State: SM2State,
  feedback: Feedback,
  difficulty?: number
): SM2Result {
  // 将 interval 转换为半衰期估计
  // 使用指数衰减模型: interval ≈ halflife * log(0.5) / log(p)
  // 当 p = 0.5 时, interval = halflife
  let halflife: number;
  
  if (sm2State.repetitions === 0) {
    // 新单词，使用默认难度计算初始半衰期
    const d = difficulty ?? calculateDifficulty(
      sm2State.interval, // 这里复用 interval 字段存储难度相关信息
      sm2State.repetitions,
      0
    );
    halflife = calStartHalflife(d);
  } else {
    // 已有学习记录，将 interval 转换为半衰期
    // 根据 SM-2 的 interval 定义，它大约等于稳定记忆的周期
    // 我们使用一个经验公式转换
    halflife = Math.max(1, sm2State.interval * 0.8);
  }
  
  // 根据反馈确定回忆结果
  const recalled = feedback === 'correct';
  const pRecall = recalled ? 0.85 : 0.15; // 估计的回忆概率
  
  // 计算新的半衰期
  let newHalflife: number;
  if (recalled) {
    newHalflife = calRecallHalflife(halflife, pRecall, difficulty ?? 10);
  } else {
    newHalflife = calForgetHalflife(halflife, pRecall, difficulty ?? 10);
    // 忘记时降低难度（难度值降低）
    difficulty = difficulty ? Math.max(1, difficulty - 1) : 9;
  }
  
  // 计算最优复习间隔
  const optimalInterval = getOptimalIntervalFast(newHalflife, difficulty ?? 10);
  
  // 根据反馈类型确定最终间隔
  // 记住：正确间隔
  // 模糊：缩短间隔（70%）
  // 忘记：立即复习（interval = 0，即当天）
  let finalInterval: number;
  if (feedback === 'correct') {
    finalInterval = Math.max(1, Math.round(optimalInterval));
  } else if (feedback === 'hazy') {
    finalInterval = Math.max(1, Math.round(optimalInterval * 0.7));
  } else {
    // forgot：立即复习，设置为 0（当天复习）
    finalInterval = 0;
  }
  
  // 计算下次复习时间
  const nextReviewAt = new Date();
  if (finalInterval === 0) {
    // 立即复习：设置为今天（0天后）
    nextReviewAt.setHours(0, 0, 0, 0);
  } else {
    nextReviewAt.setDate(nextReviewAt.getDate() + finalInterval);
    nextReviewAt.setHours(0, 0, 0, 0);
  }
  
  return {
    easeFactor: newHalflife / Math.max(1, halflife), // 使用半衰期比率作为 ease factor
    interval: finalInterval,
    repetitions: recalled ? sm2State.repetitions + 1 : 0, // 忘记时重置
    nextReviewAt,
    feedback,
  };
}

/**
 * 创建初始 SSP-MMC 状态
 */
export function createInitialSSPMCState(difficulty: number = 10): SM2State {
  return {
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewAt: new Date(),
  };
}

/**
 * 获取难度描述
 */
export function getDifficultyDescription(difficulty: number): string {
  if (difficulty <= 3) return '非常简单';
  if (difficulty <= 6) return '较简单';
  if (difficulty <= 10) return '中等';
  if (difficulty <= 14) return '较难';
  return '非常难';
}

/**
 * 预估记忆保留率
 * @param interval 间隔天数
 * @param halflife 半衰期
 */
export function estimateRetention(interval: number, halflife: number): number {
  return Math.pow(2, -interval / halflife);
}
