import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment, serverTimestamp, collection, query, orderBy, getDocs, deleteDoc, writeBatch, limit, startAfter } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { ImageItem, DiagnosisIssue, DiffResult, ImageSpec, DeterministicCheck, SourceField } from '../types/types';

// Firebase 配置 - 从环境变量读取
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Google 登录 Provider
const googleProvider = new GoogleAuthProvider();

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

// 默认配额
const DEFAULT_QUOTA = parseInt(import.meta.env.VITE_DEFAULT_QUOTA || '50');

// 管理员邮箱列表（可以在环境变量中配置）
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '').split(',').map((e: string) => e.trim()).filter(Boolean);

// Google 登录
export const signInWithGoogle = async (): Promise<UserData | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // 动态导入 cloudflare.ts 的 getOrCreateUser 避免循环依赖
    const { getOrCreateUser: getOrCreateUserFromCloudflare } = await import('./cloudflare');
    const userData = await getOrCreateUserFromCloudflare(user);
    return userData;
  } catch (error: any) {
    console.error('Google sign in error:', error);
    throw error;
  }
};

// 登出
export const signOutUser = async () => {
  await signOut(auth);
};

// 获取或创建用户数据
export const getOrCreateUser = async (firebaseUser: FirebaseUser): Promise<UserData> => {
  const userRef = doc(db, 'users', firebaseUser.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    // 更新最后登录时间
    await updateDoc(userRef, {
      lastLoginAt: serverTimestamp(),
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL
    });

    const data = userSnap.data();
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || '',
      photoURL: firebaseUser.photoURL,
      quota: data.quota || DEFAULT_QUOTA,
      used: data.used || 0,
      isAdmin: data.isAdmin || ADMIN_EMAILS.includes(firebaseUser.email || ''),
      createdAt: data.createdAt,
      lastLoginAt: data.lastLoginAt
    };
  } else {
    // 创建新用户
    const isAdmin = ADMIN_EMAILS.includes(firebaseUser.email || '');
    const newUserData = {
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      quota: DEFAULT_QUOTA,
      used: 0,
      isAdmin,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp()
    };

    await setDoc(userRef, newUserData);

    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || '',
      photoURL: firebaseUser.photoURL,
      quota: DEFAULT_QUOTA,
      used: 0,
      isAdmin,
      createdAt: newUserData.createdAt,
      lastLoginAt: newUserData.lastLoginAt
    };
  }
};

// 获取用户数据
export const getUserData = async (uid: string): Promise<UserData | null> => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const data = userSnap.data();
    return {
      uid,
      email: data.email,
      displayName: data.displayName,
      photoURL: data.photoURL,
      quota: data.quota || DEFAULT_QUOTA,
      used: data.used || 0,
      isAdmin: data.isAdmin || false,
      createdAt: data.createdAt,
      lastLoginAt: data.lastLoginAt
    };
  }
  return null;
};

// 使用配额（带记录）
export interface QuotaUsageRecord {
  id: string;
  type: 'analyze' | 'retry';
  imageName: string;
  count: number;
  timestamp: any;
  // Token 使用统计（可选）
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    model: string;
  };
}

export const useQuotaFirebase = async (
  uid: string,
  count: number = 1,
  imageName: string = '图片',
  type: 'analyze' | 'retry' = 'analyze',
  tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number; model: string }
): Promise<boolean> => {
  const userData = await getUserData(uid);
  if (!userData) return false;

  if (userData.used + count > userData.quota) {
    return false;
  }

  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    used: increment(count)
  });

  // 记录消耗历史（包含 token 使用信息）
  const usageRef = doc(collection(db, 'users', uid, 'usage'));
  const usageData: any = {
    type,
    imageName,
    count,
    timestamp: serverTimestamp()
  };

  // 如果有 token 使用信息，保存到 Firebase
  if (tokenUsage) {
    usageData.tokenUsage = tokenUsage;
  }

  await setDoc(usageRef, usageData);

  return true;
};

// 获取配额使用记录（支持分页）
export const getQuotaUsageHistory = async (
  uid: string,
  maxResults: number = 20,
  lastTimestamp?: any
): Promise<{ records: QuotaUsageRecord[]; hasMore: boolean }> => {
  try {
    const usageRef = collection(db, 'users', uid, 'usage');
    let q;

    if (lastTimestamp) {
      q = query(
        usageRef,
        orderBy('timestamp', 'desc'),
        startAfter(lastTimestamp),
        limit(maxResults + 1)
      );
    } else {
      q = query(usageRef, orderBy('timestamp', 'desc'), limit(maxResults + 1));
    }

    const snapshot = await getDocs(q);
    const docs = snapshot.docs;
    const hasMore = docs.length > maxResults;
    const records = docs.slice(0, maxResults).map(doc => ({
      id: doc.id,
      type: doc.data().type || 'analyze',
      imageName: doc.data().imageName || '图片',
      count: doc.data().count || 1,
      timestamp: doc.data().timestamp
    }));

    return { records, hasMore };
  } catch (error) {
    console.error('Get usage history error:', error);
    return { records: [], hasMore: false };
  }
};

