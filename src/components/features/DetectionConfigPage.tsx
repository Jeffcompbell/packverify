import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Save, BookOpen, ChevronRight, Search, Plus, Edit2, Trash2, ExternalLink, X, Download } from 'lucide-react';
import { Button } from '../ui/button';
import lexiconData from '../../../data/lexicon.json';
import { getLexiconStats } from '../../services/lexiconService';

interface DetectionConfigPageProps {
  onBack: () => void;
}

const STORAGE_KEY = 'packverify_custom_prompt';
const ENABLED_KEY = 'packverify_custom_prompt_enabled';

const DEFAULT_PROMPT = `你是一个专业的印刷品质量检测专家。请仔细检查图片中的以下问题：

1. 文字错误：错别字、漏字、多字
2. 标点符号：中英文标点混用、标点位置错误
3. 空格问题：多余空格、缺少空格
4. 排版问题：对齐不整齐、间距不一致
5. 图片质量：模糊、变形、颜色异常

请用中文回复，列出发现的所有问题。`;

interface LexiconEntry {
  id: string;
  pattern: string;
  patternType: 'keyword' | 'regex';
  domain: string;
  market: string;
  severity: 'P0' | 'P1' | 'P2';
  reason: string;
  suggestion: string;
  source?: string;
  sourceUrl?: string;
}

