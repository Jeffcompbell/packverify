import React, { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, ChevronDown, ChevronRight, Download } from 'lucide-react';
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
      if (next.has(imageId)) {
        next.delete(imageId);
      } else {
        next.add(imageId);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-50">
        <Loader2 size={32} className="animate-spin text-primary-400" />
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

  const totalIssues = images.reduce((sum, img) => {
    const issues = img.result?.issues || [];
    return sum + issues.length;
  }, 0);

  const highSeverityCount = images.reduce((sum, img) => {
    const issues = img.result?.issues || [];
    return sum + issues.filter((i: any) => i.severity === 'high').length;
  }, 0);

  return (
    <div className="flex-1 flex flex-col bg-surface-50 overflow-hidden">
      <div className="h-14 border-b border-border bg-white flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 hover:bg-surface-100 rounded transition-colors">
            <ArrowLeft size={18} className="text-text-muted" />
          </button>
          <h2 className="text-base font-semibold text-text-primary">{report.name}</h2>
        </div>
        <button
          onClick={() => alert('导出功能开发中')}
          className="flex items-center gap-2 px-3 py-1.5 text-xs border border-border rounded hover:bg-surface-50 transition-colors"
        >
          <Download size={14} />
          导出报告
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Summary Statistics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-border rounded-lg p-4">
              <p className="text-xs text-text-muted mb-1">总图片数</p>
              <p className="text-2xl font-semibold text-text-primary">{report.totalImages}</p>
            </div>
            <div className="bg-white border border-border rounded-lg p-4">
              <p className="text-xs text-text-muted mb-1">总问题数</p>
              <p className="text-2xl font-semibold text-text-primary">{totalIssues}</p>
            </div>
            <div className="bg-white border border-border rounded-lg p-4">
              <p className="text-xs text-text-muted mb-1">高危问题</p>
              <p className="text-2xl font-semibold text-red-600">{highSeverityCount}</p>
            </div>
          </div>

          {/* Images Table */}
          <div className="bg-white border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-medium text-text-primary">检测结果</h3>
            </div>

            <div className="divide-y divide-border">
              {images.map(image => {
                const isExpanded = expandedImages.has(image.id);
                const issues = image.result?.issues || [];
                const highCount = issues.filter((i: any) => i.severity === 'high').length;
                const mediumCount = issues.filter((i: any) => i.severity === 'medium').length;
                const lowCount = issues.filter((i: any) => i.severity === 'low').length;

                return (
                  <div key={image.id}>
                    <button
                      onClick={() => toggleExpand(image.id)}
                      className="w-full flex items-center justify-between p-4 hover:bg-surface-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <div>
                          <p className="text-sm font-medium text-text-primary">图片 {image.imageId.slice(0, 8)}</p>
                          <p className="text-xs text-text-muted">
                            {image.status === 'completed' ? '已完成' :
                             image.status === 'processing' ? '处理中' :
                             image.status === 'failed' ? '失败' : '待处理'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        {highCount > 0 && <span className="text-red-600">高危: {highCount}</span>}
                        {mediumCount > 0 && <span className="text-yellow-600">中危: {mediumCount}</span>}
                        {lowCount > 0 && <span className="text-blue-600">低危: {lowCount}</span>}
                        {issues.length === 0 && <span className="text-green-600">无问题</span>}
                      </div>
                    </button>

                    {isExpanded && issues.length > 0 && (
                      <div className="px-4 pb-4 bg-surface-50">
                        <div className="space-y-2">
                          {issues.map((issue: any, idx: number) => (
                            <div
                              key={idx}
                              className="p-3 bg-white border border-border rounded text-xs"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                  issue.severity === 'high' ? 'bg-red-100 text-red-700' :
                                  issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                  {issue.severity === 'high' ? '高危' :
                                   issue.severity === 'medium' ? '中危' : '低危'}
                                </span>
                                <span className="text-text-muted">{issue.type}</span>
                              </div>
                              {issue.original && (
                                <p className="text-text-primary mb-1">
                                  <span className="font-medium">原文：</span>{issue.original}
                                </p>
                              )}
                              {issue.problem && (
                                <p className="text-text-primary mb-1">
                                  <span className="font-medium">问题：</span>{issue.problem}
                                </p>
                              )}
                              <p className="text-text-muted">
                                <span className="font-medium">建议：</span>{issue.suggestion}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
