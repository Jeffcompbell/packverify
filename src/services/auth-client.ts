import { createAuthClient } from 'better-auth/react';

// Better Auth 客户端
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL || window.location.origin,
});

// 邮箱密码登录
export const signInWithEmail = async (email: string, password: string) => {
  return authClient.signIn.email({ email, password });
};

// 邮箱密码注册
export const signUpWithEmail = async (email: string, password: string, name?: string) => {
  return authClient.signUp.email({ email, password, name: name || email.split('@')[0] });
};

// Google 登录
export const signInWithGoogle = async () => {
  return authClient.signIn.social({ provider: 'google' });
};

// 登出
export const signOutUser = async () => {
  return authClient.signOut();
};

// 获取当前用户
export const getCurrentUser = async () => {
  const session = await authClient.getSession();
  return session?.data?.user || null;
};

// 用户数据类型
export interface BetterAuthUser {
  id: string;
  email: string;
  name: string;
  image?: string;
  quota: number;
  used: number;
  isAdmin: boolean;
}
