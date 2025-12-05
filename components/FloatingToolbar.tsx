import React from 'react';
import { ViewLayers } from '../types';
import { ScanEye, FileDiff, ZoomIn, ZoomOut, Maximize, ImagePlus, RotateCcw } from 'lucide-react';

interface FloatingToolbarProps {
  layers: ViewLayers;
  onToggleLayer: (layer: keyof ViewLayers) => void;
  onZoom: (dir: 'in' | 'out') => void;
  onFit: () => void;
  onUpload: (file: File) => void;
  onReset: () => void;
  // Unused props removed for cleanliness
  onNext: () => void;
  canProceed: boolean;
  nextLabel: string;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  layers,
  onToggleLayer,
  onZoom,
  onFit,
  onUpload,
  onReset
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUpload(e.target.files[0]);
    }
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 z-30 pointer-events-none">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
      />

      {/* Action Controls */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-full p-1.5 shadow-2xl flex items-center gap-1 pointer-events-auto mr-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-indigo-400 hover:text-white hover:bg-indigo-600 rounded-full transition-colors"
          title="Upload Image"
        >
          <ImagePlus size={16} />
        </button>
        <button
          onClick={onReset}
          className="p-2 text-red-400 hover:text-white hover:bg-red-600 rounded-full transition-colors"
          title="Reset / Clear All"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* View Controls */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-full p-1.5 shadow-2xl flex items-center gap-1 pointer-events-auto">
        <button onClick={() => onZoom('out')} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-full transition-colors" title="Zoom Out">
          <ZoomOut size={16} />
        </button>
        <button onClick={onFit} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-full transition-colors" title="Fit to Screen">
          <Maximize size={16} />
        </button>
        <button onClick={() => onZoom('in')} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-full transition-colors" title="Zoom In">
          <ZoomIn size={16} />
        </button>
      </div>

      {/* Layer Toggles */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-full p-1.5 shadow-2xl flex items-center gap-2 pointer-events-auto px-4">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mr-2 select-none">Layers</div>

        <button
          onClick={() => onToggleLayer('diagnosis')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${layers.diagnosis
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
        >
          <ScanEye size={14} /> Issues
        </button>

        <button
          onClick={() => onToggleLayer('diff')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${layers.diff
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
        >
          <FileDiff size={14} /> Diff
        </button>
      </div>
    </div>
  );
};