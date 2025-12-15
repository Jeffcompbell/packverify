import React, { useState } from 'react';
import { Loader2, Mail, Lock } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { signInWithEmail, signUpWithEmail, signInWithGoogle } from '@/services/auth-client';

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Google login error:', err);
      try {
        await onLogin();
        onClose();
      } catch (fallbackErr: any) {
        setError(fallbackErr.message || '登录失败，请重试');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 注册即登录：先尝试登录，失败则自动注册
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('请填写邮箱和密码');
      return;
    }
    if (password.length < 6) {
      setError('密码至少需要 6 位');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // 先尝试登录
      const loginResult = await signInWithEmail(email, password);
      if (loginResult.error) {
        // 登录失败，尝试注册
        const signupResult = await signUpWithEmail(email, password, email.split('@')[0]);
        if (signupResult.error) {
          throw new Error(signupResult.error.message || '登录失败');
        }
      }
      onClose();
      window.location.reload();
    } catch (err: any) {
      console.error('Email auth error:', err);
      setError(err.message || '登录失败，请检查邮箱和密码');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="p-6">
        {/* Logo + 标题 */}
        <div className="text-center mb-1">
          <div className="mx-auto mb-3 w-11 h-11 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
            </svg>
          </div>
          <h2 className="text-base font-semibold text-gray-900">登录 PackVerify</h2>
          <p className="text-xs text-gray-500 mt-0.5">AI 包装图片质检工具</p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-red-600 text-xs">
            {error}
          </div>
        )}

        {/* 邮箱密码表单 */}
        <form onSubmit={handleEmailAuth} className="space-y-3">
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              placeholder="邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 pl-9 pr-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="password"
              placeholder="密码（新用户自动注册）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-10 pl-9 pr-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-10 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 size={16} className="animate-spin" />}
            登录 / 注册
          </button>
        </form>

        {/* 分隔线 */}
        <div className="flex items-center gap-3 my-1">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">或</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Google 登录按钮 */}
        <button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2.5 h-10 px-4 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 transition-all"
        >
          {isLoading ? <Loader2 size={16} className="animate-spin text-gray-500" /> : <GoogleIcon />}
          使用 Google 登录
        </button>

        {/* 提示 */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400">
          <span className="w-1 h-1 rounded-full bg-violet-400"></span>
          <span>新用户赠送 10 次免费分析</span>
        </div>

        {/* 条款 */}
        <p className="text-center text-[10px] text-gray-400 leading-relaxed">
          登录即同意
          <a href="/help#terms" className="text-violet-500 hover:underline mx-0.5">服务条款</a>
          和
          <a href="/help#privacy" className="text-violet-500 hover:underline ml-0.5">隐私政策</a>
        </p>
      </DialogContent>
    </Dialog>
  );
};
