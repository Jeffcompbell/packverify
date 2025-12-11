import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Type, RefreshCw, FileText, AlertCircle, Loader2, CheckCheck, Copy, Brackets, ShieldAlert, CheckCircle, Plus, X, Columns, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { ImageItem } from '../../types/types';
import { AVAILABLE_MODELS } from '../../services/openaiService';

interface IssuesPanelProps {
  currentImage: ImageItem | null;
  images: ImageItem[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  isCurrentProcessing: boolean;
  processingModelId: string | null;
  onRetryAnalysis: (modelId: string) => void;
  selectedIssueId: string | null;
  onSelectIssue: (id: string) => void;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
  mobileTab: string;
  issueListRef: React.RefObject<HTMLDivElement>;
  currentModelId: string;
  onAddModel: (modelId: string) => void;
  onRemoveModel: (modelId: string) => void;
  activeModelTab: string;
  onActiveModelChange: (modelId: string) => void;
}

export const IssuesPanel: React.FC<IssuesPanelProps> = ({
  currentImage,
  images,
  currentIndex,
  onNavigate,
  isCurrentProcessing,
  processingModelId,
  onRetryAnalysis,
  selectedIssueId,
  onSelectIssue,
  copiedId,
  onCopy,
  mobileTab,
  issueListRef,
  currentModelId,
  onAddModel,
  onRemoveModel,
  activeModelTab,
  onActiveModelChange
}) => {
  const defaultModelId = currentModelId || 'gemini-3-pro-preview';
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; modelId: string } | null>(null);
  // 弹窗内图片状态
  const [modalImageIndex, setModalImageIndex] = useState(currentIndex);
  const [modalZoom, setModalZoom] = useState(1);
  const [modalRotation, setModalRotation] = useState(0);

  // 获取当前图片已分析的模型列表
  const analyzedModels = currentImage?.issuesByModel && Object.keys(currentImage.issuesByModel).length > 0
    ? Object.keys(currentImage.issuesByModel)
    : [defaultModelId]; // 默认显示当前选中的模型

  // 确保 activeModelTab 在 analyzedModels 中
  React.useEffect(() => {
    if (!analyzedModels.includes(activeModelTab)) {
      onActiveModelChange(analyzedModels[0] || defaultModelId);
    }
  }, [analyzedModels, activeModelTab, defaultModelId]);

  // 打开弹窗时同步图片索引并重置缩放/旋转
  React.useEffect(() => {
    if (showCompareModal) {
      setModalImageIndex(currentIndex);
      setModalZoom(1);
      setModalRotation(0);
    }
  }, [showCompareModal, currentIndex]);

  // 弹窗内当前显示的图片（确保索引有效）
  const safeModalIndex = Math.min(Math.max(0, modalImageIndex), images.length - 1);
  const modalImage = images.length > 0 ? images[safeModalIndex] : null;

  // 获取当前 tab 的检测结果
  const currentTabData = currentImage?.issuesByModel?.[activeModelTab] || {
    issues: currentImage?.issues || [],
    deterministicIssues: currentImage?.deterministicIssues || []
  };

  // 可添加的模型列表（排除已分析的）
  const availableModelsToAdd = AVAILABLE_MODELS.filter(
    m => !analyzedModels.includes(m.id)
  );
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

