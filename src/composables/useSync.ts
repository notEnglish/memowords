// ============================================================
// MemoWords — 同步状态封装
// 新架构：仅保留在线状态检测
// ============================================================

import { useSyncStore } from '@/stores/syncStore';

export function useSync() {
  const syncStore = useSyncStore();

  return {
    onlineStatus: syncStore.onlineStatus,
  };
}