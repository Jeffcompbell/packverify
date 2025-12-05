import React, { useState, useEffect } from 'react';
import { InfiniteCanvas } from './components/InfiniteCanvas';
import { InspectorSidebar } from './components/InspectorSidebar';
import { FloatingToolbar } from './components/FloatingToolbar';
import { diagnoseImage, fileToGenerativePart, parseSourceText, performSmartDiff } from './services/geminiService';
import { DiagnosisIssue, SourceField, DiffResult, ViewLayers, CanvasTransform } from './types';
import { Table, Zap, LayoutGrid } from 'lucide-react';

// --- MOCK DATA FOR DEMO ---
const MOCK_DATA = {
  imageSrc: "https://images.unsplash.com/photo-1627483297929-37f416fec7cd?q=80&w=2670&auto=format&fit=crop", // Coffee Bag / Packaging
  sourceFields: [
    { key: "Product Name", value: "Ethiopian Yirgacheffe Reserve", category: "content" },
    { key: "Net Weight", value: "340g (12oz)", category: "specs" },
    { key: "Roast Level", value: "Medium-Light", category: "specs" },
    { key: "Process", value: "Washed", category: "specs" },
    { key: "Ingredients", value: "100% Arabica Coffee Beans", category: "compliance" },
    { key: "Best Before", value: "12 months from roast date", category: "compliance" },
    { key: "Origin", value: "Gedeo Zone, Ethiopia", category: "content" }
  ] as SourceField[],
  diagnosisIssues: [
    {
      id: "mock-d1",
      type: "color",
      text: "Rich Black Detected",
      suggestion: "Small text body text uses 4-color black (C70 M60 Y40 K100). Change to K100 for sharp printing.",
      severity: "high",
      location_desc: "Back label text",
      box_2d: { ymin: 600, xmin: 300, ymax: 750, xmax: 700 }
    },
    {
      id: "mock-d2",
      type: "bleed",
      text: "Safe Zone Violation",
      suggestion: "The 'Organic' logo is too close to the die-cut line (< 3mm).",
      severity: "medium",
      location_desc: "Bottom right corner",
      box_2d: { ymin: 850, xmin: 800, ymax: 950, xmax: 950 }
    },
    {
      id: "mock-d3",
      type: "font",
      text: "Font Warning",
      suggestion: "Text appears to use 'Arial' system font. Ensure it is outlined or embedded.",
      severity: "low",
      location_desc: "Nutrition facts header",
      box_2d: { ymin: 400, xmin: 100, ymax: 450, xmax: 300 }
    }
  ] as DiagnosisIssue[],
  diffResults: [
    {
      id: "mock-diff1",
      field: "Product Name",
      sourceValue: "Ethiopian Yirgacheffe Reserve",
      imageValue: "Ethiopian Yirgacheffe",
      status: "warning",
      matchType: "strict",
      reason: "Missing 'Reserve' suffix on front panel.",
      box_2d: { ymin: 200, xmin: 200, ymax: 300, xmax: 800 }
    },
    {
      id: "mock-diff2",
      field: "Net Weight",
      sourceValue: "340g (12oz)",
      imageValue: "340g",
      status: "match",
      matchType: "logic",
      reason: "Unit matches, imperial unit omitted but acceptable.",
      box_2d: { ymin: 800, xmin: 100, ymax: 850, xmax: 250 }
    },
    {
      id: "mock-diff3",
      field: "Ingredients",
      sourceValue: "100% Arabica Coffee Beans",
      imageValue: "100% Arabica Coffee",
      status: "match",
      matchType: "semantic",
      box_2d: { ymin: 500, xmin: 300, ymax: 550, xmax: 700 }
    }
  ] as DiffResult[]
};

