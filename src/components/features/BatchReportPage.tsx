import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, X, FileText, Clock, CheckCircle, AlertCircle, Eye, Play } from 'lucide-react';
import { listBatchReports, createBatchReport, uploadImageToBatchReport, updateBatchReportImage, updateBatchReportStatus, BatchReport, useQuota, getBatchReport, getBatchReportImageData } from '../../services/cloudflare';
import { analyzeImageWithCustomPrompt, runDeterministicChecks } from '../../services/openaiService';

interface BatchReportPageProps {
  onBack: () => void;
  onViewReport: (reportId: string) => void;
}

const statusConfig = {
  pending: { icon: Clock, label: '等待中', color: 'text-text-muted' },
  processing: { icon: Loader2, label: '生成中', color: 'text-blue-500', spin: true },
  completed: { icon: CheckCircle, label: '已完成', color: 'text-green-500' },
  failed: { icon: AlertCircle, label: '失败', color: 'text-red-500' }
};

export const BatchReportPage: React.FC<BatchReportPageProps> = ({ onBack, onViewReport }) => {
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [reports, setReports] = useState<BatchReport[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  const [resumingReportId, setResumingReportId] = useState<string | null>(null);
  const analyzingRef = useRef(false);

  useEffect(() => {
    loadReports();
  }, []);

  // 页面加载时自动恢复 processing 状态的报告
  useEffect(() => {
    if (!isLoadingReports && reports.length > 0 && !analyzingRef.current) {
      const processingReport = reports.find(r => r.status === 'processing');
      if (processingReport) {
        resumeAnalysis(processingReport.id);
      }
    }
  }, [isLoadingReports, reports]);

  const loadReports = async () => {
    setIsLoadingReports(true);
    const data = await listBatchReports();
    setReports(data);
    setIsLoadingReports(false);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    setUploadedImages(prev => [...prev, ...files]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
      setUploadedImages(prev => [...prev, ...files]);
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  // 将文件转为 base64
  const fileToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1];
        resolve({ base64, mimeType: file.type });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // 恢复分析（刷新页面后继续）
  const resumeAnalysis = async (reportId: string) => {
    if (analyzingRef.current) return;
    analyzingRef.current = true;
    setResumingReportId(reportId);
    setIsAnalyzing(true);

    try {
      const { report, images } = await getBatchReport(reportId);
      if (!report) return;

      // 找出 pending 状态的图片
      const pendingImages = images.filter((img: any) => img.status === 'pending');
      if (pendingImages.length === 0) {
        // 没有待处理的图片，标记为完成
        await updateBatchReportStatus(reportId, 'completed', images.length);
        await loadReports();
        return;
      }

      setProgress({ current: 0, total: pendingImages.length });

      // 并行分析所有 pending 图片
      let completed = 0;
      const analyzePromises = pendingImages.map(async (img: any) => {
        try {
          // 从后端获取图片数据
          const imageData = await getBatchReportImageData(reportId, img.imageId);
          if (!imageData) throw new Error('无法获取图片数据');

          const aiResult = await analyzeImageWithCustomPrompt(imageData.base64, imageData.mimeType, '', false);
          const deterministicIssues = runDeterministicChecks(aiResult.ocrText);

          const result = {
            description: aiResult.description,
            ocrText: aiResult.ocrText,
            issues: aiResult.issues,
            deterministicIssues,
            specs: aiResult.specs,
            tokenUsage: aiResult.tokenUsage
          };

          await updateBatchReportImage(reportId, img.imageId, 'completed', result);
          await useQuota('batch_analysis', `image_${img.imageId}`, 1);
        } catch (error) {
          await updateBatchReportImage(reportId, img.imageId, 'failed', { error: error instanceof Error ? error.message : 'Unknown error' });
        }
        completed++;
        setProgress({ current: completed, total: pendingImages.length });
      });

      await Promise.all(analyzePromises);

      // 更新报告状态为 completed
      await updateBatchReportStatus(reportId, 'completed', images.length);
      await loadReports();
    } finally {
      setIsAnalyzing(false);
      setResumingReportId(null);
      analyzingRef.current = false;
    }
  };

  const startAnalysis = async () => {
    if (uploadedImages.length === 0) return;
    setIsAnalyzing(true);
    setProgress({ current: 0, total: uploadedImages.length * 2 }); // 上传 + 分析

    const reportName = `批量报告 ${new Date().toLocaleString('zh-CN')}`;
    const report = await createBatchReport(reportName);

    if (report) {
      const uploadedItems: Array<{ imageId: string; file: File }> = [];

      // 1. 上传所有图片
      for (let i = 0; i < uploadedImages.length; i++) {
        const imageId = await uploadImageToBatchReport(report.id, uploadedImages[i]);
        if (imageId) uploadedItems.push({ imageId, file: uploadedImages[i] });
        setProgress({ current: i + 1, total: uploadedImages.length * 2 });
      }

      // 2. 更新报告状态为 processing
      await updateBatchReportStatus(report.id, 'processing', 0);

      // 3. 并行分析所有图片（前端调用 AI）
      let completed = 0;
      const analyzePromises = uploadedItems.map(async ({ imageId, file }) => {
        try {
          const { base64, mimeType } = await fileToBase64(file);
          const aiResult = await analyzeImageWithCustomPrompt(base64, mimeType, '', false);
          const deterministicIssues = runDeterministicChecks(aiResult.ocrText);

          const result = {
            description: aiResult.description,
            ocrText: aiResult.ocrText,
            issues: aiResult.issues,
            deterministicIssues,
            specs: aiResult.specs,
            tokenUsage: aiResult.tokenUsage
          };

          await updateBatchReportImage(report.id, imageId, 'completed', result);
          // 扣减额度
          await useQuota('batch_analysis', file.name, 1);
        } catch (error) {
          await updateBatchReportImage(report.id, imageId, 'failed', { error: error instanceof Error ? error.message : 'Unknown error' });
        }
        completed++;
        setProgress({ current: uploadedImages.length + completed, total: uploadedImages.length * 2 });
      });

      await Promise.all(analyzePromises);

      // 4. 更新报告状态为 completed
      await updateBatchReportStatus(report.id, 'completed', uploadedItems.length);

      await loadReports();
      setUploadedImages([]);
    }
    setIsAnalyzing(false);
  };

  return (
    <div className="flex-1 flex bg-surface-50 overflow-hidden">
      {/* 左侧：上传区域 */}
      <div className="w-1/2 border-r border-border p-6 overflow-y-auto">
        <h3 className="text-sm font-medium text-text-primary mb-4">上传图片</h3>

        <label
          htmlFor="batch-upload"
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          className={`block py-16 border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors ${
            isDragging ? 'border-blue-400 bg-blue-50' : 'border-surface-200 hover:border-surface-300 hover:bg-surface-0'
          }`}
        >
          <input type="file" multiple accept="image/*" onChange={handleFileSelect} className="hidden" id="batch-upload" />
          <div className="text-4xl mb-2">📤</div>
          <p className="text-text-muted text-sm">拖拽图片到此处</p>
          <p className="text-text-muted text-xs mt-1">或点击选择文件</p>
        </label>

        {uploadedImages.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-text-secondary">已选择 {uploadedImages.length} 张图片</span>
              <button
                onClick={startAnalysis}
                disabled={isAnalyzing}
                className="px-4 py-2 text-sm bg-text-primary text-white rounded-lg hover:bg-text-secondary disabled:opacity-50 transition-colors"
              >
                {isAnalyzing ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    {progress.current}/{progress.total}
                  </span>
                ) : '开始分析'}
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 max-h-[400px] overflow-y-auto">
              {uploadedImages.map((file, idx) => (
                <div key={idx} className="relative group aspect-square">
                  <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover rounded-lg" />
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 右侧：报告列表 */}
      <div className="w-1/2 p-6 overflow-y-auto">
        <h3 className="text-sm font-medium text-text-primary mb-4">报告列表</h3>

        {isLoadingReports ? (
          <div className="py-12 text-center">
            <Loader2 size={24} className="animate-spin text-text-muted mx-auto" />
          </div>
        ) : reports.length === 0 ? (
          <div className="py-12 text-center">
            <FileText size={40} className="text-surface-200 mx-auto mb-3" />
            <p className="text-sm text-text-muted">暂无报告</p>
            <p className="text-xs text-text-muted mt-1">上传图片开始分析</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map(report => {
              const status = statusConfig[report.status];
              const StatusIcon = status.icon;
              return (
                <div
                  key={report.id}
                  className="p-4 bg-surface-0 border border-border rounded-lg hover:border-surface-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{report.name}</p>
                      <p className="text-xs text-text-muted mt-1">
                        {new Date(report.createdAt).toLocaleString('zh-CN')}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-text-muted">
                          {report.totalImages} 张图片
                        </span>
                        <span className={`flex items-center gap-1 text-xs ${status.color}`}>
                          <StatusIcon size={12} className={status.spin ? 'animate-spin' : ''} />
                          {status.label}
                          {report.status === 'processing' && ` ${report.processedImages}/${report.totalImages}`}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => onViewReport(report.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-100 rounded transition-colors"
                    >
                      <Eye size={14} />
                      查看
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
