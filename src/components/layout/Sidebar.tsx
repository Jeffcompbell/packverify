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
  const percentage = userQuota ? Math.min(100, (used / userQuota.total) * 100) : 0;

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
    <div className="w-52 bg-white border-r border-border flex flex-col h-full">
      {/* Logo */}
      <a href="/" className="h-11 flex items-center px-4 hover:bg-surface-50 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-text-primary flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
            </svg>
          </div>
          <span className="text-sm font-semibold text-text-primary">PackVerify</span>
        </div>
      </a>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.id}
                to={item.path}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-full text-[13px] transition-all ${
                  active
                    ? 'bg-surface-100 text-text-primary font-medium'
                    : 'text-text-secondary hover:bg-surface-50 hover:text-text-primary'
                }`}
              >
                <Icon size={16} strokeWidth={1.5} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-3 space-y-2">
        {/* Quota */}
        {userQuota && (
          <div className="px-3 py-2.5 rounded-xl bg-surface-50 cursor-pointer hover:bg-surface-100 transition-colors" onClick={onOpenQuotaModal}>
            <div className="flex items-center justify-between text-[11px] mb-2">
              <span className="text-text-muted">已用 {used} 次</span>
              <button
                onClick={(e) => { e.stopPropagation(); onOpenUpgradeModal?.(); }}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                升级
              </button>
            </div>
            <div className="w-full bg-surface-200 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all ${percentage > 80 ? 'bg-warning' : 'bg-text-muted'}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Help */}
        <a
          href="/help"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-3 py-2 rounded-full text-[13px] text-text-secondary hover:bg-surface-50 hover:text-text-primary transition-colors"
        >
          <HelpCircle size={16} strokeWidth={1.5} />
          <span>帮助</span>
        </a>

        {/* User */}
        {user && (
          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-full hover:bg-surface-50 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-surface-200 overflow-hidden flex-shrink-0">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-medium text-text-muted">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
              </div>
              <span className="text-[13px] text-text-primary truncate flex-1 text-left">{user.displayName || '用户'}</span>
            </button>

            {/* Dropdown */}
            {showUserMenu && (
              <div className="absolute bottom-full left-3 right-3 mb-1 bg-white border border-border rounded-xl shadow-lg overflow-hidden z-50">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-xs text-text-primary truncate">{user.displayName || '用户'}</p>
                  {user.email && <p className="text-[10px] text-text-muted truncate">{user.email}</p>}
                </div>
                <Link
                  to="/profile"
                  onClick={() => setShowUserMenu(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-surface-50 transition-colors"
                >
                  <User size={14} strokeWidth={1.5} />
                  <span>个人设置</span>
                </Link>
                <button
                  onClick={() => { setShowUserMenu(false); onLogout?.(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-surface-50 transition-colors"
                >
                  <LogOut size={14} strokeWidth={1.5} />
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
