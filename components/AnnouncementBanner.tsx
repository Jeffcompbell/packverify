import React, { useState, useEffect } from 'react';
import { X, Bell, Info, AlertCircle, CheckCircle } from 'lucide-react';

interface Announcement {
  id: string;
  type: 'info' | 'warning' | 'success' | 'update';
  title: string;
  message: string;
  date: string;
  link?: string;
  linkText?: string;
}

// 系统公告列表 - 可以从后端API获取
const ANNOUNCEMENTS: Announcement[] = [
  {
    id: '2025-01-15',
    type: 'update',
    title: '新功能上线',
    message: '支持 GPT-5.1 和 Gemini 3 Pro 模型，分析准确率提升30%。',
    date: '2025-01-15',
  },
  {
    id: '2025-01-10',
    type: 'success',
    title: '云端同步优化',
    message: '数据同步速度提升50%，支持更大的文件上传。',
    date: '2025-01-10',
  },
];

export function AnnouncementBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [currentAnnouncement, setCurrentAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    // 检查是否有未读公告
    const dismissedIds = JSON.parse(localStorage.getItem('dismissedAnnouncements') || '[]');
    const unreadAnnouncement = ANNOUNCEMENTS.find(a => !dismissedIds.includes(a.id));

    if (unreadAnnouncement) {
      setCurrentAnnouncement(unreadAnnouncement);
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    if (currentAnnouncement) {
      const dismissedIds = JSON.parse(localStorage.getItem('dismissedAnnouncements') || '[]');
      dismissedIds.push(currentAnnouncement.id);
      localStorage.setItem('dismissedAnnouncements', JSON.stringify(dismissedIds));
    }
    setIsVisible(false);
  };

  if (!isVisible || !currentAnnouncement) return null;

  const getIcon = () => {
    switch (currentAnnouncement.type) {
      case 'info':
        return <Info className="w-5 h-5 text-blue-600" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'update':
        return <Bell className="w-5 h-5 text-purple-600" />;
    }
  };

  const getBgColor = () => {
    switch (currentAnnouncement.type) {
      case 'info':
        return 'bg-blue-50 border-blue-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'update':
        return 'bg-purple-50 border-purple-200';
    }
  };

  return (
    <div className={`${getBgColor()} border-b px-4 py-3`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {getIcon()}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 text-sm">
                {currentAnnouncement.title}
              </span>
              <span className="text-xs text-gray-500">
                {currentAnnouncement.date}
              </span>
            </div>
            <p className="text-sm text-gray-700 truncate">
              {currentAnnouncement.message}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentAnnouncement.link && (
            <a
              href={currentAnnouncement.link}
              className="text-sm text-purple-600 hover:text-purple-700 font-medium whitespace-nowrap"
            >
              {currentAnnouncement.linkText || '了解更多'}
            </a>
          )}
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-white/50 rounded transition flex-shrink-0"
            aria-label="关闭公告"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>
    </div>
  );
}

// 完整的公告列表弹窗（可选）
interface AnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AnnouncementModal({ isOpen, onClose }: AnnouncementModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[70vh] overflow-hidden flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-purple-500" />
            <h2 className="text-sm font-semibold text-gray-900">系统公告</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-md transition"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-3">
            {ANNOUNCEMENTS.map((announcement) => (
              <div
                key={announcement.id}
                className="bg-gray-50 border border-gray-100 rounded-lg p-3.5 hover:bg-white hover:border-purple-100 transition"
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex-shrink-0">{getIconForType(announcement.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium text-gray-900">
                        {announcement.title}
                      </h3>
                      <span className="text-[10px] text-gray-400">
                        {announcement.date}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed mb-2">
                      {announcement.message}
                    </p>
                    {announcement.link && (
                      <a
                        href={announcement.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-purple-600 hover:text-purple-700 font-medium inline-flex items-center gap-1"
                      >
                        {announcement.linkText || '查看详情'}
                        <span className="text-[10px]">→</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function getIconForType(type: string) {
  switch (type) {
    case 'info':
      return <Info className="w-4 h-4 text-blue-500" />;
    case 'warning':
      return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    case 'success':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'update':
      return <Bell className="w-4 h-4 text-purple-500" />;
    default:
      return <Info className="w-4 h-4 text-gray-500" />;
  }
}
