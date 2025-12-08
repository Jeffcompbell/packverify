import React from 'react';
import { X, Loader2 } from 'lucide-react';

interface UserData {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  quota: number;
  used: number;
}

interface QuotaUsageRecord {
  id: string;
  imageName: string;
  imageUrl?: string;
  type: 'new' | 'retry';
  count: number;
  timestamp: any;
}

interface QuotaModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserData;
  usageHistory: QuotaUsageRecord[];
  isLoading: boolean;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
}

export const QuotaModal: React.FC<QuotaModalProps> = ({
  isOpen,
  onClose,
  user,
  usageHistory,
  isLoading,
  onLoadMore,
  hasMore,
  isLoadingMore
}) => {
  if (!isOpen) return null;

  const formatTime = (timestamp: any) => {
    if (!timestamp?.toDate) return '未知时间';
    const date = timestamp.toDate();
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 7) return `${days} 天前`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-900/95 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full max-w-md bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-2xl rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] border border-border/50 animate-in zoom-in-95 duration-300">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-9 h-9 flex items-center justify-center rounded-xl text-text-muted hover:text-text-primary hover:bg-white/10 hover:backdrop-blur-sm transition-all duration-200 hover:scale-110"
        >
          <X size={18} />
        </button>

        <div className="p-8">
          <h2 className="text-2xl font-bold text-text-primary mb-6 tracking-tight">配额使用情况</h2>

          <div className="bg-gradient-to-br from-primary-500/10 to-purple-500/10 backdrop-blur-sm border border-primary-400/20 rounded-2xl p-5 mb-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-text-secondary text-sm font-medium">剩余额度</span>
              <span className="text-3xl font-bold bg-gradient-to-r from-primary-400 to-purple-400 bg-clip-text text-transparent">{user.quota - user.used}</span>
            </div>
            <div className="w-full bg-surface-200/50 rounded-full h-2.5 mb-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-primary-500 to-purple-500 h-2.5 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                style={{ width: `${((user.quota - user.used) / user.quota) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-text-muted">
              <span>已用 {user.used} 次</span>
              <span>总额 {user.quota} 次</span>
            </div>
          </div>

          <div className="bg-surface-100/30 backdrop-blur-sm border border-border/50 rounded-xl px-4 py-2.5 mb-5 text-xs text-text-muted">
            💡 每张图片的新建分析或重新分析都会消耗 1 次额度
          </div>

          <div className="text-sm font-semibold text-text-primary mb-3">使用记录</div>
          <div className="max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {isLoading ? (
              <div className="text-center py-8">
                <Loader2 size={20} className="animate-spin mx-auto mb-2 text-primary-400" />
                <span className="text-xs text-text-muted">加载中...</span>
              </div>
            ) : usageHistory.length === 0 ? (
              <div className="text-center py-8 text-text-muted text-xs">暂无使用记录</div>
            ) : (
              <>
                <table className="w-full text-xs">
                  <thead className="text-text-muted border-b border-border/50">
                    <tr>
                      <th className="text-left py-2 font-medium">图片</th>
                      <th className="text-left py-2 font-medium">类型</th>
                      <th className="text-left py-2 font-medium">时间</th>
                      <th className="text-right py-2 font-medium">额度</th>
                    </tr>
                  </thead>
                  <tbody className="text-text-secondary">
                    {usageHistory.map((record) => (
                      <tr key={record.id} className="border-b border-border/50 hover:bg-surface-100/30 transition-colors">
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            {record.imageUrl && (
                              <img src={record.imageUrl} alt="" className="w-8 h-8 rounded object-cover bg-surface-100" />
                            )}
                            <span className="truncate max-w-[120px]">{record.imageName}</span>
                          </div>
                        </td>
                        <td className="py-2.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            record.type === 'retry' ? 'bg-amber-500/10 text-amber-400' : 'bg-primary-500/10 text-primary-400'
                          }`}>
                            {record.type === 'retry' ? '重试' : '新建'}
                          </span>
                        </td>
                        <td className="py-2.5 text-text-muted">{formatTime(record.timestamp)}</td>
                        <td className="py-2.5 text-right text-red-400">-{record.count || 1}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

              {hasMore && (
                <button
                  onClick={onLoadMore}
                  disabled={isLoadingMore}
                  className="w-full py-2.5 mt-3 text-xs text-text-muted hover:text-text-primary border-t border-border/50 hover:bg-surface-100/30 transition-all"
                >
                  {isLoadingMore ? '加载中...' : '加载更多'}
                </button>
              )}
            </>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};
