import React, { useState, useMemo } from 'react';
import { Loader2, Search, Calendar, Image as ImageIcon, Plus, MoreVertical, Pencil, Trash2 } from 'lucide-react';

interface CloudSession {
  id: string;
  productName: string;
  imageCount: number;
  updatedAt?: any;
  createdAt?: any;
  thumbnails?: string[];
}

interface AllProductsPageProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: CloudSession[];
  isLoading: boolean;
  onSelectSession: (session: CloudSession) => void;
  onCreateNew?: () => void;
  isCreatingProduct?: boolean;
  onRenameSession?: (sessionId: string, newName: string) => void;
  onDeleteSession?: (sessionId: string) => void;
}

export const AllProductsPage: React.FC<AllProductsPageProps> = ({
  isOpen,
  onClose,
  sessions,
  isLoading,
  onSelectSession,
  onCreateNew,
  isCreatingProduct,
  onRenameSession,
  onDeleteSession
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'count'>('date');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // 搜索和排序
  const filteredAndSortedSessions = useMemo(() => {
    let result = [...sessions];

    // 搜索
    if (searchQuery) {
      result = result.filter(s =>
        s.productName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // 排序
    result.sort((a, b) => {
      if (sortBy === 'date') {
        const dateA = a.updatedAt?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.updatedAt?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
        return dateB - dateA; // 最新的在前
      } else if (sortBy === 'name') {
        return a.productName.localeCompare(b.productName, 'zh-CN');
      } else {
        return b.imageCount - a.imageCount; // 图片多的在前
      }
    });

    return result;
  }, [sessions, searchQuery, sortBy]);

  if (!isOpen) return null;

  return (
    <div className="flex-1 flex flex-col bg-surface-50 overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-border bg-white flex items-center justify-between px-6 shrink-0">
        <h2 className="text-base font-semibold text-text-primary">AI视觉分析</h2>

        {/* 搜索、排序和新建 */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="搜索产品..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary-400 w-48"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1.5 text-xs border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary-400 bg-white"
          >
            <option value="date">最近更新</option>
            <option value="name">名称排序</option>
            <option value="count">图片数量</option>
          </select>

          {onCreateNew && (
            <button
              onClick={onCreateNew}
              disabled={isCreatingProduct}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-md transition-colors disabled:opacity-50"
            >
              {isCreatingProduct ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              新建产品
            </button>
          )}
        </div>
      </div>

      {/* 产品列表 */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={24} className="animate-spin text-primary-400" />
          </div>
        ) : filteredAndSortedSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted">
            <p className="text-sm">{searchQuery ? '未找到匹配的产品' : '暂无产品'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredAndSortedSessions.map((s) => (
              <div
                key={s.id}
                className="bg-white border border-border rounded-lg overflow-hidden hover:border-primary-400 hover:shadow-md transition-all text-left group relative"
              >
                <button onClick={() => onSelectSession(s)} className="w-full text-left">
                  {/* 缩略图区域 */}
                  <div className="aspect-video bg-gradient-to-br from-surface-100 to-surface-200 relative overflow-hidden">
                    {s.thumbnails && s.thumbnails.length > 0 ? (
                      <div className="grid grid-cols-2 gap-0.5 h-full">
                        {s.thumbnails.slice(0, 4).map((thumb, idx) => (
                          <div key={idx} className="relative bg-surface-100">
                            <img src={thumb} alt="" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <ImageIcon size={32} className="text-text-muted opacity-30" />
                      </div>
                    )}
                    {s.imageCount > 0 && (
                      <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                        {s.imageCount} 张
                      </div>
                    )}
                  </div>

                  {/* 产品信息 */}
                  <div className="p-3">
                    {editingId === s.id ? (
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => {
                          if (editingName.trim() && onRenameSession) {
                            onRenameSession(s.id, editingName.trim());
                          }
                          setEditingId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (editingName.trim() && onRenameSession) {
                              onRenameSession(s.id, editingName.trim());
                            }
                            setEditingId(null);
                          } else if (e.key === 'Escape') {
                            setEditingId(null);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        className="w-full text-sm font-medium border border-primary-400 rounded px-1 py-0.5 focus:outline-none"
                      />
                    ) : (
                      <div className="text-sm font-medium text-text-primary truncate mb-1 group-hover:text-primary-500 transition-colors">
                        {s.productName}
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-text-muted">
                      <span>{s.imageCount} 张图片</span>
                      <div className="flex items-center gap-1">
                        <Calendar size={10} />
                        <span>
                          {s.updatedAt ? new Date(s.updatedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) :
                           s.createdAt ? new Date(s.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) : '未知'}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>

                {/* 更多菜单按钮 */}
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === s.id ? null : s.id); }}
                  className="absolute bottom-2 right-2 p-1 rounded bg-white/80 opacity-0 group-hover:opacity-100 hover:bg-surface-100 transition-all"
                >
                  <MoreVertical size={14} className="text-text-muted" />
                </button>

                {/* 下拉菜单 */}
                {menuOpenId === s.id && (
                  <div className="absolute bottom-8 right-2 bg-white border border-border rounded-md shadow-lg py-1 z-10 min-w-[100px]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(s.id);
                        setEditingName(s.productName);
                        setMenuOpenId(null);
                      }}
                      className="w-full px-3 py-1.5 text-xs text-left hover:bg-surface-100 flex items-center gap-2"
                    >
                      <Pencil size={12} /> 重命名
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onDeleteSession && confirm('确定删除此产品？')) {
                          onDeleteSession(s.id);
                        }
                        setMenuOpenId(null);
                      }}
                      className="w-full px-3 py-1.5 text-xs text-left hover:bg-surface-100 flex items-center gap-2 text-red-500"
                    >
                      <Trash2 size={12} /> 删除
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
