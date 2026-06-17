<script setup lang="ts">
// ============================================================
// MemoWords — 设置页
// ============================================================

import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import type { ForgettingAlgorithm } from '@/types';
import { ALGORITHMS } from '@/types';

const router = useRouter();
const authStore = useAuthStore();

const dailyNewLimit = ref(20);
const dailyReviewLimit = ref(0);
const autoPronounce = ref(true);
const forgettingAlgorithm = ref<ForgettingAlgorithm>('sm2');

// 消息提示
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null);
const showMessage = (type: 'success' | 'error', text: string) => {
  message.value = { type, text };
  setTimeout(() => { message.value = null; }, 3000);
};

// 修改密码相关
const showChangePassword = ref(false);
const oldPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const isChangingPassword = ref(false);

onMounted(async () => {
  await syncProfile();
});

function syncProfile(): void {
  if (authStore.profile) {
    dailyNewLimit.value = authStore.profile.dailyNewLimit ?? 20;
    dailyReviewLimit.value = authStore.profile.dailyReviewLimit ?? 0;
    autoPronounce.value = authStore.profile.autoPronounce ?? true;
    forgettingAlgorithm.value = authStore.profile.forgettingAlgorithm ?? 'sm2';
  }
}

async function saveDailyGoals(): Promise<void> {
  if (dailyNewLimit.value < 1) dailyNewLimit.value = 1;
  if (dailyNewLimit.value > 200) dailyNewLimit.value = 200;
  if (dailyReviewLimit.value < 0) dailyReviewLimit.value = 0;
  if (dailyReviewLimit.value > 500) dailyReviewLimit.value = 500;

  try {
    await authStore.updateProfile({
      dailyNewLimit: dailyNewLimit.value,
      dailyReviewLimit: dailyReviewLimit.value,
    });
    showMessage('success', '每日学习目标已保存');
  } catch {
    showMessage('error', '保存失败，请重试');
  }
}

async function toggleAutoPronounce(): Promise<void> {
  autoPronounce.value = !autoPronounce.value;
  try {
    await authStore.updateProfile({ autoPronounce: autoPronounce.value });
    showMessage('success', `自动发音已${autoPronounce.value ? '开启' : '关闭'}`);
  } catch {
    autoPronounce.value = !autoPronounce.value;
    showMessage('error', '保存失败，请重试');
  }
}

async function saveAlgorithm(): Promise<void> {
  try {
    await authStore.updateProfile({ forgettingAlgorithm: forgettingAlgorithm.value });
    const algoName = ALGORITHMS.find(a => a.id === forgettingAlgorithm.value)?.name ?? forgettingAlgorithm.value;
    showMessage('success', `已切换到${algoName}算法`);
  } catch {
    showMessage('error', '保存失败，请重试');
  }
}

async function handleChangePassword(): Promise<void> {
  if (newPassword.value !== confirmPassword.value) {
    showMessage('error', '两次输入的密码不一致');
    return;
  }
  if (newPassword.value.length < 6) {
    showMessage('error', '密码长度至少6位');
    return;
  }

  isChangingPassword.value = true;
  try {
    const { error } = await authStore.changePassword(oldPassword.value, newPassword.value);
    if (error) {
      showMessage('error', error.message || '修改密码失败');
    } else {
      showMessage('success', '密码修改成功');
      showChangePassword.value = false;
      oldPassword.value = '';
      newPassword.value = '';
      confirmPassword.value = '';
    }
  } catch {
    showMessage('error', '修改密码失败，请重试');
  }
  isChangingPassword.value = false;
}

