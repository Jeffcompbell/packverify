import React, { useState, useEffect, useCallback } from 'react';
import { X, Upload, Loader2, FileText, Trash2 } from 'lucide-react';
import { listBatchReports, createBatchReport, BatchReport } from '../../services/cloudflare';

interface BatchReportPageProps {
  onBack: () => void;
  onViewReport: (reportId: string) => void;
}

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
      // Simulate progress (actual implementation would track real progress)
      for (let i = 0; i < uploadedImages.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        setProgress({ current: i + 1, total: uploadedImages.length });
      }
      await loadReports();
      setUploadedImages([]);
    }

    setIsAnalyzing(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-surface-50 overflow-hidden">
      <div className="h-14 border-b border-border bg-white flex items-center px-6 shrink-0">
        <h2 className="text-base font-semibold text-text-primary">批量检测</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Upload Area */}
          <div className="bg-white border border-border rounded-lg p-6">
            <h3 className="text-sm font-medium text-text-primary mb-4">上传图片</h3>

            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging ? 'border-primary-400 bg-primary-50' : 'border-border bg-surface-50'
              }`}
            >
              <Upload size={32} className="mx-auto mb-3 text-text-muted" />
              <p className="text-sm text-text-primary mb-2">拖拽图片到此处或点击上传</p>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id="batch-upload"
              />
              <label
                htmlFor="batch-upload"
                className="inline-block px-4 py-2 text-xs bg-primary-500 text-white rounded hover:bg-primary-600 cursor-pointer transition-colors"
              >
                选择文件
              </label>
            </div>

            {uploadedImages.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-text-muted">已选择 {uploadedImages.length} 张图片</p>
                  <button
                    onClick={startAnalysis}
                    disabled={isAnalyzing}
                    className="px-4 py-2 text-xs bg-primary-500 text-white rounded hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isAnalyzing ? (
                      <span className="flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" />
                        分析中 {progress.current}/{progress.total}
                      </span>
                    ) : (
                      '开始分析'
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  {uploadedImages.map((file, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-full aspect-square object-cover rounded border border-border"
                      />
                      <button
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={12} />
                      </button>
                      <p className="text-[10px] text-text-muted mt-1 truncate">{file.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Reports List */}
          <div className="bg-white border border-border rounded-lg p-6">
            <h3 className="text-sm font-medium text-text-primary mb-4">历史报告</h3>

            {isLoadingReports ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={24} className="animate-spin text-primary-400" />
              </div>
            ) : reports.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-8">暂无报告</p>
            ) : (
              <div className="space-y-2">
                {reports.map(report => (
                  <button
                    key={report.id}
                    onClick={() => onViewReport(report.id)}
                    className="w-full flex items-center justify-between p-3 border border-border rounded hover:border-primary-400 hover:bg-surface-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <FileText size={16} className="text-text-muted" />
                      <div>
                        <p className="text-sm font-medium text-text-primary">{report.name}</p>
                        <p className="text-xs text-text-muted">
                          {new Date(report.createdAt).toLocaleString('zh-CN')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-text-muted">
                          {report.processedImages}/{report.totalImages} 已完成
                        </p>
                        <p className={`text-xs font-medium ${
                          report.status === 'completed' ? 'text-green-600' :
                          report.status === 'processing' ? 'text-blue-600' :
                          report.status === 'failed' ? 'text-red-600' :
                          'text-text-muted'
                        }`}>
                          {report.status === 'completed' ? '已完成' :
                           report.status === 'processing' ? '处理中' :
                           report.status === 'failed' ? '失败' : '待处理'}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
