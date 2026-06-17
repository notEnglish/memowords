<script setup lang="ts">
// ============================================================
// MemoWords — 登录/注册页
// ============================================================

import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';

const router = useRouter();
const authStore = useAuthStore();

const isLogin = ref(true);
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const isLoading = ref(false);
const errorMsg = ref('');

function toggleMode(): void {
  isLogin.value = !isLogin.value;
  errorMsg.value = '';
  confirmPassword.value = '';
}

async function handleSubmit(): Promise<void> {
  errorMsg.value = '';

  if (!email.value || !password.value) {
    errorMsg.value = '请填写邮箱和密码';
    return;
  }

  if (!isLogin.value && password.value !== confirmPassword.value) {
    errorMsg.value = '两次密码不一致';
    return;
  }

  if (password.value.length < 6) {
    errorMsg.value = '密码至少 6 位';
    return;
  }

  isLoading.value = true;

  let success: boolean;
  if (isLogin.value) {
    success = await authStore.signIn(email.value, password.value);
  } else {
    success = await authStore.signUp(email.value, password.value);
  }

  isLoading.value = false;

  if (success) {
    router.push('/');
  } else {
    errorMsg.value = authStore.error || '操作失败，请重试';
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
    <div class="w-full max-w-sm">
      <div class="mb-8 text-center">
        <h1 class="text-3xl font-bold text-primary-600">MemoWords</h1>
        <p class="mt-2 text-sm text-gray-500">艾宾浩斯遗忘曲线 · 科学背单词</p>
      </div>

      <div class="card">
        <h2 class="mb-6 text-center text-lg font-semibold text-gray-800">
          {{ isLogin ? '登录' : '注册' }}
        </h2>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600">邮箱</label>
            <input
              v-model="email"
              type="email"
              class="input-field"
              placeholder="your@email.com"
              autocomplete="email"
            />
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600">密码</label>
            <input
              v-model="password"
              type="password"
              class="input-field"
              placeholder="至少 6 位"
              autocomplete="current-password"
            />
          </div>

          <div v-if="!isLogin">
            <label class="mb-1 block text-xs font-medium text-gray-600">确认密码</label>
            <input
              v-model="confirmPassword"
              type="password"
              class="input-field"
              placeholder="再次输入密码"
              autocomplete="new-password"
            />
          </div>

          <p v-if="errorMsg" class="text-xs text-red-500">{{ errorMsg }}</p>

          <button
            type="submit"
            :disabled="isLoading"
            class="btn-primary w-full py-2.5"
          >
            {{ isLoading ? '处理中...' : (isLogin ? '登录' : '注册') }}
          </button>
        </form>

        <p class="mt-4 text-center text-xs text-gray-400">
          {{ isLogin ? '还没有账号？' : '已有账号？' }}
          <button @click="toggleMode" class="font-medium text-primary-600 hover:underline">
            {{ isLogin ? '立即注册' : '去登录' }}
          </button>
        </p>
      </div>
    </div>
  </div>
</template>
