import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { diagnoseImage, fileToGenerativePart, parseSourceText, AVAILABLE_MODELS, getModelId, setModelId, parseQILImage, localDiffSpecs } from './services/openaiService';
import {
  signInWithGoogle, signOutUser, onAuthChange, getOrCreateUser, getUserData, useQuotaFirebase, UserData,
  getOrCreateSession, saveImageToCloud, updateImageInCloud, deleteImageFromCloud, saveQilToCloud,
  loadSessionFromCloud, clearSessionInCloud, CloudImageData, CloudSession,
  getUserSessions, createNewSession, updateSessionProductName, getQuotaUsageHistory, QuotaUsageRecord
} from './services/firebase';
import { DiagnosisIssue, SourceField, DiffResult, ImageItem, ImageSpec, BoundingBox, DeterministicCheck } from './types';
import {
  Table, Zap, AlertCircle, XCircle, ChevronDown, ChevronLeft, ChevronRight,
  ImagePlus, Trash2, RefreshCw, Copy, CheckCheck, Upload, Eye, EyeOff,
  ZoomIn, ZoomOut, RotateCcw, RotateCw, FileText, AlertTriangle, CheckCircle,
  ClipboardCheck, Image, Search, FileSpreadsheet, Loader2, Maximize2,
  Type, Brackets, ShieldAlert, GitCompare, LogOut, User as UserIcon, X, Cloud, CloudOff,
  Menu, Home, List, Settings, Package
} from 'lucide-react';
import { LoginModal, GoogleIcon } from './components/LoginModal';
import { QuotaModal } from './components/QuotaModal';
import { AllProductsPage } from './components/AllProductsPage';
import { IssuesPanel } from './components/IssuesPanel';
import { QilPanel, QilPanelRef } from './components/QilPanel';
import { base64ToBlobUrl, createVirtualFile, generateProductName, STORAGE_KEY } from './utils/helpers';
import { StoredImageItem } from './types/storage';

