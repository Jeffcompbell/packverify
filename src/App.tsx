import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import imageCompression from 'browser-image-compression';
import { diagnoseImage, fileToGenerativePart, parseSourceText, AVAILABLE_MODELS, getModelId, setModelId, parseQILImage, localDiffSpecs, extractOcrOnly } from './services/openaiService';
import { signInWithGoogle, signOutUser, onAuthChange } from './services/firebase';
import {
  getOrCreateUser, getUserData, useQuotaFirebase, UserData,
  getOrCreateSession, saveImageToCloud, updateImageInCloud, deleteImageFromCloud, saveQilToCloud,
  loadSessionFromCloud, clearSessionInCloud, CloudImageData, CloudSession,
  getUserSessions, createNewSession, updateSessionProductName, deleteSession, getQuotaUsageHistory, QuotaUsageRecord,
  updateImageStatusInCloud
} from './services/cloudflare';
import { DiagnosisIssue, SourceField, DiffResult, ImageItem, ImageSpec, BoundingBox, DeterministicCheck, IndustryType } from './types/types';
import {
  Table, Zap, AlertCircle, XCircle, ChevronDown, ChevronLeft, ChevronRight,
  ImagePlus, Trash2, RefreshCw, Copy, CheckCheck, Upload, Eye, EyeOff,
  ZoomIn, ZoomOut, RotateCcw, RotateCw, FileText, AlertTriangle, CheckCircle,
  ClipboardCheck, Image, Search, FileSpreadsheet, Loader2, Maximize2,
  Type, Brackets, ShieldAlert, GitCompare, LogOut, User as UserIcon, X, Cloud, CloudOff,
  Menu, Home, List, Settings, Package, Bell, Plus
} from 'lucide-react';
import { LoginModal, GoogleIcon } from './components/features/LoginModal';
import { QuotaModal } from './components/features/QuotaModal';
import { AllProductsPage } from './components/features/AllProductsPage';
import { IssuesPanel } from './components/features/IssuesPanel';
import { QilPanel, QilPanelRef } from './components/features/QilPanel';
import { AnnouncementBanner, AnnouncementModal } from './components/features/AnnouncementBanner';
import { UpgradeModal } from './components/features/UpgradeModal';
import { Sidebar } from './components/layout/Sidebar';
import { HomePage } from './components/features/HomePage';
import { DetectionConfigPage } from './components/features/DetectionConfigPage';
import { BatchReportPage } from './components/features/BatchReportPage';
import { BatchReportView } from './components/features/BatchReportView';
import { base64ToBlobUrl, createVirtualFile, generateProductName } from './utils/helpers';

type AppView = 'home' | 'products' | 'analysis' | 'detection-config' | 'batch-report' | 'batch-view' | '404';

// URL 路径映射
const VIEW_PATHS: Record<AppView, string> = {
  'home': '/home',
  'products': '/app',
  'analysis': '/app',
  'detection-config': '/config',
  'batch-report': '/reports',
  'batch-view': '/reports',
  '404': '/404',
};

const PATH_TO_VIEW: Record<string, AppView> = {
  '/home': 'home',
  '/config': 'detection-config',
  '/reports': 'batch-report',
  '/': 'products',
  '/app': 'products',
};

// 已知的有效路径前缀
const VALID_PATH_PREFIXES = ['/', '/home', '/app', '/config', '/reports'];