export const DetectionConfigPage: React.FC<DetectionConfigPageProps> = ({ onBack }) => {
  const [enabled, setEnabled] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // 词库管理状态
  const [showLexiconPanel, setShowLexiconPanel] = useState(false);
  const [lexiconEntries, setLexiconEntries] = useState<LexiconEntry[]>(lexiconData.entries as LexiconEntry[]);
  const [lexiconSearch, setLexiconSearch] = useState('');
  const [lexiconFilterDomain, setLexiconFilterDomain] = useState('all');
  const [editingEntry, setEditingEntry] = useState<LexiconEntry | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const lexiconStats = useMemo(() => getLexiconStats(), []);

  useEffect(() => {
    const storedEnabled = localStorage.getItem(ENABLED_KEY);
    const storedPrompt = localStorage.getItem(STORAGE_KEY);
    setEnabled(storedEnabled === 'true');
    setPrompt(storedPrompt || DEFAULT_PROMPT);
  }, []);

  const handleToggle = () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    localStorage.setItem(ENABLED_KEY, String(newEnabled));
  };

  const handleSave = () => {
    setSaving(true);
    localStorage.setItem(STORAGE_KEY, prompt);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 300);
  };

  const handleReset = () => {
    setPrompt(DEFAULT_PROMPT);
  };

  // 词库过滤
  const filteredLexicon = useMemo(() => {
    return lexiconEntries.filter(entry => {
      const matchSearch = !lexiconSearch ||
        entry.pattern.toLowerCase().includes(lexiconSearch.toLowerCase()) ||
        entry.reason.toLowerCase().includes(lexiconSearch.toLowerCase());
      const matchDomain = lexiconFilterDomain === 'all' || entry.domain === lexiconFilterDomain;
      return matchSearch && matchDomain;
    });
  }, [lexiconEntries, lexiconSearch, lexiconFilterDomain]);

  const handleExportLexicon = () => {
    const data = { version: lexiconData.version, updatedAt: new Date().toISOString().split('T')[0], entries: lexiconEntries };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lexicon.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveLexiconEntry = (entry: LexiconEntry) => {
    if (isAddingNew) {
      setLexiconEntries([...lexiconEntries, entry]);
    } else {
      setLexiconEntries(lexiconEntries.map(e => e.id === entry.id ? entry : e));
    }
    setEditingEntry(null);
    setIsAddingNew(false);
  };

  const handleDeleteLexiconEntry = (id: string) => {
    if (confirm('确定删除这条规则？')) {
      setLexiconEntries(lexiconEntries.filter(e => e.id !== id));
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-surface-50 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* 开关 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary">自定义提示词</p>
              <p className="text-xs text-text-muted mt-0.5">开启后使用自定义提示词进行检测</p>
            </div>
            <button
              onClick={handleToggle}
              className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-text-primary' : 'bg-surface-200'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'left-6' : 'left-1'}`} />
            </button>
          </div>

          {/* 编辑区域 */}
          {enabled && (
            <div className="bg-surface-0 rounded-xl border border-border overflow-hidden">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="输入你的自定义提示词..."
                className="w-full h-64 p-4 text-sm text-text-primary bg-transparent resize-none focus:outline-none"
              />
              <div className="border-t border-border px-4 py-3 flex items-center justify-between bg-surface-50">
                <button onClick={handleReset} className="text-xs text-text-muted hover:text-text-primary transition-colors">
                  恢复默认
                </button>
                <div className="flex items-center gap-3">
                  {saved && <span className="text-xs text-success">已保存</span>}
                  <Button onClick={handleSave} disabled={saving} size="sm">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    保存
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 敏感词库卡片 */}
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => setShowLexiconPanel(!showLexiconPanel)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <BookOpen size={16} className="text-amber-600" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-text-primary">敏感词库</p>
                  <p className="text-xs text-text-muted">
                    {lexiconStats.total} 条规则 · P0: {lexiconStats.bySeverity['P0'] || 0} · P1: {lexiconStats.bySeverity['P1'] || 0}
                  </p>
                </div>
              </div>
              <ChevronRight size={16} className={`text-text-muted transition-transform ${showLexiconPanel ? 'rotate-90' : ''}`} />
            </button>

            {showLexiconPanel && (
              <div className="border-t border-border">
                {/* 搜索和操作栏 */}
                <div className="px-4 py-3 flex items-center gap-3 bg-surface-50">
                  <div className="flex-1 relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      value={lexiconSearch}
                      onChange={e => setLexiconSearch(e.target.value)}
                      placeholder="搜索规则..."
                      className="w-full pl-9 pr-3 py-1.5 text-sm border border-border rounded-lg bg-white"
                    />
                  </div>
                  <select
                    value={lexiconFilterDomain}
                    onChange={e => setLexiconFilterDomain(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-border rounded-lg bg-white"
                  >
                    <option value="all">全部行业</option>
                    <option value="cosmetics">化妆品</option>
                    <option value="food">食品</option>
                    <option value="pharma">药品</option>
                    <option value="supplement">保健品</option>
                    <option value="general">通用</option>
                  </select>
                  <button
                    onClick={handleExportLexicon}
                    className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-100 rounded-lg"
                    title="导出"
                  >
                    <Download size={16} />
                  </button>
                  <button
                    onClick={() => { setIsAddingNew(true); setEditingEntry(null); }}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-text-primary text-white rounded-lg hover:bg-text-secondary"
                  >
                    <Plus size={14} /> 新增
                  </button>
                </div>

                {/* 规则列表 */}
                <div className="max-h-80 overflow-y-auto">
                  {filteredLexicon.slice(0, 20).map(entry => (
                    <div key={entry.id} className="px-4 py-2.5 border-b border-border/50 last:border-b-0 hover:bg-surface-50 group">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                              entry.severity === 'P0' ? 'bg-red-100 text-red-700' :
                              entry.severity === 'P1' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {entry.severity}
                            </span>
                            <span className="text-[10px] text-text-muted font-mono">{entry.id}</span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-surface-100 rounded">{entry.domain}</span>
                          </div>
                          <p className="text-xs font-mono text-text-primary truncate">
                            <span className="bg-amber-50 px-1 rounded">{entry.pattern}</span>
                          </p>
                          <p className="text-[11px] text-text-muted mt-0.5 truncate">{entry.reason}</p>
                        </div>
                        <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditingEntry(entry); setIsAddingNew(false); }}
                            className="p-1 text-text-muted hover:text-text-primary hover:bg-surface-100 rounded"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteLexiconEntry(entry.id)}
                            className="p-1 text-text-muted hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredLexicon.length > 20 && (
                    <div className="px-4 py-2 text-center text-xs text-text-muted">
                      还有 {filteredLexicon.length - 20} 条规则...
                    </div>
                  )}
                  {filteredLexicon.length === 0 && (
                    <div className="px-4 py-8 text-center text-xs text-text-muted">
                      没有找到匹配的规则
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 编辑弹窗 */}
      {(editingEntry || isAddingNew) && (
        <LexiconEntryForm
          entry={isAddingNew ? null : editingEntry}
          onSave={handleSaveLexiconEntry}
          onCancel={() => { setEditingEntry(null); setIsAddingNew(false); }}
        />
      )}
    </div>
  );
};

// 词库规则编辑表单
const LexiconEntryForm: React.FC<{
  entry: LexiconEntry | null;
  onSave: (e: LexiconEntry) => void;
  onCancel: () => void;
}> = ({ entry, onSave, onCancel }) => {
  const [form, setForm] = useState<LexiconEntry>(entry || {
    id: `NEW-${Date.now()}`,
    pattern: '',
    patternType: 'keyword',
    domain: 'general',
    market: 'general',
    severity: 'P1',
    reason: '',
    suggestion: '',
    source: '',
    sourceUrl: ''
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-medium text-sm">{entry ? '编辑规则' : '新增规则'}</h3>
          <button onClick={onCancel} className="p-1 hover:bg-surface-100 rounded"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">规则 ID</label>
              <input
                value={form.id}
                onChange={e => setForm({ ...form, id: e.target.value })}
                className="w-full px-3 py-1.5 border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">匹配类型</label>
              <select
                value={form.patternType}
                onChange={e => setForm({ ...form, patternType: e.target.value as 'keyword' | 'regex' })}
                className="w-full px-3 py-1.5 border border-border rounded-lg text-sm"
              >
                <option value="keyword">关键词</option>
                <option value="regex">正则表达式</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">匹配模式</label>
            <input
              value={form.pattern}
              onChange={e => setForm({ ...form, pattern: e.target.value })}
              className="w-full px-3 py-1.5 border border-border rounded-lg text-sm font-mono"
              placeholder="cure / FDA approved"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">行业</label>
              <select
                value={form.domain}
                onChange={e => setForm({ ...form, domain: e.target.value })}
                className="w-full px-3 py-1.5 border border-border rounded-lg text-sm"
              >
                <option value="general">通用</option>
                <option value="cosmetics">化妆品</option>
                <option value="food">食品</option>
                <option value="pharma">药品</option>
                <option value="supplement">保健品</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">市场</label>
              <select
                value={form.market}
                onChange={e => setForm({ ...form, market: e.target.value })}
                className="w-full px-3 py-1.5 border border-border rounded-lg text-sm"
              >
                <option value="general">通用</option>
                <option value="US">美国</option>
                <option value="EU">欧盟</option>
                <option value="CN">中国</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">严重度</label>
              <select
                value={form.severity}
                onChange={e => setForm({ ...form, severity: e.target.value as 'P0' | 'P1' | 'P2' })}
                className="w-full px-3 py-1.5 border border-border rounded-lg text-sm"
              >
                <option value="P0">P0 - 必须修改</option>
                <option value="P1">P1 - 高风险</option>
                <option value="P2">P2 - 建议</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">风险原因</label>
            <textarea
              value={form.reason}
              onChange={e => setForm({ ...form, reason: e.target.value })}
              className="w-full px-3 py-1.5 border border-border rounded-lg text-sm"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">修改建议</label>
            <textarea
              value={form.suggestion}
              onChange={e => setForm({ ...form, suggestion: e.target.value })}
              className="w-full px-3 py-1.5 border border-border rounded-lg text-sm"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">来源</label>
              <input
                value={form.source || ''}
                onChange={e => setForm({ ...form, source: e.target.value })}
                className="w-full px-3 py-1.5 border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">来源链接</label>
              <input
                value={form.sourceUrl || ''}
                onChange={e => setForm({ ...form, sourceUrl: e.target.value })}
                className="w-full px-3 py-1.5 border border-border rounded-lg text-sm"
              />
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-1.5 text-sm text-text-muted hover:bg-surface-100 rounded-lg">取消</button>
          <button
            onClick={() => onSave(form)}
            className="px-4 py-1.5 text-sm bg-text-primary text-white rounded-lg hover:bg-text-secondary"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};
