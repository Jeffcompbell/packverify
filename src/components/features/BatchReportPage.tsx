import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, X, FileText, Clock, CheckCircle, AlertCircle, Eye } from 'lucide-react';
import { listBatchReports, createBatchReport, uploadImageToBatchReport, analyzeBatchWithCustomPrompt, updateBatchReportStatus, BatchReport } from '../../services/cloudflare';

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

  useEffect(() => {
    loadReports();
  }, []);

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

  const startAnalysis = async () => {
    if (uploadedImages.length === 0) return;
    setIsAnalyzing(true);
    setProgress({ current: 0, total: uploadedImages.length });

    const reportName = `批量报告 ${new Date().toLocaleString('zh-CN')}`;
    const report = await createBatchReport(reportName);

    if (report) {
      const imageIds: string[] = [];

      // 1. 上传所有图片
      for (let i = 0; i < uploadedImages.length; i++) {
        const imageId = await uploadImageToBatchReport(report.id, uploadedImages[i]);
        if (imageId) imageIds.push(imageId);
        setProgress({ current: i + 1, total: uploadedImages.length });
      }

      // 2. 触发批量分析（后台处理）
      if (imageIds.length > 0) {
        const defaultPrompt = '请分析这张图片，检查是否存在文字错误、排版问题或其他质量问题。';
        await analyzeBatchWithCustomPrompt(report.id, imageIds, defaultPrompt);
      }

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
