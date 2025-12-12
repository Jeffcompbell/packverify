import { useState, useCallback } from 'react';
import imageCompression from 'browser-image-compression';
import { diagnoseImage, fileToGenerativePart, localDiffSpecs, getModelId, setModelId, extractOcrOnly } from '../services/openaiService';
import { useQuotaFirebase, getUserData, saveImageToCloud, updateImageInCloud, UserData } from '../services/cloudflare';
import { ImageItem, ImageSpec, SourceField, DiffResult, IndustryType } from '../types/types';

interface UseImageAnalysisProps {
  user: UserData | null;
  sessionId: string | null;
  cloudSyncEnabled: boolean;
  industry: IndustryType;
  manualSourceFields: SourceField[];
  onShowLogin: () => void;
  onError: (msg: string | null) => void;
  onUserUpdate: (user: UserData) => void;
}

interface UseImageAnalysisReturn {
  isProcessing: boolean;
  processingImageId: string | null;
  processingModelId: string | null;
  processingStep: number;
  streamText: string;
  isSyncing: boolean;
  processFile: (file: File, images: ImageItem[], currentModel: string, existingImageId?: string) => Promise<ImageItem | null>;
  retryAnalysis: (image: ImageItem, images: ImageItem[]) => Promise<void>;
  addModelAnalysis: (image: ImageItem, modelId: string) => Promise<Record<string, any> | null>;
}

