import React, { useState } from 'react';
import { ArrowLeft, Mail, User, Key, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { UserData } from '../../services/cloudflare';

const API_BASE = 'https://packverify.likelinxin.workers.dev';

interface ProfilePageProps {
  user: UserData;
  onBack: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ user, onBack }) => {
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: '密码至少需要 6 位' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: '两次输入的密码不一致' });
      return;
    }

    setIsLoading(true);
    try {
      // 发送重置密码邮件
      const response = await fetch(`${API_BASE}/api/auth/forget-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          redirectTo: `${window.location.origin}/reset-password`
        })
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error?.message || '发送失败');
      }

      setMessage({ type: 'success', text: '密码重置链接已发送到您的邮箱，请查收并设置新密码' });
      setIsSettingPassword(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '操作失败，请稍后重试' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-white overflow-auto">
      {/* Header */}
      <div className="h-11 flex items-center px-4 border-b border-border">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={16} />
          <span className="text-sm">返回</span>
        </button>
        <h1 className="text-sm font-medium text-text-primary ml-4">个人设置</h1>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto p-6">
        {/* User Info Card */}
        <div className="bg-surface-50 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-surface-200 overflow-hidden flex-shrink-0">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl font-medium text-text-muted">
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-medium text-text-primary truncate">{user.displayName || '用户'}</h2>
              <p className="text-sm text-text-muted truncate">{user.email}</p>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3 text-text-secondary">
              <Mail size={16} className="text-text-muted flex-shrink-0" />
              <span className="truncate">{user.email}</span>
            </div>
            <div className="flex items-center gap-3 text-text-secondary">
              <User size={16} className="text-text-muted flex-shrink-0" />
              <span>用户 ID: {user.uid.slice(0, 8)}...</span>
            </div>
          </div>
        </div>

        {/* Password Section */}
        <div className="bg-surface-50 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Key size={18} className="text-text-muted" />
            <h3 className="text-sm font-medium text-text-primary">密码设置</h3>
          </div>

          {message && (
            <div className={`flex items-center gap-2 p-3 rounded-lg mb-4 text-sm ${
              message.type === 'success' ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
            }`}>
              {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              <span>{message.text}</span>
            </div>
          )}

          <p className="text-sm text-text-muted mb-4">
            设置密码后，您可以使用邮箱和密码登录，无需依赖 Google 账号。
          </p>

          {!isSettingPassword ? (
            <button
              onClick={() => setIsSettingPassword(true)}
              className="w-full py-2.5 bg-text-primary text-white text-sm font-medium rounded-lg hover:bg-text-secondary transition-colors"
            >
              设置 / 重置密码
            </button>
          ) : (
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div>
                <label className="block text-xs text-text-muted mb-1.5">新密码</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="至少 6 位"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-text-muted"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1.5">确认密码</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次输入密码"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-text-muted"
                  required
                  minLength={6}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setIsSettingPassword(false); setNewPassword(''); setConfirmPassword(''); setMessage(null); }}
                  className="flex-1 py-2.5 border border-border text-text-secondary text-sm font-medium rounded-lg hover:bg-surface-100 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-2.5 bg-text-primary text-white text-sm font-medium rounded-lg hover:bg-text-secondary transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      发送中...
                    </>
                  ) : (
                    '发送重置邮件'
                  )}
                </button>
              </div>
              <p className="text-xs text-text-muted text-center">
                点击后将发送密码重置链接到您的邮箱
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
