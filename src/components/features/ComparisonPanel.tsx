import React, { useState, useRef } from 'react';
import { Type, FileSpreadsheet, GitCompare, Copy, CheckCheck, ChevronDown, ChevronRight, ImagePlus, Upload, FileText, Paperclip } from 'lucide-react';
import { ImageItem, SourceField } from '../../types/types';
import { QilPanel, QilPanelRef } from './QilPanel';

interface ComparisonPanelProps {
  images: ImageItem[];
  manualSourceFields: SourceField[];
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
  onFieldsUpdate: (fields: SourceField[], rawText: string) => void;
  onError: (msg: string | null) => void;
  onImageUpload: (file: File) => void;
}

export const ComparisonPanel: React.FC<ComparisonPanelProps> = ({
  images, manualSourceFields, copiedId, onCopy, onFieldsUpdate, onError, onImageUpload
}) => {
  const [expandedImages, setExpandedImages] = useState<Set<string>>(new Set(images.map(img => img.id)));
  const [qilProcessing, setQilProcessing] = useState(false);
  const qilPanelRef = useRef<QilPanelRef>(null);

  const toggleImage = (id: string) => {
    setExpandedImages(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 计算对比结果
  const comparisonResults = manualSourceFields.map(field => {
    const imageMatches = images.map(img => {
      if (!img.ocrText) return { imageId: img.id, found: false, ocrValue: null };
      const ocrLower = img.ocrText.toLowerCase();
      const fieldValue = field.value.trim().toLowerCase();
      const found = ocrLower.includes(fieldValue);
      return { imageId: img.id, found, ocrValue: found ? field.value : null };
    });
    const allMatch = imageMatches.every(m => m.found);
    const anyMatch = imageMatches.some(m => m.found);
    return { field, imageMatches, allMatch, anyMatch };
  });

  const errorCount = comparisonResults.filter(r => !r.allMatch).length;
  const matchCount = comparisonResults.filter(r => r.allMatch).length;

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      {/* 第一栏：所有图片 OCR 文本 */}
      <div className="w-1/3 border-r border-border flex flex-col min-h-0">
        <div className="px-3 py-2 bg-white border-b border-border flex items-center gap-2 shrink-0">
          <Type size={14} className="text-blue-500" />
          <span className="text-xs font-bold text-text-primary uppercase tracking-wider">OCR 文本</span>
          <span className="text-[10px] text-text-muted">({images.length} 张图片)</span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {images.map((img, idx) => (
            <div key={img.id} className="bg-surface-50 rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => toggleImage(img.id)}
                className="w-full px-3 py-2 flex items-center justify-between hover:bg-surface-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {expandedImages.has(img.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span className="text-xs font-medium text-text-primary">图片 {idx + 1}</span>
                  <span className="text-[10px] text-text-muted truncate max-w-[80px]">{img.file.name}</span>
                </div>
                {img.ocrText ? (
                  <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-600 rounded">已提取</span>
                ) : (
                  <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">无OCR</span>
                )}
              </button>
              {expandedImages.has(img.id) && (
                <div className="px-3 pb-3">
                  {img.ocrText ? (
                    <div className="relative group">
                      <pre className="text-[11px] text-text-secondary font-mono bg-white p-2 rounded border border-border whitespace-pre-wrap max-h-32 overflow-y-auto">
                        {img.ocrText}
                      </pre>
                      <button
                        onClick={() => onCopy(img.ocrText || '', `ocr-${img.id}`)}
                        className="absolute top-1 right-1 p-1 bg-white/80 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {copiedId === `ocr-${img.id}` ? <CheckCheck size={12} className="text-emerald-500" /> : <Copy size={12} className="text-text-muted" />}
                      </button>
                    </div>
                  ) : (
                    <div className="text-[10px] text-text-muted text-center py-3">
                      图片分析后自动提取 OCR
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* 上传图片卡片 */}
          <label className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
            <ImagePlus size={20} className="text-text-muted" />
            <span className="text-xs text-text-muted">上传图片</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onImageUpload(e.target.files[0])}
            />
          </label>
        </div>
      </div>

      {/* 第二栏：QIL 输入 */}
      <div className="w-1/3 border-r border-border flex flex-col min-h-0">
        <div className="px-3 py-2 bg-white border-b border-border flex items-center gap-2 shrink-0">
          <FileSpreadsheet size={14} className="text-emerald-500" />
          <span className="text-xs font-bold text-text-primary uppercase tracking-wider">QIL 数据</span>
          <span className="text-[10px] text-text-muted">({manualSourceFields.length} 个字段)</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <QilPanel
            ref={qilPanelRef}
            manualSourceFields={manualSourceFields}
            onFieldsUpdate={onFieldsUpdate}
            onError={onError}
            isProcessing={qilProcessing}
            onProcessingChange={setQilProcessing}
          />
        </div>
      </div>

      {/* 第三栏：QIL vs OCR 对比结果 */}
      <div className="w-1/3 flex flex-col min-h-0">
        <div className="px-3 py-2 bg-white border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <GitCompare size={14} className="text-purple-500" />
            <span className="text-xs font-bold text-text-primary uppercase tracking-wider">对比结果</span>
          </div>
          <div className="flex items-center gap-1.5 text-[9px]">
            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-600 rounded">{matchCount} 匹配</span>
            {errorCount > 0 && <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded">{errorCount} 差异</span>}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {manualSourceFields.length === 0 || images.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-text-muted">
              <GitCompare size={24} className="mb-2 opacity-30" />
              <span className="text-xs">暂无对比数据</span>
              <span className="text-[10px] mt-1">
                {images.length === 0 ? '请上传图片' : '请输入 QIL 数据'}
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              {comparisonResults.map(({ field, imageMatches, allMatch }, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg border-2 overflow-hidden ${
                    allMatch
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : 'bg-red-50/50 border-red-200'
                  }`}
                >
                  <div className="px-3 py-2 flex items-center justify-between border-b border-inherit">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${allMatch ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <span className="text-xs font-medium text-text-primary">{field.key}</span>
                    </div>
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      allMatch ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {allMatch ? '匹配' : '差异'}
                    </span>
                  </div>
                  <div className="px-3 py-2 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <span className="text-[9px] text-text-muted min-w-[40px]">QIL:</span>
                      <span className="text-[11px] text-text-primary font-mono">{field.value}</span>
                    </div>
                    {imageMatches.map((match, imgIdx) => (
                      <div key={match.imageId} className="flex items-start gap-2">
                        <span className="text-[9px] text-text-muted min-w-[40px]">图{imgIdx + 1}:</span>
                        <span className={`text-[11px] font-mono ${match.found ? 'text-emerald-600' : 'text-red-500'}`}>
                          {match.found ? '✓ 已找到' : '✗ 未找到'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