// 检查是否有配额
export const hasQuota = async (uid: string): Promise<boolean> => {
  const userData = await getUserData(uid);
  if (!userData) return false;
  return userData.used < userData.quota;
};

// 监听认证状态
export const onAuthChange = (callback: (user: FirebaseUser | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// === 管理员功能 ===

// 更新用户配额（仅管理员）
export const updateUserQuota = async (targetUid: string, newQuota: number): Promise<boolean> => {
  try {
    const userRef = doc(db, 'users', targetUid);
    await updateDoc(userRef, { quota: newQuota });
    return true;
  } catch (error) {
    console.error('Update quota error:', error);
    return false;
  }
};

// 重置用户已用配额（仅管理员）
export const resetUserUsage = async (targetUid: string): Promise<boolean> => {
  try {
    const userRef = doc(db, 'users', targetUid);
    await updateDoc(userRef, { used: 0 });
    return true;
  } catch (error) {
    console.error('Reset usage error:', error);
    return false;
  }
};

// === 云同步功能 ===

// 会话数据接口（存储在 Firestore）
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
  storageUrl: string;  // Firebase Storage URL
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
  status?: 'pending' | 'analyzing' | 'completed' | 'failed'; // 分析状态
  analyzingStartedAt?: number; // 分析开始时间戳
  errorMessage?: string; // 错误信息
  createdAt: any;
  updatedAt: any;
}

// 上传图片到 Firebase Storage
export const uploadImageToStorage = async (
  uid: string,
  imageId: string,
  base64: string,
  mimeType: string
): Promise<string> => {
  const storageRef = ref(storage, `users/${uid}/images/${imageId}`);
  // base64 格式: data:image/png;base64,xxxxx 或直接 base64 字符串
  const dataUrl = base64.startsWith('data:') ? base64 : `data:${mimeType};base64,${base64}`;
  await uploadString(storageRef, dataUrl, 'data_url');
  return await getDownloadURL(storageRef);
};

// 删除 Storage 中的图片
export const deleteImageFromStorage = async (uid: string, imageId: string): Promise<void> => {
  try {
    const storageRef = ref(storage, `users/${uid}/images/${imageId}`);
    await deleteObject(storageRef);
  } catch (error: any) {
    // 如果图片不存在，忽略错误
    if (error.code !== 'storage/object-not-found') {
      console.error('Delete image error:', error);
    }
  }
};

// 获取或创建当前会话
export const getOrCreateSession = async (uid: string, productName?: string): Promise<string> => {
  const sessionsRef = collection(db, 'users', uid, 'sessions');
  const q = query(sessionsRef, orderBy('updatedAt', 'desc'), limit(1));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const lastSession = snapshot.docs[0];
    const data = lastSession.data();
    // 如果最近的会话在 24 小时内，复用它
    const updatedAt = data.updatedAt?.toDate?.() || new Date(0);
    const hoursSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceUpdate < 24) {
      return lastSession.id;
    }
  }

  // 创建新会话
  const newSessionRef = doc(collection(db, 'users', uid, 'sessions'));
  await setDoc(newSessionRef, {
    userId: uid,
    productName: productName || '未命名产品',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    imageCount: 0,
    qilFields: [],
    qilInputText: ''
  });

  return newSessionRef.id;
};

// 创建新会话（强制创建）
export const createNewSession = async (uid: string, productName: string): Promise<string> => {
  const newSessionRef = doc(collection(db, 'users', uid, 'sessions'));
  await setDoc(newSessionRef, {
    userId: uid,
    productName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    imageCount: 0,
    qilFields: [],
    qilInputText: ''
  });
  return newSessionRef.id;
};

// 更新会话产品名称
export const updateSessionProductName = async (uid: string, sessionId: string, productName: string): Promise<void> => {
  const sessionRef = doc(db, 'users', uid, 'sessions', sessionId);
  await updateDoc(sessionRef, {
    productName,
    updatedAt: serverTimestamp()
  });
};

