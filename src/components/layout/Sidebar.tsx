import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Settings, FileText, HelpCircle, LogOut, User } from 'lucide-react';

type AppView = 'products' | 'analysis' | 'detection-config' | 'batch-report' | 'home';

interface SidebarProps {
  currentView?: AppView;
  onNavigate?: (view: AppView) => void;
  userQuota?: { remaining: number; total: number };
  user?: {
    displayName?: string;
    email?: string;
    photoURL?: string;
  };
  onLogout?: () => void;
  onOpenAnnouncement?: () => void;
  onOpenQuotaModal?: () => void;
  onOpenUpgradeModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  userQuota,
  user,
  onLogout,
  onOpenQuotaModal,
  onOpenUpgradeModal,
}) => {
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const menuItems = [
    { id: 'products', path: '/app', label: 'AI视觉分析', icon: Search },
    { id: 'detection-config', path: '/config', label: '检测配置', icon: Settings },
    { id: 'batch-report', path: '/reports', label: '批量报告', icon: FileText },
  ];

  const isActive = (path: string) => {
    const pathname = location.pathname;
    if (path === '/app' && (pathname === '/app' || pathname.startsWith('/app/') || pathname === '/' || pathname === '')) {
      return true;
    }
    return pathname === path || pathname.startsWith(path + '/');
  };

  const used = userQuota ? userQuota.total - userQuota.remaining : 0;

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="w-52 bg-surface-0 border-r border-border flex flex-col h-full">
      {/* Logo */}
      <a href="/" className="h-14 flex items-center px-4 hover:bg-surface-50 transition-colors">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-text-primary rounded-lg flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
            </svg>
          </div>
          <span className="text-sm font-semibold text-text-primary">PackVerify</span>
        </div>
      </a>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4">
        <div className="space-y-0.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.id}
                to={item.path}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-surface-100 text-text-primary font-medium'
                    : 'text-text-secondary hover:bg-surface-50'
                }`}
              >
                <Icon size={16} className={active ? 'text-text-primary' : 'text-text-muted'} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-3 space-y-3">
        {/* Quota */}
        {userQuota && (
          <div className="px-1">
            <div className="flex items-center justify-between text-xs text-text-muted mb-1.5">
              <button
                onClick={onOpenQuotaModal}
                className="hover:text-text-primary transition-colors"
              >
                已使用 {used} / {userQuota.total}
              </button>
              <button
                onClick={onOpenUpgradeModal}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                升级
              </button>
            </div>
            <div className="w-full bg-surface-100 rounded-full h-1 overflow-hidden">
              <div
                className="bg-text-muted h-1 rounded-full transition-all"
                style={{ width: `${(used / userQuota.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Help */}
        <a
          href="/help"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-text-secondary hover:bg-surface-50 transition-colors"
        >
          <HelpCircle size={16} className="text-text-muted" />
          <span>帮助文档</span>
        </a>

        {/* User with dropdown */}
        {user && (
          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-50 transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-surface-100 overflow-hidden flex-shrink-0">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-text-muted">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
              </div>
              <span className="text-sm text-text-primary truncate">{user.displayName || '用户'}</span>
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-border rounded-lg shadow-lg overflow-hidden z-50">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-xs font-medium text-text-primary truncate">{user.displayName || '用户'}</p>
                  {user.email && <p className="text-[10px] text-text-muted truncate">{user.email}</p>}
                </div>
                <button
                  onClick={() => { setShowUserMenu(false); onLogout?.(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface-50 transition-colors"
                >
                  <LogOut size={14} />
                  <span>退出登录</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
