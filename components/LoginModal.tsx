import React, { useState } from 'react';
import { X, Loader2, Zap } from 'lucide-react';

export const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18">
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
    <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
  </svg>
);

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => Promise<void>;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLogin }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await onLogin();
      onClose();
    } catch (err: any) {
      setError(err.message || '登录失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="absolute inset-0 bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-900/95 backdrop-blur-xl"
        onClick={onClose}
      />

      <div className="relative w-full max-w-sm bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-2xl rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] border border-border/50 animate-in zoom-in-95 duration-300">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-9 h-9 flex items-center justify-center rounded-xl text-text-muted hover:text-text-primary hover:bg-white/10 hover:backdrop-blur-sm transition-all duration-200 hover:scale-110"
        >
          <X size={18} />
        </button>

        <div className="p-10">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500/20 to-purple-500/20 backdrop-blur-sm border border-primary-400/30 mb-5 shadow-[0_0_30px_rgba(99,102,241,0.3)]">
              <Zap size={28} className="text-primary-400" fill="currentColor" />
            </div>
            <h1 className="text-2xl font-bold text-text-primary mb-2 tracking-tight">欢迎回来</h1>
            <p className="text-sm text-text-muted">登录后使用 AI 图片分析功能</p>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 bg-red-500/10 backdrop-blur-sm border border-red-400/30 rounded-2xl text-red-300 text-sm shadow-lg">
              {error}
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-white to-slate-50 hover:from-slate-50 hover:to-white disabled:opacity-50 text-slate-900 py-3.5 rounded-2xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-3 shadow-[0_4px_20px_rgba(255,255,255,0.15)] hover:shadow-[0_6px_30px_rgba(255,255,255,0.25)] hover:scale-[1.02]"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            {isLoading ? '登录中...' : '使用 Google 继续'}
          </button>

          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500/10 backdrop-blur-sm border border-primary-400/20 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse"></div>
              <span className="text-xs text-indigo-300 font-medium">首次登录赠送 50 次分析额度</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
