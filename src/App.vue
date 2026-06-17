<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useAuthStore } from '@/stores/authStore';
import { useWordbookStore } from '@/stores/wordbookStore';
import AppLayout from '@/components/AppLayout.vue';

const authStore = useAuthStore();
const wordbookStore = useWordbookStore();
const isReady = ref(false);

onMounted(async () => {
  try {
    await authStore.initSession();
    await wordbookStore.init(false);
  } catch (e) {
  } finally {
    isReady.value = true;
  }
});
</script>

<template>
  <div v-if="!isReady" class="flex min-h-screen items-center justify-center">
    <div class="text-center">
      <span class="block text-sm text-gray-500">加载中...</span>
    </div>
  </div>
  <AppLayout v-else />
</template>