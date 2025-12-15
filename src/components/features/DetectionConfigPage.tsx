import React, { useState, useEffect, useMemo } from 'react';
import { BookOpen, Search, Plus, Edit2, Trash2, X, Download, MoreHorizontal, Link2, Copy, Check } from 'lucide-react';
import lexiconData from '../../../data/lexicon.json';
import { getLexiconStats, type LexiconEntry } from '../../services/lexiconService';
import { Pagination } from '../ui/pagination';

interface DetectionConfigPageProps {
  onBack: () => void;
}

const STORAGE_KEY = 'packverify_custom_prompt';
const ENABLED_KEY = 'packverify_custom_prompt_enabled';
const LEXICON_TOGGLE_KEY = 'packverify_lexicon_domain_toggles';

const DOMAIN_ORDER = ['cosmetics', 'food', 'pharma', 'supplement', 'medical_device', 'infant', 'household', 'general'];
const DOMAIN_META: Record<string, { label: string; description: string; accent: string; badge: string }> = {
  cosmetics: {
    label: '化妆品',
    description: '功效宣称、药妆边界',
    accent: 'bg-rose-50 text-rose-600 border-rose-100',
    badge: 'bg-rose-100 text-rose-700'
  },
  food: {
    label: '食品',
    description: '营养成分、功效宣称',
    accent: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    badge: 'bg-emerald-100 text-emerald-700'
  },
  pharma: {
    label: '药品',
    description: '处方/警示文案',
    accent: 'bg-sky-50 text-sky-600 border-sky-100',
    badge: 'bg-sky-100 text-sky-700'
  },
  supplement: {
    label: '保健品',
    description: '结构/功能宣称',
    accent: 'bg-amber-50 text-amber-600 border-amber-100',
    badge: 'bg-amber-100 text-amber-700'
  },
  medical_device: {
    label: '医疗器械',
    description: '510(k)/CE MDR 监管文本',
    accent: 'bg-blue-50 text-blue-600 border-blue-100',
    badge: 'bg-blue-100 text-blue-700'
  },
  infant: {
    label: '婴幼儿配方',
    description: '配方奶粉/婴食法规',
    accent: 'bg-lime-50 text-lime-600 border-lime-100',
    badge: 'bg-lime-100 text-lime-700'
  },
  household: {
    label: '家清消杀',
    description: 'EPA/FIFRA 宣称约束',
    accent: 'bg-slate-50 text-slate-600 border-slate-100',
    badge: 'bg-slate-100 text-slate-700'
  },
  general: {
    label: '通用',
    description: '所有行业共享规则',
    accent: 'bg-surface-100 text-text-primary border-border/80',
    badge: 'bg-surface-200 text-text-secondary'
  }
};

const getDomainMeta = (domain: string) => DOMAIN_META[domain] || {
  label: domain,
  description: '自定义行业',
  accent: 'bg-surface-100 text-text-primary border-border/80',
  badge: 'bg-surface-200 text-text-secondary'
};

const createEmptyLexiconEntry = (domain?: string | null): LexiconEntry => ({
  id: `NEW-${Date.now()}`,
  pattern: '',
  patternType: 'keyword',
  domain: domain || 'general',
  market: 'general',
  severity: 'P1',
  reason: '',
  suggestion: '',
  source: '',
  sourceUrl: ''
});

const DEFAULT_PROMPT = `你是一个专业的印刷品质量检测专家。请仔细检查图片中的以下问题：

1. 文字错误：错别字、漏字、多字
2. 标点符号：中英文标点混用、标点位置错误
3. 空格问题：多余空格、缺少空格
4. 排版问题：对齐不整齐、间距不一致
5. 图片质量：模糊、变形、颜色异常

请用中文回复，列出发现的所有问题。`;

