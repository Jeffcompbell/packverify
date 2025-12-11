import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { localDiffSpecs, getModelId, setModelId, extractOcrOnly } from './services/openaiService';
import { signInWithGoogle, signOutUser, onAuthChange } from './services/firebase';
import {
  getOrCreateUser, getUserData, useQuotaFirebase, UserData,
  getOrCreateSession, updateImageInCloud, deleteImageFromCloud, saveQilToCloud,
  loadSessionFromCloud, clearSessionInCloud, CloudImageData, CloudSession,
  getUserSessions, createNewSession, updateSessionProductName, deleteSession, getQuotaUsageHistory, QuotaUsageRecord
} from './services/cloudflare';
import { SourceField, DiffResult, ImageItem, ImageSpec, BoundingBox, IndustryType } from './types/types';
import { useImageAnalysis } from './hooks/useImageAnalysis';
import { DiffSummary } from './components/features/DiffSummary';
import { ComparisonPanel } from './components/features/ComparisonPanel';
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
  const [isLoadingFromCloud, setIsLoadingFromCloud] = useState(false);
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Data
  const [images, setImages] = useState<ImageItem[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [manualSourceFields, setManualSourceFields] = useState<SourceField[]>([]);
  const [qilRawText, setQilRawText] = useState<string>(''); // QIL 原始文本

  // UI State
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [industry, setIndustry] = useState<IndustryType>('general');
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showIndustryMenu, setShowIndustryMenu] = useState(false);
  const [qilProcessing, setQilProcessing] = useState(false);

  // Refs for click-outside detection
  const industryMenuRef = useRef<HTMLDivElement>(null);
  const hasLoadedCloudData = useRef(false); // 防止重复加载云端数据
  const [currentModel, setCurrentModel] = useState(getModelId());
  const [activeModelTab, setActiveModelTab] = useState<string>(currentModel);
  const [imageScale, setImageScale] = useState(1);
  const [showOverlay, setShowOverlay] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Bottom panel height (resizable) - 默认收起（24px 仅显示标题栏）
  const [bottomHeight, setBottomHeight] = useState(24);
  const [isResizing, setIsResizing] = useState(false);

  // Specs tab
  const [specsTab, setSpecsTab] = useState<string>('qil');

  // 顶部模式切换：AI图片检测 / AI参数对比
  const [analysisMode, setAnalysisMode] = useState<'detection' | 'comparison'>('detection');

  // Mobile view tab
  const [mobileTab, setMobileTab] = useState<'images' | 'viewer' | 'issues' | 'qil'>('viewer');

  const issueListRef = useRef<HTMLDivElement>(null);
  const qilPanelRef = useRef<QilPanelRef>(null);

  // Current image
  const currentImage = images[currentImageIndex] || null;

  // Image analysis hook
  const {
    isProcessing, processingImageId, processingModelId, processingStep, isSyncing,
    processFile, retryAnalysis, addModelAnalysis
  } = useImageAnalysis({
    user, sessionId, cloudSyncEnabled, industry, manualSourceFields,
    onShowLogin: () => setShowLoginModal(true),
    onError: setErrorMessage,
    onUserUpdate: setUser
  });

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

  // 用户登录后，加载云端会话数据（只执行一次）
  useEffect(() => {
    if (!user || !cloudSyncEnabled) return;
    // 防止因 user 对象更新（如配额变化）而重复加载
    if (hasLoadedCloudData.current) return;
    hasLoadedCloudData.current = true;

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
  const handleImageUpload = useCallback(async (file: File) => {
    const result = await processFile(file, images, currentModel);
    if (result) {
      setImages(prev => [...prev, result]);
      setCurrentImageIndex(images.length);
    }
  }, [processFile, images, currentModel]);

  const handleRetryAnalysis = useCallback(async (imageId: string) => {
    const image = images.find(img => img.id === imageId);
    if (image) await retryAnalysis(image, images);
  }, [images, retryAnalysis]);

  const handleAddModelAnalysis = useCallback(async (imageId: string, modelId: string) => {
    const image = images.find(img => img.id === imageId);
    if (!image) return;
    setImages(prev => prev.map(img =>
      img.id === imageId ? { ...img, issuesByModel: { ...img.issuesByModel, [modelId]: { issues: [], deterministicIssues: [] } } } : img
    ));
    const result = await addModelAnalysis(image, modelId);
    if (result) {
      setImages(prev => prev.map(img => img.id === imageId ? { ...img, issuesByModel: result } : img));
    }
  }, [images, addModelAnalysis]);

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
            const ocrResult = await extractOcrOnly(img.base64, img.file.type);
            setImages(prev => prev.map(image =>
              image.id === img.id ? { ...image, ocrText: ocrResult.ocrText } : image
            ));
            if (cloudSyncEnabled && sessionId && user) {
              await updateImageInCloud(user.uid, sessionId, img.id, { ocrText: ocrResult.ocrText });
            }
          } catch (error) {
            console.error(`Failed to extract OCR for image ${img.id}:`, error);
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
              handleImageUpload(file);
            }
          }
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleImageUpload]);

  // Global Drag & Drop
  const onDragOver = useCallback((e: React.DragEvent) => e.preventDefault(), []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []) as File[];
    files.forEach(file => {
      const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
      if (file.type.startsWith('image/') || isHeic) {
        handleImageUpload(file);
      }
    });
  }, [handleImageUpload]);

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
    hasLoadedCloudData.current = false; // 重置，下次登录时重新加载
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
          <Loader2 size={24} className="animate-spin text-text-muted" />
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
        onOpenQuotaModal={() => setShowQuotaModal(true)}
        onOpenUpgradeModal={() => setShowUpgradeModal(true)}
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
        {/* Left: 云同步状态 + 产品名称 + 模式切换胶囊 */}
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

          {/* 模式切换胶囊 */}
          <div className="flex items-center bg-gray-100 rounded-full p-0.5">
            <button
              onClick={() => setAnalysisMode('detection')}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                analysisMode === 'detection'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              AI 图片检测
            </button>
            <button
              onClick={() => setAnalysisMode('comparison')}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                analysisMode === 'comparison'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              AI 参数对比
            </button>
          </div>
        </div>

        {/* Center: 图片工具 - 仅在检测模式显示 */}
        {analysisMode === 'detection' && (
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
          {/* 行业选择 */}
          <div ref={industryMenuRef} className="relative">
            <button
              onClick={() => setShowIndustryMenu(!showIndustryMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs rounded-lg transition-colors"
            >
              <Package size={14} />
              <span>{{ cosmetics: '化妆品', food: '食品', pharma: '药品', general: '通用' }[industry]}</span>
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
        )}
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
            className="px-4 py-2 bg-text-primary text-white rounded-md hover:bg-text-secondary transition-colors"
          >
            返回首页
          </button>
        </div>
      ) : (
        <>
        {/* AI 参数对比模式 */}
        {analysisMode === 'comparison' ? (
          <ComparisonPanel
            images={images}
            manualSourceFields={manualSourceFields}
            copiedId={copiedId}
            onCopy={handleCopy}
            onFieldsUpdate={handleUpdateQilFields}
            onError={setErrorMessage}
            onImageUpload={handleImageUpload}
          />
        ) : (
        <div className="flex-1 flex min-h-0 pb-14 md:pb-0">
        {/* LEFT: Thumbnails - 桌面端显示，移动端通过底部导航切换 */}
        <div className={`${mobileTab === 'images' ? 'flex' : 'hidden'} md:flex w-full md:w-[140px] border-r border-border bg-surface-50 p-2 overflow-y-auto shrink-0 flex-col`}>
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
            图片列表
          </div>
          {/* 移动端添加图片按钮 */}
          <label className="md:hidden flex items-center justify-center gap-1.5 px-3 py-2 mb-2 bg-text-primary hover:bg-text-secondary text-white text-xs font-medium rounded cursor-pointer transition-colors">
            <ImagePlus size={14} />
            <span>添加图片</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
              if (e.target.files?.[0]) {
                handleImageUpload(e.target.files[0]);
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
                  currentImageIndex === idx ? 'border-text-primary' : 'border-transparent hover:border-border-hover'
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
                    <Loader2 size={14} className="animate-spin text-text-muted" />
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
          <label className="hidden md:flex items-center justify-center gap-2 px-3 py-2 mt-2 bg-text-primary hover:bg-text-secondary text-white text-xs font-medium rounded-lg cursor-pointer transition-colors">
            <ImagePlus size={14} />
            <span>添加图片</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
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
                          background: 'linear-gradient(90deg, transparent, rgba(113, 113, 122, 0.8), rgba(161, 161, 170, 1), rgba(113, 113, 122, 0.8), transparent)',
                          boxShadow: '0 0 15px 3px rgba(113, 113, 122, 0.6), 0 0 30px 6px rgba(113, 113, 122, 0.3)'
                        }}
                      />
                      {/* 扫描线上的状态文字 */}
                      <div
                        className="absolute left-1/2 -translate-x-1/2 pointer-events-none z-30 flex items-center gap-2 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full border border-surface-300 text-[10px] text-text-secondary whitespace-nowrap"
                        style={{
                          animation: 'scanLine 2.5s ease-in-out infinite',
                        }}
                      >
                        <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-pulse" />
                        {processingStep === 1 ? 'AI 视觉分析' : '规则检测'}
                      </div>
                      {/* 顶部和底部边缘发光 */}
                      <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-surface-300/30 to-transparent pointer-events-none z-10" />
                      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-surface-300/30 to-transparent pointer-events-none z-10" />
                      {/* 四角标记 */}
                      <div className="absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 border-text-muted pointer-events-none z-10" />
                      <div className="absolute top-2 right-2 w-4 h-4 border-r-2 border-t-2 border-text-muted pointer-events-none z-10" />
                      <div className="absolute bottom-2 left-2 w-4 h-4 border-l-2 border-b-2 border-text-muted pointer-events-none z-10" />
                      <div className="absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-text-muted pointer-events-none z-10" />
                    </>
                  )}

                  {showOverlay && !isCurrentProcessing && (currentImage.issuesByModel?.[activeModelTab]?.issues || currentImage.issues).map(issue => (
                    issue.box_2d && (
                      <div
                        key={issue.id}
                        onClick={() => setSelectedIssueId(issue.id)}
                        className={`absolute rounded cursor-pointer transition-all ${
                          selectedIssueId === issue.id
                            ? 'border-2 border-text-primary bg-text-primary/20 shadow-[0_0_20px_rgba(24,24,27,0.3)] z-10'
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
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
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
      )}

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-border flex items-center justify-around px-2 z-40">
        <button
          onClick={() => setMobileTab('images')}
          className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 rounded-lg transition-colors ${
            mobileTab === 'images' ? 'text-text-primary bg-surface-100' : 'text-text-muted'
          }`}
        >
          <List size={18} />
          <span className="text-[9px]">图片</span>
          {images.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-text-primary text-white text-[8px] rounded-full flex items-center justify-center">
              {images.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setMobileTab('viewer')}
          className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 rounded-lg transition-colors ${
            mobileTab === 'viewer' ? 'text-text-primary bg-surface-100' : 'text-text-muted'
          }`}
        >
          <Eye size={18} />
          <span className="text-[9px]">预览</span>
        </button>
        <button
          onClick={() => setMobileTab('issues')}
          className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 rounded-lg transition-colors ${
            mobileTab === 'issues' ? 'text-text-primary bg-surface-100' : 'text-text-muted'
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
            mobileTab === 'qil' ? 'text-text-primary bg-surface-100' : 'text-text-muted'
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
