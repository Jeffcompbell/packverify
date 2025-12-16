import { useState } from 'react';
import { X, Check, Sparkles, Loader2 } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: 'free' | 'pro' | 'enterprise';
}

// 积分包配置（与后端保持一致）
const packages = [
  { id: 'credits_50', name: '入门包', price: 19.9, credits: 50, features: ['50 积分', '约 15 张图', '永久有效'] },
  { id: 'credits_200', name: '标准包', price: 59.9, credits: 200, features: ['200 积分', '约 60 张图', '永久有效'], recommended: true },
  { id: 'credits_500', name: '专业包', price: 129.9, credits: 500, features: ['500 积分', '约 150 张图', '永久有效', '最划算'] },
];

const API_BASE = import.meta.env.VITE_API_BASE || '';

export function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePurchase = async (packageId: string) => {
    setIsLoading(true);
    setSelectedPlan(packageId);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/stripe/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ packageId })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '创建支付失败');
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (err: any) {
      setError(err.message || '支付出现问题，请稍后重试');
    } finally {
      setIsLoading(false);
      setSelectedPlan(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 rounded-md transition">
          <X className="w-4 h-4 text-gray-400" />
        </button>

        <div className="p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">购买积分</h2>
          <p className="text-[10px] text-gray-500 mb-4">按实际 Token 消耗计费，1 张图 ≈ 3 积分</p>

          {error && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-[11px] text-red-600">
              {error}
            </div>
          )}

          {/* 方案卡片 */}
          <div className="grid grid-cols-3 gap-3">
            {packages.map(pkg => (
              <div
                key={pkg.id}
                className={`rounded-lg border p-3 relative ${
                  pkg.recommended
                    ? 'border-violet-300 bg-violet-50/50'
                    : 'border-gray-200'
                }`}
              >
                {pkg.recommended && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                    <span className="bg-violet-600 text-white px-2 py-0.5 rounded text-[9px] font-medium flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" /> 推荐
                    </span>
                  </div>
                )}

                <h3 className="text-xs font-semibold text-gray-900 mb-2">{pkg.name}</h3>

                <div className="mb-2">
                  <span className="text-lg font-bold text-gray-900">¥{pkg.price}</span>
                  <p className="text-[10px] text-violet-600 font-medium">{pkg.credits} 积分</p>
                </div>

                <ul className="space-y-1 mb-3">
                  {pkg.features.map(feature => (
                    <li key={feature} className="flex items-center gap-1 text-[9px] text-gray-600">
                      <Check className={`w-2.5 h-2.5 flex-shrink-0 ${pkg.recommended ? 'text-violet-500' : 'text-green-500'}`} />
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handlePurchase(pkg.id)}
                  disabled={isLoading}
                  className={`w-full py-1.5 rounded text-[11px] font-medium transition flex items-center justify-center gap-1 ${
                    pkg.recommended
                      ? 'bg-violet-600 text-white hover:bg-violet-700'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  } disabled:opacity-50`}
                >
                  {isLoading && selectedPlan === pkg.id ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      处理中...
                    </>
                  ) : (
                    '立即购买'
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* 底部提示 */}
          <p className="text-center text-[10px] text-gray-400 mt-4">
            支持支付宝、微信支付、银行卡 · 积分永久有效 · 用完再充
          </p>
        </div>
      </div>
    </div>
  );
}
