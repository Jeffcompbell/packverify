import React, { useState, useRef } from 'react';
import { DiffResult, SourceField } from '../../types/types';
import {
  Check, X, ArrowRight,
  RefreshCw, Search, ListFilter, ClipboardCheck, AlertOctagon, FileSpreadsheet,
  Upload, Image, Table, AlertTriangle, Copy, CheckCircle
} from 'lucide-react';

interface InspectorSidebarProps {
  sourceFields: SourceField[];
  diffResults: DiffResult[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onParseSource: (text: string) => void;
  onParseQILImage?: (file: File) => void;
  isProcessing: boolean;
  onReset: () => void;
  qilErrors?: { field: string; error: string; suggestion: string }[];
}

export const InspectorSidebar: React.FC<InspectorSidebarProps> = ({
  sourceFields,
  diffResults,
  selectedId,
  onSelect,
  onParseSource,
  onParseQILImage,
  isProcessing,
  onReset,
  qilErrors = []
}) => {
  const [inputText, setInputText] = useState("");
  const [inputMode, setInputMode] = useState<'text' | 'image'>('text');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasResults = sourceFields.length > 0 || diffResults.length > 0;

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'content': return '内容';
      case 'compliance': return '合规';
      case 'specs': return '规格';
      default: return category;
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onParseQILImage) {
      onParseQILImage(file);
    }
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200">

      {/* TOP: QIL INPUT SECTION */}
      <div className="p-4 border-b border-slate-800 bg-slate-900 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-300 text-xs uppercase tracking-wider flex items-center gap-2">
            <Table size={14} className="text-indigo-400" />
            QIL 源数据
          </h3>
          <div className="flex gap-2">
            {hasResults && (
              <button
                onClick={onReset}
                className="text-[10px] text-slate-500 hover:text-red-400 flex items-center gap-1 hover:bg-slate-800 px-2 py-1 rounded transition-colors"
              >
                <RefreshCw size={10} /> 重置
              </button>
            )}
          </div>
        </div>