export const DetectionConfigPage: React.FC<DetectionConfigPageProps> = ({ onBack }) => {
  const [enabled, setEnabled] = useState(false);
  const [prompt, setPrompt] = useState('');

  // 词库管理状态
  const [lexiconEntries, setLexiconEntries] = useState<LexiconEntry[]>(lexiconData.entries as LexiconEntry[]);
  const [lexiconSearch, setLexiconSearch] = useState('');
  const [activeLexiconDomain, setActiveLexiconDomain] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<LexiconEntry | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [domainToggles, setDomainToggles] = useState<Record<string, boolean>>({});

  const lexiconStats = useMemo(() => getLexiconStats(lexiconEntries), [lexiconEntries]);
  const domainList = useMemo(() => {
    const domainSet = new Set<string>();
    lexiconEntries.forEach(entry => domainSet.add(entry.domain));
    const prioritized = DOMAIN_ORDER.filter(domain => domainSet.has(domain));
    const extras = Array.from(domainSet).filter(domain => !DOMAIN_ORDER.includes(domain)).sort();
    return [...prioritized, ...extras];
  }, [lexiconEntries]);

  const domainStats = useMemo(() => {
    return lexiconEntries.reduce<Record<string, { total: number; severity: Record<'P0' | 'P1' | 'P2', number> }>>((acc, entry) => {
      if (!acc[entry.domain]) {
        acc[entry.domain] = {
          total: 0,
          severity: { P0: 0, P1: 0, P2: 0 }
        };
      }
      acc[entry.domain].total += 1;
      acc[entry.domain].severity[entry.severity] += 1;
      return acc;
    }, {});
  }, [lexiconEntries]);

  useEffect(() => {
    const storedEnabled = localStorage.getItem(ENABLED_KEY);
    const storedPrompt = localStorage.getItem(STORAGE_KEY);
    setEnabled(storedEnabled === 'true');
    setPrompt(storedPrompt || DEFAULT_PROMPT);
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LEXICON_TOGGLE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          setDomainToggles(parsed);
        }
      }
    } catch (error) {
      console.warn('Failed to load lexicon toggles', error);
    }
  }, []);

  useEffect(() => {
    setDomainToggles(prev => {
      let changed = false;
      const next = { ...prev };
      domainList.forEach(domain => {
        if (next[domain] === undefined) {
          next[domain] = true;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [domainList]);

  useEffect(() => {
    if (Object.keys(domainToggles).length === 0) return;
    localStorage.setItem(LEXICON_TOGGLE_KEY, JSON.stringify(domainToggles));
  }, [domainToggles]);

  useEffect(() => {
    setLexiconSearch('');
  }, [activeLexiconDomain]);

  const handleToggle = () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    localStorage.setItem(ENABLED_KEY, String(newEnabled));
  };

  const handleReset = () => {
    setPrompt(DEFAULT_PROMPT);
  };

  useEffect(() => {
    if (!enabled) return;
    localStorage.setItem(STORAGE_KEY, prompt);
  }, [prompt, enabled]);

  // 词库过滤
  const filteredLexicon = useMemo(() => {
    const keyword = lexiconSearch.trim().toLowerCase();
    return lexiconEntries.filter(entry => {
      const matchDomain = activeLexiconDomain ? entry.domain === activeLexiconDomain : true;
      if (!matchDomain) return false;
      if (!keyword) return true;
      return entry.pattern.toLowerCase().includes(keyword) || entry.reason.toLowerCase().includes(keyword);
    });
  }, [lexiconEntries, lexiconSearch, activeLexiconDomain]);

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

  const handleToggleDomain = (domain: string) => {
    setDomainToggles(prev => {
      const current = prev[domain] ?? true;
      return {
        ...prev,
        [domain]: !current
      };
    });
  };

  const handleOpenDomainPanel = (domain: string) => {
    setActiveLexiconDomain(domain);
  };

  const handleCloseDomainPanel = () => {
    setActiveLexiconDomain(null);
  };

  const handleAddLexiconEntry = (domain: string) => {
    setActiveLexiconDomain(domain);
    setIsAddingNew(true);
    setEditingEntry(null);
  };

  return (
    <div className="flex-1 flex flex-col bg-surface-50 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* 自定义提示词卡片 */}
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">自定义提示词</p>
                <p className="text-xs text-text-muted mt-0.5">
                  根据出口品类定制检测策略，确保符合美国 FDA / 欧盟 EFSA 等指导
                </p>
              </div>
              <button
                onClick={handleToggle}
                className={`self-start sm:self-auto relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-text-primary' : 'bg-surface-200'}`}
                title={enabled ? '点击关闭自定义提示词' : '点击开启自定义提示词'}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            <div className="border-t border-border bg-surface-0">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="输入你的自定义提示词..."
                disabled={!enabled}
                className={`w-full h-64 p-4 text-sm text-text-primary bg-transparent resize-none focus:outline-none ${
                  enabled ? '' : 'opacity-60 cursor-not-allowed'
                }`}
              />
              <div className="border-t border-border px-4 py-3 flex items-center justify-end bg-surface-50">
                <button
                  onClick={handleReset}
                  disabled={!enabled}
                  className={`text-xs px-3 py-1.5 rounded-lg border border-border transition ${
                    enabled ? 'hover:border-text-primary hover:text-text-primary' : 'text-text-muted/60 border-border/60 cursor-not-allowed'
                  }`}
                >
                  恢复默认
                </button>
              </div>
            </div>
          </div>

          {/* 敏感词库配置 */}
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-text-primary">
                  <BookOpen size={14} />
                  <p className="text-sm font-medium">敏感词库</p>
                </div>
                <p className="text-xs text-text-muted">
                  覆盖美国 FDA、欧盟 EFSA、加拿大 HC 等出口法规要点 · 默认全行业启用
                </p>
                <p className="text-[11px] text-text-muted">
                  共 {lexiconStats.total} 条（P0 {lexiconStats.bySeverity['P0'] || 0} · P1 {lexiconStats.bySeverity['P1'] || 0} · P2 {lexiconStats.bySeverity['P2'] || 0}）
                </p>
              </div>
              <button
                onClick={handleExportLexicon}
                className="self-start sm:self-auto inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-border rounded-lg text-text-primary hover:bg-surface-50"
              >
                <Download size={14} /> 导出全部
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {domainList.map(domain => {
                const stats = domainStats[domain];
                const meta = getDomainMeta(domain);
                const enabled = domainToggles[domain] ?? true;
                return (
                  <div
                    key={domain}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleOpenDomainPanel(domain)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpenDomainPanel(domain);
                      }
                    }}
                    className="group border border-border rounded-lg p-4 transition hover:border-text-primary hover:shadow-sm focus:outline-none focus:border-text-primary focus:shadow-sm cursor-pointer"
                    aria-label={`查看${meta.label}词库`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{meta.label}</p>
                        <p className="text-[11px] text-text-muted">{meta.description}</p>
                      </div>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleToggleDomain(domain);
                        }}
                        className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-text-primary' : 'bg-surface-200'}`}
                        title={enabled ? '点击关闭该行业词库' : '点击开启该行业词库'}
                      >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'left-6' : 'left-1'}`} />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-xs text-text-muted">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide">规则</p>
                        <p className="text-base text-text-primary font-semibold">{stats?.total || 0}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide">P0</p>
                        <p className="text-base text-red-600 font-semibold">{stats?.severity?.P0 || 0}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide">P1</p>
                        <p className="text-base text-amber-600 font-semibold">{stats?.severity?.P1 || 0}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide">P2</p>
                        <p className="text-base text-text-muted font-semibold">{stats?.severity?.P2 || 0}</p>
                      </div>
                    </div>
                    <div className="mt-3 text-[11px] text-text-muted">
                      状态：{enabled ? <span className="text-emerald-600">启用</span> : <span className="text-text-secondary">停用</span>}
                    </div>
                  </div>
                );
              })}
              {domainList.length === 0 && (
                <div className="col-span-full text-center text-xs text-text-muted py-6 border border-dashed border-border rounded-lg">
                  暂无可用词库，请先导入规则
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* 词库详情弹窗 */}
      {activeLexiconDomain && (
        <DomainLexiconModal
          domain={activeLexiconDomain}
          enabled={domainToggles[activeLexiconDomain] ?? true}
          stats={domainStats[activeLexiconDomain]}
          searchValue={lexiconSearch}
          entries={filteredLexicon}
          onSearchChange={setLexiconSearch}
          onAdd={() => handleAddLexiconEntry(activeLexiconDomain)}
          onEdit={(entry) => { setEditingEntry(entry); setIsAddingNew(false); }}
          onDelete={handleDeleteLexiconEntry}
          onClose={handleCloseDomainPanel}
          onExport={() => handleExportLexicon()}
        />
      )}

      {/* 编辑弹窗 */}
      {(editingEntry || isAddingNew) && (
        <LexiconEntryForm
          entry={isAddingNew ? null : editingEntry}
          defaultDomain={isAddingNew ? activeLexiconDomain : editingEntry?.domain}
          onSave={handleSaveLexiconEntry}
          onCancel={() => { setEditingEntry(null); setIsAddingNew(false); }}
        />
      )}
    </div>
  );
};

interface DomainLexiconModalProps {
  domain: string;
  enabled: boolean;
  stats?: { total: number; severity: Record<'P0' | 'P1' | 'P2', number> };
  searchValue: string;
  entries: LexiconEntry[];
  onSearchChange: (value: string) => void;
  onAdd: () => void;
  onEdit: (entry: LexiconEntry) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onExport: () => void;
}

const DomainLexiconModal: React.FC<DomainLexiconModalProps> = ({
  domain,
  enabled,
  stats,
  searchValue,
  entries,
  onSearchChange,
  onAdd,
  onEdit,
  onDelete,
  onClose,
  onExport
}) => {
  const meta = getDomainMeta(domain);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => {
    setPage(1);
    setRowMenuId(null);
  }, [domain, searchValue]);

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const normalizedPage = Math.min(page, totalPages);
  const startIndex = (normalizedPage - 1) * PAGE_SIZE;
  const pagedEntries = entries.slice(startIndex, startIndex + PAGE_SIZE);

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages) return;
    setPage(nextPage);
    setRowMenuId(null);
  };

  const handleCopyLink = async (event: React.MouseEvent, id: string, url?: string) => {
    event.stopPropagation();
    event.preventDefault();
    if (!url || typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLinkId(id);
      setTimeout(() => setCopiedLinkId(current => (current === id ? null : current)), 1500);
    } catch (error) {
      console.warn('Failed to copy source link', error);
    }
  };

  const toggleRowMenu = (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    event.preventDefault();
    setRowMenuId(prev => prev === id ? null : id);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-base font-semibold text-text-primary">{meta.label}词库</p>
              <span className={`text-[11px] px-2 py-0.5 rounded ${enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-surface-200 text-text-muted'}`}>
                {enabled ? '已启用' : '已停用'}
              </span>
            </div>
            <p className="text-xs text-text-muted mt-1">
              当前 {stats?.total || 0} 条规则 · P0 {stats?.severity?.P0 || 0} · P1 {stats?.severity?.P1 || 0} · P2 {stats?.severity?.P2 || 0}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onExport}
              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-100 rounded-lg"
              title="导出词库"
            >
              <Download size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-100 rounded-lg"
              title="关闭"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="px-5 py-3 border-b border-border flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px] relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={`搜索${meta.label}规则...`}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-border rounded-lg bg-white"
            />
          </div>
          <button
            onClick={onAdd}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-text-primary text-white rounded-lg hover:bg-text-secondary"
          >
            <Plus size={14} /> 新增
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-white border-b border-border text-text-muted">
              <tr>
                <th className="py-2 px-4 font-medium">风险</th>
                <th className="py-2 px-4 font-medium">词条 / 模式</th>
                <th className="py-2 px-4 font-medium">市场</th>
                <th className="py-2 px-4 font-medium">风险原因</th>
                <th className="py-2 px-4 font-medium">法规来源</th>
                <th className="py-2 px-4 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {pagedEntries.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 px-4 text-center text-text-muted">
                    没有找到匹配的规则
                  </td>
                </tr>
              )}
              {pagedEntries.map(entry => (
                <tr key={entry.id} className="border-b border-border/60 hover:bg-surface-50">
                  <td className="py-3 px-4 align-top">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                        entry.severity === 'P0' ? 'bg-red-100 text-red-700' :
                        entry.severity === 'P1' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {entry.severity}
                      </span>
                      <span className="font-mono text-text-secondary">{entry.id}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 align-top">
                    <div className="font-mono text-text-primary text-xs break-all">{entry.pattern}</div>
                    <div className="mt-1 text-[10px] text-text-muted uppercase">{entry.patternType}</div>
                  </td>
                  <td className="py-3 px-4 align-top text-text-muted">
                    {entry.market.toUpperCase()}
                  </td>
                  <td className="py-3 px-4 align-top text-text-muted">
                    {entry.reason}
                  </td>
                  <td className="py-3 px-4 align-top">
                    {entry.source ? (
                      <div className="flex items-center gap-1">
                        <Link2 size={12} className="text-text-muted" />
                        {entry.sourceUrl ? (
                          <a
                            href={entry.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline text-text-primary hover:text-text-secondary truncate max-w-[140px]"
                          >
                            {entry.source}
                          </a>
                        ) : (
                          <span className="text-text-muted truncate">{entry.source}</span>
                        )}
                        {entry.sourceUrl && (
                          <button
                            onClick={(event) => handleCopyLink(event, entry.id, entry.sourceUrl)}
                            className="p-1 rounded hover:bg-surface-100 text-text-muted"
                            title="复制链接"
                          >
                            {copiedLinkId === entry.id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 align-top text-right relative">
                    <button
                      onClick={(event) => toggleRowMenu(event, entry.id)}
                      className="p-1.5 rounded-full hover:bg-surface-100 text-text-muted inline-flex items-center justify-center"
                      title="更多操作"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    {rowMenuId === entry.id && (
                      <div className="absolute right-4 mt-1 w-32 rounded-lg border border-border bg-white shadow-lg text-[12px] z-10">
                        <button
                          onClick={() => { setRowMenuId(null); onEdit(entry); }}
                          className="w-full px-3 py-2 text-left hover:bg-surface-50 flex items-center gap-2"
                        >
                          <Edit2 size={12} />
                          编辑
                        </button>
                        <button
                          onClick={() => { setRowMenuId(null); onDelete(entry.id); }}
                          className="w-full px-3 py-2 text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <Trash2 size={12} />
                          删除
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {entries.length > 0 && (
          <div className="px-5 py-3 border-t border-border flex flex-col gap-2 text-[11px] text-text-muted">
            <span>第 {normalizedPage} / {totalPages} 页 · 共 {entries.length} 条规则</span>
            <Pagination
              currentPage={normalizedPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              className="justify-end"
            />
          </div>
        )}
      </div>
    </div>
  );
};

// 词库规则编辑表单
const LexiconEntryForm: React.FC<{
  entry: LexiconEntry | null;
  onSave: (e: LexiconEntry) => void;
  onCancel: () => void;
  defaultDomain?: string | null;
}> = ({ entry, onSave, onCancel, defaultDomain }) => {
  const [form, setForm] = useState<LexiconEntry>(entry || createEmptyLexiconEntry(defaultDomain));

  useEffect(() => {
    if (entry) {
      setForm(entry);
      return;
    }
    setForm(createEmptyLexiconEntry(defaultDomain));
  }, [entry, defaultDomain]);

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
