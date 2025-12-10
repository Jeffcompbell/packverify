import { auth } from './firebase';
import { ImageItem, DiagnosisIssue, DiffResult, ImageSpec, DeterministicCheck, SourceField } from '../types/types';

// Worker API 基础 URL
const API_BASE_URL = import.meta.env.VITE_WORKERS_URL || '';

// 获取认证 token
async function getAuthToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return await user.getIdToken();
}

// API 请求辅助函数
async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return await response.json();
}

// 用户数据接口
export interface UserData {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  quota: number;
  used: number;
  isAdmin: boolean;
  createdAt: any;
  lastLoginAt: any;
}

// 获取或创建用户数据
export const getOrCreateUser = async (firebaseUser: any): Promise<UserData> => {
  const token = await firebaseUser.getIdToken();

  const response = await fetch(`${API_BASE_URL}/api/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      quota: parseInt(import.meta.env.VITE_DEFAULT_QUOTA || '50'),
      isAdmin: (import.meta.env.VITE_ADMIN_EMAILS || '').split(',').includes(firebaseUser.email)
    })
  });

  return await response.json();
};

// 获取用户数据
export const getUserData = async (uid: string): Promise<UserData | null> => {
  try {
    return await apiRequest(`/api/users/${uid}`);
  } catch (error) {
    return null;
  }
};

// 配额使用记录接口
export interface QuotaUsageRecord {
  id: string;
  type: 'analyze' | 'retry';
  imageName: string;
  count: number;
  timestamp: any;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    model: string;
  };
}

// 使用配额
export const useQuotaFirebase = async (
  uid: string,
  count: number = 1,
  imageName: string = '图片',
  type: 'analyze' | 'retry' = 'analyze',
  tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number; model: string }
): Promise<boolean> => {
  try {
    await apiRequest('/api/quota/use', {
      method: 'POST',
      body: JSON.stringify({ type, imageName, count, tokenUsage })
    });
    return true;
  } catch (error) {
    return false;
  }
};

// 获取配额使用记录
export const getQuotaUsageHistory = async (
  uid: string,
  maxResults: number = 20,
  lastTimestamp?: any
): Promise<{ records: QuotaUsageRecord[]; hasMore: boolean }> => {
  try {
    const records = await apiRequest('/api/quota/history');
    return { records: records.slice(0, maxResults), hasMore: records.length > maxResults };
  } catch (error) {
    return { records: [], hasMore: false };
  }
};

// 检查是否有配额
export const hasQuota = async (uid: string): Promise<boolean> => {
  const userData = await getUserData(uid);
  if (!userData) return false;
  return userData.used < userData.quota;
};

// 会话数据接口
export interface CloudSession {
  id: string;
  userId: string;
  productName: string;
  createdAt: any;
  updatedAt: any;
  imageCount: number;
  qilFields: SourceField[];
  qilInputText: string;
}

// 云端图片数据接口
export interface CloudImageData {
  id: string;
  sessionId: string;
  userId: string;
  fileName: string;
  mimeType: string;
  storageUrl: string;
  description?: string;
  ocrText?: string;
  specs: ImageSpec[];
  issues: DiagnosisIssue[];
  deterministicIssues?: DeterministicCheck[];
  diffs: DiffResult[];
  issuesByModel?: {
    [modelId: string]: {
      issues: DiagnosisIssue[];
      deterministicIssues: DeterministicCheck[];
    }
  };
  status?: 'pending' | 'analyzing' | 'completed' | 'failed';
  analyzingStartedAt?: number;
  errorMessage?: string;
  createdAt: any;
  updatedAt: any;
}

// 获取或创建当前会话
export const getOrCreateSession = async (uid: string, productName?: string): Promise<string> => {
  const sessions = await getUserSessions(uid, 1);

  if (sessions.length > 0) {
    const lastSession = sessions[0];
    const updatedAt = new Date(lastSession.updatedAt);
    const hoursSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceUpdate < 24) {
      return lastSession.id;
    }
  }

  return await createNewSession(uid, productName || '未命名产品');
};

// 创建新会话
export const createNewSession = async (uid: string, productName: string): Promise<string> => {
  const session = await apiRequest('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ productName })
  });
  return session.id;
};

// 更新会话产品名称
export const updateSessionProductName = async (uid: string, sessionId: string, productName: string): Promise<void> => {
  await apiRequest(`/api/sessions/${sessionId}`, {
    method: 'PUT',
    body: JSON.stringify({ productName })
  });
};

// 保存图片数据到云端
export const saveImageToCloud = async (
  uid: string,
  sessionId: string,
  image: ImageItem
): Promise<void> => {
  const formData = new FormData();

  // 将 base64 转换为 Blob
  const base64Data = image.base64.split(',')[1];
  const blob = await fetch(`data:${image.file.type};base64,${base64Data}`).then(r => r.blob());

  formData.append('file', blob, image.file.name);
  formData.append('sessionId', sessionId);
  formData.append('fileName', image.file.name);

  const token = await getAuthToken();
  await fetch(`${API_BASE_URL}/api/images`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
};

// 更新云端图片分析结果
export const updateImageInCloud = async (
  uid: string,
  sessionId: string,
  imageId: string,
  updates: Partial<Pick<ImageItem, 'description' | 'ocrText' | 'specs' | 'issues' | 'deterministicIssues' | 'diffs' | 'issuesByModel' | 'status' | 'analyzingStartedAt' | 'errorMessage'>>
): Promise<void> => {
  await apiRequest(`/api/images/${imageId}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });
};

