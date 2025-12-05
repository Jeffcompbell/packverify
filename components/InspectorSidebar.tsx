import React, { useState } from 'react';
import { DiagnosisIssue, DiffResult } from '../types';
import { 
  AlertTriangle, Check, X, ArrowRight, FileText, ShieldAlert, 
  Type, Ruler, Palette, Image as ImageIcon, FileCog, PenTool, LayoutTemplate,
  RefreshCw, Search, ListFilter, ClipboardCheck, AlertOctagon
} from 'lucide-react';

interface InspectorSidebarProps {
  diagnosisIssues: DiagnosisIssue[];
  diffResults: DiffResult[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onParseSource: (text: string) => void;
  isProcessing: boolean;
  onReset: () => void;
}

export const InspectorSidebar: React.FC<InspectorSidebarProps> = ({
  diagnosisIssues,
  diffResults,
  selectedId,
  onSelect,
  onParseSource,
  isProcessing,
  onReset
}) => {
  const [inputText, setInputText] = useState("");
  const [filterMode, setFilterMode] = useState<'all' | 'diagnosis' | 'diff'>('all');

  const getIssueIcon = (type: string) => {
    switch(type) {
      case 'file_setting': return <FileCog size={14} />; 
      case 'font': return <Type size={14} />;            
      case 'image_quality': return <ImageIcon size={14} />;
      case 'color': return <Palette size={14} />;        
      case 'bleed': return <Ruler size={14} />;          
      case 'content': return <FileText size={14} />;     
      case 'annotation': return <PenTool size={14} />;   
      case 'format': return <LayoutTemplate size={14} />;
      case 'compliance': return <ShieldAlert size={14} />;
      default: return <AlertTriangle size={14} />;
    }
  };

  const getIssueColor = (type: string, severity: string) => {
    if (severity === 'high') return 'text-red-400 bg-red-500/10 border-red-500/30';
    if (severity === 'medium') return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    
    switch(type) {
      case 'bleed': 
      case 'file_setting':
        return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
      case 'color':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
      default:
        return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    }
  };

  const getIssueLabel = (type: string) => {
    switch(type) {
      case 'file_setting': return 'File Setting';
      case 'font': return 'Typography';
      case 'image_quality': return 'Image Res';
      case 'color': return 'Color Mode';
      case 'bleed': return 'Bleed/Margin';
      case 'content': return 'Proofing';
      case 'annotation': return 'Dielines';
      case 'format': return 'Format';
      default: return 'Compliance';
    }
  };

  const hasResults = diagnosisIssues.length > 0 || diffResults.length > 0;

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200">
      
      {/* TOP: INPUT SECTION */}
      <div className="p-4 border-b border-slate-800 bg-slate-900 shrink-0">
        <div className="flex items-center justify-between mb-3">
             <h3 className="font-bold text-slate-300 text-xs uppercase tracking-wider flex items-center gap-2">
                <ClipboardCheck size={14} className="text-indigo-400"/> 
                Source Data
             </h3>
             <div className="flex gap-2">
                {hasResults && (
                   <button 
                       onClick={onReset}
                       className="text-[10px] text-slate-500 hover:text-red-400 flex items-center gap-1 hover:bg-slate-800 px-2 py-1 rounded transition-colors"
                   >
                       <RefreshCw size={10} /> Reset
                   </button>
                )}
             </div>
        </div>
        
        <div className="relative group">
            <textarea
                className="w-full h-24 bg-slate-950 border border-slate-800 rounded-md p-3 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-mono leading-relaxed transition-all focus:h-32 focus:border-indigo-500/50"
                placeholder="Paste original specs or content..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
            />
            {(!inputText && !hasResults) && (
                 <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <span className="text-xs text-slate-600">Waiting for input...</span>
                 </div>
            )}
            <button
                onClick={() => onParseSource(inputText)}
                disabled={!inputText.trim() || isProcessing}
                className="absolute bottom-2 right-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-0 disabled:translate-y-2 text-white text-[10px] font-bold px-2.5 py-1.5 rounded flex items-center gap-1.5 transition-all shadow-lg"
            >
                {isProcessing ? <RefreshCw className="animate-spin" size={10}/> : <Search size={10}/>}
                Analyze
            </button>
        </div>
      </div>

      {/* BOTTOM: RESULTS LIST */}
      <div className="flex-1 overflow-hidden flex flex-col bg-slate-900">
         <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between bg-slate-900 sticky top-0 z-10 shrink-0 h-10">
            <h3 className="font-bold text-slate-300 text-xs uppercase tracking-wider flex items-center gap-2">
                <AlertOctagon size={14} className="text-emerald-400"/> 
                Logs
            </h3>
            <div className="flex bg-slate-800/50 rounded p-0.5 border border-slate-800">
                {(['all', 'diagnosis', 'diff'] as const).map(m => (
                    <button 
                        key={m}
                        onClick={() => setFilterMode(m)}
                        className={`px-2 py-0.5 text-[9px] uppercase font-bold rounded transition-colors ${filterMode === m ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        {m}
                    </button>
                ))}
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {!hasResults && !isProcessing && (
                <div className="text-center py-12 text-slate-600 flex flex-col items-center">
                    <ListFilter size={24} className="mb-2 opacity-30"/>
                    <p className="text-xs">No active logs</p>
                </div>
            )}

            {/* DIAGNOSIS RESULTS */}
            {(filterMode === 'all' || filterMode === 'diagnosis') && diagnosisIssues.map((issue) => (
                <div 
                  key={issue.id}
                  onClick={() => onSelect(issue.id)}
                  className={`p-2.5 rounded-md border text-left cursor-pointer transition-all group relative overflow-hidden ${
                    selectedId === issue.id 
                      ? 'bg-slate-800 border-indigo-500/50 shadow-lg shadow-indigo-900/20' 
                      : `bg-slate-800/20 border-slate-800 hover:bg-slate-800/50 hover:border-slate-700`
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase ${getIssueColor(issue.type, issue.severity)} px-1.5 py-0.5 rounded tracking-wide`}>
                       {getIssueIcon(issue.type)}
                       <span>{getIssueLabel(issue.type)}</span>
                    </div>
                    {issue.severity === 'high' && <span className="text-[9px] font-bold text-red-400 flex items-center gap-1"><AlertTriangle size={8}/> HIGH PRIORITY</span>}
                  </div>
                  <h4 className="font-semibold text-xs text-slate-200 mb-1 leading-snug">{issue.text}</h4>
                  <p className="text-[10px] text-slate-500 leading-relaxed group-hover:text-slate-400">{issue.suggestion}</p>
                  
                  {selectedId === issue.id && (
                     <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-indigo-500"></div>
                  )}
                </div>
            ))}

            {/* DIFF RESULTS */}
            {(filterMode === 'all' || filterMode === 'diff') && diffResults.map((result) => (
              <div 
                key={result.id}
                onClick={() => onSelect(result.id)}
                className={`group p-2.5 rounded-md border cursor-pointer transition-all relative ${
                  selectedId === result.id ? 'bg-slate-800 border-indigo-500/50' : 'bg-slate-800/20 border-slate-800 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{result.field}</span>
                  <div className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                    result.status === 'match' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                    {result.status === 'match' ? <Check size={10} /> : <X size={10} />}
                    {result.status === 'match' ? 'MATCH' : 'MISMATCH'}
                  </div>
                </div>

                <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-center text-[10px]">
                  <div className="bg-slate-950/50 px-2 py-1.5 rounded text-slate-400 font-mono border border-slate-800/50 truncate" title={result.sourceValue}>
                    {result.sourceValue}
                  </div>
                  <ArrowRight size={10} className="text-slate-600 shrink-0" />
                  <div className={`px-2 py-1.5 rounded font-mono border border-transparent truncate ${
                    result.status === 'match' ? 'text-emerald-400 bg-emerald-900/10' : 'text-red-300 bg-red-900/10 border-red-900/20'
                  }`} title={result.imageValue || "Missing"}>
                    {result.imageValue || "N/A"}
                  </div>
                </div>
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