// 保存图片数据到云端
export const saveImageToCloud = async (
  uid: string,
  sessionId: string,
  image: ImageItem
): Promise<void> => {
  try {
    // 1. 上传图片到 Storage
    const storageUrl = await uploadImageToStorage(uid, image.id, image.base64, image.file.type);

    // 2. 保存元数据到 Firestore
    const imageRef = doc(db, 'users', uid, 'sessions', sessionId, 'images', image.id);
    await setDoc(imageRef, {
      id: image.id,
      sessionId,
      userId: uid,
      fileName: image.file.name,
      mimeType: image.file.type,
      storageUrl,
      description: image.description || null,
      ocrText: image.ocrText || null,
      specs: image.specs || [],
      issues: image.issues || [],
      deterministicIssues: image.deterministicIssues || [],
      diffs: image.diffs || [],
      status: image.status || 'pending',
      analyzingStartedAt: image.analyzingStartedAt || null,
      errorMessage: image.errorMessage || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // 3. 更新会话
    const sessionRef = doc(db, 'users', uid, 'sessions', sessionId);
    await updateDoc(sessionRef, {
      updatedAt: serverTimestamp(),
      imageCount: increment(1)
    });
  } catch (error) {
    console.error('Save image to cloud error:', error);
    throw error;
  }
};

// 更新云端图片分析结果
export const updateImageInCloud = async (
  uid: string,
  sessionId: string,
  imageId: string,
  updates: Partial<Pick<ImageItem, 'description' | 'ocrText' | 'specs' | 'issues' | 'deterministicIssues' | 'diffs' | 'issuesByModel' | 'status' | 'analyzingStartedAt' | 'errorMessage'>>
): Promise<void> => {
  try {
    const imageRef = doc(db, 'users', uid, 'sessions', sessionId, 'images', imageId);
    await updateDoc(imageRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Update image in cloud error:', error);
  }
};

// 更新图片状态（快捷函数）
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
  try {
    // 删除 Storage 中的图片
    await deleteImageFromStorage(uid, imageId);

    // 删除 Firestore 中的记录
    const imageRef = doc(db, 'users', uid, 'sessions', sessionId, 'images', imageId);
    await deleteDoc(imageRef);

    // 更新会话计数
    const sessionRef = doc(db, 'users', uid, 'sessions', sessionId);
    await updateDoc(sessionRef, {
      updatedAt: serverTimestamp(),
      imageCount: increment(-1)
    });
  } catch (error) {
    console.error('Delete image from cloud error:', error);
  }
};

// 保存 QIL 数据到云端
export const saveQilToCloud = async (
  uid: string,
  sessionId: string,
  qilFields: SourceField[],
  qilInputText: string
): Promise<void> => {
  try {
    const sessionRef = doc(db, 'users', uid, 'sessions', sessionId);
    await updateDoc(sessionRef, {
      qilFields,
      qilInputText,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Save QIL to cloud error:', error);
  }
};

// 从云端加载会话数据
export const loadSessionFromCloud = async (
  uid: string,
  sessionId: string
): Promise<{ session: CloudSession | null; images: CloudImageData[] }> => {
  try {
    // 加载会话信息
    const sessionRef = doc(db, 'users', uid, 'sessions', sessionId);
    const sessionSnap = await getDoc(sessionRef);

    if (!sessionSnap.exists()) {
      return { session: null, images: [] };
    }

    const sessionData = sessionSnap.data();
    const session: CloudSession = {
      id: sessionSnap.id,
      userId: sessionData.userId,
      productName: sessionData.productName || '未命名产品',
      createdAt: sessionData.createdAt,
      updatedAt: sessionData.updatedAt,
      imageCount: sessionData.imageCount || 0,
      qilFields: sessionData.qilFields || [],
      qilInputText: sessionData.qilInputText || ''
    };

    // 加载图片列表
    const imagesRef = collection(db, 'users', uid, 'sessions', sessionId, 'images');
    const imagesQuery = query(imagesRef, orderBy('createdAt', 'asc'));
    const imagesSnap = await getDocs(imagesQuery);

    const images: CloudImageData[] = imagesSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        sessionId: data.sessionId,
        userId: data.userId,
        fileName: data.fileName,
        mimeType: data.mimeType,
        storageUrl: data.storageUrl,
        description: data.description,
        ocrText: data.ocrText,
        specs: data.specs || [],
        issues: data.issues || [],
        deterministicIssues: data.deterministicIssues || [],
        diffs: data.diffs || [],
        issuesByModel: data.issuesByModel || {},
        status: data.status || 'pending',
        analyzingStartedAt: data.analyzingStartedAt,
        errorMessage: data.errorMessage,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      };
    });

    return { session, images };
  } catch (error) {
    console.error('Load session from cloud error:', error);
    return { session: null, images: [] };
  }
};

// 清空会话数据
export const clearSessionInCloud = async (uid: string, sessionId: string): Promise<void> => {
  try {
    // 获取所有图片
    const imagesRef = collection(db, 'users', uid, 'sessions', sessionId, 'images');
    const imagesSnap = await getDocs(imagesRef);

    // 批量删除
    const batch = writeBatch(db);

    for (const imageDoc of imagesSnap.docs) {
      // 删除 Storage 图片
      await deleteImageFromStorage(uid, imageDoc.id);
      // 删除 Firestore 记录
      batch.delete(imageDoc.ref);
    }

    // 重置会话
    const sessionRef = doc(db, 'users', uid, 'sessions', sessionId);
    batch.update(sessionRef, {
      imageCount: 0,
      qilFields: [],
      qilInputText: '',
      updatedAt: serverTimestamp()
    });

    await batch.commit();
  } catch (error) {
    console.error('Clear session error:', error);
  }
};

// 获取用户的历史会话列表
export const getUserSessions = async (uid: string, maxResults: number = 10): Promise<CloudSession[]> => {
  try {
    const sessionsRef = collection(db, 'users', uid, 'sessions');
    const q = query(sessionsRef, orderBy('updatedAt', 'desc'), limit(maxResults));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        productName: data.productName || '未命名产品',
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        imageCount: data.imageCount || 0,
        qilFields: data.qilFields || [],
        qilInputText: data.qilInputText || ''
      };
    });
  } catch (error) {
    console.error('Get user sessions error:', error);
    return [];
  }
};
