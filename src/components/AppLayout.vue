<script setup lang="ts">
// ============================================================
// MemoWords — 全局布局组件
// ============================================================

import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { useSync } from '@/composables/useSync';
import { computed } from 'vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const { onlineStatus } = useSync();

const isLoginPage = computed(() => route.path === '/login');

const navItems = [
  { path: '/', label: '首页', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1' },
  { path: '/learn', label: '背单词', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { path: '/wordbooks', label: '词库', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  { path: '/stats', label: '统计', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { path: '/settings', label: '设置', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];
</script>

<template>
  <div class="flex h-screen flex-col" v-if="!isLoginPage && authStore.isLoggedIn">
    <!-- 顶部导航（桌面端） -->
    <header class="hidden border-b border-gray-200 bg-white md:block">
      <div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div class="flex items-center space-x-3">
          <span class="text-xl font-bold text-primary-600">MemoWords</span>
          <span class="text-xs text-gray-400">默默背单词</span>
        </div>
        <nav class="flex items-center space-x-1">
          <button
            v-for="item in navItems"
            :key="item.path"
            @click="router.push(item.path)"
            :class="[
              'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              route.path === item.path
                ? 'bg-primary-50 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100',
            ]"
          >
            {{ item.label }}
          </button>
        </nav>
        <div class="flex items-center space-x-3">
          <span
            :class="[
              'inline-flex h-2 w-2 rounded-full',
              onlineStatus ? 'bg-green-500' : 'bg-red-400',
            ]"
          ></span>
          <span class="text-xs text-gray-400">{{ authStore.user?.email }}</span>
        </div>
      </div>
    </header>

    <!-- 主内容 -->
    <main class="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:py-8">
      <router-view />
    </main>

    <!-- 底部导航（移动端） -->
    <nav class="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white md:hidden">
      <div class="flex items-center justify-around">
        <button
          v-for="item in navItems"
          :key="item.path"
          @click="router.push(item.path)"
          :class="[
            'flex flex-col items-center px-3 py-2 text-xs transition-colors',
            route.path === item.path ? 'text-primary-600' : 'text-gray-400',
          ]"
        >
          <svg class="mb-1 h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" :d="item.icon" />
          </svg>
          {{ item.label }}
        </button>
      </div>
    </nav>

    <!-- 移动端底部占位 -->
    <div class="h-16 md:hidden"></div>
  </div>

  <!-- 登录页直接渲染 -->
  <router-view v-else />
</template>
