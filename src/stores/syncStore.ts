// ============================================================
// MemoWords — 同步状态管理
// 新架构：取消同步队列，所有操作直接通过 Supabase
// 仅保留在线状态检测功能
// ============================================================

import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useSyncStore = defineStore('sync', () => {
  const onlineStatus = ref(navigator.onLine);

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => { onlineStatus.value = true; });
    window.addEventListener('offline', () => { onlineStatus.value = false; });
  }

  return {
    onlineStatus,
  };
});