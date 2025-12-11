import React, { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, ChevronDown, ChevronRight, Download, FileSpreadsheet, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
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

  const exportToExcel = () => {
    if (!report) return;

    // 构建 CSV 内容
    const headers = ['图片ID', '状态', '问题类型', '问题描述', '建议'];
    const rows: string[][] = [];

    images.forEach(img => {
      const issues = img.result?.issues || [];
      if (issues.length === 0) {
        rows.push([img.imageId.slice(0, 8), '通过', '', '', '']);
      } else {
        issues.forEach((issue: any, idx: number) => {
          rows.push([
            idx === 0 ? img.imageId.slice(0, 8) : '',
            idx === 0 ? '有问题' : '',
            issue.type || '未分类',
            issue.problem || '',
            issue.suggestion || ''
          ]);
        });
      }
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToJSON = () => {
    if (!report) return;

    const data = {
      report: {
        id: report.id,
        name: report.name,
        createdAt: report.createdAt,
        totalImages: report.totalImages,
        processedImages: report.processedImages
      },
      images: images.map(img => ({
        imageId: img.imageId,
        status: img.status,
        issues: img.result?.issues || []
      }))
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
  const passedCount = images.filter(img => (img.result?.issues?.length || 0) === 0).length;
  const failedCount = images.length - passedCount;
  const passRate = images.length > 0 ? Math.round((passedCount / images.length) * 100) : 0;

  return (
    <div className="flex-1 flex flex-col bg-surface-50 overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-border bg-surface-0 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center">
          <button onClick={onBack} className="p-1.5 hover:bg-surface-100 rounded transition-colors mr-3">
            <ArrowLeft size={18} className="text-text-muted" />
          </button>
          <h2 className="text-base font-semibold text-text-primary">{report.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-100 rounded transition-colors"
          >
            <FileSpreadsheet size={14} />
            导出 Excel
          </button>
          <button
            onClick={exportToJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-100 rounded transition-colors"
          >
            <Download size={14} />
            导出 JSON
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 bg-surface-0 border border-border rounded-lg">
              <p className="text-2xl font-semibold text-text-primary">{report.totalImages}</p>
              <p className="text-xs text-text-muted mt-1">总图片数</p>
            </div>
            <div className="p-4 bg-surface-0 border border-border rounded-lg">
              <p className="text-2xl font-semibold text-green-500">{passedCount}</p>
              <p className="text-xs text-text-muted mt-1">通过</p>
            </div>
            <div className="p-4 bg-surface-0 border border-border rounded-lg">
              <p className="text-2xl font-semibold text-red-500">{failedCount}</p>
              <p className="text-xs text-text-muted mt-1">有问题</p>
            </div>
            <div className="p-4 bg-surface-0 border border-border rounded-lg">
              <p className="text-2xl font-semibold text-text-primary">{passRate}%</p>
              <p className="text-xs text-text-muted mt-1">通过率</p>
            </div>
          </div>

          {/* Issue Summary */}
          {totalIssues > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertTriangle size={16} />
                <span className="text-sm font-medium">共发现 {totalIssues} 个问题</span>
              </div>
            </div>
          )}

          {/* Images List */}
          <div className="bg-surface-0 border border-border rounded-lg divide-y divide-border">
            {images.map(image => {
              const isExpanded = expandedImages.has(image.id);
              const issues = image.result?.issues || [];
              const hasIssues = issues.length > 0;

              return (
                <div key={image.id}>
                  <button
                    onClick={() => toggleExpand(image.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-surface-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown size={16} className="text-text-muted" /> : <ChevronRight size={16} className="text-text-muted" />}
                      {hasIssues ? (
                        <XCircle size={16} className="text-red-500" />
                      ) : (
                        <CheckCircle size={16} className="text-green-500" />
                      )}
                      <span className="text-sm text-text-primary">图片 {image.imageId.slice(0, 8)}</span>
                    </div>
                    <span className={`text-xs ${hasIssues ? 'text-red-500' : 'text-green-500'}`}>
                      {hasIssues ? `${issues.length} 个问题` : '通过'}
                    </span>
                  </button>

                  {isExpanded && issues.length > 0 && (
                    <div className="px-4 pb-4 space-y-2">
                      {issues.map((issue: any, idx: number) => (
                        <div key={idx} className="p-3 bg-red-50 border border-red-100 rounded text-xs">
                          <p className="text-red-700 font-medium">{issue.problem}</p>
                          {issue.suggestion && (
                            <p className="text-red-600 mt-1">建议：{issue.suggestion}</p>
                          )}
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
