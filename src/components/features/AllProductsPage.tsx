import React, { useState, useMemo } from 'react';
import { X, Loader2, Search, ArrowUpDown, Calendar, Image as ImageIcon, Plus } from 'lucide-react';

interface CloudSession {
  id: string;
  productName: string;
  imageCount: number;
  updatedAt?: any;
  createdAt?: any;
  thumbnails?: string[]; // 前几张图片的缩略图 URL
}

interface AllProductsPageProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: CloudSession[];
  isLoading: boolean;
  onSelectSession: (session: CloudSession) => void;
  onCreateNew?: () => void;
  isCreatingProduct?: boolean;
}

export const AllProductsPage: React.FC<AllProductsPageProps> = ({
  isOpen,
  onClose,
  sessions,
  isLoading,
  onSelectSession,
  onCreateNew,
  isCreatingProduct
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'count'>('date');

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
              <button
                key={s.id}
                onClick={() => onSelectSession(s)}
                className="bg-white border border-border rounded-lg overflow-hidden hover:border-primary-400 hover:shadow-md transition-all text-left group"
              >
                {/* 缩略图区域 */}
                <div className="aspect-video bg-gradient-to-br from-surface-100 to-surface-200 relative overflow-hidden">
                  {s.thumbnails && s.thumbnails.length > 0 ? (
                    <div className="grid grid-cols-2 gap-0.5 h-full">
                      {s.thumbnails.slice(0, 4).map((thumb, idx) => (
                        <div key={idx} className="relative bg-surface-100">
                          <img
                            src={thumb}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <ImageIcon size={32} className="text-text-muted opacity-30" />
                    </div>
                  )}
                  {/* 图片数量角标 */}
                  {s.imageCount > 0 && (
                    <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                      {s.imageCount} 张
                    </div>
                  )}
                </div>

                {/* 产品信息 */}
                <div className="p-3">
                  <div className="text-sm font-medium text-text-primary truncate mb-2 group-hover:text-primary-500 transition-colors">
                    {s.productName}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-text-muted">
                    <div className="flex items-center gap-1">
                      <Calendar size={10} />
                      <span>
                        {s.updatedAt?.toDate ?
                          s.updatedAt.toDate().toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) :
                          s.createdAt?.toDate?.().toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) ||
                          '未知'
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
