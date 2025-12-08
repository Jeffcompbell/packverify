import React from 'react';
import { X, Loader2 } from 'lucide-react';

interface CloudSession {
  id: string;
  productName: string;
  imageCount: number;
  updatedAt?: any;
}

interface AllProductsPageProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: CloudSession[];
  isLoading: boolean;
  onSelectSession: (session: CloudSession) => void;
}

export const AllProductsPage: React.FC<AllProductsPageProps> = ({
  isOpen,
  onClose,
  sessions,
  isLoading,
  onSelectSession
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-surface-50 flex flex-col">
      <div className="h-12 border-b border-border bg-white flex items-center justify-between px-4 shrink-0">
        <h2 className="text-sm font-semibold text-text-primary">全部产品</h2>
        <button onClick={onClose} className="p-1.5 hover:bg-surface-100 rounded transition-colors">
          <X size={16} className="text-text-muted" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={24} className="animate-spin text-primary-400" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted">
            <p className="text-sm">暂无产品</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  onSelectSession(s);
                  onClose();
                }}
                className="bg-white border border-border rounded-lg p-4 hover:border-border hover:bg-surface-100 transition-all text-left"
              >
                <div className="aspect-video bg-surface-100 rounded mb-3 flex items-center justify-center text-text-muted">
                  {s.imageCount > 0 ? `${s.imageCount} 张` : '无图片'}
                </div>
                <div className="text-sm font-medium text-text-primary truncate mb-1">{s.productName}</div>
                <div className="text-xs text-text-muted">
                  {s.updatedAt?.toDate && s.updatedAt.toDate().toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
