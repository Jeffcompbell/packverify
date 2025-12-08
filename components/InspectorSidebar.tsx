import React, { useState } from 'react';
import { DiffResult, SourceField } from '../types';
import {
  Check, X, ArrowRight,
  RefreshCw, Search, ListFilter, ClipboardCheck, AlertOctagon, FileSpreadsheet
} from 'lucide-react';

interface InspectorSidebarProps {
  sourceFields: SourceField[];
  diffResults: DiffResult[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onParseSource: (text: string) => void;
  isProcessing: boolean;
  onReset: () => void;
}

export const InspectorSidebar: React.FC<InspectorSidebarProps> = ({
  sourceFields,
  diffResults,
  selectedId,
  onSelect,
  onParseSource,
  isProcessing,
  onReset
}) => {
  const [inputText, setInputText] = useState("");

  const hasResults = sourceFields.length > 0 || diffResults.length > 0;

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'content': return '内容';
      case 'compliance': return '合规';
      case 'specs': return '规格';
      default: return category;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200">

      {/* TOP: INPUT SECTION */}
      <div className="p-4 border-b border-slate-800 bg-slate-900 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-300 text-xs uppercase tracking-wider flex items-center gap-2">
            <ClipboardCheck size={14} className="text-indigo-400" />
            源数据输入
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

        <div className="relative group">
          <textarea
            className="w-full h-24 bg-slate-950 border border-slate-800 rounded-md p-3 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-mono leading-relaxed transition-all focus:h-32 focus:border-indigo-500/50"
            placeholder="粘贴原始规格数据或产品信息..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          {(!inputText && !hasResults) && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <span className="text-xs text-slate-600">等待输入...</span>
            </div>
          )}
          <button
            onClick={() => onParseSource(inputText)}
            disabled={!inputText.trim() || isProcessing}
            className="absolute bottom-2 right-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-0 disabled:translate-y-2 text-white text-[10px] font-bold px-2.5 py-1.5 rounded flex items-center gap-1.5 transition-all shadow-lg"
          >
            {isProcessing ? <RefreshCw className="animate-spin" size={10} /> : <Search size={10} />}
            解析
          </button>
        </div>
      </div>

      {/* MIDDLE: PARSED FIELDS */}
      {sourceFields.length > 0 && (
        <div className="border-b border-slate-800 bg-slate-900/50 shrink-0">
          <div className="px-4 py-2 flex items-center justify-between border-b border-slate-800/50">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileSpreadsheet size={12} className="text-emerald-400" />
              已解析字段
            </h4>
            <span className="text-[9px] text-slate-500">{sourceFields.length} 项</span>
          </div>
          <div className="max-h-[180px] overflow-y-auto p-2 space-y-1">
            {sourceFields.map((field, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2 bg-slate-800/30 rounded text-xs hover:bg-slate-800/50 transition-colors">
                <span className="text-[9px] px-1.5 py-0.5 bg-slate-700/50 text-slate-400 rounded shrink-0">
                  {getCategoryLabel(field.category)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-300 font-medium truncate">{field.key}</p>
                  <p className="text-slate-500 text-[10px] truncate">{field.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BOTTOM: DIFF RESULTS */}
      <div className="flex-1 overflow-hidden flex flex-col bg-slate-900">
        <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between bg-slate-900 sticky top-0 z-10 shrink-0 h-10">
          <h3 className="font-bold text-slate-300 text-xs uppercase tracking-wider flex items-center gap-2">
            <AlertOctagon size={14} className="text-emerald-400" />
            匹配结果
          </h3>
          {diffResults.length > 0 && (
            <div className="flex items-center gap-2 text-[9px]">
              <span className="text-emerald-400">
                {diffResults.filter(d => d.status === 'match').length} 匹配
              </span>
              <span className="text-red-400">
                {diffResults.filter(d => d.status !== 'match').length} 差异
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {diffResults.length === 0 && !isProcessing && (
            <div className="text-center py-12 text-slate-600 flex flex-col items-center">
              <ListFilter size={24} className="mb-2 opacity-30" />
              <p className="text-xs">暂无匹配结果</p>
              <p className="text-[10px] text-slate-700 mt-1">上传图片并输入源数据后开始匹配</p>
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
                <div className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${result.status === 'match' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                  {result.status === 'match' ? <Check size={10} /> : <X size={10} />}
                  {result.status === 'match' ? '匹配' : '差异'}
                </div>
              </div>

              <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-center text-[10px]">
                <div className="bg-slate-950/50 px-2 py-1.5 rounded text-slate-400 font-mono border border-slate-800/50 truncate" title={result.sourceValue}>
                  {result.sourceValue}
                </div>
                <ArrowRight size={10} className="text-slate-600 shrink-0" />
                <div className={`px-2 py-1.5 rounded font-mono border border-transparent truncate ${result.status === 'match' ? 'text-emerald-400 bg-emerald-900/10' : 'text-red-300 bg-red-900/10 border-red-900/20'
                  }`} title={result.imageValue || "缺失"}>
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
