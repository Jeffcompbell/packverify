import React, { useRef, useEffect, useState } from 'react';
import { CanvasTransform, DiagnosisIssue, DiffResult, ViewLayers, BoundingBox, ImageItem } from '../types';
import { AlertCircle, CheckCircle, Info, XCircle, ImagePlus, Loader2, Trash2, FileText, AlertTriangle, Package } from 'lucide-react';

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
  onRemoveImage: (id: string) => void;
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
  onRemoveImage
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUpload(e.target.files[0]);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Enable zoom even if no image, for effect
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

  const handleMouseDown = (e: React.MouseEvent) => {
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

  const handleMouseUp = () => setIsDragging(false);

  // Native wheel handler to support non-passive prevention
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

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden bg-slate-900 cursor-${isDragging ? 'grabbing' : 'grab'}`}
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

                {/* 顶部：图片区域 */}
                <div className="relative">
                  <img
                    src={imgItem.src}
                    alt="包装设计"
                    className={`block w-full max-h-[400px] object-contain bg-slate-900 ${isThisProcessing ? 'opacity-60' : 'opacity-100'}`}
                    draggable={false}
                  />

                  {/* 悬停时显示文件名和删除按钮 */}
                  <div className="absolute top-2 left-2 right-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[11px] text-white bg-black/70 backdrop-blur px-2.5 py-1.5 rounded truncate max-w-[280px]">{imgItem.file.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemoveImage(imgItem.id); }}
                      className="p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-full transition-colors"
                      title="删除"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* 扫描动画 */}
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
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur border border-indigo-500/50 text-white px-5 py-2.5 rounded-full shadow-xl flex items-center gap-2">
                        <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                        <span className="text-sm font-bold tracking-wide">AI 分析中...</span>
                      </div>
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
                          {issue.text}
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

                {/* 下部：分析结果区域 */}
                <div className="flex-1 flex flex-col bg-slate-900/50 max-h-[350px] overflow-y-auto">

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

                  {/* 参数表格 */}
                  {imgItem.specs && imgItem.specs.length > 0 && (
                    <div className="border-b border-slate-700/50">
                      <div className="px-4 py-2 flex items-center gap-2 bg-slate-800/30">
                        <Package size={12} className="text-emerald-400" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">提取参数</span>
                        <span className="text-[9px] text-slate-500 ml-auto">{imgItem.specs.length} 项</span>
                      </div>
                      <table className="w-full text-[11px]">
                        <thead className="bg-slate-800/50">
                          <tr>
                            <th className="px-3 py-1.5 text-left text-slate-500 font-medium w-24">分类</th>
                            <th className="px-3 py-1.5 text-left text-slate-500 font-medium w-28">项目</th>
                            <th className="px-3 py-1.5 text-left text-slate-500 font-medium">值</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/30">
                          {imgItem.specs.map((spec, idx) => (
                            <tr key={idx} className="hover:bg-slate-800/30">
                              <td className="px-3 py-1.5 text-slate-500 font-mono text-[10px]">{spec.category}</td>
                              <td className="px-3 py-1.5 text-slate-300">{spec.key}</td>
                              <td className="px-3 py-1.5 text-slate-400 font-mono">{spec.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* 问题表格 */}
                  <div className="flex-1">
                    <div className="px-4 py-2 flex items-center gap-2 bg-slate-800/30">
                      <AlertTriangle size={12} className="text-amber-400" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">检测问题</span>
                      {imgItem.issues.length > 0 ? (
                        <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded ml-auto">{imgItem.issues.length} 个问题</span>
                      ) : !isThisProcessing && (
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded ml-auto">✓ 通过</span>
                      )}
                    </div>

                    {isThisProcessing ? (
                      <div className="flex items-center justify-center py-6 text-slate-500">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-[11px]">分析中...</span>
                        </div>
                      </div>
                    ) : imgItem.issues.length === 0 ? (
                      <div className="flex items-center justify-center py-4 text-slate-600">
                        <CheckCircle size={14} className="mr-1.5 text-emerald-500/50" />
                        <span className="text-[11px]">未检测到问题</span>
                      </div>
                    ) : (
                      <table className="w-full text-[11px]">
                        <thead className="bg-slate-800/50">
                          <tr>
                            <th className="px-3 py-1.5 text-left text-slate-500 font-medium w-16">级别</th>
                            <th className="px-3 py-1.5 text-left text-slate-500 font-medium w-20">类型</th>
                            <th className="px-3 py-1.5 text-left text-slate-500 font-medium">问题描述</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/30">
                          {imgItem.issues.map((issue) => (
                            <tr
                              key={issue.id}
                              onClick={() => onSelect(issue.id)}
                              className={`cursor-pointer transition-colors ${selectedId === issue.id ? 'bg-indigo-500/20' : 'hover:bg-slate-800/30'}`}
                            >
                              <td className="px-3 py-1.5">
                                <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                  issue.severity === 'high'
                                    ? 'bg-red-500/20 text-red-400'
                                    : issue.severity === 'medium'
                                      ? 'bg-amber-500/20 text-amber-400'
                                      : 'bg-slate-500/20 text-slate-400'
                                }`}>
                                  {issue.severity === 'high' ? '紧急' : issue.severity === 'medium' ? '警告' : '提示'}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-slate-400 font-mono text-[10px]">{issue.type}</td>
                              <td className="px-3 py-1.5">
                                <p className="text-slate-300 truncate max-w-[200px]" title={issue.text}>{issue.text}</p>
                                {issue.suggestion && (
                                  <p className="text-[10px] text-slate-500 truncate max-w-[200px]" title={issue.suggestion}>{issue.suggestion}</p>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* 添加新图片的空白卡片 */}
          {images.length < 8 && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-[420px] min-h-[500px] bg-slate-800/20 hover:bg-slate-800/40 transition-all flex flex-col items-center justify-center border-2 border-slate-700/50 border-dashed rounded-xl cursor-pointer group shrink-0 hover:border-indigo-500/50"
            >
              <div className="p-5 bg-slate-800/50 rounded-full mb-4 group-hover:scale-110 group-hover:bg-indigo-600/30 transition-all">
                <ImagePlus className="text-slate-400 group-hover:text-indigo-400" size={40} />
              </div>
              <p className="text-slate-400 font-medium text-base group-hover:text-slate-300">点击添加图片</p>
              <p className="text-slate-600 text-sm mt-2">或拖拽/粘贴上传</p>
              <p className="text-slate-700 text-xs mt-6">{images.length}/8 张</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};