export function useImageAnalysis({
  user, sessionId, cloudSyncEnabled, industry, manualSourceFields,
  onShowLogin, onError, onUserUpdate
}: UseImageAnalysisProps): UseImageAnalysisReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingImageId, setProcessingImageId] = useState<string | null>(null);
  const [processingModelId, setProcessingModelId] = useState<string | null>(null);
  const [processingStep, setProcessingStep] = useState(1);
  const [streamText, setStreamText] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const processFile = useCallback(async (file: File, images: ImageItem[], currentModel: string, existingImageId?: string): Promise<ImageItem | null> => {
    if (!user) { onShowLogin(); return null; }

    const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
    if (!file.type.startsWith('image/') && !isHeic) {
      onError("请上传图片文件");
      return null;
    }
    if (images.length >= 30) {
      onError("每个产品最多支持 30 张图片");
      return null;
    }
    if (user.used >= user.quota) {
      onError(`配额已用完（${user.used}/${user.quota}），请联系管理员`);
      return null;
    }

    const newImageId = existingImageId || `img-${Date.now()}`;
    let processedFile = file;

    try {
      const maxSizeMB = 10;
      const fileSizeMB = file.size / 1024 / 1024;

      if (isHeic || file.type === 'image/heic' || file.type === 'image/heif' || fileSizeMB > maxSizeMB) {
        onError(isHeic ? '正在转换 HEIC 格式...' : `正在压缩图片...`);
        try {
          processedFile = await imageCompression(file, {
            maxSizeMB, maxWidthOrHeight: 4096, useWebWorker: true,
            fileType: 'image/jpeg', initialQuality: 0.9
          });
          onError(null);
        } catch {
          onError(isHeic ? 'HEIC 格式转换失败' : '图片压缩失败');
          return null;
        }
      }

      const url = URL.createObjectURL(processedFile);
      const base64 = await fileToGenerativePart(processedFile);

      const newImage: ImageItem = {
        id: newImageId, src: url, base64, file: processedFile,
        specs: [], issues: [], diffs: [], issuesByModel: {}
      };

      setIsProcessing(true);
      setProcessingImageId(newImageId);
      setProcessingModelId(currentModel);
      setStreamText('');
      onError(null);

      let diagResult;
      let retryCount = 0;
      while (retryCount <= 1) {
        try {
          diagResult = await Promise.race([
            diagnoseImage(base64, file.type, setProcessingStep, industry, false, (chunk) => setStreamText(prev => prev + chunk)),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('分析超时')), 60000))
          ]);
          break;
        } catch (error: any) {
          retryCount++;
          if (error.message !== '分析超时' || retryCount > 1) throw error;
        }
      }

      if (!diagResult) throw new Error('分析失败');

      const imageSpecs: ImageSpec[] = diagResult.specs.map(s => ({ key: s.key, value: s.value, category: s.category }));
      const usedModelId = getModelId();
      let diffs: DiffResult[] = [];
      if (manualSourceFields.length > 0) {
        diffs = localDiffSpecs(manualSourceFields, imageSpecs);
      }

      const finalImage: ImageItem = {
        ...newImage,
        issues: diagResult.issues,
        description: diagResult.description,
        ocrText: diagResult.ocrText,
        deterministicIssues: diagResult.deterministicIssues,
        specs: imageSpecs,
        diffs,
        issuesByModel: { [usedModelId]: { issues: diagResult.issues, deterministicIssues: diagResult.deterministicIssues, lexiconIssues: diagResult.lexiconIssues } }
      };

      // 消耗配额
      const tokenUsage = diagResult.tokenUsage ? {
        promptTokens: diagResult.tokenUsage.promptTokens,
        completionTokens: diagResult.tokenUsage.completionTokens,
        totalTokens: diagResult.tokenUsage.totalTokens,
        model: diagResult.tokenUsage.model
      } : undefined;
      await useQuotaFirebase(user.uid, 1, file.name, 'analyze', tokenUsage);
      const updatedUser = await getUserData(user.uid);
      if (updatedUser) onUserUpdate(updatedUser);

      // 异步云同步
      if (cloudSyncEnabled && sessionId) {
        (async () => {
          try {
            setIsSyncing(true);
            await saveImageToCloud(user.uid, sessionId, finalImage);
            await updateImageInCloud(user.uid, sessionId, newImageId, {
              description: diagResult.description, ocrText: diagResult.ocrText,
              specs: imageSpecs, issues: diagResult.issues,
              deterministicIssues: diagResult.deterministicIssues, diffs
            });
          } catch (e) { console.error('Cloud sync failed:', e); }
          finally { setIsSyncing(false); }
        })();
      }

      return finalImage;
    } catch (error: any) {
      if (error.message === '分析超时') {
        onError("⏱️ 检测超时，请重试");
        return { id: newImageId, src: URL.createObjectURL(processedFile), base64: '', file: processedFile,
          description: '⏱️ 检测超时', ocrText: '分析超时，请重试', specs: [], issues: [], diffs: [], issuesByModel: {} };
      }
      onError(error.message || "图片处理失败");
      return null;
    } finally {
      setIsProcessing(false);
      setProcessingImageId(null);
      setProcessingModelId(null);
    }
  }, [user, sessionId, cloudSyncEnabled, industry, manualSourceFields, onShowLogin, onError, onUserUpdate]);

  const retryAnalysis = useCallback(async (image: ImageItem, images: ImageItem[]) => {
    if (!user) { onShowLogin(); return; }
    if (user.used >= user.quota) {
      onError(`配额已用完（${user.used}/${user.quota}）`);
      return;
    }

    try {
      const usedModelId = getModelId();
      setIsProcessing(true);
      setProcessingImageId(image.id);
      setProcessingModelId(usedModelId);
      onError(null);

      let diagResult;
      let retryCount = 0;
      while (retryCount <= 1) {
        try {
          diagResult = await Promise.race([
            diagnoseImage(image.base64, image.file.type, setProcessingStep, industry, manualSourceFields.length > 0),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('分析超时')), 60000))
          ]);
          break;
        } catch (error: any) {
          retryCount++;
          if (error.message !== '分析超时' || retryCount > 1) throw error;
        }
      }

      if (!diagResult) throw new Error('重新分析失败');

      const imageSpecs: ImageSpec[] = diagResult.specs.map(s => ({ key: s.key, value: s.value, category: s.category }));
      let diffs: DiffResult[] = [];
      if (manualSourceFields.length > 0) {
        diffs = localDiffSpecs(manualSourceFields, imageSpecs);
      }

      // 返回更新后的数据，由调用方更新 state
      const tokenUsage = diagResult.tokenUsage ? {
        promptTokens: diagResult.tokenUsage.promptTokens,
        completionTokens: diagResult.tokenUsage.completionTokens,
        totalTokens: diagResult.tokenUsage.totalTokens,
        model: diagResult.tokenUsage.model
      } : undefined;
      await useQuotaFirebase(user.uid, 1, image.file.name, 'retry', tokenUsage);
      const updatedUser = await getUserData(user.uid);
      if (updatedUser) onUserUpdate(updatedUser);

      if (cloudSyncEnabled && sessionId) {
        const newIssuesByModel = {
          ...image.issuesByModel,
          [usedModelId]: { issues: diagResult.issues, deterministicIssues: diagResult.deterministicIssues, lexiconIssues: diagResult.lexiconIssues }
        };
        (async () => {
          try {
            await updateImageInCloud(user.uid, sessionId, image.id, {
              description: diagResult.description, ocrText: diagResult.ocrText,
              specs: imageSpecs, issues: diagResult.issues,
              deterministicIssues: diagResult.deterministicIssues, diffs, issuesByModel: newIssuesByModel
            });
          } catch (e) { console.error('Cloud sync failed:', e); }
        })();
      }
    } catch (error: any) {
      if (error.message === '分析超时') {
        onError("⏱️ 检测超时，请稍后再试");
      } else {
        onError(error.message || "重新分析失败");
      }
    } finally {
      setIsProcessing(false);
      setProcessingImageId(null);
      setProcessingModelId(null);
    }
  }, [user, sessionId, cloudSyncEnabled, industry, manualSourceFields, onShowLogin, onError, onUserUpdate]);

  const addModelAnalysis = useCallback(async (image: ImageItem, modelId: string): Promise<Record<string, any> | null> => {
    if (!user) { onShowLogin(); return null; }
    if (user.used >= user.quota) {
      onError(`配额已用完（${user.used}/${user.quota}）`);
      return null;
    }

    try {
      setIsProcessing(true);
      setProcessingImageId(image.id);
      setProcessingModelId(modelId);
      onError(null);

      const previousModel = getModelId();
      setModelId(modelId);

      const diagResult = await diagnoseImage(image.base64, image.file.type, setProcessingStep, industry, manualSourceFields.length > 0);
      setModelId(previousModel);

      const newIssuesByModel = {
        ...image.issuesByModel,
        [modelId]: { issues: diagResult.issues, deterministicIssues: diagResult.deterministicIssues, lexiconIssues: diagResult.lexiconIssues }
      };

      const tokenUsage = diagResult.tokenUsage ? {
        promptTokens: diagResult.tokenUsage.promptTokens,
        completionTokens: diagResult.tokenUsage.completionTokens,
        totalTokens: diagResult.tokenUsage.totalTokens,
        model: diagResult.tokenUsage.model
      } : undefined;
      await useQuotaFirebase(user.uid, 1, image.file.name, 'analyze', tokenUsage);
      const updatedUser = await getUserData(user.uid);
      if (updatedUser) onUserUpdate(updatedUser);

      if (cloudSyncEnabled && sessionId) {
        try {
          await updateImageInCloud(user.uid, sessionId, image.id, { issuesByModel: newIssuesByModel });
        } catch (e) { console.error('Cloud sync failed:', e); }
      }

      return newIssuesByModel;
    } catch (error: any) {
      onError(error.message || "模型分析失败");
      return null;
    } finally {
      setIsProcessing(false);
      setProcessingImageId(null);
      setProcessingModelId(null);
    }
  }, [user, sessionId, cloudSyncEnabled, industry, manualSourceFields, onShowLogin, onError, onUserUpdate]);

  return {
    isProcessing, processingImageId, processingModelId, processingStep, streamText, isSyncing,
    processFile, retryAnalysis, addModelAnalysis
  };
}