const App: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // 从 URL 解析初始视图
  const getViewFromPath = (pathname: string): AppView => {
    if (pathname.startsWith('/reports/')) return 'batch-view';
    if (pathname.startsWith('/app/')) return 'analysis';
    if (PATH_TO_VIEW[pathname]) return PATH_TO_VIEW[pathname];
    // 检查是否是有效路径
    const isValid = VALID_PATH_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'));
    return isValid ? 'products' : '404';
  };

  // 路由状态
  const [currentView, setCurrentViewState] = useState<AppView>(() => getViewFromPath(location.pathname));
  const [selectedReportId, setSelectedReportId] = useState<string | null>(() => {
    const match = location.pathname.match(/\/reports\/(.+)/);
    return match ? match[1] : null;
  });

  // 同步 URL 变化到视图状态
  useEffect(() => {
    const newView = getViewFromPath(location.pathname);
    if (newView !== currentView) {
      setCurrentViewState(newView);
    }
    // 提取报告 ID
    const reportMatch = location.pathname.match(/\/reports\/(.+)/);
    if (reportMatch) {
      setSelectedReportId(reportMatch[1]);
    }
    // 提取产品 ID（从 /app/:productId）
    const productMatch = location.pathname.match(/\/app\/(.+)/);
    if (productMatch && productMatch[1]) {
      // 如果 URL 中有产品 ID，自动加载该产品
      const productId = productMatch[1];
      if (productId !== sessionId) {
        // 延迟处理，等待 user 加载
      }
    }
  }, [location.pathname]);

  // 封装 setCurrentView，同时更新 URL
  const setCurrentView = useCallback((view: AppView, productId?: string) => {
    setCurrentViewState(view);
    if (view === 'analysis' && productId) {
      navigate(`/app/${productId}`);
    } else {
      const path = VIEW_PATHS[view];
      if (location.pathname !== path) {
        navigate(path);
      }
    }
  }, [navigate, location.pathname]);

  // 用户认证状态
  const [user, setUser] = useState<UserData | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [quotaUsageHistory, setQuotaUsageHistory] = useState<QuotaUsageRecord[]>([]);
  const [isLoadingQuotaHistory, setIsLoadingQuotaHistory] = useState(false);
  const [hasMoreQuotaHistory, setHasMoreQuotaHistory] = useState(false);
  const [isLoadingMoreQuotaHistory, setIsLoadingMoreQuotaHistory] = useState(false);

  // 产品/会话状态
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [productName, setProductName] = useState<string>(generateProductName());
  const [isEditingProductName, setIsEditingProductName] = useState(false);
  const [historySessions, setHistorySessions] = useState<CloudSession[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);

  // 云同步状态
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingFromCloud, setIsLoadingFromCloud] = useState(false);
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(true);

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingImageId, setProcessingImageId] = useState<string | null>(null);
  const [processingModelId, setProcessingModelId] = useState<string | null>(null);
  const [processingStep, setProcessingStep] = useState<number>(1);
  const [streamText, setStreamText] = useState<string>(''); // 流式输出文本
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Data
  const [images, setImages] = useState<ImageItem[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [manualSourceFields, setManualSourceFields] = useState<SourceField[]>([]);
  const [qilRawText, setQilRawText] = useState<string>(''); // QIL 原始文本

  // UI State
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState(getModelId());
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [industry, setIndustry] = useState<IndustryType>('general');
  const [showIndustryMenu, setShowIndustryMenu] = useState(false);

  // Refs for click-outside detection
  const industryMenuRef = useRef<HTMLDivElement>(null);
  const [activeModelTab, setActiveModelTab] = useState<string>(currentModel);
  const [imageScale, setImageScale] = useState(1);
  const [showOverlay, setShowOverlay] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Bottom panel height (resizable) - 默认收起（24px 仅显示标题栏）
  const [bottomHeight, setBottomHeight] = useState(24);
  const [isResizing, setIsResizing] = useState(false);

  // Specs tab
  const [specsTab, setSpecsTab] = useState<string>('qil');

  // Mobile view tab
  const [mobileTab, setMobileTab] = useState<'images' | 'viewer' | 'issues' | 'qil'>('viewer');

  const issueListRef = useRef<HTMLDivElement>(null);
  const qilPanelRef = useRef<QilPanelRef>(null);

  // Current image
  const currentImage = images[currentImageIndex] || null;

  // 计算当前图片与 QIL 的对比结果
  const currentDiffResults = useMemo(() => {
    if (!currentImage || !manualSourceFields.length || !currentImage.specs?.length) {
      return [];
    }
    return localDiffSpecs(manualSourceFields, currentImage.specs);
  }, [currentImage, manualSourceFields]);

  // 已移除 localStorage 缓存，完全依赖云端存储

  // 当选中问题时，滚动到对应的列表项
  useEffect(() => {
    if (selectedIssueId && issueListRef.current) {
      const element = issueListRef.current.querySelector(`[data-issue-id="${selectedIssueId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedIssueId]);

  // 检查登录状态
  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        const userData = await getUserData(firebaseUser.uid);
        if (userData) {
          setUser(userData);
        } else {
          const newUserData = await getOrCreateUser(firebaseUser);
          setUser(newUserData);
        }
      } else {
        setUser(null);
        setSessionId(null);
      }
      setIsCheckingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // 未登录时自动显示登录弹窗
  useEffect(() => {
    if (!isCheckingAuth && !user) {
      setShowLoginModal(true);
    }
  }, [isCheckingAuth, user]);

  // 用户登录后，加载云端会话数据
  useEffect(() => {
    if (!user || !cloudSyncEnabled) return;

    const loadCloudData = async () => {
      try {
        setIsLoadingFromCloud(true);

        // 优先从 URL 获取产品 ID
        const urlMatch = window.location.pathname.match(/\/app\/(.+)/);
        const urlProductId = urlMatch ? urlMatch[1] : null;
        const storedSessionId = localStorage.getItem('currentSessionId');

        let sid: string;
        const targetSessionId = urlProductId || storedSessionId;

        if (targetSessionId) {
          // 验证 session 是否存在
          const { session } = await loadSessionFromCloud(user.uid, targetSessionId);
          if (session) {
            sid = targetSessionId;
          } else {
            // Session 不存在，创建新的
            sid = await getOrCreateSession(user.uid, productName);
            localStorage.setItem('currentSessionId', sid);
          }
        } else {
          // 没有 sessionId，创建新的
          sid = await getOrCreateSession(user.uid, productName);
          localStorage.setItem('currentSessionId', sid);
        }

        setSessionId(sid);

        // 从云端加载数据
        const { session, images: cloudImages } = await loadSessionFromCloud(user.uid, sid);

        if (session) {
          // 设置产品名称
          if (session.productName) {
            setProductName(session.productName);
          }

          if (cloudImages.length > 0) {
            // 将云端数据转换为本地格式
            const loadedImages: ImageItem[] = await Promise.all(
              cloudImages.map(async (cloudImg: CloudImageData) => {
                // 从 Storage URL 获取图片并转为 base64
                const response = await fetch(cloudImg.storageUrl);
                const blob = await response.blob();
                const base64 = await new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    const result = reader.result as string;
                    // 移除 data:image/xxx;base64, 前缀
                    const base64Data = result.split(',')[1] || result;
                    resolve(base64Data);
                  };
                  reader.readAsDataURL(blob);
                });

                return {
                  id: cloudImg.id,
                  src: cloudImg.storageUrl,
                  base64,
                  file: new File([blob], cloudImg.fileName, { type: cloudImg.mimeType }),
                  description: cloudImg.description,
                  ocrText: cloudImg.ocrText,
                  specs: cloudImg.specs || [],
                  issues: cloudImg.issues || [],
                  deterministicIssues: cloudImg.deterministicIssues || [],
                  diffs: cloudImg.diffs || [],
                  issuesByModel: cloudImg.issuesByModel || {}
                };
              })
            );

            setImages(loadedImages);
          }
          setManualSourceFields(session.qilFields || []);
          console.log(`Loaded ${cloudImages.length} images from cloud`);
        }

        // 如果 URL 中有产品 ID，确保停留在 analysis 视图
        if (urlProductId) {
          setCurrentViewState('analysis');
          localStorage.setItem('currentSessionId', sid);
        }

        // 加载历史会话列表
        const sessions = await getUserSessions(user.uid, 10);
        setHistorySessions(sessions);
      } catch (error) {
        console.error('Failed to load cloud data:', error);
      } finally {
        setIsLoadingFromCloud(false);
      }
    };

    loadCloudData();
  }, [user, cloudSyncEnabled]);

  // 切换到产品列表时刷新数据
  useEffect(() => {
    if (currentView === 'products' && user && !isLoadingHistory) {
      setIsLoadingHistory(true);
      getUserSessions(user.uid, 50).then(sessions => {
        setHistorySessions(sessions);
      }).finally(() => {
        setIsLoadingHistory(false);
      });
    }
  }, [currentView, user]);

  // Check for API Key on mount
  useEffect(() => {
    if (!import.meta.env.VITE_PACKY_API_KEY) {
      setErrorMessage("Missing VITE_PACKY_API_KEY in .env.local");
    }
  }, []);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // --- Handlers ---
  const processFile = useCallback(async (file: File) => {
    // 未登录时弹出登录框
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    // 检查是否是图片文件（包括 HEIC/HEIF）
    const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
    if (!file.type.startsWith('image/') && !isHeic) {
      setErrorMessage("请上传图片文件");
      return;
    }

    if (images.length >= 30) {
      setErrorMessage("每个产品最多支持 30 张图片");
      return;
    }

    // 检查配额
    if (user.used >= user.quota) {
      setErrorMessage(`配额已用完（${user.used}/${user.quota}），请联系管理员`);
      return;
    }

    const newImageId = `img-${Date.now()}`;

    try {
      console.log("Processing file:", file.name, `(${(file.size / 1024 / 1024).toFixed(2)} MB)`);

      let processedFile = file;
      const maxSizeMB = 10;
      const fileSizeMB = file.size / 1024 / 1024;

      // 处理 HEIC/HEIF 格式或大文件压缩
      if (isHeic || file.type === 'image/heic' || file.type === 'image/heif' || fileSizeMB > maxSizeMB) {
        const action = isHeic ? '转换 HEIC 格式' : `压缩图片 (${fileSizeMB.toFixed(1)}MB → ${maxSizeMB}MB)`;
        setErrorMessage(`正在${action}...`);

        try {
          const options = {
            maxSizeMB: maxSizeMB,
            maxWidthOrHeight: 4096,
            useWebWorker: true,
            fileType: 'image/jpeg' as const,
            initialQuality: 0.9
          };

          processedFile = await imageCompression(file, options);
          const newSizeMB = processedFile.size / 1024 / 1024;
          console.log(`Image processed: ${fileSizeMB.toFixed(2)}MB → ${newSizeMB.toFixed(2)}MB`);
          setErrorMessage(null);
        } catch (err) {
          console.error('Image processing failed:', err);
          if (isHeic) {
            setErrorMessage('HEIC 格式转换失败。建议：\n1. iPhone: 设置 > 相机 > 格式 > 选择"最兼容"\n2. 使用在线工具转换: heictojpg.com\n3. 或直接上传 JPG/PNG 格式');
          } else {
            setErrorMessage(`图片处理失败（${fileSizeMB.toFixed(1)}MB）。请尝试：\n1. 使用图片编辑工具压缩后上传\n2. 或上传小于 ${maxSizeMB}MB 的图片`);
          }
          return;
        }
      }

      const url = URL.createObjectURL(processedFile);
      const base64 = await fileToGenerativePart(processedFile);

      const newImage: ImageItem = {
        id: newImageId,
        src: url,
        base64: base64,
        file: processedFile,
        specs: [],
        issues: [],
        diffs: [],
        issuesByModel: {}
      };

      setImages(prev => [...prev, newImage]);
      setCurrentImageIndex(images.length);

      setIsProcessing(true);
      setProcessingImageId(newImageId);
      setProcessingModelId(currentModel);
      setErrorMessage(null);

      // 直接进行完整分析（已移除预检）
      console.log('Starting full analysis...');

      // 添加超时机制：60秒超时，自动重试一次
      let diagResult;
      let retryCount = 0;
      const maxRetries = 1;
      const timeoutMs = 60000; // 60秒超时

      while (retryCount <= maxRetries) {
        try {
          // 使用 Promise.race 实现超时
          setStreamText(''); // 清空流式文本
          diagResult = await Promise.race([
            diagnoseImage(base64, file.type, (step) => {
              setProcessingStep(step);
            }, industry, false, (chunk) => {
              // 流式输出回调
              setStreamText(prev => prev + chunk);
            }),  // ✅ 默认不包含 OCR（快速模式）
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('分析超时')), timeoutMs)
            )
          ]);
          break; // 成功，跳出循环
        } catch (error: any) {
          retryCount++;
          if (error.message === '分析超时' && retryCount <= maxRetries) {
            console.log(`Analysis timeout, retrying (${retryCount}/${maxRetries})...`);
            continue; // 重试
          }
          // 超时且重试次数用完，或其他错误
          throw error;
        }
      }

      if (!diagResult) {
        throw new Error('分析失败');
      }

      // 转换 specs 格式
      const imageSpecs: ImageSpec[] = diagResult.specs.map(s => ({
        key: s.key,
        value: s.value,
        category: s.category
      }));

      const usedModelId = getModelId();
      setImages(prev => prev.map(img =>
        img.id === newImageId ? {
          ...img,
          issues: diagResult.issues,
          description: diagResult.description,
          ocrText: diagResult.ocrText,
          deterministicIssues: diagResult.deterministicIssues,
          specs: imageSpecs,
          issuesByModel: {
            ...img.issuesByModel,
            [usedModelId]: {
              issues: diagResult.issues,
              deterministicIssues: diagResult.deterministicIssues
            }
          }
        } : img
      ));

      // Diff if manual fields exist (本地对比，不调用 API)
      let diffs: DiffResult[] = [];
      if (manualSourceFields.length > 0) {
        diffs = localDiffSpecs(manualSourceFields, imageSpecs);
        setImages(prev => prev.map(img =>
          img.id === newImageId ? { ...img, diffs } : img
        ));
      }

      // ✅ 只有成功完成分析，才消耗配额
      const tokenUsage = diagResult.tokenUsage ? {
        promptTokens: diagResult.tokenUsage.promptTokens,
        completionTokens: diagResult.tokenUsage.completionTokens,
        totalTokens: diagResult.tokenUsage.totalTokens,
        model: diagResult.tokenUsage.model
      } : undefined;
      await useQuotaFirebase(user.uid, 1, file.name, 'analyze', tokenUsage);
      const updatedUser = await getUserData(user.uid);
      if (updatedUser) setUser(updatedUser);

      // ✅ 异步云同步 - 分析完成后在后台上传，不阻塞用户
      if (cloudSyncEnabled && sessionId) {
        const finalImage: ImageItem = {
          id: newImageId,
          src: url,
          base64,
          file: processedFile,
          description: diagResult.description,
          ocrText: diagResult.ocrText,
          specs: imageSpecs,
          issues: diagResult.issues,
          deterministicIssues: diagResult.deterministicIssues,
          diffs: diffs,
          issuesByModel: {}
        };

        // 🚀 异步上传，不等待完成
        (async () => {
          try {
            setIsSyncing(true);
            await saveImageToCloud(user.uid, sessionId, finalImage);
            console.log('✓ Image synced to cloud:', newImageId);
          } catch (syncError) {
            console.error('✗ Cloud sync failed:', syncError);
          } finally {
            setIsSyncing(false);
          }
        })();
      }

    } catch (error: any) {
      console.error("Processing failed:", error);

      // 🔴 超时错误特殊处理 - 不消耗配额
      if (error.message === '分析超时') {
        setErrorMessage("⏱️ 检测超时（已重试）。请点击图片上的重试按钮再次分析，不会消耗额度。");
        setImages(prev => prev.map(img =>
          img.id === newImageId ? {
            ...img,
            description: '⏱️ 检测超时',
            ocrText: '分析超时，请重试。提示：如果多次超时，可能是网络问题或图片过大。',
            issues: [],
            deterministicIssues: [],
            specs: [],
            issuesByModel: {}
          } : img
        ));
      } else {
        setErrorMessage(error.message || "图片处理失败");
      }
    } finally {
      setIsProcessing(false);
      setProcessingImageId(null);
      setProcessingModelId(null);
    }
  }, [user, images.length, manualSourceFields, cloudSyncEnabled, sessionId, industry, currentModel]);

  const handleRetryAnalysis = useCallback(async (imageId: string) => {
    // 未登录时弹出登录框
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    const image = images.find(img => img.id === imageId);
    if (!image) return;

    // 检查配额
    if (user.used >= user.quota) {
      setErrorMessage(`配额已用完（${user.used}/${user.quota}），请联系管理员`);
      return;
    }

    try {
      const usedModelId = getModelId();
      setIsProcessing(true);
      setProcessingImageId(imageId);
      setProcessingModelId(usedModelId);
      setErrorMessage(null);

      // 添加超时机制：60秒超时，自动重试一次
      let diagResult;
      let retryCount = 0;
      const maxRetries = 1;
      const timeoutMs = 60000;

      while (retryCount <= maxRetries) {
        try {
          diagResult = await Promise.race([
            diagnoseImage(image.base64, image.file.type, (step) => {
              setProcessingStep(step);
            }, industry, manualSourceFields.length > 0),  // 有 QIL 时包含 OCR
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('分析超时')), timeoutMs)
            )
          ]);
          break;
        } catch (error: any) {
          retryCount++;
          if (error.message === '分析超时' && retryCount <= maxRetries) {
            console.log(`Retry timeout, retrying (${retryCount}/${maxRetries})...`);
            continue;
          }
          throw error;
        }
      }

      if (!diagResult) {
        throw new Error('重新分析失败');
      }

      // 转换 specs 格式
      const imageSpecs: ImageSpec[] = diagResult.specs.map(s => ({
        key: s.key,
        value: s.value,
        category: s.category
      }));

      // Diff if manual fields exist (本地对比，不调用 API)
      let diffs: DiffResult[] = [];
      if (manualSourceFields.length > 0) {
        diffs = localDiffSpecs(manualSourceFields, imageSpecs);
      }

      const analysisDuration = image.analyzingStartedAt ? Date.now() - image.analyzingStartedAt : undefined;
      setImages(prev => prev.map(img =>
        img.id === imageId ? {
          ...img,
          issues: diagResult.issues,
          description: diagResult.description,
          ocrText: diagResult.ocrText,
          deterministicIssues: diagResult.deterministicIssues,
          specs: imageSpecs,
          diffs: diffs,
          analysisDuration,
          issuesByModel: {
            ...img.issuesByModel,
            [usedModelId]: {
              issues: diagResult.issues,
              deterministicIssues: diagResult.deterministicIssues
            }
          }
        } : img
      ));

      // ✅ 只有成功完成，才消耗配额
      const tokenUsage = diagResult.tokenUsage ? {
        promptTokens: diagResult.tokenUsage.promptTokens,
        completionTokens: diagResult.tokenUsage.completionTokens,
        totalTokens: diagResult.tokenUsage.totalTokens,
        model: diagResult.tokenUsage.model
      } : undefined;
      await useQuotaFirebase(user.uid, 1, image.file.name, 'retry', tokenUsage);
      const updatedUser = await getUserData(user.uid);
      if (updatedUser) setUser(updatedUser);

      // ✅ 异步云同步 - 分析完成后在后台更新
      if (cloudSyncEnabled && sessionId) {
        const existingImage = images.find(img => img.id === imageId);
        const newIssuesByModel = {
          ...existingImage?.issuesByModel,
          [usedModelId]: {
            issues: diagResult.issues,
            deterministicIssues: diagResult.deterministicIssues
          }
        };

        // 🚀 异步更新，不等待
        (async () => {
          try {
            await updateImageInCloud(user.uid, sessionId, imageId, {
              description: diagResult.description,
              ocrText: diagResult.ocrText,
              specs: imageSpecs,
              issues: diagResult.issues,
              deterministicIssues: diagResult.deterministicIssues,
              diffs: diffs,
              issuesByModel: newIssuesByModel
            });
            console.log('✓ Image updated in cloud:', imageId);
          } catch (syncError) {
            console.error('✗ Cloud sync failed:', syncError);
          }
        })();
      }

    } catch (error: any) {
      console.error("Retry failed:", error);

      // 🔴 超时错误特殊处理
      if (error.message === '分析超时') {
        setErrorMessage("⏱️ 检测超时（已重试）。请稍后再试，不会消耗额度。");
        setImages(prev => prev.map(img =>
          img.id === imageId ? {
            ...img,
            description: '⏱️ 检测超时',
            ocrText: '分析超时，请重试。'
          } : img
        ));
      } else {
        setErrorMessage(error.message || "重新分析失败");
      }
    } finally {
      setIsProcessing(false);
      setProcessingImageId(null);
      setProcessingModelId(null);
    }
  }, [user, images, manualSourceFields, cloudSyncEnabled, sessionId, industry]);

  // 添加新模型分析（将结果存储到 issuesByModel）
  const handleAddModelAnalysis = useCallback(async (imageId: string, modelId: string) => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    const image = images.find(img => img.id === imageId);
    if (!image) return;

    if (user.used >= user.quota) {
      setErrorMessage(`配额已用完（${user.used}/${user.quota}）`);
      return;
    }

    // 立即创建新 tab（空数据，显示 loading）
    setImages(prev => prev.map(img =>
      img.id === imageId ? {
        ...img,
        issuesByModel: {
          ...img.issuesByModel,
          [modelId]: { issues: [], deterministicIssues: [] }
        }
      } : img
    ));

    try {
      setIsProcessing(true);
      setProcessingImageId(imageId);
      setProcessingModelId(modelId);
      setErrorMessage(null);

      // 临时切换模型
      const previousModel = getModelId();
      setModelId(modelId);

      const diagResult = await diagnoseImage(image.base64, image.file.type, (step) => {
        setProcessingStep(step);
      }, industry, manualSourceFields.length > 0);  // 有 QIL 时包含 OCR

      // 恢复之前的模型
      setModelId(previousModel);

      // 更新分析结果
      const newIssuesByModel = {
        ...image.issuesByModel,
        [modelId]: {
          issues: diagResult.issues,
          deterministicIssues: diagResult.deterministicIssues
        }
      };
      setImages(prev => prev.map(img =>
        img.id === imageId ? { ...img, issuesByModel: newIssuesByModel } : img
      ));

      // 消耗配额（包含 token 使用统计）
      const tokenUsage = diagResult.tokenUsage ? {
        promptTokens: diagResult.tokenUsage.promptTokens,
        completionTokens: diagResult.tokenUsage.completionTokens,
        totalTokens: diagResult.tokenUsage.totalTokens,
        model: diagResult.tokenUsage.model
      } : undefined;
      await useQuotaFirebase(user.uid, 1, image.file.name, 'analyze', tokenUsage);
      const updatedUser = await getUserData(user.uid);
      if (updatedUser) setUser(updatedUser);

      // 云同步
      if (cloudSyncEnabled && sessionId) {
        try {
          await updateImageInCloud(user.uid, sessionId, imageId, { issuesByModel: newIssuesByModel });
        } catch (syncError) {
          console.error('Cloud sync failed:', syncError);
        }
      }

    } catch (error: any) {
      setErrorMessage(error.message || "模型分析失败");
    } finally {
      setIsProcessing(false);
      setProcessingImageId(null);
      setProcessingModelId(null);
    }
  }, [user, images, cloudSyncEnabled, sessionId]);

  const handleUpdateQilFields = useCallback(async (fields: SourceField[], rawText: string) => {
    setManualSourceFields(fields);
    setQilRawText(rawText); // 保存原文

    // 对当前图片执行 diff
    if (currentImage && currentImage.specs?.length) {
      const diffs = localDiffSpecs(fields, currentImage.specs);
      setImages(prev => prev.map(img =>
        img.id === currentImage.id ? { ...img, diffs } : img
      ));
    }

    // ✅ 新增：如果有图片但没有 OCR，触发轻量级 OCR 提取
    if (images.length > 0 && !isProcessing) {
      const imagesNeedOcr = images.filter(img => img.description && !img.ocrText);
      if (imagesNeedOcr.length > 0) {
        console.log(`[QIL] Detected ${imagesNeedOcr.length} images need OCR, extracting...`);

        // 轻量级 OCR 提取（只提取文字，不重复分析）
        for (const img of imagesNeedOcr) {
          try {
            setIsProcessing(true);
            setProcessingImageId(img.id);

            // ✅ 使用轻量级 OCR（5-10秒，~500-1000 tokens）
            const ocrResult = await extractOcrOnly(img.base64, img.file.type);

            // 更新图片数据（只更新 ocrText）
            setImages(prev => prev.map(image =>
              image.id === img.id ? {
                ...image,
                ocrText: ocrResult.ocrText,
              } : image
            ));

            // 消耗配额（OCR 操作）
            if (user) {
              const tokenUsage = ocrResult.tokenUsage ? {
                promptTokens: ocrResult.tokenUsage.promptTokens,
                completionTokens: ocrResult.tokenUsage.completionTokens,
                totalTokens: ocrResult.tokenUsage.totalTokens,
                model: ocrResult.tokenUsage.model
              } : undefined;
              await useQuotaFirebase(user.uid, 1, img.file.name, 'ocr', tokenUsage);
              const updatedUser = await getUserData(user.uid);
              if (updatedUser) setUser(updatedUser);
            }

            // 云同步
            if (cloudSyncEnabled && sessionId && user) {
              await updateImageInCloud(user.uid, sessionId, img.id, { ocrText: ocrResult.ocrText });
            }
          } catch (error) {
            console.error(`Failed to extract OCR for image ${img.id}:`, error);
          } finally {
            setIsProcessing(false);
            setProcessingImageId(null);
          }
        }
      }
    }

    // 云同步 - 保存 QIL 数据
    if (cloudSyncEnabled && sessionId && user) {
      try {
        await saveQilToCloud(user.uid, sessionId, fields, '');
        console.log('QIL data synced to cloud');
      } catch (error) {
        console.error('Failed to sync QIL to cloud:', error);
      }
    }
  }, [currentImage, cloudSyncEnabled, sessionId, user, images, isProcessing, industry]);

  const handleModelChange = useCallback((modelId: string) => {
    setModelId(modelId);
    setCurrentModel(modelId);
    setShowModelSelector(false);
  }, []);

  const handleRemoveImage = useCallback(async (id: string) => {
    setImages(prev => prev.filter(i => i.id !== id));
    if (currentImageIndex >= images.length - 1 && currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
    }

    // 云同步 - 删除图片
    if (cloudSyncEnabled && sessionId && user) {
      try {
        await deleteImageFromCloud(user.uid, sessionId, id);
        console.log('Image deleted from cloud:', id);
      } catch (error) {
        console.error('Failed to delete image from cloud:', error);
      }
    }
  }, [currentImageIndex, images.length, cloudSyncEnabled, sessionId, user]);

  const handleReset = useCallback(async () => {
    setImages([]);
    setCurrentImageIndex(0);
    setManualSourceFields([]);
    setErrorMessage(null);
    setSelectedIssueId(null);
    setImageScale(1);

    // 云同步 - 清空会话
    if (cloudSyncEnabled && sessionId && user) {
      try {
        await clearSessionInCloud(user.uid, sessionId);
        console.log('Session cleared in cloud');
      } catch (error) {
        console.error('Failed to clear session in cloud:', error);
      }
    }
  }, [cloudSyncEnabled, sessionId, user]);

  // 切换到指定的历史产品
  const handleSwitchSession = useCallback(async (targetSession: CloudSession) => {
    if (!user) return;

    try {
      setIsLoadingFromCloud(true);

      // 加载目标会话数据
      const { session, images: cloudImages } = await loadSessionFromCloud(user.uid, targetSession.id);

      if (session) {
        setSessionId(targetSession.id);
        localStorage.setItem('currentSessionId', targetSession.id);
        setProductName(session.productName || '未命名产品');

        if (cloudImages.length > 0) {
          const loadedImages: ImageItem[] = await Promise.all(
            cloudImages.map(async (cloudImg: CloudImageData) => {
              const response = await fetch(cloudImg.storageUrl);
              const blob = await response.blob();
              const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                  const result = reader.result as string;
                  const base64Data = result.split(',')[1] || result;
                  resolve(base64Data);
                };
                reader.readAsDataURL(blob);
              });

              return {
                id: cloudImg.id,
                src: cloudImg.storageUrl,
                base64,
                file: new File([blob], cloudImg.fileName, { type: cloudImg.mimeType }),
                description: cloudImg.description,
                ocrText: cloudImg.ocrText,
                specs: cloudImg.specs || [],
                issues: cloudImg.issues || [],
                deterministicIssues: cloudImg.deterministicIssues || [],
                diffs: cloudImg.diffs || [],
                issuesByModel: cloudImg.issuesByModel || {}
              };
            })
          );
          setImages(loadedImages);
        } else {
          setImages([]);
        }

        setManualSourceFields(session.qilFields || []);
        setCurrentImageIndex(0);
      }
    } catch (error) {
      console.error('Failed to switch session:', error);
      setErrorMessage('切换产品失败');
    } finally {
      setIsLoadingFromCloud(false);
    }
  }, [user]);

  // 创建新产品
  const handleCreateNewProduct = useCallback(async () => {
    if (!user || isCreatingProduct) return;

    setIsCreatingProduct(true);
    try {
      const newName = generateProductName();
      const newSid = await createNewSession(user.uid, newName);

      setSessionId(newSid);
      localStorage.setItem('currentSessionId', newSid);
      setProductName(newName);
      setImages([]);
      setManualSourceFields([]);
      setCurrentImageIndex(0);

      // 刷新历史列表
      const sessions = await getUserSessions(user.uid, 10);
      setHistorySessions(sessions);
    } catch (error) {
      console.error('Failed to create new product:', error);
      setErrorMessage('创建新产品失败');
    } finally {
      setIsCreatingProduct(false);
    }
  }, [user, isCreatingProduct]);

  // 产品名称变更时保存到云端
  const handleProductNameChange = useCallback(async (newName: string) => {
    setProductName(newName);
    if (user && sessionId && cloudSyncEnabled) {
      try {
        await updateSessionProductName(user.uid, sessionId, newName);
        // 更新历史列表中的名称
        setHistorySessions(prev => prev.map(s =>
          s.id === sessionId ? { ...s, productName: newName } : s
        ));
      } catch (error) {
        console.error('Failed to update product name:', error);
      }
    }
  }, [user, sessionId, cloudSyncEnabled]);

  // 打开配额弹窗
  const handleOpenQuotaModal = useCallback(async () => {
    if (!user) return;
    setShowQuotaModal(true);
    setIsLoadingQuotaHistory(true);
    setQuotaUsageHistory([]);
    try {
      const { records, hasMore } = await getQuotaUsageHistory(user.uid, 20);
      setQuotaUsageHistory(records);
      setHasMoreQuotaHistory(hasMore);
    } catch (error) {
      console.error('Failed to load quota history:', error);
    } finally {
      setIsLoadingQuotaHistory(false);
    }
  }, [user]);

  // 加载更多配额记录
  const handleLoadMoreQuotaHistory = useCallback(async () => {
    if (!user || isLoadingMoreQuotaHistory || quotaUsageHistory.length === 0) return;
    setIsLoadingMoreQuotaHistory(true);
    try {
      const lastRecord = quotaUsageHistory[quotaUsageHistory.length - 1];
      const { records, hasMore } = await getQuotaUsageHistory(user.uid, 20, lastRecord.timestamp);
      setQuotaUsageHistory(prev => [...prev, ...records]);
      setHasMoreQuotaHistory(hasMore);
    } catch (error) {
      console.error('Failed to load more quota history:', error);
    } finally {
      setIsLoadingMoreQuotaHistory(false);
    }
  }, [user, quotaUsageHistory, isLoadingMoreQuotaHistory]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (industryMenuRef.current && !industryMenuRef.current.contains(event.target as Node)) {
        setShowIndustryMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global Paste Handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const activeElement = document.activeElement;
      const isQilFocused = activeElement?.closest('.qil-input-area');

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            if (isQilFocused && qilPanelRef.current) {
              qilPanelRef.current.handleQilImageFile(file);
            } else {
              processFile(file);
            }
          }
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [processFile]);

  // Global Drag & Drop
  const onDragOver = useCallback((e: React.DragEvent) => e.preventDefault(), []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    files.forEach(file => {
      const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
      if (file.type.startsWith('image/') || isHeic) {
        processFile(file);
      }
    });
  }, [processFile]);

  // Resize handler for bottom panel
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startY = e.clientY;
    const startHeight = bottomHeight;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startY - e.clientY;
      const newHeight = Math.min(500, Math.max(24, startHeight + delta));
      setBottomHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [bottomHeight]);

  const getStyleForBox = useCallback((box: BoundingBox) => ({
    top: `${box.ymin / 10}%`,
    left: `${box.xmin / 10}%`,
    height: `${(box.ymax - box.ymin) / 10}%`,
    width: `${(box.xmax - box.xmin) / 10}%`,
  }), []);

  const handleLogout = useCallback(async () => {
    await signOutUser();
    setUser(null);
    // 跳转到落地页
    window.location.href = '/';
  }, []);

  const handleLogin = useCallback(async () => {
    try {
      // signInWithGoogle 已经内部调用了 getOrCreateUser，直接返回 UserData
      const userData = await signInWithGoogle();
      if (userData) {
        setUser(userData);
        setShowLoginModal(false);
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }, []);

  const isCurrentProcessing = currentImage && processingImageId === currentImage.id;

  // 加载中状态
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 size={24} className="animate-spin text-primary-400" />
          <span className="text-text-muted">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-surface-50 flex font-sans text-text-primary overflow-hidden">
      {/* Sidebar - 始终显示 */}
      <Sidebar
        currentView={currentView}
        onNavigate={setCurrentView}
        userQuota={user ? { remaining: user.quota - user.used, total: user.quota } : undefined}
        user={user ? {
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL
        } : undefined}
        onLogout={user ? handleLogout : undefined}
        onOpenAnnouncement={() => setShowAnnouncementModal(true)}
      />

      {/* Main Content Area */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
      {/* 登录弹窗 */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLogin={handleLogin}
      />

      {/* 配额弹窗 */}
      {user && (
        <QuotaModal
          isOpen={showQuotaModal}
          onClose={() => setShowQuotaModal(false)}
          user={user}
          usageHistory={quotaUsageHistory}
          isLoading={isLoadingQuotaHistory}
          onLoadMore={handleLoadMoreQuotaHistory}
          hasMore={hasMoreQuotaHistory}
          isLoadingMore={isLoadingMoreQuotaHistory}
        />
      )}

      {/* 升级订阅弹窗 */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentPlan={user?.plan || 'free'}
        quotaUsed={user?.used || 0}
        quotaTotal={user?.quota || 10}
      />


      {/* 系统公告弹窗 */}
      <AnnouncementModal
        isOpen={showAnnouncementModal}
        onClose={() => setShowAnnouncementModal(false)}
      />

      {/* TOP BAR - 简化版，仅在分析视图显示 */}
      {currentView === 'analysis' && (
      <div className="h-12 border-b border-gray-100 bg-white flex items-center px-4 shrink-0 gap-4 relative z-50">
        {/* Left: 云同步状态 + 产品名称 */}
        <div className="flex items-center gap-3 min-w-0">
          {/* 云同步状态 */}
          {user && (
            <div className="flex items-center gap-1.5" title={cloudSyncEnabled ? '云同步已开启' : '云同步已关闭'}>
              {isSyncing || isLoadingFromCloud ? (
                <Loader2 size={12} className="animate-spin text-gray-400" />
              ) : (
                <Cloud size={12} className="text-gray-400" />
              )}
            </div>
          )}

          {/* 当前产品名称（可编辑） */}
          {isEditingProductName ? (
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              onBlur={() => {
                setIsEditingProductName(false);
                handleProductNameChange(productName);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setIsEditingProductName(false);
                  handleProductNameChange(productName);
                }
              }}
              className="bg-white border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 w-40 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              autoFocus
            />
          ) : (
            <button
              onClick={() => user && setIsEditingProductName(true)}
              className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors truncate max-w-[200px] px-2 py-1 rounded hover:bg-gray-50"
              title="点击编辑产品名称"
            >
              {productName}
            </button>
          )}

          {/* 行业选择 */}
          <div ref={industryMenuRef} className="relative">
            <button
              onClick={() => setShowIndustryMenu(!showIndustryMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm rounded-lg transition-colors"
            >
              <Package size={14} />
              <span>{{ cosmetics: '化妆品场景', food: '食品场景', pharma: '药品场景', general: '通用场景' }[industry]}</span>
              <ChevronDown size={12} className={`transition-transform ${showIndustryMenu ? 'rotate-180' : ''}`} />
            </button>
            {showIndustryMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-[100]">
                {(['cosmetics', 'food', 'pharma', 'general'] as IndustryType[]).map((ind) => (
                  <button
                    key={ind}
                    onClick={() => { setIndustry(ind); setShowIndustryMenu(false); }}
                    className={`w-full px-4 py-2 text-left text-sm transition-colors ${industry === ind ? 'bg-purple-50 text-purple-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    {{ cosmetics: '化妆品场景', food: '食品场景', pharma: '药品场景', general: '通用场景' }[ind]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center: 图片工具 */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
          {currentImage && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-lg">
              <button
                onClick={() => setShowOverlay(!showOverlay)}
                className={`p-1 rounded hover:bg-white transition-colors ${showOverlay ? 'text-purple-600' : 'text-gray-400'}`}
                title="标注"
              >
                {showOverlay ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>

              <button
                onClick={() => setImageScale(s => Math.max(0.3, s / 1.2))}
                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-white rounded transition-colors"
                title="缩小"
              >
                <ZoomOut size={16} />
              </button>
              <span className="text-xs text-gray-600 font-medium min-w-[42px] text-center">
                {Math.round(imageScale * 100)}%
              </span>
              <button
                onClick={() => setImageScale(s => Math.min(3, s * 1.2))}
                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-white rounded transition-colors"
                title="放大"
              >
                <ZoomIn size={16} />
              </button>

              <button
                onClick={() => setImages(imgs => imgs.map((img, i) => i === currentImageIndex ? { ...img, rotation: (img.rotation || 0) - 90 } : img))}
                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-white rounded transition-colors"
                title="逆时针"
              >
                <RotateCcw size={16} />
              </button>
              <button
                onClick={() => setImages(imgs => imgs.map((img, i) => i === currentImageIndex ? { ...img, rotation: (img.rotation || 0) + 90 } : img))}
                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-white rounded transition-colors"
                title="顺时针"
              >
                <RotateCw size={16} />
              </button>

              <button
                onClick={() => {
                  setImageScale(1);
                  setImages(imgs => imgs.map((img, i) => i === currentImageIndex ? { ...img, rotation: 0 } : img));
                }}
                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-white rounded transition-colors"
                title="重置"
              >
                <Maximize2 size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
      )}


      {/* MAIN CONTENT */}
      {currentView === 'home' ? (
        <HomePage
          onNavigate={setCurrentView}
          userQuota={user ? { quota: user.quota, used: user.used } : undefined}
        />
      ) : currentView === 'products' ? (
        <AllProductsPage
          isOpen={true}
          onClose={() => {}}
          sessions={historySessions}
          isLoading={isLoadingHistory}
          onSelectSession={(session) => {
            handleSwitchSession(session);
            setCurrentView('analysis', session.id);
          }}
          onCreateNew={async () => {
            await handleCreateNewProduct();
            const newSid = localStorage.getItem('currentSessionId');
            if (newSid) {
              setCurrentView('analysis', newSid);
            }
          }}
          isCreatingProduct={isCreatingProduct}
          onRenameSession={async (sessionId, newName) => {
            if (!user) return;
            await updateSessionProductName(user.uid, sessionId, newName);
            setHistorySessions(prev => prev.map(s => s.id === sessionId ? { ...s, productName: newName } : s));
          }}
          onDeleteSession={async (sessionId) => {
            if (!user) return;
            await deleteSession(user.uid, sessionId);
            setHistorySessions(prev => prev.filter(s => s.id !== sessionId));
          }}
          onUploadImages={async (files) => {
            // 先创建新产品，然后进入画布并上传图片
            await handleCreateNewProduct();
            const newSid = localStorage.getItem('currentSessionId');
            if (newSid) {
              setCurrentView('analysis', newSid);
              // 延迟一下让画布渲染完成，然后触发上传
              setTimeout(() => {
                for (let i = 0; i < files.length; i++) {
                  handleImageUpload(files[i]);
                }
              }, 100);
            }
          }}
        />
      ) : currentView === 'detection-config' ? (
        <DetectionConfigPage onBack={() => setCurrentView('products')} />
      ) : currentView === 'batch-report' ? (
        <BatchReportPage
          onBack={() => setCurrentView('products')}
          onViewReport={(id) => { setSelectedReportId(id); setCurrentView('batch-view'); }}
        />
      ) : currentView === 'batch-view' ? (
        <BatchReportView
          reportId={selectedReportId}
          onBack={() => setCurrentView('batch-report')}
        />
      ) : currentView === '404' ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-surface-50">
          <div className="text-6xl mb-4">404</div>
          <div className="text-text-muted mb-6">页面不存在</div>
          <button
            onClick={() => { navigate('/'); setCurrentViewState('products'); }}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-500 transition-colors"
          >
            返回首页
          </button>
        </div>
      ) : (
        <>
        <div className="flex-1 flex min-h-0 pb-14 md:pb-0">
        {/* LEFT: Thumbnails - 桌面端显示，移动端通过底部导航切换 */}
        <div className={`${mobileTab === 'images' ? 'flex' : 'hidden'} md:flex w-full md:w-[140px] border-r border-border bg-surface-50 p-2 overflow-y-auto shrink-0 flex-col`}>
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
            图片列表
          </div>
          {/* 移动端添加图片按钮 */}
          <label className="md:hidden flex items-center justify-center gap-1.5 px-3 py-2 mb-2 bg-primary-600 hover:bg-primary-500 text-text-primary text-xs font-medium rounded cursor-pointer transition-colors">
            <ImagePlus size={14} />
            <span>添加图片</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
              if (e.target.files?.[0]) {
                processFile(e.target.files[0]);
                setMobileTab('viewer');
              }
            }} />
          </label>
          <div className="grid grid-cols-3 gap-2 md:flex md:flex-col md:space-y-2 md:gap-0 overflow-y-auto">
            {images.map((img, idx) => (
              <div
                key={img.id}
                onClick={() => {
                  setCurrentImageIndex(idx);
                  setMobileTab('viewer');
                }}
                className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all aspect-square md:aspect-auto ${
                  currentImageIndex === idx ? 'border-primary-500' : 'border-transparent hover:border-border-hover'
                }`}
              >
                <img src={img.src} alt="" className="w-full h-full md:h-20 object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between">
                  <span className="text-[8px] text-text-primary truncate max-w-[60px]">{img.file.name}</span>
                  {img.issues.length > 0 ? (
                    <span className="text-[8px] bg-red-500 text-text-primary px-1 rounded">{img.issues.length}</span>
                  ) : img.description && (
                    <span className="text-[8px] bg-emerald-500 text-text-primary px-1 rounded">✓</span>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveImage(img.id); }}
                  className="absolute top-1 right-1 p-0.5 bg-red-500/80 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={10} className="text-text-primary" />
                </button>
                {processingImageId === img.id && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <Loader2 size={14} className="animate-spin text-primary-400" />
                  </div>
                )}
              </div>
            ))}
            {images.length === 0 && (
              <div className="col-span-3 p-4 border-2 border-dashed border-border rounded-lg text-center">
                <ImagePlus size={20} className="mx-auto text-slate-700 mb-1" />
                <span className="text-[9px] text-slate-600">点击下方按钮添加图片</span>
              </div>
            )}
          </div>

          {/* 添加图片按钮 - 桌面端底部 */}
          <label className="hidden md:flex items-center justify-center gap-2 px-3 py-2 mt-2 bg-primary-600 hover:bg-primary-500 text-white text-xs font-medium rounded-lg cursor-pointer transition-colors">
            <ImagePlus size={14} />
            <span>添加图片</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
          </label>
        </div>

        {/* CENTER: Image Viewer */}
        <div className={`${mobileTab === 'viewer' ? 'flex' : 'hidden'} md:flex flex-1 relative bg-white overflow-hidden items-center justify-center group/canvas`}>
          {/* Grid Background */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />

          {currentImage ? (
            <>
              <div
                className="relative"
                style={{
                  transform: `scale(${imageScale}) rotate(${currentImage.rotation || 0}deg)`,
                  transition: 'transform 0.2s'
                }}
              >
                <div className="relative inline-block overflow-hidden">
                  <img
                    src={currentImage.src}
                    alt="包装设计"
                    className="block max-h-[60vh]"
                    draggable={false}
                    style={{ maxWidth: '100%', height: 'auto' }}
                  />

                  {/* 扫描动画效果 */}
                  {isCurrentProcessing && (
                    <>
                      {/* 扫描线 */}
                      <div
                        className="absolute left-0 right-0 h-0.5 pointer-events-none z-20"
                        style={{
                          animation: 'scanLine 2.5s ease-in-out infinite',
                          background: 'linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.8), rgba(129, 140, 248, 1), rgba(99, 102, 241, 0.8), transparent)',
                          boxShadow: '0 0 15px 3px rgba(99, 102, 241, 0.6), 0 0 30px 6px rgba(99, 102, 241, 0.3)'
                        }}
                      />
                      {/* 扫描线上的状态文字 */}
                      <div
                        className="absolute left-1/2 -translate-x-1/2 pointer-events-none z-30 flex items-center gap-2 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full border border-primary-500/50 text-[10px] text-indigo-300 whitespace-nowrap"
                        style={{
                          animation: 'scanLine 2.5s ease-in-out infinite',
                        }}
                      >
                        <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-pulse" />
                        {processingStep === 1 ? 'AI 视觉分析' : '规则检测'}
                      </div>
                      {/* 顶部和底部边缘发光 */}
                      <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-primary-500/20 to-transparent pointer-events-none z-10" />
                      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-primary-500/20 to-transparent pointer-events-none z-10" />
                      {/* 四角标记 */}
                      <div className="absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 border-primary-400 pointer-events-none z-10" />
                      <div className="absolute top-2 right-2 w-4 h-4 border-r-2 border-t-2 border-primary-400 pointer-events-none z-10" />
                      <div className="absolute bottom-2 left-2 w-4 h-4 border-l-2 border-b-2 border-primary-400 pointer-events-none z-10" />
                      <div className="absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-primary-400 pointer-events-none z-10" />
                    </>
                  )}

                  {showOverlay && !isCurrentProcessing && (currentImage.issuesByModel?.[activeModelTab]?.issues || currentImage.issues).map(issue => (
                    issue.box_2d && (
                      <div
                        key={issue.id}
                        onClick={() => setSelectedIssueId(issue.id)}
                        className={`absolute rounded cursor-pointer transition-all ${
                          selectedIssueId === issue.id
                            ? 'border-2 border-primary-400 bg-primary-400/30 shadow-[0_0_20px_rgba(99,102,241,0.6)] z-10'
                            : issue.severity === 'high'
                              ? 'border-2 border-red-500 bg-red-500/20 hover:bg-red-500/40'
                              : 'border-2 border-amber-400 bg-amber-400/20 hover:bg-amber-400/40'
                        }`}
                        style={getStyleForBox(issue.box_2d)}
                      >
                        <div className={`absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-text-primary text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap pointer-events-none border border-border transition-opacity ${selectedIssueId === issue.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          {issue.original || issue.text}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>

              {/* 左右切换按钮 */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentImageIndex(i => Math.max(0, i - 1))}
                    disabled={currentImageIndex === 0}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full disabled:opacity-30 hover:bg-surface-100 transition-all opacity-0 group-hover/canvas:opacity-100 shadow-sm border border-border"
                  >
                    <ChevronLeft size={20} className="text-text-secondary" />
                  </button>
                  <button
                    onClick={() => setCurrentImageIndex(i => Math.min(images.length - 1, i + 1))}
                    disabled={currentImageIndex === images.length - 1}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full disabled:opacity-30 hover:bg-surface-100 transition-all opacity-0 group-hover/canvas:opacity-100 shadow-sm border border-border"
                  >
                    <ChevronRight size={20} className="text-text-secondary" />
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="text-center">
              <div className="p-5 bg-surface-50 rounded-2xl mb-4 inline-block">
                <ImagePlus className="text-text-muted" size={40} />
              </div>
              <p className="text-text-secondary font-medium mb-1">Ctrl+V 粘贴图片</p>
              <p className="text-text-muted text-sm mb-4">或拖拽图片到此处</p>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-surface-100 hover:bg-surface-200 text-text-primary text-sm font-medium rounded-lg cursor-pointer transition-colors border border-border">
                <Upload size={16} />
                选择文件
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
              </label>
              {!user && (
                <p className="text-text-muted text-xs mt-4">上传图片需要先登录</p>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Issues Panel */}
        <IssuesPanel
          currentImage={currentImage}
          images={images}
          currentIndex={currentImageIndex}
          onNavigate={setCurrentImageIndex}
          isCurrentProcessing={isCurrentProcessing}
          processingModelId={processingModelId}
          onRetryAnalysis={(modelId) => currentImage && handleRetryAnalysis(currentImage.id)}
          selectedIssueId={selectedIssueId}
          onSelectIssue={setSelectedIssueId}
          copiedId={copiedId}
          onCopy={handleCopy}
          mobileTab={mobileTab}
          issueListRef={issueListRef}
          currentModelId={currentModel}
          onAddModel={(modelId) => currentImage && handleAddModelAnalysis(currentImage.id, modelId)}
          onRemoveModel={async (modelId) => {
            if (!currentImage) return;
            const { [modelId]: _, ...newIssuesByModel } = currentImage.issuesByModel || {};
            setImages(prev => prev.map(img =>
              img.id === currentImage.id ? { ...img, issuesByModel: newIssuesByModel } : img
            ));
            if (cloudSyncEnabled && sessionId && user) {
              try {
                await updateImageInCloud(user.uid, sessionId, currentImage.id, { issuesByModel: newIssuesByModel });
              } catch (e) { console.error('Cloud sync failed:', e); }
            }
          }}
          activeModelTab={activeModelTab}
          onActiveModelChange={setActiveModelTab}
        />
      </div>

      {/* BOTTOM PANEL - QIL (桌面端显示，移动端通过导航切换全屏) */}
      <div style={{ height: mobileTab === 'qil' ? 'auto' : bottomHeight }} className={`${mobileTab === 'qil' ? 'flex absolute inset-0 top-12 bottom-14 z-30' : 'hidden'} md:flex md:static md:z-auto border-t border-border bg-surface-50 flex-col shrink-0 relative`}>
        {/* 拖动调整高度的把手区域 */}
        <div
          onMouseDown={handleResizeStart}
          className={`hidden md:flex items-center justify-center h-6 cursor-ns-resize hover:bg-primary-500/10 transition-colors relative ${isResizing ? 'bg-primary-500/20' : ''}`}
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-border"></div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setBottomHeight(prev => prev <= 24 ? 280 : 24);
            }}
            className="bg-white hover:bg-primary-50 border border-border rounded-full w-6 h-6 text-text-muted hover:text-primary-600 transition-colors flex items-center justify-center shadow-sm z-10"
            title={bottomHeight <= 24 ? '展开 QIL 面板' : '收起 QIL 面板'}
          >
            <span className="text-[12px]">{bottomHeight <= 24 ? '▲' : '▼'}</span>
          </button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* QIL Input Panel */}
          <QilPanel
            ref={qilPanelRef}
            manualSourceFields={manualSourceFields}
            onFieldsUpdate={handleUpdateQilFields}
            onError={setErrorMessage}
            isProcessing={isProcessing}
            onProcessingChange={setIsProcessing}
          />

          {/* Specs Table */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="px-3 py-2 bg-white border-b border-border flex items-center gap-1 overflow-x-auto shrink-0">
              <FileSpreadsheet size={12} className="text-emerald-400 shrink-0 mr-1" />
              <button
                onClick={() => setSpecsTab('qil')}
                className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-all shrink-0 ${
                  specsTab === 'qil'
                    ? 'bg-primary-500/20 text-primary-400 border border-primary-500/50'
                    : 'text-text-muted hover:text-text-secondary hover:bg-surface-100'
                }`}
              >
                QIL ({manualSourceFields.length})
              </button>
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setSpecsTab(img.id)}
                  className={`px-3 py-1 text-[10px] font-medium rounded transition-all shrink-0 truncate max-w-[120px] ${
                    specsTab === img.id
                      ? 'bg-primary-500/20 text-primary-400 border border-primary-500/50'
                      : 'text-text-muted hover:text-text-secondary hover:bg-surface-100'
                  }`}
                  title={img.file.name}
                >
                  图片{idx + 1} OCR
                </button>
              ))}
              <button
                onClick={() => setSpecsTab('diff')}
                className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-all shrink-0 ${
                  specsTab === 'diff'
                    ? 'bg-primary-500/20 text-primary-400 border border-primary-500/50'
                    : 'text-text-muted hover:text-text-secondary hover:bg-surface-100'
                }`}
              >
                对比汇总
              </button>
            </div>

            <div className="flex-1 overflow-auto p-3">
              {specsTab === 'qil' ? (
                !qilRawText && manualSourceFields.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-700">
                    <Table size={24} className="mb-2 opacity-30" />
                    <span className="text-xs">暂无 QIL 数据</span>
                    <span className="text-[10px] text-slate-600 mt-1">左侧输入文本或上传图片后解析</span>
                  </div>
                ) : (
                  <div className="h-full flex flex-col">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                        QIL 源数据 {manualSourceFields.length > 0 && `(已解析 ${manualSourceFields.length} 个字段)`}
                      </span>
                      {qilRawText && (
                        <button
                          onClick={() => handleCopy(qilRawText, 'qil-raw-text')}
                          className="p-1 rounded hover:bg-surface-100 transition-colors"
                          title="复制全部"
                        >
                          {copiedId === 'qil-raw-text' ? <CheckCheck size={12} className="text-emerald-400" /> : <Copy size={12} className="text-text-muted" />}
                        </button>
                      )}
                    </div>
                    {qilRawText ? (
                      <pre className="flex-1 text-xs text-text-secondary font-mono bg-surface-100/50 p-3 rounded-lg whitespace-pre-wrap leading-relaxed border border-border/50 overflow-y-auto">
                        {qilRawText}
                      </pre>
                    ) : (
                      <div className="flex-1 text-center py-8 text-slate-600">
                        <FileSpreadsheet size={24} className="mx-auto mb-2 opacity-30" />
                        <p className="text-xs">已通过图片解析 {manualSourceFields.length} 个字段</p>
                        <p className="text-[10px] text-slate-700 mt-1">使用文本输入可查看原文</p>
                      </div>
                    )}
                  </div>
                )
              ) : specsTab === 'diff' ? (
                (() => {
                  if (images.length === 0 || manualSourceFields.length === 0) {
                    return (
                      <div className="h-full flex flex-col items-center justify-center text-slate-700">
                        <GitCompare size={24} className="mb-2 opacity-30" />
                        <span className="text-xs">暂无对比数据</span>
                        <span className="text-[10px] text-slate-600 mt-1">
                          {images.length === 0 ? '请上传包装图片' : '请输入 QIL 数据'}
                        </span>
                      </div>
                    );
                  }

                  const allResults = manualSourceFields.map(field => {
                    const imageResults = images.map(img => {
                      if (!img.specs?.length) return { value: '-', status: 'pending' };
                      const matchingSpec = img.specs.find(spec =>
                        spec.key === field.key ||
                        spec.key.includes(field.key) ||
                        field.key.includes(spec.key)
                      );
                      if (!matchingSpec) return { value: '(未找到)', status: 'error' };

                      const qilValue = field.value.trim().toLowerCase();
                      const imgValue = matchingSpec.value.trim().toLowerCase();

                      if (qilValue === imgValue) {
                        return { value: matchingSpec.value, status: 'match' };
                      } else if (imgValue.includes(qilValue) || qilValue.includes(imgValue)) {
                        return { value: matchingSpec.value, status: 'warning' };
                      } else {
                        return { value: matchingSpec.value, status: 'error' };
                      }
                    });
                    const hasError = imageResults.some(r => r.status === 'error');
                    const hasWarning = imageResults.some(r => r.status === 'warning');
                    return { field, imageResults, hasError, hasWarning };
                  });

                  const sortedResults = [...allResults].sort((a, b) => {
                    if (a.hasError && !b.hasError) return -1;
                    if (!a.hasError && b.hasError) return 1;
                    if (a.hasWarning && !b.hasWarning) return -1;
                    if (!a.hasWarning && b.hasWarning) return 1;
                    return 0;
                  });

                  const errorCount = allResults.filter(r => r.hasError).length;
                  const warningCount = allResults.filter(r => r.hasWarning && !r.hasError).length;
                  const matchCount = allResults.length - errorCount - warningCount;
                  const allPass = errorCount === 0 && warningCount === 0;

                  // 只显示差异项开关
                  const [showOnlyDiff, setShowOnlyDiff] = useState(false);
                  const displayResults = showOnlyDiff
                    ? sortedResults.filter(r => r.hasError || r.hasWarning)
                    : sortedResults;

                  return (
                    <div className="flex flex-col h-full">
                      {/* 汇总统计 */}
                      <div className={`px-4 py-3 mb-3 rounded-lg flex items-center justify-between border-2 ${
                        allPass
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : errorCount > 0
                            ? 'bg-red-500/10 border-red-500/30'
                            : 'bg-amber-500/10 border-amber-500/30'
                      }`}>
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-bold ${
                            allPass ? 'text-emerald-400' : errorCount > 0 ? 'text-red-400' : 'text-amber-400'
                          }`}>
                            {allPass ? '✓ 全部通过' : errorCount > 0 ? `✗ 发现 ${errorCount} 处差异` : `⚠ ${warningCount} 处警告`}
                          </span>
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">{matchCount} 匹配</span>
                            {warningCount > 0 && <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded">{warningCount} 警告</span>}
                            {errorCount > 0 && <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded">{errorCount} 差异</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => setShowOnlyDiff(!showOnlyDiff)}
                          className={`px-3 py-1.5 text-[10px] font-medium rounded-lg transition-all ${
                            showOnlyDiff
                              ? 'bg-primary-600 text-text-primary'
                              : 'bg-surface-100 text-text-muted hover:bg-surface-200'
                          }`}
                        >
                          {showOnlyDiff ? '显示全部' : '只看差异'}
                        </button>
                      </div>

                      {/* 对比表格 */}
                      <div className="flex-1 overflow-auto">
                        <div className="space-y-2">{displayResults.map(({ field, imageResults, hasError, hasWarning }, idx) => (
                            <div
                              key={idx}
                              className={`rounded-lg border-2 transition-all ${
                                hasError
                                  ? 'bg-red-500/5 border-red-500/30 shadow-lg shadow-red-500/10'
                                  : hasWarning
                                    ? 'bg-amber-500/5 border-amber-500/30'
                                    : 'bg-surface-100/30 border-border/50'
                              }`}
                            >
                              {/* 字段名 */}
                              <div className="px-3 py-2 border-b border-border/50 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${
                                    hasError ? 'bg-red-500' : hasWarning ? 'bg-amber-500' : 'bg-emerald-500'
                                  }`}></span>
                                  <span className="text-xs font-medium text-text-primary">{field.key}</span>
                                </div>
                                {(hasError || hasWarning) && (
                                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                                    hasError
                                      ? 'bg-red-500/20 text-red-400'
                                      : 'bg-amber-500/20 text-amber-400'
                                  }`}>
                                    {hasError ? '差异' : '警告'}
                                  </span>
                                )}
                              </div>

                              {/* 对比内容 */}
                              <div className="p-3 grid grid-cols-2 gap-3">
                                {/* QIL 值 */}
                                <div>
                                  <div className="text-[9px] text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <FileSpreadsheet size={10} />
                                    QIL 标准
                                  </div>
                                  <div
                                    onClick={() => handleCopy(field.value, `qil-${idx}`)}
                                    className="group relative text-xs font-mono bg-primary-500/10 text-indigo-300 px-3 py-2 rounded-lg cursor-pointer hover:bg-primary-500/20 transition-all border border-primary-500/30"
                                  >
                                    <div className="pr-6">{field.value}</div>
                                    <Copy
                                      size={12}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 text-primary-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                    />
                                    {copiedId === `qil-${idx}` && (
                                      <div className="absolute -top-6 right-0 bg-emerald-500 text-text-primary text-[9px] px-2 py-0.5 rounded">
                                        已复制
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* 图片值 */}
                                <div>
                                  <div className="text-[9px] text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <Image size={10} />
                                    图片实际
                                  </div>
                                  <div className="space-y-1.5">
                                    {imageResults.map((result, imgIdx) => (
                                      <div
                                        key={imgIdx}
                                        onClick={() => handleCopy(result.value, `img-${idx}-${imgIdx}`)}
                                        className={`group relative text-xs font-mono px-3 py-2 rounded-lg cursor-pointer transition-all border ${
                                          result.status === 'match'
                                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                                            : result.status === 'warning'
                                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                                              : result.status === 'error'
                                                ? 'bg-red-500/10 text-red-300 border-red-500/30 hover:bg-red-500/20'
                                                : 'bg-surface-100/50 text-text-muted border-border/50'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 pr-6">
                                          <span className="text-[8px] text-slate-600">#{imgIdx + 1}</span>
                                          <span className="flex-1">{result.value}</span>
                                        </div>
                                        <Copy
                                          size={12}
                                          className={`absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity ${
                                            result.status === 'match' ? 'text-emerald-400' :
                                            result.status === 'warning' ? 'text-amber-400' :
                                            result.status === 'error' ? 'text-red-400' : 'text-text-muted'
                                          }`}
                                        />
                                        {copiedId === `img-${idx}-${imgIdx}` && (
                                          <div className="absolute -top-6 right-0 bg-emerald-500 text-text-primary text-[9px] px-2 py-0.5 rounded">
                                            已复制
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                (() => {
                  const currentOcrText = images.find(img => img.id === specsTab)?.ocrText || '';

                  return (
                    <div className="h-full">
                      {!currentOcrText ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-700">
                          <Type size={24} className="mb-2 opacity-30" />
                          <span className="text-xs">暂无 OCR 数据</span>
                          <span className="text-[10px] text-slate-600 mt-1">图片分析后自动提取</span>
                        </div>
                      ) : (
                        <div className="h-full flex flex-col">
                          <div className="flex items-center justify-between mb-2 px-1">
                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">OCR 原文</span>
                            <button
                              onClick={() => handleCopy(currentOcrText, 'ocr-text')}
                              className="p-1 rounded hover:bg-surface-100 transition-colors"
                              title="复制全部"
                            >
                              {copiedId === 'ocr-text' ? <CheckCheck size={12} className="text-emerald-400" /> : <Copy size={12} className="text-text-muted" />}
                            </button>
                          </div>
                          <pre className="flex-1 text-xs text-text-secondary font-mono bg-surface-100/50 p-3 rounded-lg whitespace-pre-wrap leading-relaxed border border-border/50 overflow-y-auto">
                            {currentOcrText}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-border flex items-center justify-around px-2 z-40">
        <button
          onClick={() => setMobileTab('images')}
          className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 rounded-lg transition-colors ${
            mobileTab === 'images' ? 'text-primary-400 bg-surface-100' : 'text-text-muted'
          }`}
        >
          <List size={18} />
          <span className="text-[9px]">图片</span>
          {images.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-primary-500 text-text-primary text-[8px] rounded-full flex items-center justify-center">
              {images.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setMobileTab('viewer')}
          className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 rounded-lg transition-colors ${
            mobileTab === 'viewer' ? 'text-primary-400 bg-surface-100' : 'text-text-muted'
          }`}
        >
          <Eye size={18} />
          <span className="text-[9px]">预览</span>
        </button>
        <button
          onClick={() => setMobileTab('issues')}
          className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 rounded-lg transition-colors ${
            mobileTab === 'issues' ? 'text-primary-400 bg-surface-100' : 'text-text-muted'
          }`}
        >
          <AlertTriangle size={18} />
          <span className="text-[9px]">问题</span>
          {currentImage && (() => {
            const modelData = currentImage.issuesByModel?.[activeModelTab];
            const count = (modelData?.issues?.length || currentImage.issues.length) + (modelData?.deterministicIssues?.length || currentImage.deterministicIssues?.length || 0);
            return count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-red-500 text-text-primary text-[8px] rounded-full flex items-center justify-center">
                {count}
              </span>
            );
          })()}
        </button>
        <button
          onClick={() => setMobileTab('qil')}
          className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 rounded-lg transition-colors ${
            mobileTab === 'qil' ? 'text-primary-400 bg-surface-100' : 'text-text-muted'
          }`}
        >
          <Table size={18} />
          <span className="text-[9px]">QIL</span>
          {manualSourceFields.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-emerald-500 text-text-primary text-[8px] rounded-full flex items-center justify-center">
              {manualSourceFields.length}
            </span>
          )}
        </button>
      </div>
        </>
      )}

      {/* Error Toast */}
      {errorMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-500/90 text-text-primary px-6 py-3 rounded-lg shadow-2xl z-50 text-sm font-medium flex items-center gap-3 backdrop-blur-sm border border-red-400/50">
          <AlertCircle size={20} />
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="ml-2 hover:bg-white/20 p-1 rounded">
            <XCircle size={16} />
          </button>
        </div>
      )}
      </div>
    </div>
  );
};

export default App;