  const handleContextMenu = (e: React.MouseEvent, modelId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, modelId });
  };

  const handleCopyModelResult = (modelId: string) => {
    const modelData = currentImage?.issuesByModel?.[modelId];
    const model = AVAILABLE_MODELS.find(m => m.id === modelId);
    const displayName = model?.name || modelId;
    const issues = modelData?.issues || [];
    const detIssues = modelData?.deterministicIssues || [];

    let text = `【${displayName}】检测结果\n\n`;
    if (detIssues.length > 0) {
      text += `确定性问题（${detIssues.length}）:\n`;
      detIssues.forEach((issue, i) => {
        const typeLabel = issue.type === 'bracket_mismatch' ? '括号不配对' : issue.type === 'encoding_error' ? '编码错误' : '格式错误';
        text += `${i + 1}. [${typeLabel}] ${issue.description}\n   位置: ${issue.location}\n\n`;
      });
    }
    if (issues.length > 0) {
      text += `AI建议（${issues.length}）:\n`;
      issues.forEach((issue, i) => {
        text += `${i + 1}. 原文: ${issue.original || issue.text}\n   问题: ${issue.problem || ''}\n   建议: ${issue.suggestion}\n\n`;
      });
    }
    navigator.clipboard.writeText(text);
    setContextMenu(null);
  };

  const handleDeleteModel = (modelId: string) => {
    if (analyzedModels.length > 1) {
      onRemoveModel(modelId);
      if (activeModelTab === modelId) {
        onActiveModelChange(analyzedModels.find(m => m !== modelId) || defaultModelId);
      }
    }
    setContextMenu(null);
  };

  return (
    <div className={`${mobileTab === 'issues' ? 'flex' : 'hidden'} md:flex w-full md:w-[380px] border-l border-border bg-white flex-col`}>
      {/* 标题栏 */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-white">
        <div className="flex items-center gap-1.5">
          <AlertTriangle size={14} className="text-text-muted" />
          <span className="text-xs font-medium text-text-primary">检测问题</span>
        </div>
        <div className="flex items-center gap-1">
          {analyzedModels.length > 1 && (
            <button
              onClick={() => setShowCompareModal(true)}
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-100 transition-colors"
              title="对比模型结果"
            >
              <Columns size={12} />
            </button>
          )}
          {availableModelsToAdd.length > 0 && (
            <button
              onClick={() => setShowModelMenu(!showModelMenu)}
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-100 transition-colors"
              title="添加模型"
            >
              <Plus size={12} />
            </button>
          )}
          <button
            onClick={() => onRetryAnalysis(activeModelTab)}
            disabled={isCurrentProcessing || !currentImage}
            className="p-1 text-text-muted hover:text-text-primary hover:bg-surface-100 rounded transition-colors disabled:opacity-50"
            title="重新分析"
          >
            <RefreshCw size={12} className={isCurrentProcessing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
      {/* 模型 Tabs - 可换行 */}
      <div className="px-2 py-1.5 border-b border-border bg-white flex flex-wrap gap-1">
        {analyzedModels.map((modelId) => {
          const model = AVAILABLE_MODELS.find(m => m.id === modelId);
          const modelData = currentImage?.issuesByModel?.[modelId];
          const issueCount = (modelData?.issues.length || 0) + (modelData?.deterministicIssues?.length || 0);
          const displayName = model?.name || (modelId.includes('gemini') ? 'Gemini 3 Pro' : modelId);

          const isProcessing = isCurrentProcessing && processingModelId === modelId;

          return (
            <button
              key={modelId}
              onClick={() => onActiveModelChange(modelId)}
              onContextMenu={(e) => handleContextMenu(e, modelId)}
              className={`relative flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all group ${
                activeModelTab === modelId
                  ? 'bg-white text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-secondary hover:bg-white/50'
              }`}
            >
              {isProcessing && <Loader2 size={10} className="animate-spin" />}
              <span>{displayName}</span>
              {issueCount > 0 && (
                <span className="bg-text-primary text-white text-[9px] px-1.5 rounded-full">{issueCount}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* 模型选择菜单 - 使用 Portal 确保在最顶层 */}
      {showModelMenu && createPortal(
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setShowModelMenu(false)}
          />
          <div className="fixed top-20 right-4 w-48 bg-surface-100 border border-border rounded-lg shadow-xl z-[9999] overflow-hidden">
            <div className="p-2 border-b border-border">
              <p className="text-[10px] text-text-muted">选择模型进行对比分析</p>
            </div>
            {availableModelsToAdd.map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  onAddModel(model.id);
                  setShowModelMenu(false);
                  onActiveModelChange(model.id);
                }}
                className="w-full px-3 py-2 text-left hover:bg-surface-200 transition-colors"
              >
                <div className="text-xs font-medium text-text-secondary">{model.name}</div>
                <div className="text-[10px] text-text-muted">{model.description}</div>
              </button>
            ))}
          </div>
        </>,
        document.body
      )}

      {currentImage?.description && (
        <div>
          <div className="flex items-center gap-2 px-3 py-2 text-[10px] font-medium text-text-muted bg-surface-50 border-b border-border/50">
            <FileText size={10} /> 图片描述
          </div>
          <div className="px-3 py-2 border-b border-border/50 bg-white">
            <p className="text-xs text-text-secondary">{currentImage.description}</p>
          </div>
        </div>
      )}

      <div ref={issueListRef} className="flex-1 overflow-y-auto">
        {!currentImage ? (
          <div className="text-center py-12 text-text-muted">
            <AlertCircle size={24} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs">上传图片后显示检测结果</p>
          </div>
        ) : (isCurrentProcessing && processingModelId === activeModelTab) ? (
          <div className="text-center py-12 text-text-muted">
            <Loader2 size={24} className="mx-auto mb-2 animate-spin" />
            <p className="text-xs">正在分析...</p>
          </div>
        ) : (
          <div>
            {currentTabData.deterministicIssues && currentTabData.deterministicIssues.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-3 py-2 text-[10px] font-medium text-text-muted bg-surface-50 border-b border-border/50">
                  <Brackets size={10} />
                  确定性问题
                </div>
                {currentTabData.deterministicIssues.map((issue) => {
                  const copyText = `类型: ${issue.type === 'bracket_mismatch' ? '括号不配对' : issue.type === 'encoding_error' ? '编码错误' : '格式错误'}\n问题: ${issue.description}\n位置: ${issue.location}`;
                  return (
                    <div key={issue.id} className="px-3 py-2 border-b border-border/50 last:border-b-0 bg-white group">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
                        <span className="text-[10px] font-medium text-red-600">
                          {issue.type === 'bracket_mismatch' ? '括号不配对' : issue.type === 'encoding_error' ? '编码错误' : '格式错误'}
                        </span>
                        <button
                          onClick={() => onCopy(copyText, issue.id)}
                          className="p-1 rounded hover:bg-surface-100 transition-colors opacity-0 group-hover:opacity-100 ml-auto"
                          title="复制"
                        >
                          {copiedId === issue.id ? <CheckCheck size={12} className="text-success" /> : <Copy size={12} className="text-text-muted" />}
                        </button>
                      </div>
                      <p className="text-xs text-text-primary mb-1">{issue.description}</p>
                      <div className="text-[10px] text-text-muted font-mono">{issue.location}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {currentTabData.issues.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-3 py-2 text-[10px] font-medium text-text-muted bg-surface-50 border-b border-border/50">
                  <ShieldAlert size={10} />
                  AI 建议
                </div>
                {currentTabData.issues.map((issue) => {
                  const displayOriginal = issue.original || issue.text || '';
                  const displayProblem = issue.problem || '';
                  const copyText = `原文: ${displayOriginal}\n问题: ${displayProblem}\n建议: ${issue.suggestion}`;

                  return (
                    <div
                      key={issue.id}
                      data-issue-id={issue.id}
                      onClick={() => onSelectIssue(issue.id)}
                      className={`px-3 py-2 border-b border-border/50 last:border-b-0 cursor-pointer transition-all group bg-white ${
                        selectedIssueId === issue.id ? 'bg-primary-50/50' : 'hover:bg-surface-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          issue.severity === 'high' ? 'bg-red-500' : issue.severity === 'medium' ? 'bg-amber-500' : 'bg-surface-300'
                        }`}></span>
                        <span className={`text-[10px] font-medium ${
                          issue.severity === 'high' ? 'text-red-600' : issue.severity === 'medium' ? 'text-amber-600' : 'text-text-muted'
                        }`}>
                          {issue.severity === 'high' ? '紧急' : issue.severity === 'medium' ? '警告' : '提示'}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); onCopy(copyText, issue.id); }}
                          className="p-1 rounded hover:bg-surface-100 transition-colors opacity-0 group-hover:opacity-100 ml-auto"
                          title="复制"
                        >
                          {copiedId === issue.id ? <CheckCheck size={12} className="text-success" /> : <Copy size={12} className="text-text-muted" />}
                        </button>
                      </div>

                      <p className="text-xs text-text-primary mb-1">{renderOriginal(displayOriginal)}</p>

                      {displayProblem && (
                        <p className="text-[11px] text-text-secondary mb-1">{displayProblem}</p>
                      )}

                      {issue.suggestion && (
                        <p className="text-[11px] text-text-secondary">→ {issue.suggestion}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {currentTabData.issues.length === 0 && (!currentTabData.deterministicIssues || currentTabData.deterministicIssues.length === 0) && (
              <div className="text-center py-12 text-text-muted">
                <CheckCircle size={24} className="mx-auto mb-2 text-emerald-500/50" />
                <p className="text-xs">未检测到问题</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 多模型对比弹窗 - 全屏沉浸式 */}
      {showCompareModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-surface-50 flex flex-col">
          {/* 顶部工具栏 */}
          <div className="shrink-0 h-14 flex items-center justify-between px-4 bg-white/50">
            {/* 图片工具 */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setModalZoom(z => Math.max(0.5, z - 0.25))}
                className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-100 transition-colors"
                title="缩小"
              >
                <ZoomOut size={18} />
              </button>
              <span className="text-xs text-text-muted w-12 text-center">{Math.round(modalZoom * 100)}%</span>
              <button
                onClick={() => setModalZoom(z => Math.min(3, z + 0.25))}
                className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-100 transition-colors"
                title="放大"
              >
                <ZoomIn size={18} />
              </button>
              <button
                onClick={() => setModalRotation(r => (r + 90) % 360)}
                className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-100 transition-colors ml-2"
                title="旋转"
              >
                <RotateCw size={18} />
              </button>
            </div>
            {/* 图片计数 */}
            <span className="text-xs text-text-muted">{safeModalIndex + 1} / {images.length}</span>
            {/* 关闭按钮 */}
            <button
              onClick={() => setShowCompareModal(false)}
              className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          {/* 主内容 */}
          <div className="flex-1 flex min-h-0">
            {/* 左侧：原图 + 导航 */}
            <div className="w-[42%] relative flex items-center justify-center p-6">
              {/* 上一张 */}
              {safeModalIndex > 0 && (
                <button
                  onClick={() => { setModalImageIndex(i => i - 1); setModalZoom(1); setModalRotation(0); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-surface-100/60 hover:bg-surface-200 text-text-muted hover:text-text-primary transition-colors"
                >
                  <ChevronLeft size={24} />
                </button>
              )}
              {modalImage && (
                <img
                  src={modalImage.src}
                  alt="原图"
                  className="max-w-full max-h-full object-contain rounded-xl shadow-2xl transition-transform duration-200"
                  style={{ transform: `scale(${modalZoom}) rotate(${modalRotation}deg)` }}
                />
              )}
              {/* 下一张 */}
              {safeModalIndex < images.length - 1 && (
                <button
                  onClick={() => { setModalImageIndex(i => i + 1); setModalZoom(1); setModalRotation(0); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-surface-100/60 hover:bg-surface-200 text-text-muted hover:text-text-primary transition-colors"
                >
                  <ChevronRight size={24} />
                </button>
              )}
            </div>
            {/* 右侧：模型结果对比 - 平滑滚动 */}
            <div className="flex-1 overflow-x-auto py-6 pr-6 scroll-smooth">
              <div className="flex gap-3 h-full" style={{ minWidth: `${(modalImage?.issuesByModel ? Object.keys(modalImage.issuesByModel).length : 1) * 270}px` }}>
                {(modalImage?.issuesByModel ? Object.keys(modalImage.issuesByModel) : [defaultModelId]).map((modelId) => {
                  const model = AVAILABLE_MODELS.find(m => m.id === modelId);
                  const modelData = modalImage?.issuesByModel?.[modelId];
                  const displayName = model?.name || (modelId.includes('gemini') ? 'Gemini 3 Pro' : modelId);
                  const issues = modelData?.issues || [];
                  const detIssues = modelData?.deterministicIssues || [];

                  return (
                    <div key={modelId} className="w-[260px] shrink-0 bg-white/80 rounded-xl flex flex-col backdrop-blur-sm">
                      <div className="px-4 py-3 shrink-0">
                        <span className="text-sm font-medium text-text-primary">{displayName}</span>
                        <span className="ml-2 text-xs text-text-muted">{issues.length + detIssues.length} 问题</span>
                      </div>
                      <div className="flex-1 px-3 pb-3 space-y-2 overflow-y-auto">
                        {detIssues.map((issue) => (
                          <div key={issue.id} className="p-3 rounded-lg bg-red-500/10 text-[11px]">
                            <span className="text-red-400 font-medium text-[10px]">确定性问题</span>
                            <p className="text-red-300 mt-1">{issue.description}</p>
                          </div>
                        ))}
                        {issues.map((issue) => (
                          <div key={issue.id} className="p-3 rounded-lg bg-surface-100/60 text-[11px]">
                            <div className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-medium mb-1.5 ${
                              issue.severity === 'high' ? 'bg-red-500/20 text-red-400' :
                              issue.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-text-muted/50 text-text-muted'
                            }`}>
                              {issue.severity === 'high' ? '紧急' : issue.severity === 'medium' ? '警告' : '提示'}
                            </div>
                            <p className="text-text-primary">{issue.original || issue.text}</p>
                            {issue.problem && <p className="text-text-muted mt-1.5 text-[10px]">{issue.problem}</p>}
                          </div>
                        ))}
                        {issues.length === 0 && detIssues.length === 0 && (
                          <div className="text-center py-12 text-text-muted text-xs">无问题</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 右键菜单 */}
      {contextMenu && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-[9999] bg-surface-100 border border-border rounded-lg shadow-xl py-1 min-w-[120px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => handleCopyModelResult(contextMenu.modelId)}
              className="w-full px-3 py-1.5 text-left text-xs text-text-secondary hover:bg-surface-200 flex items-center gap-2"
            >
              <Copy size={12} /> 复制全文
            </button>
            {analyzedModels.length > 1 && (
              <button
                onClick={() => handleDeleteModel(contextMenu.modelId)}
                className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-surface-200 flex items-center gap-2"
              >
                <X size={12} /> 删除
              </button>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
};
