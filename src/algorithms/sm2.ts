// ============================================================
// MemoWords — SM-2 间隔重复算法
// ============================================================

import type { Feedback, SM2State, SM2Result } from '@/types';

const FEEDBACK_QUALITY: Record<Feedback, number> = {
  correct: 5,
  hazy: 3,
  forgot: 1,
};

/**
 * 执行一次 SM-2 算法迭代
 * @param state 当前 SM-2 状态
 * @param feedback 用户反馈
 * @returns 更新后的 SM-2 结果
 */
export function computeSM2(state: SM2State, feedback: Feedback): SM2Result {
  const q = FEEDBACK_QUALITY[feedback];
  let { easeFactor, interval, repetitions } = state;

  // 1. 更新 easeFactor
  const deltaEF = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  easeFactor = Math.max(1.3, easeFactor + deltaEF);

  // 2. 更新 repetitions & interval
  if (q < 3) {
    repetitions = 0;
    interval = 0; // 忘记：立即复习（当天）
  } else {
    repetitions += 1;
    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
  }

  // 3. 计算下次复习时间（对齐到当天 00:00）
  const nextReviewAt = new Date();
  if (interval === 0) {
    // 立即复习：设置为今天 00:00
    nextReviewAt.setHours(0, 0, 0, 0);
  } else {
    nextReviewAt.setDate(nextReviewAt.getDate() + interval);
    nextReviewAt.setHours(0, 0, 0, 0);
  }

  return {
    easeFactor,
    interval,
    repetitions,
    nextReviewAt,
    feedback,
  };
}

/**
 * 创建初始 SM-2 状态
 */
export function createInitialSM2State(): SM2State {
  return {
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewAt: new Date(),
  };
}
