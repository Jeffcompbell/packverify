import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';

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
    console.log('Google login button clicked'); // 调试日志
    setIsLoading(true);
    setError(null);
    try {
      await onLogin();
      onClose();
    } catch (err: any) {
      console.error('Login error:', err); // 调试日志
      setError(err.message || '登录失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* 背景遮罩 - Arc 风格半透明白色 */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 登录卡片 - Arc 风格大尺寸白色卡片 */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200/60 animate-in zoom-in-95 duration-200">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100/50 transition-colors"
        >
          <X size={18} />
        </button>

        {/* 内容区域 */}
        <div className="p-8">
          {/* Logo 和标题 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 mb-4 shadow-sm">
              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">欢迎使用 PackVerify</h1>
            <p className="text-sm text-gray-600">登录后使用 AI 图片分析功能</p>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Google 登录按钮 */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300 text-gray-700 py-3 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center gap-3 shadow-sm hover:shadow-md hover:border-gray-400"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin text-gray-600" />
            ) : (
              <GoogleIcon />
            )}
            {isLoading ? '登录中...' : '使用 Google 继续'}
          </button>

          {/* 提示信息 */}
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 border border-purple-200 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
              <span className="text-xs text-purple-700 font-medium">首次登录赠送 50 次分析额度</span>
            </div>
          </div>

          {/* 服务条款 */}
          <p className="mt-6 text-center text-xs text-gray-500">
            登录即表示您同意我们的
            <a href="#" className="text-purple-600 hover:text-purple-700 mx-1">服务条款</a>
            和
            <a href="#" className="text-purple-600 hover:text-purple-700 ml-1">隐私政策</a>
          </p>
        </div>
      </div>
    </div>
  );
};