const App: React.FC = () => {
  // 用户认证状态
  const [user, setUser] = useState<UserData | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [quotaUsageHistory, setQuotaUsageHistory] = useState<QuotaUsageRecord[]>([]);
  const [isLoadingQuotaHistory, setIsLoadingQuotaHistory] = useState(false);
  const [hasMoreQuotaHistory, setHasMoreQuotaHistory] = useState(false);
  const [isLoadingMoreQuotaHistory, setIsLoadingMoreQuotaHistory] = useState(false);

  // 产品/会话状态
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [productName, setProductName] = useState<string>(generateProductName());
  const [isEditingProductName, setIsEditingProductName] = useState(false);
  const [showProductList, setShowProductList] = useState(false);
  const [historySessions, setHistorySessions] = useState<CloudSession[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // 云同步状态
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingFromCloud, setIsLoadingFromCloud] = useState(false);
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(true);

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingImageId, setProcessingImageId] = useState<string | null>(null);
  const [processingStep, setProcessingStep] = useState<number>(1);
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
  const [imageScale, setImageScale] = useState(1);
  const [showOverlay, setShowOverlay] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Bottom panel height (resizable)
  const [bottomHeight, setBottomHeight] = useState(280);
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

  // 从 localStorage 恢复数据
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        const storedImages: StoredImageItem[] = data.images || [];

        const restoredImages: ImageItem[] = storedImages.map(item => ({
          id: item.id,
          src: base64ToBlobUrl(item.base64, item.mimeType),
          base64: item.base64,
          file: createVirtualFile(item.base64, item.mimeType, item.fileName),
          description: item.description,
          ocrText: item.ocrText,
          specs: item.specs || [],
          issues: item.issues || [],
          deterministicIssues: item.deterministicIssues || [],
          diffs: item.diffs || []
        }));

        if (restoredImages.length > 0) {
          setImages(restoredImages);
          setCurrentImageIndex(data.currentIndex || 0);
        }

        if (data.manualSourceFields) {
          setManualSourceFields(data.manualSourceFields);
        }
      }
    } catch (err) {
      console.error('Failed to restore data:', err);
    }
  }, []);

  // 保存数据到 localStorage
  useEffect(() => {
    if (images.length === 0 && manualSourceFields.length === 0) return;

    try {
      const storedImages: StoredImageItem[] = images.map(img => ({
        id: img.id,
        base64: img.base64,
        mimeType: img.file.type,
        fileName: img.file.name,
        description: img.description,
        ocrText: img.ocrText,
        specs: img.specs,
        issues: img.issues,
        deterministicIssues: img.deterministicIssues,
        diffs: img.diffs
      }));

      const data = {
        images: storedImages,
        currentIndex: currentImageIndex,
        manualSourceFields
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error('Failed to save data:', err);
    }
  }, [images, currentImageIndex, manualSourceFields]);

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

  // 用户登录后，加载云端会话数据
  useEffect(() => {
    if (!user || !cloudSyncEnabled) return;

    const loadCloudData = async () => {
      try {
        setIsLoadingFromCloud(true);

        // 获取或创建会话
        const sid = await getOrCreateSession(user.uid, productName);
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
                  diffs: cloudImg.diffs || []
                };
              })
            );

            setImages(loadedImages);
          }
          setManualSourceFields(session.qilFields || []);
          console.log(`Loaded ${cloudImages.length} images from cloud`);
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

  // Check for API Key on mount
  useEffect(() => {
    if (!import.meta.env.VITE_OPENAI_API_KEY) {
      setErrorMessage("Missing VITE_OPENAI_API_KEY in .env.local");
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

    if (!file.type.startsWith('image/')) {
      setErrorMessage("请上传图片文件");
      return;
    }

    if (images.length >= 8) {
      setErrorMessage("最多支持 8 张图片");
      return;
    }

    // 检查配额
    if (user.used >= user.quota) {
      setErrorMessage(`配额已用完（${user.used}/${user.quota}），请联系管理员`);
      return;
    }

    const newImageId = `img-${Date.now()}`;

    try {
      console.log("Processing file:", file.name);
      const url = URL.createObjectURL(file);
      const base64 = await fileToGenerativePart(file);

      const newImage: ImageItem = {
        id: newImageId,
        src: url,
        base64: base64,
        file: file,
        specs: [],
        issues: [],
        diffs: []
      };

      setImages(prev => [...prev, newImage]);
      setCurrentImageIndex(images.length);

      setIsProcessing(true);
      setProcessingImageId(newImageId);
      setErrorMessage(null);

      // 单次 AI 调用完成：OCR + 问题检测 + 规格提取
      const diagResult = await diagnoseImage(base64, file.type, (step) => {
        setProcessingStep(step);
      });

      // 转换 specs 格式
      const imageSpecs: ImageSpec[] = diagResult.specs.map(s => ({
        key: s.key,
        value: s.value,
        category: s.category
      }));

      setImages(prev => prev.map(img =>
        img.id === newImageId ? {
          ...img,
          issues: diagResult.issues,
          description: diagResult.description,
          ocrText: diagResult.ocrText,
          deterministicIssues: diagResult.deterministicIssues,
          specs: imageSpecs
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

      // 消耗配额
      await useQuotaFirebase(user.uid, 1, file.name);
      const updatedUser = await getUserData(user.uid);
      if (updatedUser) setUser(updatedUser);

      // 云同步 - 保存到 Firebase
      if (cloudSyncEnabled && sessionId) {
        setIsSyncing(true);
        try {
          // 获取最新的图片数据
          const finalImage: ImageItem = {
            id: newImageId,
            src: url,
            base64,
            file,
            description: diagResult.description,
            ocrText: diagResult.ocrText,
            specs: imageSpecs,
            issues: diagResult.issues,
            deterministicIssues: diagResult.deterministicIssues,
            diffs: diffs
          };
          await saveImageToCloud(user.uid, sessionId, finalImage);
          console.log('Image synced to cloud:', newImageId);
        } catch (syncError) {
          console.error('Cloud sync failed:', syncError);
        } finally {
          setIsSyncing(false);
        }
      }

    } catch (error: any) {
      console.error("Processing failed:", error);
      setErrorMessage(error.message || "图片处理失败");
    } finally {
      setIsProcessing(false);
      setProcessingImageId(null);
    }
  }, [user, images.length, manualSourceFields, cloudSyncEnabled, sessionId]);

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
      setIsProcessing(true);
      setProcessingImageId(imageId);
      setErrorMessage(null);

      // 单次 AI 调用完成：OCR + 问题检测 + 规格提取
      const diagResult = await diagnoseImage(image.base64, image.file.type, (step) => {
        setProcessingStep(step);
      });

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

      setImages(prev => prev.map(img =>
        img.id === imageId ? {
          ...img,
          issues: diagResult.issues,
          description: diagResult.description,
          ocrText: diagResult.ocrText,
          deterministicIssues: diagResult.deterministicIssues,
          specs: imageSpecs,
          diffs: diffs
        } : img
      ));

      // 消耗配额
      await useQuotaFirebase(user.uid, 1, image.file.name, 'retry');
      const updatedUser = await getUserData(user.uid);
      if (updatedUser) setUser(updatedUser);

      // 云同步 - 更新图片数据
      if (cloudSyncEnabled && sessionId) {
        try {
          await updateImageInCloud(user.uid, sessionId, imageId, {
            description: diagResult.description,
            ocrText: diagResult.ocrText,
            specs: imageSpecs,
            issues: diagResult.issues,
            deterministicIssues: diagResult.deterministicIssues,
            diffs: diffs
          });
          console.log('Image updated in cloud:', imageId);
        } catch (syncError) {
          console.error('Cloud sync failed:', syncError);
        }
      }

    } catch (error: any) {
      setErrorMessage(error.message || "重新分析失败");
    } finally {
      setIsProcessing(false);
      setProcessingImageId(null);
    }
  }, [user, images, manualSourceFields, cloudSyncEnabled, sessionId]);

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

    // 云同步 - 保存 QIL 数据
    if (cloudSyncEnabled && sessionId && user) {
      try {
        await saveQilToCloud(user.uid, sessionId, fields, '');
        console.log('QIL data synced to cloud');
      } catch (error) {
        console.error('Failed to sync QIL to cloud:', error);
      }
    }
  }, [currentImage, cloudSyncEnabled, sessionId, user]);

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
    localStorage.removeItem(STORAGE_KEY);

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
      setShowProductList(false);

      // 加载目标会话数据
      const { session, images: cloudImages } = await loadSessionFromCloud(user.uid, targetSession.id);

      if (session) {
        setSessionId(targetSession.id);
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
                diffs: cloudImg.diffs || []
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
    if (!user) return;

    try {
      const newName = generateProductName();
      const newSid = await createNewSession(user.uid, newName);

      setSessionId(newSid);
      setProductName(newName);
      setImages([]);
      setManualSourceFields([]);
      setCurrentImageIndex(0);
      setShowProductList(false);

      // 刷新历史列表
      const sessions = await getUserSessions(user.uid, 10);
      setHistorySessions(sessions);
    } catch (error) {
      console.error('Failed to create new product:', error);
      setErrorMessage('创建新产品失败');
    }
  }, [user]);

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
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  // Resize handler for bottom panel
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startY = e.clientY;
    const startHeight = bottomHeight;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startY - e.clientY;
      const newHeight = Math.min(500, Math.max(150, startHeight + delta));
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
  }, []);

  const handleLogin = useCallback((loggedInUser: UserData) => {
    setUser(loggedInUser);
  }, []);

  const isCurrentProcessing = currentImage && processingImageId === currentImage.id;

  // 加载中状态
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 size={24} className="animate-spin text-indigo-400" />
          <span className="text-slate-400">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-screen w-screen bg-slate-950 flex flex-col font-sans text-slate-200 overflow-hidden"
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

      {/* TOP BAR */}
      <div className="h-12 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-2 md:px-4 shrink-0">
        {/* Left: Product Name */}
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          {/* 产品名称 - 可编辑 */}
          <div className="flex items-center gap-1 md:gap-2 min-w-0">
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
                className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white w-28 md:w-40 focus:outline-none focus:border-slate-500"
                autoFocus
              />
            ) : (
              <button
                onClick={() => user && setIsEditingProductName(true)}
                className="text-xs md:text-sm font-medium text-white hover:text-slate-300 transition-colors flex items-center gap-1 truncate max-w-[100px] md:max-w-none"
                title="点击编辑产品名称"
              >
                {productName}
                {user && <span className="text-slate-600 text-xs hidden md:inline">✎</span>}
              </button>
            )}

            {/* 产品切换下拉 */}
            {user && (
              <div className="relative">
                <button
                  onClick={() => setShowProductList(!showProductList)}
                  className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors"
                  title="切换产品"
                >
                  <ChevronDown size={14} className={`transition-transform ${showProductList ? 'rotate-180' : ''}`} />
                </button>

                {showProductList && (
                  <div className="absolute top-full left-0 mt-1 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-80 overflow-hidden">
                    {/* 新建产品 */}
                    <div className="p-2 border-b border-slate-700">
                      <button
                        onClick={handleCreateNewProduct}
                        className="w-full px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 rounded flex items-center gap-2"
                      >
                        <ImagePlus size={12} />
                        新建产品
                      </button>
                    </div>

                    {/* 历史产品列表 */}
                    <div className="max-h-60 overflow-y-auto">
                      {historySessions.length === 0 ? (
                        <div className="p-3 text-[10px] text-slate-500 text-center">
                          暂无历史产品
                        </div>
                      ) : (
                        historySessions.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => handleSwitchSession(s)}
                            className={`w-full px-3 py-2 text-left hover:bg-slate-700 transition-colors flex items-center justify-between ${
                              s.id === sessionId ? 'bg-slate-700/50' : ''
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className={`text-xs font-medium truncate ${s.id === sessionId ? 'text-white' : 'text-slate-300'}`}>
                                {s.productName}
                              </div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-2">
                                <span>{s.imageCount} 张图片</span>
                                {s.updatedAt?.toDate && (
                                  <span>{s.updatedAt.toDate().toLocaleDateString()}</span>
                                )}
                              </div>
                            </div>
                            {s.id === sessionId && <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full shrink-0 ml-2"></div>}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 分隔线 - 桌面端 */}
          <div className="h-5 w-px bg-slate-700 hidden md:block" />

          {/* 云同步状态 - 桌面端 */}
          {user && (
            <div className="hidden md:flex items-center gap-1.5" title={cloudSyncEnabled ? '云同步已开启' : '云同步已关闭'}>
              {isSyncing || isLoadingFromCloud ? (
                <Loader2 size={12} className="animate-spin text-slate-500" />
              ) : (
                <Cloud size={12} className="text-slate-500" />
              )}
              <span className="text-[10px] text-slate-500">
                {isSyncing ? '同步中' : isLoadingFromCloud ? '加载中' : '已同步'}
              </span>
            </div>
          )}
        </div>

        {/* Center: Image Tools - 桌面端显示 */}
        <div className="hidden md:flex items-center gap-2">
          {/* 添加图片 */}
          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded border border-slate-700 cursor-pointer transition-colors">
            <ImagePlus size={14} />
            <span>添加图片</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
          </label>

          {/* 图片计数 */}
          {images.length > 0 && (
            <div className="px-2 py-1 bg-slate-800 rounded text-[10px] text-slate-400">
              {images.length}/8
            </div>
          )}

          {/* 分隔线 */}
          {currentImage && <div className="h-5 w-px bg-slate-700" />}

          {/* 图片查看工具 */}
          {currentImage && (
            <>
              <button
                onClick={() => setShowOverlay(!showOverlay)}
                className={`p-1.5 rounded transition-colors ${showOverlay ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-800'}`}
                title="显示/隐藏标注"
              >
                {showOverlay ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <button onClick={() => setImageScale(s => Math.min(3, s * 1.2))} className="p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white rounded transition-colors" title="放大">
                <ZoomIn size={14} />
              </button>
              <button onClick={() => setImageScale(s => Math.max(0.3, s / 1.2))} className="p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white rounded transition-colors" title="缩小">
                <ZoomOut size={14} />
              </button>
              <span className="text-[10px] text-slate-500 px-1 min-w-[36px] text-center">{Math.round(imageScale * 100)}%</span>
              <button onClick={() => {
                setImageScale(1);
                setImages(imgs => imgs.map((img, i) => i === currentImageIndex ? { ...img, rotation: 0 } : img));
              }} className="p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white rounded transition-colors" title="重置">
                <Maximize2 size={14} />
              </button>
              <button onClick={() => setImages(imgs => imgs.map((img, i) => i === currentImageIndex ? { ...img, rotation: (img.rotation || 0) - 90 } : img))} className="p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white rounded transition-colors" title="逆时针旋转">
                <RotateCcw size={14} />
              </button>
              <button onClick={() => setImages(imgs => imgs.map((img, i) => i === currentImageIndex ? { ...img, rotation: (img.rotation || 0) + 90 } : img))} className="p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white rounded transition-colors" title="顺时针旋转">
                <RotateCw size={14} />
              </button>
            </>
          )}

          {/* 清空 */}
          {images.length > 0 && (
            <>
              <div className="h-5 w-px bg-slate-700" />
              <button
                onClick={handleReset}
                className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded transition-colors"
                title="清空全部"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>

        {/* Right: User & Settings */}
        <div className="flex items-center gap-1.5 md:gap-3">
          {/* Model Selector - 桌面端 */}
          <div className="relative hidden md:block">
            <button
              onClick={() => setShowModelSelector(!showModelSelector)}
              className="bg-slate-800 px-2.5 py-1 rounded border border-slate-700 text-[11px] flex items-center gap-1.5 hover:border-slate-600 transition-colors"
            >
              <span className="text-slate-400">
                {AVAILABLE_MODELS.find(m => m.id === currentModel)?.name || 'Gemini'}
              </span>
              <ChevronDown size={12} className={`text-slate-500 transition-transform ${showModelSelector ? 'rotate-180' : ''}`} />
            </button>

            {showModelSelector && (
              <div className="absolute top-full right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden min-w-[180px] z-50">
                {AVAILABLE_MODELS.map(model => (
                  <button
                    key={model.id}
                    onClick={() => handleModelChange(model.id)}
                    className={`w-full px-3 py-2 text-left hover:bg-slate-700 transition-colors flex items-center justify-between ${
                      currentModel === model.id ? 'bg-slate-700' : ''
                    }`}
                  >
                    <div>
                      <div className={`text-xs font-medium ${currentModel === model.id ? 'text-white' : 'text-slate-300'}`}>
                        {model.name}
                      </div>
                      <div className="text-[10px] text-slate-500">{model.description}</div>
                    </div>
                    {currentModel === model.id && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {user ? (
            <>
              {/* 配额 */}
              <button
                onClick={handleOpenQuotaModal}
                className="flex items-center gap-1 md:gap-1.5 px-1.5 md:px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[10px] transition-colors"
                title="点击查看配额详情"
              >
                <span className="text-slate-500 hidden md:inline">额度</span>
                <span className="text-slate-300 font-medium tabular-nums">{user.quota - user.used}/{user.quota}</span>
              </button>

              {/* 用户头像 */}
              <div className="relative group">
                <button className="flex items-center gap-1 md:gap-1.5 p-1 rounded hover:bg-slate-800 transition-all">
                  <div className="w-6 h-6 rounded-full bg-slate-700 overflow-hidden">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] font-medium text-slate-400">
                        {(user.displayName || user.email || 'U')[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <ChevronDown size={12} className="text-slate-500 hidden md:block" />
                </button>

                {/* 下拉菜单 */}
                <div className="absolute top-full right-0 mt-1 w-44 py-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <div className="px-3 py-2 border-b border-slate-700">
                    <div className="text-xs font-medium text-slate-300 truncate">{user.displayName || '用户'}</div>
                    <div className="text-[10px] text-slate-500 truncate">{user.email}</div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full px-3 py-2 text-left text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors flex items-center gap-2"
                  >
                    <LogOut size={12} />
                    退出登录
                  </button>
                </div>
              </div>
            </>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-900 rounded text-xs font-medium transition-colors"
            >
              <GoogleIcon />
              登录
            </button>
          )}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex min-h-0 pb-14 md:pb-0">
        {/* LEFT: Thumbnails - 桌面端显示，移动端通过底部导航切换 */}
        <div className={`${mobileTab === 'images' ? 'flex' : 'hidden'} md:flex w-full md:w-[140px] border-r border-slate-800 bg-slate-950 p-2 overflow-y-auto shrink-0 flex-col`}>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            图片列表
          </div>
          {/* 移动端添加图片按钮 */}
          <label className="md:hidden flex items-center justify-center gap-1.5 px-3 py-2 mb-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded cursor-pointer transition-colors">
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
                  currentImageIndex === idx ? 'border-indigo-500' : 'border-transparent hover:border-slate-600'
                }`}
              >
                <img src={img.src} alt="" className="w-full h-full md:h-20 object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between">
                  <span className="text-[8px] text-white truncate max-w-[60px]">{img.file.name}</span>
                  {img.issues.length > 0 ? (
                    <span className="text-[8px] bg-red-500 text-white px-1 rounded">{img.issues.length}</span>
                  ) : img.description && (
                    <span className="text-[8px] bg-emerald-500 text-white px-1 rounded">✓</span>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveImage(img.id); }}
                  className="absolute top-1 right-1 p-0.5 bg-red-500/80 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={10} className="text-white" />
                </button>
                {processingImageId === img.id && (
                  <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center">
                    <Loader2 size={14} className="animate-spin text-indigo-400" />
                  </div>
                )}
              </div>
            ))}
            {images.length === 0 && (
              <div className="col-span-3 p-4 border-2 border-dashed border-slate-800 rounded-lg text-center">
                <ImagePlus size={20} className="mx-auto text-slate-700 mb-1" />
                <span className="text-[9px] text-slate-600 hidden md:block">点击顶部按钮添加</span>
                <span className="text-[9px] text-slate-600 md:hidden">点击上方按钮添加图片</span>
              </div>
            )}
          </div>
        </div>

        {/* CENTER: Image Viewer */}
        <div className={`${mobileTab === 'viewer' ? 'flex' : 'hidden'} md:flex flex-1 relative bg-slate-900 overflow-hidden items-center justify-center`}>
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
                        className="absolute left-1/2 -translate-x-1/2 pointer-events-none z-30 flex items-center gap-2 px-3 py-1 bg-slate-900/90 backdrop-blur-sm rounded-full border border-indigo-500/50 text-[10px] text-indigo-300 whitespace-nowrap"
                        style={{
                          animation: 'scanLine 2.5s ease-in-out infinite',
                        }}
                      >
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
                        {processingStep === 1 ? 'AI 视觉分析' : '规则检测'}
                      </div>
                      {/* 顶部和底部边缘发光 */}
                      <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-indigo-500/20 to-transparent pointer-events-none z-10" />
                      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-indigo-500/20 to-transparent pointer-events-none z-10" />
                      {/* 四角标记 */}
                      <div className="absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 border-indigo-400 pointer-events-none z-10" />
                      <div className="absolute top-2 right-2 w-4 h-4 border-r-2 border-t-2 border-indigo-400 pointer-events-none z-10" />
                      <div className="absolute bottom-2 left-2 w-4 h-4 border-l-2 border-b-2 border-indigo-400 pointer-events-none z-10" />
                      <div className="absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-indigo-400 pointer-events-none z-10" />
                    </>
                  )}

                  {showOverlay && !isCurrentProcessing && currentImage.issues.map(issue => (
                    issue.box_2d && (
                      <div
                        key={issue.id}
                        onClick={() => setSelectedIssueId(issue.id)}
                        className={`absolute rounded cursor-pointer transition-all ${
                          selectedIssueId === issue.id
                            ? 'border-2 border-indigo-400 bg-indigo-400/30 shadow-[0_0_20px_rgba(99,102,241,0.6)] z-10'
                            : issue.severity === 'high'
                              ? 'border-2 border-red-500 bg-red-500/20 hover:bg-red-500/40'
                              : 'border-2 border-amber-400 bg-amber-400/20 hover:bg-amber-400/40'
                        }`}
                        style={getStyleForBox(issue.box_2d)}
                      >
                        <div className={`absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap pointer-events-none border border-slate-700 transition-opacity ${selectedIssueId === issue.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          {issue.original || issue.text}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>

              {/* 左右切换按钮 */}
            </>
          ) : (
            <div className="text-center">
              <div className="p-6 bg-slate-800/30 rounded-full mb-4 inline-block">
                <ImagePlus className="text-slate-500" size={48} />
              </div>
              <p className="text-slate-400 font-medium mb-2">Ctrl+V 粘贴图片</p>
              <p className="text-slate-600 text-sm mb-4">或拖拽图片到此处</p>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg cursor-pointer transition-colors">
                <Upload size={16} />
                选择文件
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
              </label>
              {!user && (
                <p className="text-slate-600 text-xs mt-4">上传图片需要先登录</p>
              )}
            </div>
          )}

          {images.length > 1 && (
            <>
              <button
                onClick={() => setCurrentImageIndex(i => Math.max(0, i - 1))}
                disabled={currentImageIndex === 0}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-slate-800/80 rounded-full disabled:opacity-30 hover:bg-slate-700 transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => setCurrentImageIndex(i => Math.min(images.length - 1, i + 1))}
                disabled={currentImageIndex === images.length - 1}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-slate-800/80 rounded-full disabled:opacity-30 hover:bg-slate-700 transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>

        {/* RIGHT: Issues Panel */}
        <IssuesPanel
          currentImage={currentImage}
          isCurrentProcessing={isCurrentProcessing}
          onRetryAnalysis={() => currentImage && handleRetryAnalysis(currentImage.id)}
          selectedIssueId={selectedIssueId}
          onSelectIssue={setSelectedIssueId}
          copiedId={copiedId}
          onCopy={handleCopy}
          mobileTab={mobileTab}
          issueListRef={issueListRef}
        />
      </div>

      {/* BOTTOM BAR */}
      {/* BOTTOM PANEL - QIL (桌面端显示，移动端通过导航切换全屏) */}
      <div style={{ height: mobileTab === 'qil' ? 'auto' : bottomHeight }} className={`${mobileTab === 'qil' ? 'flex absolute inset-0 top-12 bottom-14 z-30' : 'hidden'} md:flex md:static md:z-auto border-t border-slate-800 bg-slate-950 flex-col shrink-0 relative`}>
        <div
          onMouseDown={handleResizeStart}
          className={`absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-indigo-500/50 transition-colors hidden md:block ${isResizing ? 'bg-indigo-500/50' : ''}`}
        />

        <div className="flex-1 flex flex-col md:flex-row min-h-0 pt-1 overflow-hidden">
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
            <div className="px-3 py-2 bg-slate-900 border-b border-slate-800 flex items-center gap-1 overflow-x-auto shrink-0">
              <FileSpreadsheet size={12} className="text-emerald-400 shrink-0 mr-1" />
              <button
                onClick={() => setSpecsTab('qil')}
                className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-all shrink-0 ${
                  specsTab === 'qil'
                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/50'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
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
                      ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/50'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
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
                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/50'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
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
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        QIL 源数据 {manualSourceFields.length > 0 && `(已解析 ${manualSourceFields.length} 个字段)`}
                      </span>
                      {qilRawText && (
                        <button
                          onClick={() => handleCopy(qilRawText, 'qil-raw-text')}
                          className="p-1 rounded hover:bg-slate-800 transition-colors"
                          title="复制全部"
                        >
                          {copiedId === 'qil-raw-text' ? <CheckCheck size={12} className="text-emerald-400" /> : <Copy size={12} className="text-slate-500" />}
                        </button>
                      )}
                    </div>
                    {qilRawText ? (
                      <pre className="flex-1 text-xs text-slate-300 font-mono bg-slate-800/50 p-3 rounded-lg whitespace-pre-wrap leading-relaxed border border-slate-700/50 overflow-y-auto">
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
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
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
                                    : 'bg-slate-800/30 border-slate-700/50'
                              }`}
                            >
                              {/* 字段名 */}
                              <div className="px-3 py-2 border-b border-slate-700/50 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${
                                    hasError ? 'bg-red-500' : hasWarning ? 'bg-amber-500' : 'bg-emerald-500'
                                  }`}></span>
                                  <span className="text-xs font-medium text-slate-200">{field.key}</span>
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
                                  <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <FileSpreadsheet size={10} />
                                    QIL 标准
                                  </div>
                                  <div
                                    onClick={() => handleCopy(field.value, `qil-${idx}`)}
                                    className="group relative text-xs font-mono bg-indigo-500/10 text-indigo-300 px-3 py-2 rounded-lg cursor-pointer hover:bg-indigo-500/20 transition-all border border-indigo-500/30"
                                  >
                                    <div className="pr-6">{field.value}</div>
                                    <Copy
                                      size={12}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                    />
                                    {copiedId === `qil-${idx}` && (
                                      <div className="absolute -top-6 right-0 bg-emerald-500 text-white text-[9px] px-2 py-0.5 rounded">
                                        已复制
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* 图片值 */}
                                <div>
                                  <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
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
                                                : 'bg-slate-800/50 text-slate-500 border-slate-700/50'
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
                                            result.status === 'error' ? 'text-red-400' : 'text-slate-400'
                                          }`}
                                        />
                                        {copiedId === `img-${idx}-${imgIdx}` && (
                                          <div className="absolute -top-6 right-0 bg-emerald-500 text-white text-[9px] px-2 py-0.5 rounded">
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
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">OCR 原文</span>
                            <button
                              onClick={() => handleCopy(currentOcrText, 'ocr-text')}
                              className="p-1 rounded hover:bg-slate-800 transition-colors"
                              title="复制全部"
                            >
                              {copiedId === 'ocr-text' ? <CheckCheck size={12} className="text-emerald-400" /> : <Copy size={12} className="text-slate-500" />}
                            </button>
                          </div>
                          <pre className="flex-1 text-xs text-slate-300 font-mono bg-slate-800/50 p-3 rounded-lg whitespace-pre-wrap leading-relaxed border border-slate-700/50 overflow-y-auto">
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
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-slate-900 border-t border-slate-800 flex items-center justify-around px-2 z-40">
        <button
          onClick={() => setMobileTab('images')}
          className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 rounded-lg transition-colors ${
            mobileTab === 'images' ? 'text-indigo-400 bg-slate-800' : 'text-slate-500'
          }`}
        >
          <List size={18} />
          <span className="text-[9px]">图片</span>
          {images.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-indigo-500 text-white text-[8px] rounded-full flex items-center justify-center">
              {images.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setMobileTab('viewer')}
          className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 rounded-lg transition-colors ${
            mobileTab === 'viewer' ? 'text-indigo-400 bg-slate-800' : 'text-slate-500'
          }`}
        >
          <Eye size={18} />
          <span className="text-[9px]">预览</span>
        </button>
        <button
          onClick={() => setMobileTab('issues')}
          className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 rounded-lg transition-colors ${
            mobileTab === 'issues' ? 'text-indigo-400 bg-slate-800' : 'text-slate-500'
          }`}
        >
          <AlertTriangle size={18} />
          <span className="text-[9px]">问题</span>
          {currentImage && (currentImage.issues.length + (currentImage.deterministicIssues?.length || 0)) > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-red-500 text-white text-[8px] rounded-full flex items-center justify-center">
              {currentImage.issues.length + (currentImage.deterministicIssues?.length || 0)}
            </span>
          )}
        </button>
        <button
          onClick={() => setMobileTab('qil')}
          className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 rounded-lg transition-colors ${
            mobileTab === 'qil' ? 'text-indigo-400 bg-slate-800' : 'text-slate-500'
          }`}
        >
          <Table size={18} />
          <span className="text-[9px]">QIL</span>
          {manualSourceFields.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-emerald-500 text-white text-[8px] rounded-full flex items-center justify-center">
              {manualSourceFields.length}
            </span>
          )}
        </button>
      </div>

      {/* Error Toast */}
      {errorMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-6 py-3 rounded-lg shadow-2xl z-50 text-sm font-medium flex items-center gap-3 backdrop-blur-sm border border-red-400/50">
          <AlertCircle size={20} />
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="ml-2 hover:bg-white/20 p-1 rounded">
            <XCircle size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
