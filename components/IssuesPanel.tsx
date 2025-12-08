import React from 'react';
import { AlertTriangle, Type, RefreshCw, FileText, AlertCircle, Loader2, CheckCheck, Copy, Brackets, ShieldAlert, CheckCircle } from 'lucide-react';
import { ImageItem } from '../types';

interface IssuesPanelProps {
  currentImage: ImageItem | null;
  isCurrentProcessing: boolean;
  onRetryAnalysis: () => void;
  selectedIssueId: string | null;
  onSelectIssue: (id: string) => void;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
  mobileTab: string;
  issueListRef: React.RefObject<HTMLDivElement>;
}

export const IssuesPanel: React.FC<IssuesPanelProps> = ({
  currentImage,
  isCurrentProcessing,
  onRetryAnalysis,
  selectedIssueId,
  onSelectIssue,
  copiedId,
  onCopy,
  mobileTab,
  issueListRef
}) => {
  const renderOriginal = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const word = part.slice(2, -2);
        return <span key={i} className="bg-red-500/30 text-red-300 px-0.5 rounded font-bold">{word}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className={`${mobileTab === 'issues' ? 'flex' : 'hidden'} md:flex w-full md:w-[380px] border-l border-slate-800 bg-slate-900 flex-col`}>
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-indigo-400" />
          <span className="text-sm font-medium text-slate-200">检测问题</span>
          {currentImage && (currentImage.issues.length + (currentImage.deterministicIssues?.length || 0)) > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
              {currentImage.issues.length + (currentImage.deterministicIssues?.length || 0)}
            </span>
          )}
        </div>
        <button
          onClick={onRetryAnalysis}
          disabled={isCurrentProcessing || !currentImage}
          className="p-2 text-slate-500 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
          title="重新分析"
        >
          <RefreshCw size={14} className={isCurrentProcessing ? 'animate-spin' : ''} />
        </button>
      </div>

      {currentImage?.description && (
        <div className="px-4 py-2 border-b border-slate-800/50 bg-slate-800/30">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1">
            <FileText size={10} /> 图片描述
          </div>
          <p className="text-xs text-slate-300">{currentImage.description}</p>
        </div>
      )}

      <div ref={issueListRef} className="flex-1 overflow-y-auto">
        {!currentImage ? (
          <div className="text-center py-12 text-slate-600">
            <AlertCircle size={24} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs">上传图片后显示检测结果</p>
          </div>
        ) : isCurrentProcessing ? (
          <div className="text-center py-12 text-slate-500">
            <Loader2 size={24} className="mx-auto mb-2 animate-spin" />
            <p className="text-xs">正在分析...</p>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {currentImage.deterministicIssues && currentImage.deterministicIssues.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-bold text-red-400 uppercase tracking-wider">
                  <Brackets size={12} />
                  确定性问题（100%准确）
                </div>
                {currentImage.deterministicIssues.map((issue) => (
                  <div key={issue.id} className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                        {issue.type === 'bracket_mismatch' ? '括号不配对' : issue.type === 'encoding_error' ? '编码错误' : '格式错误'}
                      </span>
                    </div>
                    <p className="text-xs text-red-300 mb-1.5">{issue.description}</p>
                    <div className="text-[10px] text-slate-400 font-mono bg-slate-900/50 px-2 py-1.5 rounded">
                      {issue.location}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {currentImage.issues.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                  <ShieldAlert size={12} />
                  AI 建议（需人工确认）
                </div>
                {currentImage.issues.map((issue) => {
                  const displayOriginal = issue.original || issue.text || '';
                  const displayProblem = issue.problem || '';
                  const copyText = `原文: ${displayOriginal}\n问题: ${displayProblem}\n建议: ${issue.suggestion}`;

                  return (
                    <div
                      key={issue.id}
                      data-issue-id={issue.id}
                      onClick={() => onSelectIssue(issue.id)}
                      className={`p-3 rounded-lg cursor-pointer transition-all group ${
                        selectedIssueId === issue.id
                          ? 'bg-indigo-500/20 border border-indigo-500/50 ring-2 ring-indigo-500/30'
                          : 'bg-slate-800/50 border border-transparent hover:bg-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          issue.severity === 'high' ? 'bg-red-500' : issue.severity === 'medium' ? 'bg-amber-500' : 'bg-slate-500'
                        }`}></span>
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          issue.severity === 'high'
                            ? 'bg-red-500/20 text-red-400'
                            : issue.severity === 'medium'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-slate-500/20 text-slate-400'
                        }`}>
                          {issue.severity === 'high' ? '紧急' : issue.severity === 'medium' ? '警告' : '提示'}
                        </span>
                        <span className="text-[8px] text-slate-600 ml-auto">AI建议</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); onCopy(copyText, issue.id); }}
                          className="p-1 rounded hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"
                          title="复制"
                        >
                          {copiedId === issue.id ? <CheckCheck size={12} className="text-emerald-400" /> : <Copy size={12} className="text-slate-500" />}
                        </button>
                      </div>

                      <div className="mb-2">
                        <span className="text-[10px] text-slate-500">原文：</span>
                        <div className="text-xs text-slate-300 font-mono bg-slate-800/50 px-2 py-1.5 rounded mt-1 leading-relaxed">
                          {renderOriginal(displayOriginal)}
                        </div>
                      </div>

                      {displayProblem && (
                        <p className="text-xs text-slate-300 mb-1.5">{displayProblem}</p>
                      )}

                      {issue.suggestion && (
                        <div className="flex items-start gap-1.5 text-[11px] text-emerald-400/90 bg-emerald-500/10 px-2 py-1.5 rounded">
                          <span className="shrink-0">💡</span>
                          <span>{issue.suggestion}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {currentImage.issues.length === 0 && (!currentImage.deterministicIssues || currentImage.deterministicIssues.length === 0) && (
              <div className="text-center py-12 text-slate-600">
                <CheckCircle size={24} className="mx-auto mb-2 text-emerald-500/50" />
                <p className="text-xs">未检测到问题</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