        {/* Input Mode Toggle */}
        <div className="flex gap-1 mb-3 bg-slate-950 p-1 rounded-lg">
          <button
            onClick={() => setInputMode('text')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-medium transition-all ${
              inputMode === 'text'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800'
            }`}
          >
            <ClipboardCheck size={12} />
            文本粘贴
          </button>
          <button
            onClick={() => setInputMode('image')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-medium transition-all ${
              inputMode === 'image'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Image size={12} />
            图片上传
          </button>
        </div>

        {inputMode === 'text' ? (
          <div className="relative group">
            <textarea
              className="w-full h-28 bg-slate-950 border border-slate-800 rounded-md p-3 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-mono leading-relaxed transition-all focus:h-36 focus:border-indigo-500/50"
              placeholder="粘贴 QIL 表格数据或产品规格信息..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <button
              onClick={() => onParseSource(inputText)}
              disabled={!inputText.trim() || isProcessing}
              className="absolute bottom-2 right-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-0 disabled:translate-y-2 text-white text-[10px] font-bold px-2.5 py-1.5 rounded flex items-center gap-1.5 transition-all shadow-lg"
            >
              {isProcessing ? <RefreshCw className="animate-spin" size={10} /> : <Search size={10} />}
              解析
            </button>
          </div>
        ) : (
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="w-full h-28 bg-slate-950 border-2 border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-indigo-500/50 hover:bg-slate-950/80 transition-all group"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="animate-spin text-indigo-400" size={24} />
                  <span className="text-xs text-slate-400">识别中...</span>
                </>
              ) : (
                <>
                  <Upload className="text-slate-500 group-hover:text-indigo-400 transition-colors" size={24} />
                  <span className="text-xs text-slate-500 group-hover:text-slate-400">点击上传 QIL 表格截图</span>
                  <span className="text-[10px] text-slate-600">支持 PNG、JPG 格式</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* QIL ERRORS - Spelling/Format Check */}
      {qilErrors.length > 0 && (
        <div className="border-b border-slate-800 bg-amber-950/20 shrink-0">
          <div className="px-4 py-2 flex items-center justify-between border-b border-amber-900/30">
            <h4 className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle size={12} />
              QIL 数据问题
            </h4>
            <span className="text-[9px] text-amber-500/70">{qilErrors.length} 项待修正</span>
          </div>
          <div className="max-h-[120px] overflow-y-auto p-2 space-y-1">
            {qilErrors.map((err, idx) => (
              <div key={idx} className="p-2 bg-amber-900/20 rounded text-xs border border-amber-800/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-amber-300 font-medium">{err.field}</span>
                  <button
                    onClick={() => handleCopy(err.suggestion, `qil-${idx}`)}
                    className="text-amber-400 hover:text-amber-300 p-1 rounded hover:bg-amber-900/30 transition-colors"
                    title="复制建议修正"
                  >
                    {copiedId === `qil-${idx}` ? <CheckCircle size={12} /> : <Copy size={12} />}
                  </button>
                </div>
                <p className="text-amber-200/70 text-[10px]">{err.error}</p>
                <p className="text-emerald-400/80 text-[10px] mt-1">建议: {err.suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MIDDLE: PARSED FIELDS - QIL Table */}
      {sourceFields.length > 0 && (
        <div className="border-b border-slate-800 bg-slate-900/50 shrink-0">
          <div className="px-4 py-2 flex items-center justify-between border-b border-slate-800/50">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileSpreadsheet size={12} className="text-emerald-400" />
              QIL 解析结果
            </h4>
            <span className="text-[9px] text-slate-500">{sourceFields.length} 项</span>
          </div>
          <div className="max-h-[200px] overflow-y-auto">
            <table className="w-full text-[10px]">
              <thead className="bg-slate-800/50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-1.5 text-slate-500 font-medium">分类</th>
                  <th className="text-left px-3 py-1.5 text-slate-500 font-medium">项目</th>
                  <th className="text-left px-3 py-1.5 text-slate-500 font-medium">值</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/30">
                {sourceFields.map((field, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-3 py-2 text-slate-500">{getCategoryLabel(field.category)}</td>
                    <td className="px-3 py-2 text-slate-300 font-medium">{field.key}</td>
                    <td className="px-3 py-2 text-slate-400 font-mono">{field.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BOTTOM: DIFF RESULTS - Image vs QIL Matching */}
      <div className="flex-1 overflow-hidden flex flex-col bg-slate-900">
        <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between bg-slate-900 sticky top-0 z-10 shrink-0 h-10">
          <h3 className="font-bold text-slate-300 text-xs uppercase tracking-wider flex items-center gap-2">
            <AlertOctagon size={14} className="text-emerald-400" />
            图片 ⇄ QIL 校验
          </h3>
          {diffResults.length > 0 && (
            <div className="flex items-center gap-2 text-[9px]">
              <span className="text-emerald-400">
                {diffResults.filter(d => d.status === 'match').length} 一致
              </span>
              <span className="text-red-400">
                {diffResults.filter(d => d.status !== 'match').length} 不一致
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {diffResults.length === 0 && !isProcessing && (
            <div className="text-center py-12 text-slate-600 flex flex-col items-center">
              <ListFilter size={24} className="mb-2 opacity-30" />
              <p className="text-xs">暂无校验结果</p>
              <p className="text-[10px] text-slate-700 mt-1">上传图片并输入 QIL 数据后自动校验</p>
            </div>
          )}

          {/* DIFF RESULTS */}
          {diffResults.map((result) => (
            <div
              key={result.id}
              onClick={() => onSelect(result.id)}
              className={`group p-2.5 rounded-md border cursor-pointer transition-all relative ${selectedId === result.id ? 'bg-slate-800 border-indigo-500/50' : 'bg-slate-800/20 border-slate-800 hover:bg-slate-800/50'
                }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{result.field}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(`${result.field}: ${result.sourceValue} → ${result.imageValue || '未找到'}${result.reason ? ` (${result.reason})` : ''}`, result.id);
                    }}
                    className="text-slate-500 hover:text-slate-300 p-1 rounded hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"
                    title="复制"
                  >
                    {copiedId === result.id ? <CheckCircle size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                  <div className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${result.status === 'match' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                    {result.status === 'match' ? <Check size={10} /> : <X size={10} />}
                    {result.status === 'match' ? '一致' : '不一致'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-center text-[10px]">
                <div className="bg-slate-950/50 px-2 py-1.5 rounded text-slate-400 font-mono border border-slate-800/50 truncate" title={result.sourceValue}>
                  <span className="text-[9px] text-slate-600 block mb-0.5">QIL</span>
                  {result.sourceValue}
                </div>
                <ArrowRight size={10} className="text-slate-600 shrink-0" />
                <div className={`px-2 py-1.5 rounded font-mono border border-transparent truncate ${result.status === 'match' ? 'text-emerald-400 bg-emerald-900/10' : 'text-red-300 bg-red-900/10 border-red-900/20'
                  }`} title={result.imageValue || "缺失"}>
                  <span className="text-[9px] text-slate-600 block mb-0.5">图片</span>
                  {result.imageValue || "未找到"}
                </div>
              </div>

              {result.reason && (
                <p className="text-[9px] text-slate-500 mt-2 leading-relaxed">{result.reason}</p>
              )}

              {selectedId === result.id && (
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-indigo-500"></div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
