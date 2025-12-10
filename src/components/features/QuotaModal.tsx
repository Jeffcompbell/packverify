import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Pagination } from '../ui/pagination';

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
  type: 'new' | 'retry' | 'analyze';
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

const ITEMS_PER_PAGE = 10;

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
  const [currentPage, setCurrentPage] = useState(1);

  // 计算总页数
  const totalPages = Math.max(1, Math.ceil(usageHistory.length / ITEMS_PER_PAGE));

  // 当前页的数据
  const currentData = usageHistory.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // 重置页码当弹窗关闭时
  useEffect(() => {
    if (!isOpen) {
      setCurrentPage(1);
    }
  }, [isOpen]);

  // 当到达最后一页且有更多数据时，自动加载
  useEffect(() => {
    if (currentPage === totalPages && hasMore && !isLoadingMore && !isLoading) {
      onLoadMore();
    }
  }, [currentPage, totalPages, hasMore, isLoadingMore, isLoading]);

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

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 rounded-md transition"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>

        <div className="p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">配额使用情况</h2>

          {/* 简化的配额卡片 */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <div className="flex items-baseline justify-between mb-2">
              <div>
                <span className="text-gray-600 text-xs">剩余额度</span>
                <span className="text-[9px] text-gray-400 ml-2">每次分析消耗 1 额度</span>
              </div>
              <span className="text-xl font-semibold text-gray-900 tabular-nums">{user.quota - user.used}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1 mb-1.5 overflow-hidden">
              <div
                className="bg-gray-900 h-1 rounded-full transition-all duration-500"
                style={{ width: `${((user.quota - user.used) / user.quota) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>已用 {user.used}</span>
              <span>总额 {user.quota}</span>
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-medium text-gray-900">使用记录</h3>
            <span className="text-[10px] text-gray-500">共 {usageHistory.length} 条</span>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {isLoading ? (
              <div className="text-center py-8">
                <Loader2 size={16} className="animate-spin mx-auto mb-1.5 text-gray-400" />
                <span className="text-[10px] text-gray-500">加载中...</span>
              </div>
            ) : usageHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-[10px]">暂无使用记录</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                      <tr>
                        <th className="text-left py-2 px-3 font-medium">图片</th>
                        <th className="text-left py-2 px-3 font-medium">类型</th>
                        <th className="text-left py-2 px-3 font-medium">Token</th>
                        <th className="text-left py-2 px-3 font-medium">时间</th>
                        <th className="text-right py-2 px-3 font-medium">额度</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-700 divide-y divide-gray-100">
                      {currentData.map((record, idx) => (
                        <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              {record.imageUrl && (
                                <img src={record.imageUrl} alt="" className="w-6 h-6 rounded object-cover bg-gray-100 flex-shrink-0" />
                              )}
                              <span className="truncate max-w-[120px] text-gray-700">{record.imageName}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <span className="text-gray-500">
                              {record.type === 'retry' ? '重试' : record.type === 'analyze' ? '分析' : '新建'}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            {record.tokenUsage ? (
                              <div className="text-[9px] text-gray-500">
                                <div>{record.tokenUsage.totalTokens.toLocaleString()}</div>
                                <div className="text-[8px] text-gray-400">
                                  {record.tokenUsage.promptTokens.toLocaleString()} + {record.tokenUsage.completionTokens.toLocaleString()}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-gray-500 tabular-nums">{formatTime(record.timestamp)}</td>
                          <td className="py-2 px-3 text-right text-gray-700 tabular-nums">-{record.count || 1}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 分页 */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center py-2.5 border-t border-gray-200 bg-gray-50">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={handlePageChange}
                    />
                  </div>
                )}

                {/* 加载中提示 */}
                {isLoadingMore && (
                  <div className="flex items-center justify-center py-2.5 border-t border-gray-200 bg-gray-50">
                    <Loader2 size={12} className="animate-spin text-gray-400 mr-1.5" />
                    <span className="text-[10px] text-gray-500">加载更多数据...</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
