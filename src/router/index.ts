// ============================================================
// MemoWords — Vue Router 路由配置
// ============================================================

import { createRouter, createWebHistory } from 'vue-router';
import { supabase } from '@/supabase/client';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/pages/LoginPage.vue'),
  },
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('@/pages/DashboardPage.vue'),
    meta: { auth: true },
  },
  {
    path: '/learn',
    name: 'Learn',
    component: () => import('@/pages/LearnPage.vue'),
    meta: { auth: true },
  },
  {
    path: '/wordbooks',
    name: 'Wordbooks',
    component: () => import('@/pages/WordbooksPage.vue'),
    meta: { auth: true },
  },
  {
    path: '/wordlist',
    name: 'Wordlist',
    component: () => import('@/pages/WordlistPage.vue'),
    meta: { auth: true },
  },
  {
    path: '/stats',
    name: 'Stats',
    component: () => import('@/pages/StatsPage.vue'),
    meta: { auth: true },
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/pages/SettingsPage.vue'),
    meta: { auth: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// 路由守卫：未登录重定向到 /login
router.beforeEach(async (to, _from, next) => {
  if (to.meta.auth) {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      return next('/login');
    }
  }
  next();
});

export default router;
