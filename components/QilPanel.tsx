import React, { useCallback, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import {
  Table, Upload, Search, ImagePlus, XCircle, Loader2,
  FileSpreadsheet, ClipboardCheck, Image
} from 'lucide-react';
import { parseSourceText, parseQILImage, fileToGenerativePart } from '../services/openaiService';
import { SourceField } from '../types';

interface QilPanelProps {
  manualSourceFields: SourceField[];
  onFieldsUpdate: (fields: SourceField[], rawText: string) => void;
  onError: (message: string) => void;
  isProcessing: boolean;
  onProcessingChange: (processing: boolean) => void;
}

export interface QilPanelRef {
  handleQilImageFile: (file: File) => void;
}

export const QilPanel = forwardRef<QilPanelRef, QilPanelProps>(({
  manualSourceFields,
  onFieldsUpdate,
  onError,
  isProcessing,
  onProcessingChange
}, ref) => {
  const [qilInputMode, setQilInputMode] = useState<'text' | 'image'>('text');
  const [qilInputText, setQilInputText] = useState('');
  const [qilImages, setQilImages] = useState<{
    id: string;
    src: string;
    base64: string;
    mimeType: string;
    parsed: boolean;
  }[]>([]);
  const [isParsingQil, setIsParsingQil] = useState(false);
  const [parsingQilId, setParsingQilId] = useState<string | null>(null);
  const qilDropRef = useRef<HTMLDivElement>(null);

  // QIL 图片处理 - 支持多张
  const handleQilImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (qilImages.length >= 4) {
      onError('QIL 最多支持 4 张图片');
      return;
    }

    const url = URL.createObjectURL(file);
    const reader = new FileReader();

    reader.onloadend = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1] || result;

      const newQilImage = {
        id: `qil-${Date.now()}`,
        src: url,
        base64: base64Data,
        mimeType: file.type,
        parsed: false
      };
      setQilImages(prev => [...prev, newQilImage]);
      setQilInputMode('image');
    };

    reader.readAsDataURL(file);
  }, [qilImages.length, onError]);

  // Expose handleQilImageFile to parent component
  useImperativeHandle(ref, () => ({
    handleQilImageFile
  }), [handleQilImageFile]);

  // QIL 图片删除
  const handleRemoveQilImage = useCallback((id: string) => {
    setQilImages(prev => prev.filter(img => img.id !== id));
  }, []);

  // QIL 文本解析
  const handleParseText = useCallback(async () => {
    if (!qilInputText.trim()) return;

    onProcessingChange(true);
    try {
      const fields = await parseSourceText(qilInputText);
      onFieldsUpdate(fields, qilInputText); // 传递原文
    } catch (err) {
      onError("Failed to parse source text.");
    } finally {
      onProcessingChange(false);
    }
  }, [qilInputText, onFieldsUpdate, onError, onProcessingChange]);

  // QIL 解析所有图片
  const handleParseAllQilImages = useCallback(async () => {
    const unparsedImages = qilImages.filter(img => !img.parsed);
    if (unparsedImages.length === 0) return;

    setIsParsingQil(true);
    onError('');

    try {
      let allFields: SourceField[] = [...manualSourceFields];

      for (const qilImg of unparsedImages) {
        setParsingQilId(qilImg.id);
        const fields = await parseQILImage(qilImg.base64, qilImg.mimeType);
        allFields = [...allFields, ...fields];
        setQilImages(prev => prev.map(img =>
          img.id === qilImg.id ? { ...img, parsed: true } : img
        ));
      }

      // 去重
      const uniqueFields = allFields.reduce((acc, field) => {
        if (!acc.find(f => f.key === field.key)) {
          acc.push(field);
        }
        return acc;
      }, [] as SourceField[]);

      onFieldsUpdate(uniqueFields, ''); // 图片解析时原文为空
    } catch (error: any) {
      onError(error.message || 'QIL 图片解析失败');
    } finally {
      setIsParsingQil(false);
      setParsingQilId(null);
    }
  }, [qilImages, manualSourceFields, onFieldsUpdate, onError]);

  return (
    <div className="w-full md:w-[320px] border-b md:border-b-0 md:border-r border-slate-800 p-3 flex flex-col shrink-0 max-h-[40%] md:max-h-none">
      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
        <Table size={12} className="text-indigo-400" />
        QIL 源数据
      </div>

      {/* 模式切换 */}
      <div className="flex gap-1 mb-2 bg-slate-900 p-0.5 rounded">
        <button
          onClick={() => setQilInputMode('text')}
          className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] transition-all ${
            qilInputMode === 'text' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <ClipboardCheck size={10} /> 文本
        </button>
        <button
          onClick={() => setQilInputMode('image')}
          className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] transition-all ${
            qilInputMode === 'image' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Image size={10} /> 图片
        </button>
      </div>

      {/* 文本输入模式 */}
      {qilInputMode === 'text' ? (
        <div className="flex-1 relative">
          <textarea
            className="w-full h-full bg-slate-900 border border-slate-800 rounded p-2 text-[11px] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-mono"
            placeholder="粘贴 QIL 表格数据..."
            value={qilInputText}
            onChange={(e) => setQilInputText(e.target.value)}
          />
          <button
            onClick={handleParseText}
            disabled={!qilInputText.trim() || isProcessing}
            className="absolute bottom-2 right-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[10px] px-2 py-1 rounded flex items-center gap-1"
          >
            <Search size={10} /> 解析
          </button>
        </div>
      ) : (
        /* 图片输入模式 */
        <div
          ref={qilDropRef}
          className="qil-input-area flex-1 bg-slate-900 border-2 border-dashed border-slate-700 rounded flex flex-col cursor-pointer hover:border-indigo-500/50 transition-colors relative overflow-hidden"
          tabIndex={0}
          onClick={() => {
            if (qilImages.length < 4) {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) handleQilImageFile(file);
              };
              input.click();
            }
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const file = e.dataTransfer.files?.[0];
            if (file) handleQilImageFile(file);
          }}
        >
          {qilImages.length > 0 ? (
            <div className="flex-1 p-2 overflow-auto">
              <div className="grid grid-cols-2 gap-2">
                {qilImages.map((qilImg) => (
                  <div key={qilImg.id} className="relative group">
                    <img src={qilImg.src} alt="QIL" className="w-full h-24 object-cover rounded border border-slate-700" />
                    {qilImg.parsed && (
                      <div className="absolute top-1 left-1 bg-emerald-500/80 text-white text-[8px] px-1 rounded">
                        已解析
                      </div>
                    )}
                    {parsingQilId === qilImg.id && (
                      <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center rounded">
                        <Loader2 size={16} className="animate-spin text-indigo-400" />
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveQilImage(qilImg.id);
                      }}
                      className="absolute top-1 right-1 p-0.5 bg-red-500/80 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <XCircle size={10} className="text-white" />
                    </button>
                  </div>
                ))}
                {qilImages.length < 4 && (
                  <div className="h-24 border-2 border-dashed border-slate-700 rounded flex flex-col items-center justify-center text-slate-600 hover:border-indigo-500/50 hover:text-slate-500 transition-colors">
                    <ImagePlus size={16} />
                    <span className="text-[9px] mt-1">添加</span>
                  </div>
                )}
              </div>
              {qilImages.some(img => !img.parsed) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleParseAllQilImages();
                  }}
                  disabled={isParsingQil}
                  className="mt-2 w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded text-[10px] flex items-center justify-center gap-1"
                >
                  {isParsingQil ? <Loader2 size={10} className="animate-spin" /> : <Search size={10} />}
                  {isParsingQil ? '解析中...' : `解析 ${qilImages.filter(img => !img.parsed).length} 张图片`}
                </button>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center">
              <Upload size={20} className="text-slate-600 mb-1" />
              <span className="text-[10px] text-slate-600">Ctrl+V 粘贴 QIL 截图</span>
              <span className="text-[9px] text-slate-700 mt-1">或点击/拖拽上传（最多4张）</span>
            </div>
          )}
        </div>
      )}

      {/* 字段统计 */}
      {manualSourceFields.length > 0 && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-400">
          <FileSpreadsheet size={10} />
          已解析 {manualSourceFields.length} 个字段
        </div>
      )}
    </div>
  );
});
