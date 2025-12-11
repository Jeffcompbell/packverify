import React, { useState } from 'react';
import { GitCompare, FileSpreadsheet, Image, Copy } from 'lucide-react';
import { ImageItem, SourceField } from '../../types/types';

interface DiffSummaryProps {
  images: ImageItem[];
  manualSourceFields: SourceField[];
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
}

export const DiffSummary: React.FC<DiffSummaryProps> = ({
  images, manualSourceFields, copiedId, onCopy
}) => {
  const [showOnlyDiff, setShowOnlyDiff] = useState(false);

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
      if (!img.specs?.length) return { value: '-', status: 'pending' as const };
      const matchingSpec = img.specs.find(spec =>
        spec.key === field.key ||
        spec.key.includes(field.key) ||
        field.key.includes(spec.key)
      );
      if (!matchingSpec) return { value: '(未找到)', status: 'error' as const };

      const qilValue = field.value.trim().toLowerCase();
      const imgValue = matchingSpec.value.trim().toLowerCase();

      if (qilValue === imgValue) {
        return { value: matchingSpec.value, status: 'match' as const };
      } else if (imgValue.includes(qilValue) || qilValue.includes(imgValue)) {
        return { value: matchingSpec.value, status: 'warning' as const };
      } else {
        return { value: matchingSpec.value, status: 'error' as const };
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
              ? 'bg-text-primary text-white'
              : 'bg-surface-100 text-text-muted hover:bg-surface-200'
          }`}
        >
          {showOnlyDiff ? '显示全部' : '只看差异'}
        </button>
      </div>

      {/* 对比表格 */}
      <div className="flex-1 overflow-auto">
        <div className="space-y-2">
          {displayResults.map(({ field, imageResults, hasError, hasWarning }, idx) => (
            <div
              key={idx}
              className={`rounded-lg border-2 transition-all ${
                hasError
                  ? 'bg-red-500/5 border-red-500/30 shadow-lg shadow-red-500/10'
                  : hasWarning
                    ? 'bg-amber-500/5 border-amber-500/30'
                    : 'bg-surface-100/30 border-border/50'
              }`}
            >
              {/* 字段名 */}
              <div className="px-3 py-2 border-b border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    hasError ? 'bg-red-500' : hasWarning ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}></span>
                  <span className="text-xs font-medium text-text-primary">{field.key}</span>
                </div>
                {(hasError || hasWarning) && (
                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                    hasError ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {hasError ? '差异' : '警告'}
                  </span>
                )}
              </div>

              {/* 对比内容 */}
              <div className="p-3 grid grid-cols-2 gap-3">
                {/* QIL 值 */}
                <div>
                  <div className="text-[9px] text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1">
                    <FileSpreadsheet size={10} />
                    QIL 标准
                  </div>
                  <div
                    onClick={() => onCopy(field.value, `qil-${idx}`)}
                    className="group relative text-xs font-mono bg-surface-100 text-text-secondary px-3 py-2 rounded-lg cursor-pointer hover:bg-surface-200 transition-all border border-surface-200"
                  >
                    <div className="pr-6">{field.value}</div>
                    <Copy size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                    {copiedId === `qil-${idx}` && (
                      <div className="absolute -top-6 right-0 bg-emerald-500 text-text-primary text-[9px] px-2 py-0.5 rounded">已复制</div>
                    )}
                  </div>
                </div>

                {/* 图片值 */}
                <div>
                  <div className="text-[9px] text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Image size={10} />
                    图片实际
                  </div>
                  <div className="space-y-1.5">
                    {imageResults.map((result, imgIdx) => (
                      <div
                        key={imgIdx}
                        onClick={() => onCopy(result.value, `img-${idx}-${imgIdx}`)}
                        className={`group relative text-xs font-mono px-3 py-2 rounded-lg cursor-pointer transition-all border ${
                          result.status === 'match'
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                            : result.status === 'warning'
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                              : result.status === 'error'
                                ? 'bg-red-500/10 text-red-300 border-red-500/30 hover:bg-red-500/20'
                                : 'bg-surface-100/50 text-text-muted border-border/50'
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
                            result.status === 'error' ? 'text-red-400' : 'text-text-muted'
                          }`}
                        />
                        {copiedId === `img-${idx}-${imgIdx}` && (
                          <div className="absolute -top-6 right-0 bg-emerald-500 text-text-primary text-[9px] px-2 py-0.5 rounded">已复制</div>
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
};
