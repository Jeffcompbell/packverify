import React, { useState, useEffect, useCallback } from 'react';
import { InfiniteCanvas } from './components/InfiniteCanvas';
import { InspectorSidebar } from './components/InspectorSidebar';
import { FloatingToolbar } from './components/FloatingToolbar';
// Services
import { diagnoseImage, fileToGenerativePart, parseSourceText, performSmartDiff, extractProductSpecs, AVAILABLE_MODELS, getModelId, setModelId } from './services/openaiService';
import { DiagnosisIssue, SourceField, DiffResult, ViewLayers, CanvasTransform, ImageItem, ImageSpec } from './types';
import { Table, Zap, LayoutGrid, AlertCircle, XCircle, ChevronDown } from 'lucide-react';

const App: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingImageId, setProcessingImageId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Data
  const [images, setImages] = useState<ImageItem[]>([]);
  // Derived state for the "active" or "latest" image for sidebar display (optional, or just show aggregate/latest)
  // For simplicity, let's keep diagnosisIssues/diffResults as "current view" or "latest processed"
  const [diagnosisIssues, setDiagnosisIssues] = useState<DiagnosisIssue[]>([]);
  const [manualSourceFields, setManualSourceFields] = useState<SourceField[]>([]); // 用户手动输入解析的字段
  const [diffResults, setDiffResults] = useState<DiffResult[]>([]);
  const [specsTab, setSpecsTab] = useState<string>('all'); // 底部规格表当前选中的Tab

  // UI State
  const [transform, setTransform] = useState<CanvasTransform>({ x: 50, y: 50, scale: 1 });
  const [layers, setLayers] = useState<ViewLayers>({ diagnosis: true, diff: true });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState(getModelId());
  const [showModelSelector, setShowModelSelector] = useState(false);

  // Load Mock Data on Mount
  useEffect(() => {
    // Start with better initial position - larger scale for visibility
    setTransform({ x: 40, y: 40, scale: 1 });
  }, []);

  // Check for API Key on mount
  useEffect(() => {
    if (!import.meta.env.VITE_OPENAI_API_KEY) {
      setErrorMessage("Missing VITE_OPENAI_API_KEY in .env.local");
    }
  }, []);

  // --- Handlers ---

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage("请上传图片文件");
      return;
    }

    if (images.length >= 8) {
      setErrorMessage("最多支持 8 张图片");
      return;
    }

    const newImageId = `img-${Date.now()}`;

    try {
      console.log("Processing file:", file.name);
      const url = URL.createObjectURL(file);
      const base64 = await fileToGenerativePart(file);
      console.log("File converted to base64");

      // 先添加到images，再设置processing状态
      const newImage: ImageItem = {
        id: newImageId,
        src: url,
        base64: base64,
        file: file,
        specs: [],
        issues: [],
        diffs: []
      };

      setImages(prev => [...prev, newImage]);

      // 设置处理状态（在图片添加后）
      setIsProcessing(true);
      setProcessingImageId(newImageId);
      setErrorMessage(null);

      // Auto-fit if it's the first image - position to be visible
      if (images.length === 0) {
        // 设置一个合适的位置，scale=1 保持原始大小
        setTransform({
          x: 40,
          y: 40,
          scale: 1
        });
      }

      // Analyze
      console.log("Starting diagnosis...");
      const diagResult = await diagnoseImage(base64, file.type);
      console.log("Diagnosis complete:", diagResult);

      setImages(prev => prev.map(img =>
        img.id === newImageId ? { ...img, issues: diagResult.issues, description: diagResult.description } : img
      ));

      // 更新全局诊断问题列表（用于底部面板显示）
      setDiagnosisIssues(prev => [...prev, ...diagResult.issues.map(issue => ({
        ...issue,
        imageId: newImageId,
        imageName: file.name
      }))]);

      // 提取产品规格到规格表（每张图片都提取）
      console.log("Extracting product specs...");
      const specs = await extractProductSpecs(base64, file.type);
      console.log("Specs extracted:", specs);

      // 将规格存储到当前图片
      const imageSpecs: ImageSpec[] = specs.map(s => ({
        key: s.key,
        value: s.value,
        category: s.category
      }));

      setImages(prev => prev.map(img =>
        img.id === newImageId ? { ...img, specs: imageSpecs } : img
      ));

      // 如果已有手动输入的规格，对比差异
      if (manualSourceFields.length > 0) {
        console.log("Starting diff with manual specs...");
        const diffs = await performSmartDiff(base64, manualSourceFields);
        console.log("Diff complete:", diffs);
        setImages(prev => prev.map(img =>
          img.id === newImageId ? { ...img, diffs } : img
        ));
        setDiffResults(prev => [...prev, ...diffs]);
      }

    } catch (error: any) {
      console.error("Processing failed:", error);
      setErrorMessage(error.message || "图片处理失败");
    } finally {
      setIsProcessing(false);
      setProcessingImageId(null);
    }
  }, [images.length, manualSourceFields]); // Dependencies

  const handleFileUpload = (file: File) => {
    processFile(file);
  };

  const handleParseSource = async (text: string) => {
    setIsProcessing(true);
    try {
      const fields = await parseSourceText(text);
      setManualSourceFields(fields);

      // Re-run diff on the LATEST image if available
      const latestImage = images[images.length - 1];
      if (latestImage) {
        const diffs = await performSmartDiff(latestImage.base64, fields);
        setDiffResults(diffs);
      }
    } catch (err) {
      setErrorMessage("Failed to parse source text.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setImages([]);
    setDiagnosisIssues([]);
    setManualSourceFields([]);
    setDiffResults([]);
    setErrorMessage(null);
    setSpecsTab('all');
  };

  const handleZoom = (dir: 'in' | 'out') => {
    setTransform(prev => ({
      ...prev,
      scale: dir === 'in' ? prev.scale * 1.2 : prev.scale / 1.2
    }));
  };

  const handleFit = () => {
    setTransform(prev => ({ ...prev, scale: 0.45, x: 100, y: 50 }));
  };

  const handleModelChange = (modelId: string) => {
    setModelId(modelId);
    setCurrentModel(modelId);
    setShowModelSelector(false);
  };

  // Retry analysis for a specific image (useful when switching models)
  const handleRetryAnalysis = useCallback(async (imageId: string) => {
    const image = images.find(img => img.id === imageId);
    if (!image) return;

    try {
      setIsProcessing(true);
      setProcessingImageId(imageId);
      setErrorMessage(null);

      console.log("Retrying analysis for image:", imageId, "with model:", currentModel);

      // Re-run diagnosis
      const diagResult = await diagnoseImage(image.base64, image.file.type);
      console.log("Retry diagnosis complete:", diagResult);

      // Update image with new results
      setImages(prev => prev.map(img =>
        img.id === imageId ? { ...img, issues: diagResult.issues, description: diagResult.description } : img
      ));

      // Re-extract specs
      const specs = await extractProductSpecs(image.base64, image.file.type);
      const imageSpecs: ImageSpec[] = specs.map(s => ({
        key: s.key,
        value: s.value,
        category: s.category
      }));

      setImages(prev => prev.map(img =>
        img.id === imageId ? { ...img, specs: imageSpecs } : img
      ));

      // Re-run diff if manual fields exist
      if (manualSourceFields.length > 0) {
        const diffs = await performSmartDiff(image.base64, manualSourceFields);
        setImages(prev => prev.map(img =>
          img.id === imageId ? { ...img, diffs } : img
        ));
      }

    } catch (error: any) {
      console.error("Retry analysis failed:", error);
      setErrorMessage(error.message || "重新分析失败");
    } finally {
      setIsProcessing(false);
      setProcessingImageId(null);
    }
  }, [images, currentModel, manualSourceFields]);

  // Global Paste Handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) processFile(file);
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [processFile]); // Correct dependency to avoid stale closure

  // Global Drag & Drop Handlers
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div
      className="h-screen w-screen bg-slate-950 flex font-sans text-slate-200 selection:bg-indigo-500/30 overflow-hidden"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >

      {/* --- LEFT COLUMN (Image + Specs) --- */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-slate-800">

        {/* TOP LEFT: INFINITE CANVAS */}
        <div className="flex-grow-[3] relative bg-slate-900 overflow-hidden">
          {/* Logo + Model Selector */}
          <div className="absolute top-4 left-4 z-20 flex items-center gap-3">
            <div className="bg-slate-950/80 backdrop-blur-md px-4 py-2 rounded-lg border border-slate-700/50 text-xs font-bold text-slate-300 flex items-center gap-3 shadow-xl">
              <div className="bg-indigo-500/20 p-1.5 rounded text-indigo-400">
                <Zap size={16} fill="currentColor" />
              </div>
              <div>
                <div className="text-white">包装稿审核 Pro</div>
                <div className="text-[10px] text-slate-500 font-normal">v3.0.1 • AI自动诊断</div>
              </div>
            </div>

            {/* Model Selector */}
            <div className="relative">
              <button
                onClick={() => setShowModelSelector(!showModelSelector)}
                className="bg-slate-950/80 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-700/50 text-xs text-slate-300 flex items-center gap-2 shadow-xl hover:border-indigo-500/50 transition-colors"
              >
                <span className="text-emerald-400 font-medium">
                  {AVAILABLE_MODELS.find(m => m.id === currentModel)?.name || 'GPT-4o'}
                </span>
                <ChevronDown size={14} className={`text-slate-500 transition-transform ${showModelSelector ? 'rotate-180' : ''}`} />
              </button>

              {showModelSelector && (
                <div className="absolute top-full left-0 mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden min-w-[200px]">
                  {AVAILABLE_MODELS.map(model => (
                    <button
                      key={model.id}
                      onClick={() => handleModelChange(model.id)}
                      className={`w-full px-4 py-2.5 text-left hover:bg-slate-800 transition-colors flex items-center justify-between ${
                        currentModel === model.id ? 'bg-indigo-500/10' : ''
                      }`}
                    >
                      <div>
                        <div className={`text-sm font-medium ${currentModel === model.id ? 'text-indigo-400' : 'text-slate-300'}`}>
                          {model.name}
                        </div>
                        <div className="text-[10px] text-slate-500">{model.description}</div>
                      </div>
                      {currentModel === model.id && (
                        <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <InfiniteCanvas
            images={images}
            transform={transform}
            onTransformChange={setTransform}
            layers={layers}
            diagnosisIssues={diagnosisIssues}
            diffResults={diffResults}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onUpload={handleFileUpload}
            isProcessing={isProcessing}
            processingImageId={processingImageId}
            onRemoveImage={(id) => setImages(prev => prev.filter(i => i.id !== id))}
            onRetryAnalysis={handleRetryAnalysis}
          />

          <FloatingToolbar
            layers={layers}
            onToggleLayer={(l) => setLayers(prev => ({ ...prev, [l]: !prev[l] }))}
            onZoom={handleZoom}
            onFit={handleFit}
            onUpload={handleFileUpload}
            onReset={handleReset}
            onNext={() => { }}
            canProceed={true}
            nextLabel=""
          />

          {errorMessage && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-6 py-3 rounded-lg shadow-2xl z-50 text-sm font-medium flex items-center gap-3 backdrop-blur-sm border border-red-400/50 animate-in fade-in slide-in-from-top-4">
              <AlertCircle size={20} />
              <span>{errorMessage}</span>
              <button onClick={() => setErrorMessage(null)} className="ml-2 hover:bg-white/20 p-1 rounded">
                <XCircle size={16} />
              </button>
            </div>
          )}
        </div>

        {/* BOTTOM LEFT: 产品规格汇总表 - 多Tab */}
        <div className="h-[240px] border-t border-slate-800 bg-slate-950 flex flex-col shadow-[0_-4px_20px_rgba(0,0,0,0.3)] z-10 transition-all duration-300">
          {/* Tab 栏 */}
          <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto">
              <Table size={14} className="text-indigo-400 shrink-0 mr-2" />
              {/* 全部 Tab */}
              <button
                onClick={() => setSpecsTab('all')}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all shrink-0 ${
                  specsTab === 'all'
                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/50'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                }`}
              >
                全部
              </button>
              {/* 每张图片一个 Tab */}
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setSpecsTab(img.id)}
                  className={`px-3 py-1.5 text-[10px] font-medium rounded transition-all shrink-0 truncate max-w-[120px] ${
                    specsTab === img.id
                      ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/50'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                  }`}
                  title={img.file.name}
                >
                  图片{idx + 1}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 text-[10px] shrink-0 ml-4">
              <span className="text-slate-500">
                {specsTab === 'all'
                  ? `共 ${images.reduce((sum, img) => sum + (img.specs?.length || 0), 0)} 个字段`
                  : `${images.find(img => img.id === specsTab)?.specs?.length || 0} 个字段`
                }
              </span>
              <button className="text-indigo-400 hover:text-indigo-300 transition-colors">导出 CSV</button>
            </div>
          </div>

          {/* 表格内容 */}
          <div className="flex-1 overflow-auto bg-slate-950">
            {(() => {
              // 根据当前 Tab 获取要显示的数据
              const currentSpecs = specsTab === 'all'
                ? images.flatMap(img => (img.specs || []).map(spec => ({ ...spec, imageName: img.file.name })))
                : (images.find(img => img.id === specsTab)?.specs || []);

              if (currentSpecs.length === 0) {
                return (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600">
                    <LayoutGrid size={24} className="mb-2 opacity-30" />
                    <p className="text-xs italic">暂无规格数据</p>
                    <p className="text-[10px] text-slate-700 mt-1">上传图片后自动提取产品规格</p>
                  </div>
                );
              }

              return (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-900 sticky top-0 z-10 text-[10px] uppercase text-slate-500 font-medium">
                    <tr>
                      {specsTab === 'all' && <th className="px-4 py-2 border-b border-slate-800 w-28">来源</th>}
                      <th className="px-4 py-2 border-b border-slate-800 w-28">分类</th>
                      <th className="px-4 py-2 border-b border-slate-800 w-40">项目</th>
                      <th className="px-4 py-2 border-b border-slate-800">值</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-slate-800/50">
                    {currentSpecs.map((spec: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-900/50 transition-colors group">
                        {specsTab === 'all' && (
                          <td className="px-4 py-2.5 text-slate-600 text-[10px] truncate max-w-[100px]" title={spec.imageName}>
                            {spec.imageName}
                          </td>
                        )}
                        <td className="px-4 py-2.5 text-slate-500 font-mono text-[10px]">{spec.category}</td>
                        <td className="px-4 py-2.5 text-slate-300 font-medium">{spec.key}</td>
                        <td className="px-4 py-2.5 text-slate-400 font-mono">{spec.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </div>
      </div>

      {/* --- RIGHT COLUMN (Input + Results) --- */}
      <div className="w-[420px] border-l border-slate-800 bg-slate-900 flex flex-col shadow-2xl z-20">
        <InspectorSidebar
          sourceFields={manualSourceFields}
          diffResults={diffResults}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id)}
          onParseSource={handleParseSource}
          isProcessing={isProcessing}
          onReset={handleReset}
        />
      </div>


    </div>
  );
};

export default App;