const App: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Data
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [diagnosisIssues, setDiagnosisIssues] = useState<DiagnosisIssue[]>([]);
  const [sourceFields, setSourceFields] = useState<SourceField[]>([]);
  const [diffResults, setDiffResults] = useState<DiffResult[]>([]);

  // UI State
  const [transform, setTransform] = useState<CanvasTransform>({ x: 0, y: 0, scale: 0.45 });
  const [layers, setLayers] = useState<ViewLayers>({ diagnosis: true, diff: true });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Load Mock Data on Mount
  useEffect(() => {
    // Simulate a loading delay for realism
    const timer = setTimeout(() => {
      setImageSrc(MOCK_DATA.imageSrc);
      setSourceFields(MOCK_DATA.sourceFields);
      setDiagnosisIssues(MOCK_DATA.diagnosisIssues);
      setDiffResults(MOCK_DATA.diffResults);
      // Center the mock image
      setTransform({ x: window.innerWidth * 0.1, y: 50, scale: 0.45 });
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // --- Handlers ---

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      img.onload = () => {
        setTransform({
          x: (window.innerWidth * 0.6 - img.width * 0.4) / 2,
          y: (window.innerHeight * 0.6 - img.height * 0.4) / 2,
          scale: 0.4
        });
      };
      setImageSrc(url);

      const base64 = await fileToGenerativePart(file);
      setImageBase64(base64);

      const issues = await diagnoseImage(base64, file.type);
      setDiagnosisIssues(issues);

      if (sourceFields.length > 0) {
        const diffs = await performSmartDiff(base64, sourceFields);
        setDiffResults(diffs);
      }

    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to process image.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleParseSource = async (text: string) => {
    setIsProcessing(true);
    try {
      const fields = await parseSourceText(text);
      setSourceFields(fields);

      if (imageBase64) {
        const diffs = await performSmartDiff(imageBase64, fields);
        setDiffResults(diffs);
      }
    } catch (err) {
      setErrorMessage("Failed to parse source text.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setImageSrc(null);
    setImageBase64(null);
    setDiagnosisIssues([]);
    setSourceFields([]);
    setDiffResults([]);
    setErrorMessage(null);
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

  return (
    <div className="h-screen w-screen bg-slate-950 flex font-sans text-slate-200 selection:bg-indigo-500/30 overflow-hidden">

      {/* --- LEFT COLUMN (Image + Specs) --- */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-slate-800">

        {/* TOP LEFT: INFINITE CANVAS */}
        <div className="flex-grow-[3] relative bg-slate-900 overflow-hidden">
          <div className="absolute top-4 left-4 z-10 bg-slate-950/80 backdrop-blur-md px-4 py-2 rounded-lg border border-slate-700/50 text-xs font-bold text-slate-300 flex items-center gap-3 shadow-xl">
            <div className="bg-indigo-500/20 p-1.5 rounded text-indigo-400">
              <Zap size={16} fill="currentColor" />
            </div>
            <div>
              <div className="text-white">PackVerify Pro</div>
              <div className="text-[10px] text-slate-500 font-normal">v3.0.1 • Auto-Diagnosis Active</div>
            </div>
          </div>

          <InfiniteCanvas
            imageSrc={imageSrc}
            transform={transform}
            onTransformChange={setTransform}
            layers={layers}
            diagnosisIssues={diagnosisIssues}
            diffResults={diffResults}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onUpload={handleFileUpload}
            isProcessing={isProcessing}
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
            <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded shadow-lg z-50 text-sm font-medium">
              {errorMessage}
            </div>
          )}
        </div>

        {/* BOTTOM LEFT: PARSED SPECS TABLE */}
        <div className="h-[300px] border-t border-slate-800 bg-slate-950 flex flex-col shadow-[0_-4px_20px_rgba(0,0,0,0.3)] z-10">
          <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Table size={14} className="text-indigo-400" />
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Product Specs</h3>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-slate-500">{sourceFields.length} fields loaded</span>
              <button className="text-indigo-400 hover:text-indigo-300 transition-colors">Export CSV</button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {sourceFields.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600">
                <LayoutGrid size={24} className="mb-2 opacity-30" />
                <p className="text-xs italic">No specifications loaded.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-900 sticky top-0 z-10 text-[10px] uppercase text-slate-500 font-medium">
                  <tr>
                    <th className="px-4 py-2 border-b border-slate-800 w-32">Category</th>
                    <th className="px-4 py-2 border-b border-slate-800 w-48">Key</th>
                    <th className="px-4 py-2 border-b border-slate-800">Standard Value</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-800/50">
                  {sourceFields.map((field, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/50 transition-colors group">
                      <td className="px-4 py-2.5 text-slate-500 font-mono text-[10px]">{field.category}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-300 group-hover:text-indigo-300 transition-colors">{field.key}</td>
                      <td className="px-4 py-2.5 text-slate-400 font-mono tracking-tight">{field.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* --- RIGHT COLUMN (Input + Results) --- */}
      <div className="w-[420px] border-l border-slate-800 bg-slate-900 flex flex-col shadow-2xl z-20">
        <InspectorSidebar
          diagnosisIssues={diagnosisIssues}
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