import React, { useRef, useEffect, useState } from 'react';
import { CanvasTransform, DiagnosisIssue, DiffResult, ViewLayers, BoundingBox, ImageItem } from '../types';
import { AlertCircle, CheckCircle, Info, XCircle, ImagePlus, Loader2, Trash2, FileText, AlertTriangle, RefreshCw, Copy, CheckCheck, Upload, GripVertical, Eye, FileSearch, CheckSquare } from 'lucide-react';

interface InfiniteCanvasProps {
  images: ImageItem[];
  transform: CanvasTransform;
  onTransformChange: (t: CanvasTransform) => void;
  layers: ViewLayers;
  diagnosisIssues: DiagnosisIssue[];
  diffResults: DiffResult[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpload: (file: File) => void;
  isProcessing: boolean;
  processingImageId: string | null;
  processingStep?: number; // 1=视觉分析, 2=OCR提取, 3=终审验证
  onRemoveImage: (id: string) => void;
  onRetryAnalysis?: (imageId: string) => void;
}

export const InfiniteCanvas: React.FC<InfiniteCanvasProps> = ({
  images,
  transform,
  onTransformChange,
  layers,
  diagnosisIssues,
  diffResults,
  selectedId,
  onSelect,
  onUpload,
  isProcessing,
  processingImageId,
  processingStep = 1,
  onRemoveImage,
  onRetryAnalysis
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [isDragOver, setIsDragOver] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dragHandleActive, setDragHandleActive] = useState<string | null>(null);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUpload(e.target.files[0]);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const scaleFactor = 0.1;
      const newScale = Math.max(0.1, Math.min(5, transform.scale - Math.sign(e.deltaY) * scaleFactor));
      onTransformChange({ ...transform, scale: newScale });
    } else {
      onTransformChange({
        ...transform,
        x: transform.x - e.deltaX,
        y: transform.y - e.deltaY,
      });
    }
  };

  // 只有在拖动手柄激活时才允许拖动画布
  const handleMouseDown = (e: React.MouseEvent) => {
    // 检查是否点击在卡片内部（非拖动手柄）
    const target = e.target as HTMLElement;
    const isInsideCard = target.closest('.image-card-content');

    if (isInsideCard && !dragHandleActive) {
      // 点击在卡片内容区域，不拖动画布
      return;
    }

    if (e.button === 0 || e.button === 1) {
      setIsDragging(true);
      setLastMouse({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - lastMouse.x;
    const deltaY = e.clientY - lastMouse.y;
    onTransformChange({
      ...transform,
      x: transform.x + deltaX,
      y: transform.y + deltaY,
    });
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragHandleActive(null);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const preventDefault = (e: WheelEvent) => e.preventDefault();
    container.addEventListener('wheel', preventDefault, { passive: false });
    return () => container.removeEventListener('wheel', preventDefault);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      onUpload(file);
    }
  };

  const getStyleForBox = (box: BoundingBox) => ({
    top: `${box.ymin / 10}%`,
    left: `${box.xmin / 10}%`,
    height: `${(box.ymax - box.ymin) / 10}%`,
    width: `${(box.xmax - box.xmin) / 10}%`,
  });

  // 三步分析进度组件
  const AnalysisProgress = ({ step }: { step: number }) => (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur border border-indigo-500/50 text-white px-4 py-3 rounded-xl shadow-xl z-50">
      <div className="flex items-center gap-4">
        {/* Step 1 */}
        <div className={`flex items-center gap-2 ${step >= 1 ? 'text-indigo-400' : 'text-slate-600'}`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center ${step === 1 ? 'bg-indigo-500 animate-pulse' : step > 1 ? 'bg-emerald-500' : 'bg-slate-700'}`}>
            {step > 1 ? <CheckCircle size={14} /> : <Eye size={14} />}
          </div>
          <span className="text-[10px] font-medium">视觉分析</span>
        </div>

        <div className={`w-8 h-0.5 ${step > 1 ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>

        {/* Step 2 */}
        <div className={`flex items-center gap-2 ${step >= 2 ? 'text-indigo-400' : 'text-slate-600'}`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center ${step === 2 ? 'bg-indigo-500 animate-pulse' : step > 2 ? 'bg-emerald-500' : 'bg-slate-700'}`}>
            {step > 2 ? <CheckCircle size={14} /> : <FileSearch size={14} />}
          </div>
          <span className="text-[10px] font-medium">OCR提取</span>
        </div>

        <div className={`w-8 h-0.5 ${step > 2 ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>

        {/* Step 3 */}
        <div className={`flex items-center gap-2 ${step >= 3 ? 'text-indigo-400' : 'text-slate-600'}`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center ${step === 3 ? 'bg-indigo-500 animate-pulse' : 'bg-slate-700'}`}>
            <CheckSquare size={14} />
          </div>
          <span className="text-[10px] font-medium">终审验证</span>
        </div>
      </div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden bg-slate-900 ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Technical Grid Background */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          transform: `translate(${transform.x % 20}px, ${transform.y % 20}px)`
        }}
      />

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
      />

      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-indigo-500/20 border-4 border-indigo-500 border-dashed flex items-center justify-center pointer-events-none">
          <div className="bg-slate-900 px-6 py-4 rounded-full font-bold text-white shadow-xl animate-bounce">
            拖放上传
          </div>
        </div>
      )}

      <div
        className="absolute origin-top-left transition-transform duration-75 ease-out will-change-transform"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
        }}
      >
        <div className="flex gap-8 p-10">
          {/* 已上传的图片 - 每张图片是一个完整卡片 */}
          {images.map((imgItem) => {
            const isThisProcessing = processingImageId === imgItem.id;
            return (
              <div key={imgItem.id} className="relative group shrink-0 flex flex-col bg-slate-800/30 rounded-xl overflow-hidden border border-slate-700/50 shadow-2xl" style={{ width: '420px' }}>

                {/* 左上角拖动手柄 */}
                <div
                  className="absolute top-0 left-0 z-30 p-2 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDragHandleActive(imgItem.id);
                    setIsDragging(true);
                    setLastMouse({ x: e.clientX, y: e.clientY });
                  }}
                >
                  <div className="bg-slate-800/90 backdrop-blur p-1.5 rounded-lg border border-slate-600/50 hover:bg-slate-700 transition-colors">
                    <GripVertical size={16} className="text-slate-400" />
                  </div>
                </div>

                {/* 顶部：图片区域 */}
                <div className="relative" style={{ transform: `rotate(${imgItem.rotation || 0}deg)`, transformOrigin: 'center' }}>
                  <img
                    src={imgItem.src}
                    alt="包装设计"
                    className={`block w-full max-h-[400px] object-contain bg-slate-900 ${isThisProcessing ? 'opacity-60' : 'opacity-100'}`}
                    draggable={false}
                  />

                  {/* 悬停时显示文件名、重试和删除按钮 */}
                  <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[11px] text-white bg-black/70 backdrop-blur px-2.5 py-1.5 rounded truncate max-w-[200px]">{imgItem.file.name}</span>
                    {onRetryAnalysis && !isThisProcessing && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onRetryAnalysis(imgItem.id); }}
                        className="p-1.5 bg-indigo-500/80 hover:bg-indigo-500 text-white rounded-full transition-colors"
                        title="重新分析 (切换模型后可重试)"
                      >
                        <RefreshCw size={12} />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemoveImage(imgItem.id); }}
                      className="p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-full transition-colors"
                      title="删除"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* 扫描动画 + 三步进度 */}
                  {isThisProcessing && (
                    <div className="absolute inset-0 z-50 overflow-hidden pointer-events-none">
                      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-400 via-purple-500 to-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.8)]"
                        style={{ animation: 'scan 2s linear infinite' }}
                      />
                      <style>{`
                        @keyframes scan {
                          0% { top: 0%; opacity: 0; }
                          10% { opacity: 1; }
                          90% { opacity: 1; }
                          100% { top: 100%; opacity: 0; }
                        }
                      `}</style>
                      <div className="absolute inset-0 bg-indigo-500/5 backdrop-blur-[1px]" />
                      <AnalysisProgress step={processingStep} />
                    </div>
                  )}

                  {/* Diagnosis Layer - 问题高亮框 */}
                  {layers.diagnosis && imgItem.issues.map(issue => (
                    issue.box_2d && (
                      <div
                        key={issue.id}
                        onClick={(e) => { e.stopPropagation(); onSelect(issue.id); }}
                        className={`absolute rounded cursor-pointer group/issue hover:z-50 transition-all duration-300 ${selectedId === issue.id
                          ? 'border-2 border-indigo-400 bg-indigo-400/20 shadow-[0_0_15px_rgba(99,102,241,0.5)] z-40'
                          : issue.severity === 'high'
                            ? 'border border-red-500/80 bg-red-500/10 hover:bg-red-500/30'
                            : 'border border-amber-400/80 bg-amber-400/10 hover:bg-amber-400/30'
                          }`}
                        style={getStyleForBox(issue.box_2d)}
                      >
                        <div className={`absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-medium px-2 py-1 rounded shadow-xl whitespace-nowrap opacity-0 group-hover/issue:opacity-100 transition-all pointer-events-none flex items-center gap-1 border border-slate-700 z-50 ${selectedId === issue.id ? 'opacity-100' : ''}`}>
                          {issue.type === 'content' && <AlertCircle size={10} className="text-red-400" />}
                          {issue.type === 'compliance' && <Info size={10} className="text-amber-400" />}
                          {issue.original || issue.text}
                        </div>
                      </div>
                    )
                  ))}

                  {/* Diff Layer */}
                  {layers.diff && imgItem.diffs && imgItem.diffs.map(res => (
                    res.box_2d && (
                      <div
                        key={res.id}
                        onClick={(e) => { e.stopPropagation(); onSelect(res.id); }}
                        className={`absolute rounded cursor-pointer group/diff hover:z-50 transition-all duration-300 ${selectedId === res.id
                          ? 'z-40 ring-2 ring-white shadow-xl'
                          : ''
                          } ${res.status === 'match'
                            ? 'border border-emerald-500/50 hover:bg-emerald-500/20'
                            : 'border-2 border-red-500/80 bg-red-500/10 hover:bg-red-500/30 animate-pulse'
                          }`}
                        style={getStyleForBox(res.box_2d)}
                      >
                        {res.status !== 'match' && (
                          <div className={`absolute -bottom-7 left-1/2 -translate-x-1/2 bg-red-900/90 text-white text-[10px] px-2 py-0.5 rounded shadow-lg whitespace-nowrap opacity-0 group-hover/diff:opacity-100 transition-opacity pointer-events-none border border-red-500/50 flex items-center gap-1 ${selectedId === res.id ? 'opacity-100' : ''}`}>
                            <XCircle size={10} className="text-red-200" />
                            <span>检测到差异</span>
                          </div>
                        )}
                      </div>
                    )
                  ))}
                </div>

                {/* 下部：分析结果区域 - 可滚动，阻止事件冒泡 */}
                <div
                  className="image-card-content flex-1 flex flex-col bg-slate-900/50 overflow-y-auto cursor-default"
                  style={{ maxHeight: '400px' }}
                  onMouseDown={(e) => e.stopPropagation()}
                >

                  {/* 图片描述 */}
                  {imgItem.description && (
                    <div className="px-4 py-3 border-b border-slate-700/50">
                      <div className="flex items-center gap-2 mb-1.5">
                        <FileText size={12} className="text-indigo-400" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">图片描述</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{imgItem.description}</p>
                    </div>
                  )}

                  {/* 检测问题 - List 形式 */}
                  <div className="flex-1">
                    <div className="px-4 py-2 flex items-center gap-2 bg-slate-800/30 border-b border-slate-700/50">
                      <AlertTriangle size={12} className="text-amber-400" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">检测问题</span>
                      {imgItem.issues.length > 0 ? (
                        <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded ml-auto">{imgItem.issues.length} 个问题</span>
                      ) : !isThisProcessing && (
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded ml-auto">✓ 通过</span>
                      )}
                      {!isThisProcessing && imgItem.analysisDuration && (
                        <span className="text-[9px] text-slate-500">{(imgItem.analysisDuration / 1000).toFixed(1)}s</span>
                      )}
                    </div>

                    {isThisProcessing ? (
                      <div className="flex items-center justify-center py-8 text-slate-500">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-xs">AI 正在分析...</span>
                        </div>
                      </div>
                    ) : imgItem.issues.length === 0 ? (
                      <div className="flex items-center justify-center py-6 text-slate-600">
                        <CheckCircle size={16} className="mr-2 text-emerald-500/50" />
                        <span className="text-xs">未检测到问题</span>
                      </div>
                    ) : (
                      <div className="p-3 space-y-2">
                        {imgItem.issues.map((issue) => {
                          // 兼容新旧格式
                          const displayOriginal = issue.original || issue.text || '';
                          const displayProblem = issue.problem || '';
                          const copyText = `原文: ${displayOriginal}\n问题: ${displayProblem}\n建议: ${issue.suggestion}`;

                          return (
                            <div
                              key={issue.id}
                              onClick={() => onSelect(issue.id)}
                              className={`p-3 rounded-lg cursor-pointer transition-all group/issue ${
                                selectedId === issue.id
                                  ? 'bg-indigo-500/20 border border-indigo-500/50'
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
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopy(copyText, issue.id);
                                  }}
                                  className="ml-auto p-1 rounded hover:bg-slate-700 transition-colors opacity-0 group-hover/issue:opacity-100"
                                  title="复制问题"
                                >
                                  {copiedId === issue.id ? (
                                    <CheckCheck size={12} className="text-emerald-400" />
                                  ) : (
                                    <Copy size={12} className="text-slate-500" />
                                  )}
                                </button>
                              </div>

                              {/* 原文（简短） */}
                              <div className="mb-1.5">
                                <span className="text-[10px] text-slate-500">原文：</span>
                                <span className="text-xs text-red-300 font-mono bg-red-500/10 px-1.5 py-0.5 rounded ml-1">{displayOriginal}</span>
                              </div>

                              {/* 问题描述 */}
                              {displayProblem && (
                                <p className="text-xs text-slate-300 mb-1.5">{displayProblem}</p>
                              )}

                              {/* 修改建议 */}
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
                  </div>
                </div>
              </div>
            );
          })}

          {/* 添加新图片的空白卡片 - 默认粘贴，点击按钮上传 */}
          {images.length < 8 && (
            <div
              className="w-[420px] min-h-[500px] bg-slate-800/20 transition-all flex flex-col items-center justify-center border-2 border-slate-700/50 border-dashed rounded-xl group shrink-0 hover:border-indigo-500/50 hover:bg-slate-800/30"
            >
              <div className="p-5 bg-slate-800/50 rounded-full mb-4 group-hover:scale-105 transition-all">
                <ImagePlus className="text-slate-400" size={40} />
              </div>
              <p className="text-slate-400 font-medium text-base">Ctrl+V 粘贴图片</p>
              <p className="text-slate-600 text-sm mt-2">或拖拽图片到任意位置</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-6 px-4 py-2 bg-indigo-600/80 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <Upload size={16} />
                选择文件上传
              </button>
              <p className="text-slate-700 text-xs mt-4">{images.length}/8 张</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
