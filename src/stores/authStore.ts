// ============================================================
// MemoWords — 认证状态管理
// 新架构：所有操作直接通过 Supabase，关键信息缓存到 Pinia
// ============================================================

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/supabase/client';
import type { UserProfileRecord } from '@/types';
import { v4 } from '@/composables/uuid';
import { useWordbookStore } from '@/stores/wordbookStore';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const profile = ref<UserProfileRecord | null>(null);
  const isLoading = ref(false);
  const error = ref<string>('');

  const isLoggedIn = computed(() => !!user.value);

  function generateUUID(): string {
    return v4();
  }

  async function initSession(): Promise<void> {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      user.value = data.session.user;
      await loadProfile();
    }

    supabase.auth.onAuthStateChange((_event, session) => {
      user.value = session?.user ?? null;
      if (session?.user) {
        loadProfile();
      } else {
        profile.value = null;
      }
    });
  }

  async function loadProfile(): Promise<void> {
    if (!user.value) return;

    const userId = user.value.id;

    try {
      const { data, error: supabaseErr } = await supabase
        .from('users_profile')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!supabaseErr && data) {
        profile.value = {
          id: data.id,
          userId: data.user_id ?? userId,
          nickname: data.nickname ?? '',
          avatarUrl: data.avatar_url ?? '',
          currentWordbookId: data.current_wordbook_id ?? null,
          dailyNewLimit: data.daily_new_limit ?? 20,
          dailyReviewLimit: data.daily_review_limit ?? 0,
          autoPronounce: data.auto_pronounce ?? true,
          forgettingAlgorithm: data.forgetting_algorithm ?? 'sm2',
          updatedAt: data.updated_at ? new Date(data.updated_at) : new Date(),
        };
        return;
      }
    } catch (e) {
    }

    const newProfile: UserProfileRecord = {
      id: generateUUID(),
      userId,
      nickname: '',
      avatarUrl: '',
      currentWordbookId: null,
      dailyNewLimit: 20,
      dailyReviewLimit: 0,
      autoPronounce: true,
      forgettingAlgorithm: 'sm2',
      updatedAt: new Date(),
    };

    try {
      await supabase.from('users_profile').insert({
        id: newProfile.id,
        user_id: newProfile.userId,
        nickname: newProfile.nickname,
        avatar_url: newProfile.avatarUrl,
        current_wordbook_id: newProfile.currentWordbookId,
        daily_new_limit: newProfile.dailyNewLimit,
        daily_review_limit: newProfile.dailyReviewLimit,
        auto_pronounce: newProfile.autoPronounce,
        forgetting_algorithm: newProfile.forgettingAlgorithm,
        created_at: newProfile.updatedAt.toISOString(),
        updated_at: newProfile.updatedAt.toISOString(),
      });
    } catch (e) {
    }

    profile.value = newProfile;
  }

  async function signUp(email: string, password: string): Promise<boolean> {
    isLoading.value = true;
    error.value = '';

    const { data, error: err } = await supabase.auth.signUp({ email, password });

    if (err) {
      error.value = err.message;
      isLoading.value = false;
      return false;
    }

    if (data.user) {
      user.value = data.user;
      await loadProfile();

      const wordbookStore = useWordbookStore();
      try {
        await wordbookStore.init();
      } catch (e) {
      }
    }

    isLoading.value = false;
    return true;
  }

  async function signIn(email: string, password: string): Promise<boolean> {
    isLoading.value = true;
    error.value = '';

    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });

    if (err) {
      error.value = err.message;
      isLoading.value = false;
      return false;
    }

    if (data.user) {
      user.value = data.user;
      await loadProfile();

      const wordbookStore = useWordbookStore();
      try {
        await wordbookStore.init();
      } catch (e) {
      }
    }

    isLoading.value = false;
    return true;
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
    user.value = null;
    profile.value = null;
  }

  async function updateProfile(updates: Partial<UserProfileRecord>): Promise<void> {
    if (!profile.value || !user.value) {
      return;
    }

    const updated: UserProfileRecord = {
      id: profile.value.id,
      userId: profile.value.userId,
      nickname: profile.value.nickname,
      avatarUrl: profile.value.avatarUrl,
      currentWordbookId: updates.currentWordbookId !== undefined ? updates.currentWordbookId : profile.value.currentWordbookId,
      dailyNewLimit: updates.dailyNewLimit ?? profile.value.dailyNewLimit,
      dailyReviewLimit: updates.dailyReviewLimit ?? profile.value.dailyReviewLimit,
      autoPronounce: updates.autoPronounce !== undefined ? updates.autoPronounce : profile.value.autoPronounce,
      forgettingAlgorithm: updates.forgettingAlgorithm ?? profile.value.forgettingAlgorithm,
      updatedAt: new Date(),
    };

    try {
      const { error: sbErr } = await supabase
        .from('users_profile')
        .update({
          nickname: updated.nickname,
          avatar_url: updated.avatarUrl,
          current_wordbook_id: updated.currentWordbookId,
          daily_new_limit: updated.dailyNewLimit,
          daily_review_limit: updated.dailyReviewLimit,
          auto_pronounce: updated.autoPronounce,
          forgetting_algorithm: updated.forgettingAlgorithm,
          updated_at: updated.updatedAt.toISOString(),
        })
        .eq('id', updated.id);

      if (!sbErr) {
        profile.value = updated;
      }
    } catch (e) {
    }
  }

  async function changePassword(oldPassword: string, newPassword: string): Promise<{ error: { message: string } | null }> {
    isLoading.value = true;
    error.value = '';

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.value?.email ?? '',
      password: oldPassword,
    });

    if (signInError) {
      isLoading.value = false;
      return { error: { message: '原密码错误' } };
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

    if (updateError) {
      error.value = updateError.message;
    }

    isLoading.value = false;
    return { error: updateError ? { message: updateError.message } : null };
  }

  return {
    user,
    profile,
    isLoading,
    error,
    isLoggedIn,
    initSession,
    signUp,
    signIn,
    signOut,
    updateProfile,
    changePassword,
  };
});