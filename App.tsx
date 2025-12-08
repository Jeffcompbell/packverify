import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { diagnoseImage, fileToGenerativePart, parseSourceText, performSmartDiff, extractProductSpecs, AVAILABLE_MODELS, getModelId, setModelId, parseQILImage, localDiffSpecs } from './services/openaiService';
import {
  signInWithGoogle, signOutUser, onAuthChange, getOrCreateUser, getUserData, useQuotaFirebase, UserData,
  getOrCreateSession, saveImageToCloud, updateImageInCloud, deleteImageFromCloud, saveQilToCloud,
  loadSessionFromCloud, clearSessionInCloud, CloudImageData
} from './services/firebase';
import { DiagnosisIssue, SourceField, DiffResult, ImageItem, ImageSpec, BoundingBox, DeterministicCheck } from './types';
import {
  Table, Zap, AlertCircle, XCircle, ChevronDown, ChevronLeft, ChevronRight,
  ImagePlus, Trash2, RefreshCw, Copy, CheckCheck, Upload, Eye, EyeOff,
  ZoomIn, ZoomOut, RotateCcw, RotateCw, FileText, AlertTriangle, CheckCircle,
  ClipboardCheck, Image, Search, FileSpreadsheet, Loader2, Maximize2,
  Type, Brackets, ShieldAlert, GitCompare, LogOut, User as UserIcon, X, Cloud, CloudOff
} from 'lucide-react';

// 存储接口 - 用于 localStorage 持久化
interface StoredImageItem {
  id: string;
  base64: string;
  mimeType: string;
  fileName: string;
  description?: string;
  ocrText?: string;
  specs: ImageSpec[];
  issues: DiagnosisIssue[];
  deterministicIssues?: DeterministicCheck[];
  diffs: DiffResult[];
}

