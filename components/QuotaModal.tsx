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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-border">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-100 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-5">配额使用情况</h2>

          <div className="bg-surface-50 border border-border rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-text-secondary text-sm">剩余额度</span>
              <span className="text-2xl font-bold text-primary-500">{user.quota - user.used}</span>
            </div>
            <div className="w-full bg-surface-200 rounded-full h-2 mb-2 overflow-hidden">
              <div
                className="bg-primary-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${((user.quota - user.used) / user.quota) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-text-muted">
              <span>已用 {user.used} 次</span>
              <span>总额 {user.quota} 次</span>
            </div>
          </div>

          <div className="bg-surface-50 border border-border rounded-lg px-3 py-2 mb-4 text-xs text-text-muted">
            每张图片的新建分析或重新分析都会消耗 1 次额度
          </div>

          <div className="text-sm font-medium text-text-primary mb-3">使用记录</div>
          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="text-center py-6">
                <Loader2 size={18} className="animate-spin mx-auto mb-2 text-primary-500" />
                <span className="text-xs text-text-muted">加载中...</span>
              </div>
            ) : usageHistory.length === 0 ? (
              <div className="text-center py-6 text-text-muted text-xs">暂无使用记录</div>
            ) : (
              <>
                <table className="w-full text-xs">
                  <thead className="text-text-muted border-b border-border">
                    <tr>
                      <th className="text-left py-2 font-medium">图片</th>
                      <th className="text-left py-2 font-medium">类型</th>
                      <th className="text-left py-2 font-medium">时间</th>
                      <th className="text-right py-2 font-medium">额度</th>
                    </tr>
                  </thead>
                  <tbody className="text-text-secondary">
                    {usageHistory.map((record) => (
                      <tr key={record.id} className="border-b border-border hover:bg-surface-50 transition-colors">
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            {record.imageUrl && (
                              <img src={record.imageUrl} alt="" className="w-7 h-7 rounded object-cover bg-surface-100" />
                            )}
                            <span className="truncate max-w-[100px]">{record.imageName}</span>
                          </div>
                        </td>
                        <td className="py-2">
                          <span className="text-[10px] text-text-muted">
                            {record.type === 'retry' ? '重试' : '新建'}
                          </span>
                        </td>
                        <td className="py-2 text-text-muted">{formatTime(record.timestamp)}</td>
                        <td className="py-2 text-right text-text-secondary">-{record.count || 1}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

              {hasMore && (
                <button
                  onClick={onLoadMore}
                  disabled={isLoadingMore}
                  className="w-full py-2 mt-2 text-xs text-text-muted hover:text-text-primary border-t border-border hover:bg-surface-50 transition-colors"
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
