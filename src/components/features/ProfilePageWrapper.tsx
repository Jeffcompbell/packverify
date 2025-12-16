import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { onAuthChange } from '../../services/firebase';
import { getUserData, getOrCreateUser, UserData } from '../../services/cloudflare';
import { ProfilePage } from './ProfilePage';
import { Sidebar } from '../layout/Sidebar';
import { signOutUser } from '../../services/firebase';

export const ProfilePageWrapper: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        const userData = await getUserData(firebaseUser.uid);
        if (userData) {
          setUser(userData);
        } else {
          const newUserData = await getOrCreateUser(firebaseUser);
          setUser(newUserData);
        }
      } else {
        // 未登录，跳转到首页
        navigate('/');
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await signOutUser();
    setUser(null);
    window.location.href = '/';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={24} className="animate-spin text-text-muted" />
          <span className="text-text-muted text-sm">加载中...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="h-screen w-screen gradient-bg flex font-sans text-text-primary overflow-hidden">
      <Sidebar
        userQuota={{ remaining: user.quota - user.used, total: user.quota }}
        user={{
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL
        }}
        onLogout={handleLogout}
      />
      <ProfilePage user={user} onBack={() => navigate('/app')} />
    </div>
  );
};