async function handleLogout(): Promise<void> {
  await authStore.signOut();
  router.push('/login');
}
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-xl font-bold text-gray-800">设置</h1>

    <!-- 账号信息 - 移至最上方 -->
    <div class="card space-y-4">
      <h3 class="text-sm font-semibold text-gray-700">账号信息</h3>
      <p class="text-xs text-gray-400">{{ authStore.user?.email }}</p>
      <button @click="showChangePassword = true" class="btn-secondary w-full py-2">
        修改密码
      </button>
    </div>

    <!-- 每日学习目标 -->
    <div class="card space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-gray-700">每日学习目标</h3>
      </div>

      <div>
        <label class="mb-1 block text-xs text-gray-500">每日新词上限（1~200）</label>
        <input
          v-model.number="dailyNewLimit"
          type="number"
          min="1"
          max="200"
          class="input-field w-32"
        />
      </div>

      <div class="flex items-center justify-between">
        <div>
          <label class="mb-1 block text-xs text-gray-500">每日复习上限（0=不限制）</label>
          <input
            v-model.number="dailyReviewLimit"
            type="number"
            min="0"
            max="500"
            class="input-field w-32"
          />
        </div>
        <button
          @click="saveDailyGoals"
          class="rounded-lg bg-primary-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-600"
        >
          保存
        </button>
      </div>
    </div>

    <!-- 学习偏好 -->
    <div class="card space-y-4">
      <h3 class="text-sm font-semibold text-gray-700">学习偏好</h3>

      <div class="flex items-center justify-between">
        <span class="text-sm text-gray-600">自动发音</span>
        <button
          :class="[
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
            autoPronounce ? 'bg-primary-500' : 'bg-gray-300',
          ]"
          @click="toggleAutoPronounce"
        >
          <span
            :class="[
              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
              autoPronounce ? 'translate-x-6' : 'translate-x-1',
            ]"
          ></span>
        </button>
      </div>
    </div>

    <!-- 遗忘算法选择 -->
    <div class="card space-y-4">
      <h3 class="text-sm font-semibold text-gray-700">遗忘算法</h3>
      <p class="text-xs text-gray-400">选择背单词使用的遗忘曲线算法。切换算法后，新的复习计划将使用新算法计算。</p>

      <div class="space-y-2">
        <label
          v-for="algo in ALGORITHMS"
          :key="algo.id"
          class="flex cursor-pointer items-start space-x-3 rounded-lg border p-3 transition-colors"
          :class="forgettingAlgorithm === algo.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'"
        >
          <input
            type="radio"
            :value="algo.id"
            v-model="forgettingAlgorithm"
            class="mt-1 h-4 w-4 text-primary-500"
          />
          <div class="flex-1">
            <div class="font-medium text-gray-800">{{ algo.name }}</div>
            <div class="text-xs text-gray-500">{{ algo.description }}</div>
          </div>
        </label>
      </div>

      <button
        @click="saveAlgorithm"
        class="btn-primary w-full py-2"
      >
        保存算法设置
      </button>
    </div>

    <!-- 退出登录 - 移至最底部 -->
    <button @click="handleLogout" class="btn-secondary w-full py-2 text-red-500 hover:text-red-600">
      退出登录
    </button>

    <!-- 消息提示 -->
    <div v-if="message" class="fixed top-6 left-1/2 z-50 -translate-x-1/2">
      <div
        :class="[
          'rounded-lg px-4 py-2 text-sm font-medium shadow-lg',
          message.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white',
        ]"
      >
        {{ message.text }}
      </div>
    </div>

    <!-- 修改密码弹窗 -->
    <div v-if="showChangePassword" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h3 class="mb-4 text-lg font-semibold text-gray-800">修改密码</h3>

        <div class="space-y-3">
          <div>
            <label class="mb-1 block text-xs text-gray-500">原密码</label>
            <input
              v-model="oldPassword"
              type="password"
              class="input-field w-full"
              placeholder="请输入原密码"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs text-gray-500">新密码</label>
            <input
              v-model="newPassword"
              type="password"
              class="input-field w-full"
              placeholder="请输入新密码（至少6位）"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs text-gray-500">确认新密码</label>
            <input
              v-model="confirmPassword"
              type="password"
              class="input-field w-full"
              placeholder="请再次输入新密码"
            />
          </div>
        </div>

        <div class="mt-6 flex space-x-3">
          <button
            @click="showChangePassword = false"
            class="flex-1 rounded-lg bg-gray-100 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200"
          >
            取消
          </button>
          <button
            @click="handleChangePassword"
            :disabled="isChangingPassword"
            class="flex-1 rounded-lg bg-primary-500 py-2.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
          >
            {{ isChangingPassword ? '提交中...' : '确认' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
