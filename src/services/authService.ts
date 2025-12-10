// 简单的用户认证和配额管理

export interface User {
  username: string;
  quota: number;      // 总配额
  used: number;       // 已使用
  loginTime: number;  // 登录时间戳
}

const AUTH_KEY = 'packverify_auth';
const USAGE_KEY = 'packverify_usage';

// 从环境变量读取配置，默认值
const DEFAULT_QUOTA = parseInt(import.meta.env.VITE_DEFAULT_QUOTA || '50');
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';
const USER_PASSWORD = import.meta.env.VITE_USER_PASSWORD || 'packverify';

// 用户配额配置（可以在环境变量中配置）
// 格式: username:quota,username:quota
const USER_QUOTAS: Record<string, number> = {};
const quotaConfig = import.meta.env.VITE_USER_QUOTAS || '';
if (quotaConfig) {
  quotaConfig.split(',').forEach((item: string) => {
    const [user, quota] = item.split(':');
    if (user && quota) {
      USER_QUOTAS[user.trim()] = parseInt(quota);
    }
  });
}

// 登录
export const login = (username: string, password: string): User | null => {
  // 验证密码
  if (password !== ADMIN_PASSWORD && password !== USER_PASSWORD) {
    return null;
  }

  // 获取用户配额
  const quota = USER_QUOTAS[username] || DEFAULT_QUOTA;

  // 获取已使用量
  const usageData = localStorage.getItem(USAGE_KEY);
  const usage = usageData ? JSON.parse(usageData) : {};
  const used = usage[username] || 0;

  const user: User = {
    username,
    quota,
    used,
    loginTime: Date.now()
  };

  // 保存登录状态
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));

  return user;
};

// 获取当前用户
export const getCurrentUser = (): User | null => {
  const data = localStorage.getItem(AUTH_KEY);
  if (!data) return null;

  try {
    const user = JSON.parse(data);
    // 更新已使用量
    const usageData = localStorage.getItem(USAGE_KEY);
    const usage = usageData ? JSON.parse(usageData) : {};
    user.used = usage[user.username] || 0;
    return user;
  } catch {
    return null;
  }
};

// 登出
export const logout = () => {
  localStorage.removeItem(AUTH_KEY);
};

// 检查是否可以处理图片
export const canProcessImage = (): boolean => {
  const user = getCurrentUser();
  if (!user) return false;
  return user.used < user.quota;
};

// 获取剩余配额
export const getRemainingQuota = (): number => {
  const user = getCurrentUser();
  if (!user) return 0;
  return Math.max(0, user.quota - user.used);
};

// 使用配额（处理一张图片后调用）
export const useQuota = (count: number = 1): boolean => {
  const user = getCurrentUser();
  if (!user) return false;

  const usageData = localStorage.getItem(USAGE_KEY);
  const usage = usageData ? JSON.parse(usageData) : {};

  const currentUsed = usage[user.username] || 0;
  const newUsed = currentUsed + count;

  if (newUsed > user.quota) {
    return false;
  }

  usage[user.username] = newUsed;
  localStorage.setItem(USAGE_KEY, JSON.stringify(usage));

  // 更新缓存的用户信息
  user.used = newUsed;
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));

  return true;
};

// 获取配置信息（用于显示）
export const getQuotaConfig = () => ({
  defaultQuota: DEFAULT_QUOTA,
  userQuotas: USER_QUOTAS
});
