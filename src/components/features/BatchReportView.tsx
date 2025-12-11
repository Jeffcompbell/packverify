import React, { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { getBatchReport, BatchReport, BatchReportImage } from '../../services/cloudflare';

interface BatchReportViewProps {
  reportId: string;
  onBack: () => void;
}

export const BatchReportView: React.FC<BatchReportViewProps> = ({ reportId, onBack }) => {
  const [report, setReport] = useState<BatchReport | null>(null);
  const [images, setImages] = useState<BatchReportImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedImages, setExpandedImages] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadReport();
  }, [reportId]);

  const loadReport = async () => {
    setIsLoading(true);
    const data = await getBatchReport(reportId);
    setReport(data.report);
    setImages(data.images);
    setIsLoading(false);
  };

  const toggleExpand = (imageId: string) => {
    setExpandedImages(prev => {
      const next = new Set(prev);
      next.has(imageId) ? next.delete(imageId) : next.add(imageId);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-50">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-50">
        <p className="text-sm text-text-muted">报告不存在</p>
      </div>
    );
  }

  const totalIssues = images.reduce((sum, img) => sum + (img.result?.issues?.length || 0), 0);

  return (
    <div className="flex-1 flex flex-col bg-surface-50 overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-border bg-surface-0 flex items-center px-6 shrink-0">
        <button onClick={onBack} className="p-1.5 hover:bg-surface-100 rounded transition-colors mr-3">
          <ArrowLeft size={18} className="text-text-muted" />
        </button>
        <h2 className="text-base font-semibold text-text-primary">{report.name}</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Summary */}
          <div className="flex gap-6 text-sm text-text-muted">
            <span>{report.totalImages} 张图片</span>
            <span>{totalIssues} 个问题</span>
          </div>

          {/* Images List */}
          <div className="bg-surface-0 border border-border rounded-lg divide-y divide-border">
            {images.map(image => {
              const isExpanded = expandedImages.has(image.id);
              const issues = image.result?.issues || [];

              return (
                <div key={image.id}>
                  <button
                    onClick={() => toggleExpand(image.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-surface-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown size={16} className="text-text-muted" /> : <ChevronRight size={16} className="text-text-muted" />}
                      <span className="text-sm text-text-primary">图片 {image.imageId.slice(0, 8)}</span>
                    </div>
                    <span className="text-xs text-text-muted">
                      {issues.length > 0 ? `${issues.length} 个问题` : '无问题'}
                    </span>
                  </button>

                  {isExpanded && issues.length > 0 && (
                    <div className="px-4 pb-4 space-y-2">
                      {issues.map((issue: any, idx: number) => (
                        <div key={idx} className="p-3 bg-surface-50 rounded text-xs text-text-secondary">
                          {issue.problem && <p className="mb-1">{issue.problem}</p>}
                          {issue.suggestion && <p className="text-text-muted">建议：{issue.suggestion}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
