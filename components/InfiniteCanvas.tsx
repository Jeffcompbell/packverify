import React, { useRef, useEffect, useState } from 'react';
import { CanvasTransform, DiagnosisIssue, DiffResult, ViewLayers, BoundingBox } from '../types';
import { AlertCircle, CheckCircle, Info, XCircle, ImagePlus } from 'lucide-react';

interface InfiniteCanvasProps {
  imageSrc: string | null;
  transform: CanvasTransform;
  onTransformChange: (t: CanvasTransform) => void;
  layers: ViewLayers;
  diagnosisIssues: DiagnosisIssue[];
  diffResults: DiffResult[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpload: (file: File) => void;
  isProcessing: boolean;
}

export const InfiniteCanvas: React.FC<InfiniteCanvasProps> = ({
  imageSrc,
  transform,
  onTransformChange,
  layers,
  diagnosisIssues,
  diffResults,
  selectedId,
  onSelect,
  onUpload,
  isProcessing
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [isDragOver, setIsDragOver] = useState(false);

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
      className={`flex-1 overflow-hidden bg-slate-900 relative cursor-${isDragging ? 'grabbing' : 'grab'}`}
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

      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-indigo-500/20 border-4 border-indigo-500 border-dashed flex items-center justify-center pointer-events-none">
          <div className="bg-slate-900 px-6 py-4 rounded-full font-bold text-white shadow-xl animate-bounce">
            Drop to analyze
          </div>
        </div>
      )}

      <div
        className="absolute origin-top-left transition-transform duration-75 ease-out will-change-transform"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
        }}
      >
        <div className="relative shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-white/5">
          {imageSrc ? (
            <>
              <img
                src={imageSrc}
                alt="Packaging Design"
                className={`block max-w-none pointer-events-none select-none transition-opacity duration-300 ${isProcessing ? 'opacity-80' : 'opacity-100'}`}
                draggable={false}
              />
              {isProcessing && (
                <div className="absolute inset-0 z-50 overflow-hidden rounded-sm">
                  {/* Scanning Line */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.8)] animate-[scan_2s_linear_infinite]"
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

                  {/* Processing Badge */}
                  <div className="absolute bottom-4 right-4 bg-slate-900/90 backdrop-blur border border-indigo-500/50 text-white px-3 py-1.5 rounded-full shadow-xl flex items-center gap-2">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                    <span className="text-xs font-bold tracking-wide">AI Analyzing...</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            // Placeholder if user manages to clear the mock image
            <div className="w-[800px] h-[600px] bg-slate-800 flex flex-col items-center justify-center border-2 border-slate-700 border-dashed rounded-lg">
              <ImagePlus className="text-slate-600 mb-4" size={48} />
              <p className="text-slate-500 font-bold">No Image Loaded</p>
              <p className="text-slate-600 text-sm">Drag & drop to begin</p>
            </div>
          )}

          {/* Diagnosis Layer */}
          {imageSrc && layers.diagnosis && diagnosisIssues.map(issue => (
            issue.box_2d && (
              <div
                key={issue.id}
                onClick={(e) => { e.stopPropagation(); onSelect(issue.id); }}
                className={`absolute rounded cursor-pointer group hover:z-50 transition-all duration-300 ${selectedId === issue.id
                    ? 'border-2 border-indigo-400 bg-indigo-400/20 shadow-[0_0_15px_rgba(99,102,241,0.5)] z-40'
                    : issue.severity === 'high'
                      ? 'border border-red-500/80 bg-red-500/10 hover:bg-red-500/30'
                      : 'border border-amber-400/80 bg-amber-400/10 hover:bg-amber-400/30'
                  }`}
                style={getStyleForBox(issue.box_2d)}
              >
                {/* Connector Line (visible when selected) */}
                {selectedId === issue.id && (
                  <div className="absolute top-0 right-0 w-8 h-[1px] bg-indigo-400 translate-x-full mt-2 pointer-events-none opacity-50" />
                )}

                {/* Tooltip Bubble */}
                <div className={`absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-medium px-2 py-1 rounded shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none flex items-center gap-1 border border-slate-700 z-50 -translate-y-1 group-hover:translate-y-0 ${selectedId === issue.id ? 'opacity-100 translate-y-0' : ''}`}>
                  {issue.type === 'content' && <AlertCircle size={10} className="text-red-400" />}
                  {issue.type === 'compliance' && <Info size={10} className="text-amber-400" />}
                  {issue.text}
                </div>
              </div>
            )
          ))}

          {/* Diff Layer */}
          {imageSrc && layers.diff && diffResults.map(res => (
            res.box_2d && (
              <div
                key={res.id}
                onClick={(e) => { e.stopPropagation(); onSelect(res.id); }}
                className={`absolute rounded cursor-pointer group hover:z-50 transition-all duration-300 ${selectedId === res.id
                    ? 'z-40 ring-2 ring-white shadow-xl'
                    : ''
                  } ${res.status === 'match'
                    ? 'border border-emerald-500/50 hover:bg-emerald-500/20'
                    : 'border-2 border-red-500/80 bg-red-500/10 hover:bg-red-500/30 animate-pulse'
                  }`}
                style={getStyleForBox(res.box_2d)}
              >
                {res.status !== 'match' && (
                  <div className={`absolute -bottom-7 left-1/2 -translate-x-1/2 bg-red-900/90 text-white text-[10px] px-2 py-0.5 rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-red-500/50 flex items-center gap-1 ${selectedId === res.id ? 'opacity-100' : ''}`}>
                    <XCircle size={10} className="text-red-200" />
                    <span>Difference detected</span>
                  </div>
                )}
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
};