// base64 转 blob URL
const base64ToBlobUrl = (base64: string, mimeType: string): string => {
  const byteString = atob(base64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([ab], { type: mimeType });
  return URL.createObjectURL(blob);
};

// 创建虚拟 File 对象
const createVirtualFile = (base64: string, mimeType: string, fileName: string): File => {
  const byteString = atob(base64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new File([ab], fileName, { type: mimeType });
};

const STORAGE_KEY = 'packverify_data';

// Google 图标组件
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// 登录弹窗组件 - 简洁专业设计
const LoginModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: UserData) => void;
}> = ({ isOpen, onClose, onLogin }) => {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      const userData = await signInWithGoogle();
      if (userData) {
        onLogin(userData);
        onClose();
      }
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('登录已取消');
      } else {
        setError(err.message || '登录失败，请重试');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-slate-900 rounded-2xl shadow-2xl border border-slate-800">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all"
        >
          <X size={18} />
        </button>

        {/* Content */}
        <div className="p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-800 mb-4">
              <Zap size={24} className="text-slate-300" fill="currentColor" />
            </div>
            <h1 className="text-xl font-semibold text-white mb-1">登录</h1>
            <p className="text-sm text-slate-500">登录后使用图片分析功能</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Login button */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-900 py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-3"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            {isLoading ? '登录中...' : '使用 Google 继续'}
          </button>

          {/* Footer */}
          <p className="mt-4 text-center text-xs text-slate-600">
            首次登录赠送 50 次分析额度
          </p>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  // 用户认证状态
  const [user, setUser] = useState<UserData | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // 产品/会话状态
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [productName, setProductName] = useState<string>('未命名产品');
  const [isEditingProductName, setIsEditingProductName] = useState(false);
  const [showProductList, setShowProductList] = useState(false);

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

  // UI State
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState(getModelId());
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [imageScale, setImageScale] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Bottom panel height (resizable)
  const [bottomHeight, setBottomHeight] = useState(280);
  const [isResizing, setIsResizing] = useState(false);

  // Specs tab
  const [specsTab, setSpecsTab] = useState<string>('qil');

  // Right panel tab
  const [rightPanelTab, setRightPanelTab] = useState<'issues' | 'ocr'>('issues');

  // QIL Input
  const [qilInputMode, setQilInputMode] = useState<'text' | 'image'>('text');
  const [qilInputText, setQilInputText] = useState('');
  const [qilImages, setQilImages] = useState<{ id: string; src: string; base64: string; mimeType: string; parsed: boolean }[]>([]);
  const [isParsingQil, setIsParsingQil] = useState(false);
  const [parsingQilId, setParsingQilId] = useState<string | null>(null);
  const qilDropRef = useRef<HTMLDivElement>(null);
  const issueListRef = useRef<HTMLDivElement>(null);

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
        if (data.qilInputText) {
          setQilInputText(data.qilInputText);
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
        manualSourceFields,
        qilInputText
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error('Failed to save data:', err);
    }
  }, [images, currentImageIndex, manualSourceFields, qilInputText]);

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
        const sid = await getOrCreateSession(user.uid);
        setSessionId(sid);

        // 从云端加载数据
        const { session, images: cloudImages } = await loadSessionFromCloud(user.uid, sid);

        if (session && cloudImages.length > 0) {
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
          setManualSourceFields(session.qilFields || []);
          setQilInputText(session.qilInputText || '');
          console.log(`Loaded ${loadedImages.length} images from cloud`);
        }
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

      // Analyze
      const diagResult = await diagnoseImage(base64, file.type, (step) => {
        setProcessingStep(step);
      });

      setImages(prev => prev.map(img =>
        img.id === newImageId ? {
          ...img,
          issues: diagResult.issues,
          description: diagResult.description,
          ocrText: diagResult.ocrText,
          deterministicIssues: diagResult.deterministicIssues
        } : img
      ));

      // Extract specs
      const specs = await extractProductSpecs(base64, file.type);
      const imageSpecs: ImageSpec[] = specs.map(s => ({
        key: s.key,
        value: s.value,
        category: s.category
      }));

      setImages(prev => prev.map(img =>
        img.id === newImageId ? { ...img, specs: imageSpecs } : img
      ));

      // Diff if manual fields exist
      if (manualSourceFields.length > 0) {
        const diffs = await performSmartDiff(base64, manualSourceFields);
        setImages(prev => prev.map(img =>
          img.id === newImageId ? { ...img, diffs } : img
        ));
      }

      // 消耗配额
      await useQuotaFirebase(user.uid, 1);
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
            diffs: manualSourceFields.length > 0 ? await performSmartDiff(base64, manualSourceFields) : []
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

      const diagResult = await diagnoseImage(image.base64, image.file.type, (step) => {
        setProcessingStep(step);
      });

      setImages(prev => prev.map(img =>
        img.id === imageId ? {
          ...img,
          issues: diagResult.issues,
          description: diagResult.description,
          ocrText: diagResult.ocrText,
          deterministicIssues: diagResult.deterministicIssues
        } : img
      ));

      const specs = await extractProductSpecs(image.base64, image.file.type);
      const imageSpecs: ImageSpec[] = specs.map(s => ({
        key: s.key,
        value: s.value,
        category: s.category
      }));

      setImages(prev => prev.map(img =>
        img.id === imageId ? { ...img, specs: imageSpecs } : img
      ));

      if (manualSourceFields.length > 0) {
        const diffs = await performSmartDiff(image.base64, manualSourceFields);
        setImages(prev => prev.map(img =>
          img.id === imageId ? { ...img, diffs } : img
        ));
      }

      // 消耗配额
      await useQuotaFirebase(user.uid, 1);
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
            diffs: manualSourceFields.length > 0 ? await performSmartDiff(image.base64, manualSourceFields) : []
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

  const handleParseSource = useCallback(async (text: string) => {
    setIsProcessing(true);
    try {
      const fields = await parseSourceText(text);
      setManualSourceFields(fields);

      if (currentImage) {
        const diffs = await performSmartDiff(currentImage.base64, fields);
        setImages(prev => prev.map(img =>
          img.id === currentImage.id ? { ...img, diffs } : img
        ));
      }

      // 云同步 - 保存 QIL 数据
      if (cloudSyncEnabled && sessionId && user) {
        try {
          await saveQilToCloud(user.uid, sessionId, fields, text);
          console.log('QIL data synced to cloud');
        } catch (error) {
          console.error('Failed to sync QIL to cloud:', error);
        }
      }
    } catch (err) {
      setErrorMessage("Failed to parse source text.");
    } finally {
      setIsProcessing(false);
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
    setQilImages([]);
    setQilInputText('');
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

  // QIL 图片处理 - 支持多张
  const handleQilImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (qilImages.length >= 4) {
      setErrorMessage('QIL 最多支持 4 张图片');
      return;
    }
    const url = URL.createObjectURL(file);
    const base64 = await fileToGenerativePart(file);
    const newQilImage = {
      id: `qil-${Date.now()}`,
      src: url,
      base64,
      mimeType: file.type,
      parsed: false
    };
    setQilImages(prev => [...prev, newQilImage]);
    setQilInputMode('image');
  }, [qilImages.length]);

  // QIL 图片删除
  const handleRemoveQilImage = useCallback((id: string) => {
    setQilImages(prev => prev.filter(img => img.id !== id));
  }, []);

  // QIL 解析所有图片
  const handleParseAllQilImages = useCallback(async () => {
    const unparsedImages = qilImages.filter(img => !img.parsed);
    if (unparsedImages.length === 0) return;

    setIsParsingQil(true);
    setErrorMessage(null);

    try {
      let allFields: SourceField[] = [...manualSourceFields];

      for (const qilImg of unparsedImages) {
        setParsingQilId(qilImg.id);
        const fields = await parseQILImage(qilImg.base64, qilImg.mimeType);
        allFields = [...allFields, ...fields];
        setQilImages(prev => prev.map(img =>
          img.id === qilImg.id ? { ...img, parsed: true } : img
        ));
      }

      // 去重
      const uniqueFields = allFields.reduce((acc, field) => {
        if (!acc.find(f => f.key === field.key)) {
          acc.push(field);
        }
        return acc;
      }, [] as SourceField[]);

      setManualSourceFields(uniqueFields);
    } catch (error: any) {
      setErrorMessage(error.message || 'QIL 图片解析失败');
    } finally {
      setIsParsingQil(false);
      setParsingQilId(null);
    }
  }, [qilImages, manualSourceFields]);

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
            if (isQilFocused || qilInputMode === 'image') {
              handleQilImageFile(file);
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
  }, [processFile, qilInputMode, handleQilImageFile]);

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

      {/* TOP BAR */}
      <div className="h-12 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-4 shrink-0">
        {/* Left: Product Name */}
        <div className="flex items-center gap-3">
          {/* 产品名称 - 可编辑 */}
          <div className="flex items-center gap-2">
            {isEditingProductName ? (
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                onBlur={() => setIsEditingProductName(false)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditingProductName(false)}
                className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white w-40 focus:outline-none focus:border-slate-500"
                autoFocus
              />
            ) : (
              <button
                onClick={() => user && setIsEditingProductName(true)}
                className="text-sm font-medium text-white hover:text-slate-300 transition-colors flex items-center gap-1"
                title="点击编辑产品名称"
              >
                {productName}
                {user && <span className="text-slate-600 text-xs">✎</span>}
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
                  <div className="absolute top-full left-0 mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
                    <div className="p-2 border-b border-slate-700">
                      <button
                        onClick={() => {
                          setProductName('未命名产品');
                          setImages([]);
                          setManualSourceFields([]);
                          setQilInputText('');
                          setShowProductList(false);
                        }}
                        className="w-full px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 rounded flex items-center gap-2"
                      >
                        <ImagePlus size={12} />
                        新建产品
                      </button>
                    </div>
                    <div className="p-1 text-[10px] text-slate-500 text-center">
                      历史产品（开发中）
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 分隔线 */}
          <div className="h-5 w-px bg-slate-700" />

          {/* 云同步状态 */}
          {user && (
            <div className="flex items-center gap-1.5" title={cloudSyncEnabled ? '云同步已开启' : '云同步已关闭'}>
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

        {/* Center: Image Tools */}
        <div className="flex items-center gap-2">
          {/* 添加图片 */}
          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-900 text-xs font-medium rounded cursor-pointer transition-colors">
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
              <button onClick={() => { setImageScale(1); setImageRotation(0); }} className="p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white rounded transition-colors" title="重置">
                <Maximize2 size={14} />
              </button>
              <button onClick={() => setImageRotation(r => r - 90)} className="p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white rounded transition-colors" title="逆时针旋转">
                <RotateCcw size={14} />
              </button>
              <button onClick={() => setImageRotation(r => r + 90)} className="p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white rounded transition-colors" title="顺时针旋转">
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
        <div className="flex items-center gap-3">
          {/* Model Selector */}
          <div className="relative">
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
              <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 rounded text-[10px]">
                <span className="text-slate-500">额度</span>
                <span className="text-slate-300 font-medium tabular-nums">{user.quota - user.used}/{user.quota}</span>
              </div>

              {/* 用户头像 */}
              <div className="relative group">
                <button className="flex items-center gap-1.5 p-1 rounded hover:bg-slate-800 transition-all">
                  <div className="w-6 h-6 rounded-full bg-slate-700 overflow-hidden">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] font-medium text-slate-400">
                        {(user.displayName || user.email || 'U')[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <ChevronDown size={12} className="text-slate-500" />
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
      <div className="flex-1 flex min-h-0">
        {/* LEFT: Thumbnails */}
        <div className="w-[140px] border-r border-slate-800 bg-slate-950 p-2 overflow-y-auto shrink-0 flex flex-col">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            图片列表
          </div>
          <div className="space-y-2 flex-1">
            {images.map((img, idx) => (
              <div
                key={img.id}
                onClick={() => setCurrentImageIndex(idx)}
                className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                  currentImageIndex === idx ? 'border-indigo-500' : 'border-transparent hover:border-slate-600'
                }`}
              >
                <img src={img.src} alt="" className="w-full h-20 object-cover" />
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
              <div className="p-4 border-2 border-dashed border-slate-800 rounded-lg text-center">
                <ImagePlus size={20} className="mx-auto text-slate-700 mb-1" />
                <span className="text-[9px] text-slate-600">点击顶部按钮添加</span>
              </div>
            )}
          </div>
        </div>

        {/* CENTER: Image Viewer */}
        <div className="flex-1 relative bg-slate-900 overflow-hidden flex items-center justify-center">
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
                  transform: `scale(${imageScale}) rotate(${imageRotation}deg)`,
                  transition: 'transform 0.2s'
                }}
              >
                <div className="relative inline-block">
                  <img
                    src={currentImage.src}
                    alt="包装设计"
                    className={`block max-h-[60vh] ${isCurrentProcessing ? 'opacity-60' : ''}`}
                    draggable={false}
                    style={{ maxWidth: '100%', height: 'auto' }}
                  />

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

              {isCurrentProcessing && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-slate-900/90 backdrop-blur px-6 py-4 rounded-xl border border-indigo-500/50">
                    <div className="flex items-center gap-3 mb-3">
                      <Loader2 className="animate-spin text-indigo-400" size={20} />
                      <span className="text-sm font-medium">AI 分析中...</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white ${processingStep >= 1 ? 'bg-indigo-500' : 'bg-slate-700'}`}>1</div>
                      <span className={`text-xs ${processingStep >= 1 ? 'text-indigo-400' : 'text-slate-500'}`}>AI分析</span>
                      <div className={`w-8 h-0.5 ${processingStep > 1 ? 'bg-indigo-500' : 'bg-slate-700'}`}></div>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white ${processingStep >= 2 ? 'bg-indigo-500' : 'bg-slate-700'}`}>2</div>
                      <span className={`text-xs ${processingStep >= 2 ? 'text-indigo-400' : 'text-slate-500'}`}>规则检查</span>
                    </div>
                  </div>
                </div>
              )}
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
        <div className="w-[380px] border-l border-slate-800 bg-slate-900 flex flex-col">
          <div className="px-2 py-2 border-b border-slate-800 flex items-center gap-1 bg-slate-900">
            <button
              onClick={() => setRightPanelTab('issues')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                rightPanelTab === 'issues'
                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/50'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
              }`}
            >
              <AlertTriangle size={14} />
              检测问题
              {currentImage && (currentImage.issues.length + (currentImage.deterministicIssues?.length || 0)) > 0 && (
                <span className="bg-red-500 text-white text-[9px] px-1.5 rounded-full">
                  {currentImage.issues.length + (currentImage.deterministicIssues?.length || 0)}
                </span>
              )}
            </button>
            <button
              onClick={() => setRightPanelTab('ocr')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                rightPanelTab === 'ocr'
                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/50'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Type size={14} />
              OCR 原文
            </button>
            <button
              onClick={() => currentImage && handleRetryAnalysis(currentImage.id)}
              disabled={isCurrentProcessing || !currentImage}
              className="p-2 text-slate-500 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
              title="重新分析"
            >
              <RefreshCw size={14} className={isCurrentProcessing ? 'animate-spin' : ''} />
            </button>
          </div>

          {currentImage?.description && (
            <div className="px-4 py-2 border-b border-slate-800/50 bg-slate-800/30">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1">
                <FileText size={10} /> 图片描述
              </div>
              <p className="text-xs text-slate-300">{currentImage.description}</p>
            </div>
          )}

          <div ref={issueListRef} className="flex-1 overflow-y-auto">
            {!currentImage ? (
              <div className="text-center py-12 text-slate-600">
                <AlertCircle size={24} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">上传图片后显示检测结果</p>
              </div>
            ) : isCurrentProcessing ? (
              <div className="text-center py-12 text-slate-500">
                <Loader2 size={24} className="mx-auto mb-2 animate-spin" />
                <p className="text-xs">正在分析...</p>
              </div>
            ) : rightPanelTab === 'ocr' ? (
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">识别文字</span>
                  <button
                    onClick={() => currentImage.ocrText && handleCopy(currentImage.ocrText, 'ocr-text')}
                    className="p-1 rounded hover:bg-slate-800 transition-colors"
                    title="复制全部"
                  >
                    {copiedId === 'ocr-text' ? <CheckCheck size={12} className="text-emerald-400" /> : <Copy size={12} className="text-slate-500" />}
                  </button>
                </div>
                {currentImage.ocrText ? (
                  <pre className="text-xs text-slate-300 font-mono bg-slate-800/50 p-3 rounded-lg whitespace-pre-wrap leading-relaxed border border-slate-700/50 max-h-[500px] overflow-y-auto">
                    {currentImage.ocrText}
                  </pre>
                ) : (
                  <div className="text-center py-8 text-slate-600">
                    <Type size={24} className="mx-auto mb-2 opacity-30" />
                    <p className="text-xs">暂无 OCR 数据</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 space-y-3">
                {currentImage.deterministicIssues && currentImage.deterministicIssues.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-red-400 uppercase tracking-wider">
                      <Brackets size={12} />
                      确定性问题（100%准确）
                    </div>
                    {currentImage.deterministicIssues.map((issue) => (
                      <div key={issue.id} className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                            {issue.type === 'bracket_mismatch' ? '括号不配对' : issue.type === 'encoding_error' ? '编码错误' : '格式错误'}
                          </span>
                        </div>
                        <p className="text-xs text-red-300 mb-1.5">{issue.description}</p>
                        <div className="text-[10px] text-slate-400 font-mono bg-slate-900/50 px-2 py-1.5 rounded">
                          {issue.location}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {currentImage.issues.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                      <ShieldAlert size={12} />
                      AI 建议（需人工确认）
                    </div>
                    {currentImage.issues.map((issue) => {
                      const displayOriginal = issue.original || issue.text || '';
                      const displayProblem = issue.problem || '';
                      const copyText = `原文: ${displayOriginal}\n问题: ${displayProblem}\n建议: ${issue.suggestion}`;

                      const renderOriginal = (text: string) => {
                        const parts = text.split(/(\*\*[^*]+\*\*)/g);
                        return parts.map((part, i) => {
                          if (part.startsWith('**') && part.endsWith('**')) {
                            const word = part.slice(2, -2);
                            return <span key={i} className="bg-red-500/30 text-red-300 px-0.5 rounded font-bold">{word}</span>;
                          }
                          return <span key={i}>{part}</span>;
                        });
                      };

                      return (
                        <div
                          key={issue.id}
                          data-issue-id={issue.id}
                          onClick={() => setSelectedIssueId(issue.id)}
                          className={`p-3 rounded-lg cursor-pointer transition-all group ${
                            selectedIssueId === issue.id
                              ? 'bg-indigo-500/20 border border-indigo-500/50 ring-2 ring-indigo-500/30'
                              : 'bg-slate-800/50 border border-transparent hover:bg-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${
                              issue.severity === 'high' ? 'bg-red-500' : issue.severity === 'medium' ? 'bg-amber-500' : 'bg-slate-500'
                            }`}></span>
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              issue.severity === 'high'
                                ? 'bg-red-500/20 text-red-400'
                                : issue.severity === 'medium'
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'bg-slate-500/20 text-slate-400'
                            }`}>
                              {issue.severity === 'high' ? '紧急' : issue.severity === 'medium' ? '警告' : '提示'}
                            </span>
                            <span className="text-[8px] text-slate-600 ml-auto">AI建议</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCopy(copyText, issue.id); }}
                              className="p-1 rounded hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"
                              title="复制"
                            >
                              {copiedId === issue.id ? <CheckCheck size={12} className="text-emerald-400" /> : <Copy size={12} className="text-slate-500" />}
                            </button>
                          </div>

                          <div className="mb-2">
                            <span className="text-[10px] text-slate-500">原文：</span>
                            <div className="text-xs text-slate-300 font-mono bg-slate-800/50 px-2 py-1.5 rounded mt-1 leading-relaxed">
                              {renderOriginal(displayOriginal)}
                            </div>
                          </div>

                          {displayProblem && (
                            <p className="text-xs text-slate-300 mb-1.5">{displayProblem}</p>
                          )}

                          {issue.suggestion && (
                            <div className="flex items-start gap-1.5 text-[11px] text-emerald-400/90 bg-emerald-500/10 px-2 py-1.5 rounded">
                              <span className="shrink-0">💡</span>
                              <span>{issue.suggestion}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {currentImage.issues.length === 0 && (!currentImage.deterministicIssues || currentImage.deterministicIssues.length === 0) && (
                  <div className="text-center py-12 text-slate-600">
                    <CheckCircle size={24} className="mx-auto mb-2 text-emerald-500/50" />
                    <p className="text-xs">未检测到问题</p>
                    <p className="text-[10px] text-slate-700 mt-1">建议查看 OCR 原文自行核对</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div style={{ height: bottomHeight }} className="border-t border-slate-800 bg-slate-950 flex flex-col shrink-0 relative">
        <div
          onMouseDown={handleResizeStart}
          className={`absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-indigo-500/50 transition-colors ${isResizing ? 'bg-indigo-500/50' : ''}`}
        />

        <div className="flex-1 flex min-h-0 pt-1">
          {/* QIL Input */}
          <div className="w-[320px] border-r border-slate-800 p-3 flex flex-col">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Table size={12} className="text-indigo-400" />
              QIL 源数据
            </div>

            <div className="flex gap-1 mb-2 bg-slate-900 p-0.5 rounded">
              <button
                onClick={() => setQilInputMode('text')}
                className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] transition-all ${
                  qilInputMode === 'text' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <ClipboardCheck size={10} /> 文本
              </button>
              <button
                onClick={() => setQilInputMode('image')}
                className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] transition-all ${
                  qilInputMode === 'image' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Image size={10} /> 图片
              </button>
            </div>

            {qilInputMode === 'text' ? (
              <div className="flex-1 relative">
                <textarea
                  className="w-full h-full bg-slate-900 border border-slate-800 rounded p-2 text-[11px] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-mono"
                  placeholder="粘贴 QIL 表格数据..."
                  value={qilInputText}
                  onChange={(e) => setQilInputText(e.target.value)}
                />
                <button
                  onClick={() => handleParseSource(qilInputText)}
                  disabled={!qilInputText.trim() || isProcessing}
                  className="absolute bottom-2 right-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[10px] px-2 py-1 rounded flex items-center gap-1"
                >
                  <Search size={10} /> 解析
                </button>
              </div>
            ) : (
              <div
                ref={qilDropRef}
                className="qil-input-area flex-1 bg-slate-900 border-2 border-dashed border-slate-700 rounded flex flex-col cursor-pointer hover:border-indigo-500/50 transition-colors relative overflow-hidden"
                tabIndex={0}
                onClick={() => {
                  if (qilImages.length < 4) {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) handleQilImageFile(file);
                    };
                    input.click();
                  }
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleQilImageFile(file);
                }}
              >
                {qilImages.length > 0 ? (
                  <div className="flex-1 p-2 overflow-auto">
                    <div className="grid grid-cols-2 gap-2">
                      {qilImages.map((qilImg) => (
                        <div key={qilImg.id} className="relative group">
                          <img src={qilImg.src} alt="QIL" className="w-full h-24 object-cover rounded border border-slate-700" />
                          {qilImg.parsed && (
                            <div className="absolute top-1 left-1 bg-emerald-500/80 text-white text-[8px] px-1 rounded">
                              已解析
                            </div>
                          )}
                          {parsingQilId === qilImg.id && (
                            <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center rounded">
                              <Loader2 size={16} className="animate-spin text-indigo-400" />
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveQilImage(qilImg.id);
                            }}
                            className="absolute top-1 right-1 p-0.5 bg-red-500/80 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <XCircle size={10} className="text-white" />
                          </button>
                        </div>
                      ))}
                      {qilImages.length < 4 && (
                        <div className="h-24 border-2 border-dashed border-slate-700 rounded flex flex-col items-center justify-center text-slate-600 hover:border-indigo-500/50 hover:text-slate-500 transition-colors">
                          <ImagePlus size={16} />
                          <span className="text-[9px] mt-1">添加</span>
                        </div>
                      )}
                    </div>
                    {qilImages.some(img => !img.parsed) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleParseAllQilImages();
                        }}
                        disabled={isParsingQil}
                        className="mt-2 w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded text-[10px] flex items-center justify-center gap-1"
                      >
                        {isParsingQil ? <Loader2 size={10} className="animate-spin" /> : <Search size={10} />}
                        {isParsingQil ? '解析中...' : `解析 ${qilImages.filter(img => !img.parsed).length} 张图片`}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <Upload size={20} className="text-slate-600 mb-1" />
                    <span className="text-[10px] text-slate-600">Ctrl+V 粘贴 QIL 截图</span>
                    <span className="text-[9px] text-slate-700 mt-1">或点击/拖拽上传（最多4张）</span>
                  </div>
                )}
              </div>
            )}

            {manualSourceFields.length > 0 && (
              <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-400">
                <FileSpreadsheet size={10} />
                已解析 {manualSourceFields.length} 个字段
              </div>
            )}
          </div>

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
                  图片{idx + 1} ({img.specs?.length || 0})
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
                manualSourceFields.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-700">
                    <Table size={24} className="mb-2 opacity-30" />
                    <span className="text-xs">暂无 QIL 数据</span>
                    <span className="text-[10px] text-slate-600 mt-1">左侧输入文本或上传图片后解析</span>
                  </div>
                ) : (
                  <table className="w-full text-[11px]">
                    <thead className="bg-slate-800 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 text-slate-500 font-medium">分类</th>
                        <th className="text-left px-3 py-2 text-slate-500 font-medium">项目</th>
                        <th className="text-left px-3 py-2 text-slate-500 font-medium">值</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {manualSourceFields.map((field, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30">
                          <td className="px-3 py-2 text-slate-500">{field.category}</td>
                          <td className="px-3 py-2 text-slate-300 font-medium">{field.key}</td>
                          <td className="px-3 py-2 text-slate-400 font-mono">{field.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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

                  return (
                    <div className="flex flex-col h-full">
                      <div className={`px-3 py-2 mb-2 rounded flex items-center justify-between ${
                        allPass ? 'bg-emerald-500/10' : errorCount > 0 ? 'bg-red-500/10' : 'bg-amber-500/10'
                      }`}>
                        <span className={`text-xs font-bold ${
                          allPass ? 'text-emerald-400' : errorCount > 0 ? 'text-red-400' : 'text-amber-400'
                        }`}>
                          {allPass ? '✓ 全部通过' : errorCount > 0 ? `✗ ${errorCount} 处差异` : `⚠ ${warningCount} 处警告`}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {matchCount}匹配 / {warningCount}警告 / {errorCount}差异
                        </span>
                      </div>

                      <div className="flex-1 overflow-auto">
                        <table className="w-full text-[11px]">
                          <thead className="bg-slate-800 sticky top-0">
                            <tr>
                              <th className="text-left px-2 py-1.5 text-slate-500 w-24">字段</th>
                              <th className="text-left px-2 py-1.5 text-indigo-400">QIL</th>
                              <th className="text-left px-2 py-1.5 text-emerald-400">图片</th>
                              <th className="w-8"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedResults.map(({ field, imageResults, hasError, hasWarning }, idx) => (
                              <tr key={idx} className={`border-b border-slate-800/50 ${
                                hasError ? 'bg-red-500/5' : hasWarning ? 'bg-amber-500/5' : ''
                              }`}>
                                <td className="px-2 py-2 align-top">
                                  <div className="flex items-center gap-1">
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                      hasError ? 'bg-red-500' : hasWarning ? 'bg-amber-500' : 'bg-emerald-500'
                                    }`}></span>
                                    <span className="text-slate-300 truncate" title={field.key}>{field.key}</span>
                                  </div>
                                </td>
                                <td className="px-2 py-2 align-top">
                                  <div
                                    className="text-indigo-300 font-mono text-[10px] cursor-pointer hover:bg-slate-800 px-1 py-0.5 rounded -mx-1"
                                    onClick={() => handleCopy(field.value, `qil-${idx}`)}
                                    title="点击复制"
                                  >
                                    {field.value}
                                    {copiedId === `qil-${idx}` && <CheckCheck size={10} className="inline ml-1 text-emerald-400" />}
                                  </div>
                                </td>
                                <td className="px-2 py-2 align-top">
                                  {imageResults.map((result, imgIdx) => (
                                    <div
                                      key={imgIdx}
                                      className={`font-mono text-[10px] cursor-pointer hover:bg-slate-800 px-1 py-0.5 rounded -mx-1 ${
                                        result.status === 'match' ? 'text-emerald-300' :
                                        result.status === 'warning' ? 'text-amber-300' :
                                        result.status === 'error' ? 'text-red-300' : 'text-slate-500'
                                      }`}
                                      onClick={() => handleCopy(result.value, `img-${idx}-${imgIdx}`)}
                                      title="点击复制"
                                    >
                                      {result.value}
                                      {copiedId === `img-${idx}-${imgIdx}` && <CheckCheck size={10} className="inline ml-1 text-emerald-400" />}
                                    </div>
                                  ))}
                                </td>
                                <td className="px-2 py-2 align-top text-center">
                                  {hasError ? <XCircle size={12} className="text-red-400" /> :
                                   hasWarning ? <AlertTriangle size={12} className="text-amber-400" /> :
                                   <CheckCircle size={12} className="text-emerald-400" />}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()
              ) : (
                (() => {
                  const currentSpecs = images.find(img => img.id === specsTab)?.specs || [];

                  if (currentSpecs.length === 0) {
                    return (
                      <div className="h-full flex flex-col items-center justify-center text-slate-700">
                        <Table size={24} className="mb-2 opacity-30" />
                        <span className="text-xs">暂无规格数据</span>
                        <span className="text-[10px] text-slate-600 mt-1">图片分析后自动提取</span>
                      </div>
                    );
                  }

                  return (
                    <table className="w-full text-[11px]">
                      <thead className="bg-slate-800 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 text-slate-500 font-medium">分类</th>
                          <th className="text-left px-3 py-2 text-slate-500 font-medium">项目</th>
                          <th className="text-left px-3 py-2 text-slate-500 font-medium">值</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {currentSpecs.map((spec: ImageSpec, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-800/30">
                            <td className="px-3 py-2 text-slate-500">{spec.category}</td>
                            <td className="px-3 py-2 text-slate-300 font-medium">{spec.key}</td>
                            <td className="px-3 py-2 text-slate-400 font-mono">{spec.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()
              )}
            </div>
          </div>
        </div>
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