// 更新图片状态
export const updateImageStatusInCloud = async (
  uid: string,
  sessionId: string,
  imageId: string,
  status: 'pending' | 'analyzing' | 'completed' | 'failed',
  errorMessage?: string
): Promise<void> => {
  const updates: any = { status };
  if (status === 'analyzing') {
    updates.analyzingStartedAt = Date.now();
  }
  if (errorMessage) {
    updates.errorMessage = errorMessage;
  }
  await updateImageInCloud(uid, sessionId, imageId, updates);
};

// 删除云端图片
export const deleteImageFromCloud = async (
  uid: string,
  sessionId: string,
  imageId: string
): Promise<void> => {
  await apiRequest(`/api/images/${imageId}`, {
    method: 'DELETE'
  });
};

// 保存 QIL 数据到云端
export const saveQilToCloud = async (
  uid: string,
  sessionId: string,
  qilFields: SourceField[],
  qilInputText: string
): Promise<void> => {
  await apiRequest(`/api/sessions/${sessionId}`, {
    method: 'PUT',
    body: JSON.stringify({ qilFields, qilInputText })
  });
};

// 从云端加载会话数据
export const loadSessionFromCloud = async (
  uid: string,
  sessionId: string
): Promise<{ session: CloudSession | null; images: CloudImageData[] }> => {
  try {
    const data = await apiRequest(`/api/sessions/${sessionId}`);

    // 解析 JSON 字段
    if (data.qil_fields && typeof data.qil_fields === 'string') {
      data.qilFields = JSON.parse(data.qil_fields);
    }

    const session: CloudSession = {
      id: data.id,
      userId: data.user_id,
      productName: data.product_name,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      imageCount: data.image_count,
      qilFields: data.qilFields || [],
      qilInputText: data.qil_input_text || ''
    };

    const images: CloudImageData[] = (data.images || []).map((img: any) => ({
      id: img.id,
      sessionId: img.session_id,
      userId: img.user_id,
      fileName: img.file_name,
      mimeType: img.mime_type,
      storageUrl: `${API_BASE_URL}/api/images/${img.id}/data`,
      description: img.description,
      ocrText: img.ocr_text,
      specs: img.specs ? JSON.parse(img.specs) : [],
      issues: img.issues ? JSON.parse(img.issues) : [],
      deterministicIssues: img.deterministic_issues ? JSON.parse(img.deterministic_issues) : [],
      diffs: img.diffs ? JSON.parse(img.diffs) : [],
      issuesByModel: img.issues_by_model ? JSON.parse(img.issues_by_model) : {},
      status: img.status || 'pending',
      analyzingStartedAt: img.analyzing_started_at,
      errorMessage: img.error_message,
      createdAt: img.created_at,
      updatedAt: img.updated_at
    }));

    return { session, images };
  } catch (error) {
    return { session: null, images: [] };
  }
};

// 清空会话数据
export const clearSessionInCloud = async (uid: string, sessionId: string): Promise<void> => {
  const { images } = await loadSessionFromCloud(uid, sessionId);

  for (const image of images) {
    await deleteImageFromCloud(uid, sessionId, image.id);
  }

  await apiRequest(`/api/sessions/${sessionId}`, {
    method: 'PUT',
    body: JSON.stringify({ qilFields: [], qilInputText: '' })
  });
};

// 获取用户的历史会话列表
export const getUserSessions = async (uid: string, maxResults: number = 10): Promise<CloudSession[]> => {
  try {
    const sessions = await apiRequest('/api/sessions');

    return sessions.slice(0, maxResults).map((data: any) => ({
      id: data.id,
      userId: data.user_id,
      productName: data.product_name,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      imageCount: data.image_count,
      qilFields: data.qil_fields ? JSON.parse(data.qil_fields) : [],
      qilInputText: data.qil_input_text || ''
    }));
  } catch (error) {
    return [];
  }
};

