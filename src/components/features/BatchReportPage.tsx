import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, X } from 'lucide-react';
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
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Upload */}
          <div>
            <label
              htmlFor="batch-upload"
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              className={`block py-12 border border-dashed rounded-xl text-center cursor-pointer transition-colors ${
                isDragging ? 'border-text-muted bg-surface-100' : 'border-surface-200 hover:border-surface-300 hover:bg-surface-0'
              }`}
            >
              <input type="file" multiple accept="image/*" onChange={handleFileSelect} className="hidden" id="batch-upload" />
              <p className="text-text-muted">粘贴 · 拖拽 · 点击上传</p>
            </label>

            {uploadedImages.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-text-muted">{uploadedImages.length} 张</span>
                  <button
                    onClick={startAnalysis}
                    disabled={isAnalyzing}
                    className="px-4 py-2 text-xs bg-text-primary text-white rounded-lg hover:bg-text-secondary disabled:opacity-50 transition-colors"
                  >
                    {isAnalyzing ? `${progress.current}/${progress.total}` : '开始分析'}
                  </button>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {uploadedImages.map((file, idx) => (
                    <div key={idx} className="relative group">
                      <img src={URL.createObjectURL(file)} alt="" className="w-full aspect-square object-cover rounded" />
                      <button
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 p-0.5 bg-black/50 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Reports */}
          {isLoadingReports ? (
            <div className="py-12 text-center">
              <Loader2 size={20} className="animate-spin text-text-muted mx-auto" />
            </div>
          ) : reports.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-text-muted mb-3">历史报告</p>
              {reports.map(report => (
                <button
                  key={report.id}
                  onClick={() => onViewReport(report.id)}
                  className="w-full flex items-center justify-between p-3 bg-surface-0 border border-border rounded-lg hover:border-surface-300 transition-colors text-left"
                >
                  <div>
                    <p className="text-sm text-text-primary">{report.name}</p>
                    <p className="text-xs text-text-muted">{new Date(report.createdAt).toLocaleString('zh-CN')}</p>
                  </div>
                  <span className="text-xs text-text-muted">{report.processedImages}/{report.totalImages}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
