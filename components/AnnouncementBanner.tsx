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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-purple-600" />
            <h2 className="text-xl font-bold text-gray-900">系统公告</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {ANNOUNCEMENTS.map((announcement) => (
              <div
                key={announcement.id}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:border-purple-200 transition"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{getIconForType(announcement.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">
                        {announcement.title}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {announcement.date}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">
                      {announcement.message}
                    </p>
                    {announcement.link && (
                      <a
                        href={announcement.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                      >
                        {announcement.linkText || '查看详情'} →
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
      return <Info className="w-5 h-5 text-blue-600" />;
    case 'warning':
      return <AlertCircle className="w-5 h-5 text-yellow-600" />;
    case 'success':
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    case 'update':
      return <Bell className="w-5 h-5 text-purple-600" />;
    default:
      return <Info className="w-5 h-5 text-gray-600" />;
  }
}
