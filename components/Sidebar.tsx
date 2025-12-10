import React from 'react';
import { Search, Settings, FileText, HelpCircle, Bell, LogOut, ChevronDown } from 'lucide-react';

type AppView = 'analysis' | 'detection-config' | 'batch-report';

interface SidebarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  userQuota?: { remaining: number; total: number };
  user?: {
    displayName?: string;
    email?: string;
    photoURL?: string;
  };
  onLogout?: () => void;
  onOpenAnnouncement?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  userQuota,
  user,
  onLogout,
  onOpenAnnouncement
}) => {
  const menuItems = [
    { id: 'analysis' as AppView, label: '质检分析', icon: Search },
    { id: 'detection-config' as AppView, label: '检测配置', icon: Settings },
    { id: 'batch-report' as AppView, label: '批量报告', icon: FileText },
  ];

  return (
    <div className="w-52 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Logo - 可点击返回首页 */}
      <button
        onClick={() => onNavigate('home' as AppView)}
        className="h-14 flex items-center px-4 hover:bg-gray-50 transition-colors w-full"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
            </svg>
          </div>
          <span className="text-sm font-semibold text-gray-900">PackVerify</span>
        </div>
      </button>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4">
        <div className="space-y-0.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-purple-50 text-purple-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-purple-600' : 'text-gray-400'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Bottom Section */}
      <div className="px-3 pb-3 space-y-2">
        {/* Help Link */}
        <a
          href="/help.html"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <HelpCircle size={16} className="text-gray-400" />
          <span>帮助文档</span>
        </a>

        {/* Quota Display - Compact */}
        {userQuota && (
          <div className="px-3 py-2 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-500">剩余额度</span>
              <span className="text-sm font-semibold text-gray-900 tabular-nums">
                {userQuota.remaining}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-0.5 overflow-hidden">
              <div
                className="bg-purple-600 h-0.5 rounded-full transition-all"
                style={{ width: `${(userQuota.remaining / userQuota.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* User Section */}
        {user && (
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2 px-2 py-1.5">
              {/* Avatar */}
              <div className="w-7 h-7 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-medium text-gray-600">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
              </div>

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-900 truncate">
                  {user.displayName || '用户'}
                </div>
                <div className="text-[10px] text-gray-500 truncate">
                  {user.email}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-0.5">
                {/* Notification */}
                {onOpenAnnouncement && (
                  <button
                    onClick={onOpenAnnouncement}
                    className="relative p-1.5 hover:bg-gray-100 rounded transition-colors"
                    title="系统公告"
                  >
                    <Bell size={14} className="text-gray-500" />
                    <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                  </button>
                )}

                {/* Logout */}
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                    title="退出登录"
                  >
                    <LogOut size={14} className="text-gray-500" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