// 管理员功能
export const updateUserQuota = async (targetUid: string, newQuota: number): Promise<boolean> => {
  try {
    await apiRequest(`/api/users/${targetUid}`, {
      method: 'PUT',
      body: JSON.stringify({ quota: newQuota })
    });
    return true;
  } catch (error) {
    return false;
  }
};

export const resetUserUsage = async (targetUid: string): Promise<boolean> => {
  try {
    await apiRequest(`/api/users/${targetUid}`, {
      method: 'PUT',
      body: JSON.stringify({ used: 0 })
    });
    return true;
  } catch (error) {
    return false;
  }
};

// 检测配置接口
export interface DetectionConfig {
  id: string;
  userId: string;
  name: string;
  prompt: string;
  isActive: boolean;
  createdAt: any;
  updatedAt: any;
}

// 获取检测配置列表
export const listDetectionConfigs = async (): Promise<DetectionConfig[]> => {
  try {
    const configs = await apiRequest('/api/detection-configs');
    return configs.map((data: any) => ({
      id: data.id,
      userId: data.user_id,
      name: data.name,
      prompt: data.prompt,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    }));
  } catch (error) {
    return [];
  }
};

// 创建检测配置
export const createDetectionConfig = async (name: string, prompt: string): Promise<DetectionConfig | null> => {
  try {
    const config = await apiRequest('/api/detection-configs', {
      method: 'POST',
      body: JSON.stringify({ name, prompt })
    });
    return {
      id: config.id,
      userId: config.user_id,
      name: config.name,
      prompt: config.prompt,
      isActive: config.is_active,
      createdAt: config.created_at,
      updatedAt: config.updated_at
    };
  } catch (error) {
    return null;
  }
};

// 更新检测配置
export const updateDetectionConfig = async (id: string, updates: { name?: string; prompt?: string; isActive?: boolean }): Promise<boolean> => {
  try {
    await apiRequest(`/api/detection-configs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return true;
  } catch (error) {
    return false;
  }
};

// 删除检测配置
export const deleteDetectionConfig = async (id: string): Promise<boolean> => {
  try {
    await apiRequest(`/api/detection-configs/${id}`, {
      method: 'DELETE'
    });
    return true;
  } catch (error) {
    return false;
  }
};

// 批量报告接口
export interface BatchReport {
  id: string;
  userId: string;
  name: string;
  configId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalImages: number;
  processedImages: number;
  createdAt: any;
  updatedAt: any;
}

export interface BatchReportImage {
  id: string;
  reportId: string;
  imageId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  createdAt: any;
}

// 创建批量报告
export const createBatchReport = async (name: string, configId?: string): Promise<BatchReport | null> => {
  try {
    const report = await apiRequest('/api/batch-reports', {
      method: 'POST',
      body: JSON.stringify({ name, configId })
    });
    return {
      id: report.id,
      userId: report.user_id,
      name: report.name,
      configId: report.config_id,
      status: report.status,
      totalImages: report.total_images,
      processedImages: report.processed_images,
      createdAt: report.created_at,
      updatedAt: report.updated_at
    };
  } catch (error) {
    return null;
  }
};

// 获取批量报告列表
export const listBatchReports = async (): Promise<BatchReport[]> => {
  try {
    const reports = await apiRequest('/api/batch-reports');
    return reports.map((data: any) => ({
      id: data.id,
      userId: data.user_id,
      name: data.name,
      configId: data.config_id,
      status: data.status,
      totalImages: data.total_images,
      processedImages: data.processed_images,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    }));
  } catch (error) {
    return [];
  }
};

// 获取批量报告详情
export const getBatchReport = async (reportId: string): Promise<{ report: BatchReport | null; images: BatchReportImage[] }> => {
  try {
    const data = await apiRequest(`/api/batch-reports/${reportId}`);
    const report: BatchReport = {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      configId: data.config_id,
      status: data.status,
      totalImages: data.total_images,
      processedImages: data.processed_images,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
    const images: BatchReportImage[] = (data.images || []).map((img: any) => ({
      id: img.id,
      reportId: img.report_id,
      imageId: img.image_id,
      status: img.status,
      result: img.result ? JSON.parse(img.result) : null,
      createdAt: img.created_at
    }));
    return { report, images };
  } catch (error) {
    return { report: null, images: [] };
  }
};

// 批量分析图片
export const analyzeBatchWithCustomPrompt = async (reportId: string, imageIds: string[], prompt: string): Promise<boolean> => {
  try {
    await apiRequest(`/api/batch-reports/${reportId}/analyze`, {
      method: 'POST',
      body: JSON.stringify({ imageIds, prompt })
    });
    return true;
  } catch (error) {
    return false;
  }
};
