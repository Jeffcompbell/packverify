import { useState } from 'react';
import { X, Check, Sparkles } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: 'free' | 'pro' | 'enterprise';
}

// 1 元 = 10 积分，1 张图 ≈ 3 积分
const plans = [
  { id: 'free' as const, name: '免费版', price: 0, credits: 30, features: ['30 积分（约10张图）', '基础AI模型', '云端同步'] },
  { id: 'starter' as const, name: '入门版', price: 10, credits: 100, features: ['100 积分（约30张图）', '全部AI模型', '云端同步'] },
  { id: 'pro' as const, name: '专业版', price: 30, credits: 350, features: ['350 积分（约100张图）', '全部AI模型', '云端同步', '送50积分'], recommended: true },
  { id: 'enterprise' as const, name: '企业版', price: 100, credits: 1200, features: ['1200 积分（约400张图）', '全部AI模型', '云端同步', '送200积分', '优先支持'] },
];

export function UpgradeModal({ isOpen, onClose, currentPlan }: UpgradeModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePurchase = async (planId: string, price: number) => {
    if (price === 0) return; // 免费版不需要购买
    setIsLoading(true);
    setSelectedPlan(planId);
    try {
      // TODO: 接入支付系统
      alert(`即将跳转支付 ¥${price}，获得 ${plans.find(p => p.id === planId)?.credits} 积分`);
    } catch {
      alert('支付出现问题，请稍后重试');
    } finally {
      setIsLoading(false);
      setSelectedPlan(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 rounded-md transition">
          <X className="w-4 h-4 text-gray-400" />
        </button>

        <div className="p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">购买积分</h2>
          <p className="text-[10px] text-gray-500 mb-4">按实际 Token 消耗计费，1 元 ≈ 10 积分，1 张图 ≈ 3 积分</p>

          {/* 方案卡片 */}
          <div className="grid grid-cols-4 gap-2.5">
            {plans.map(plan => {
              const isFree = plan.price === 0;

              return (
                <div
                  key={plan.id}
                  className={`rounded-lg border p-3 relative ${
                    plan.recommended
                      ? 'border-violet-300 bg-violet-50/50'
                      : 'border-gray-200'
                  }`}
                >
                  {plan.recommended && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                      <span className="bg-violet-600 text-white px-2 py-0.5 rounded text-[9px] font-medium flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5" /> 推荐
                      </span>
                    </div>
                  )}

                  <h3 className="text-xs font-semibold text-gray-900 mb-2">{plan.name}</h3>

                  <div className="mb-2">
                    {isFree ? (
                      <span className="text-lg font-bold text-gray-900">免费</span>
                    ) : (
                      <>
                        <span className="text-lg font-bold text-gray-900">¥{plan.price}</span>
                        <p className="text-[10px] text-violet-600 font-medium">{plan.credits} 积分</p>
                      </>
                    )}
                  </div>

                  <ul className="space-y-1 mb-3">
                    {plan.features.map(feature => (
                      <li key={feature} className="flex items-center gap-1 text-[9px] text-gray-600">
                        <Check className={`w-2.5 h-2.5 flex-shrink-0 ${plan.recommended ? 'text-violet-500' : 'text-green-500'}`} />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {!isFree && (
                    <button
                      onClick={() => handlePurchase(plan.id, plan.price)}
                      disabled={isLoading && selectedPlan === plan.id}
                      className={`w-full py-1.5 rounded text-[11px] font-medium transition ${
                        plan.recommended
                          ? 'bg-violet-600 text-white hover:bg-violet-700'
                          : 'bg-gray-900 text-white hover:bg-gray-800'
                      } disabled:opacity-50`}
                    >
                      {isLoading && selectedPlan === plan.id ? '处理中...' : '立即购买'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* 底部提示 */}
          <p className="text-center text-[10px] text-gray-400 mt-4">
            支持支付宝、微信支付 · 积分永久有效 · 用完再充
          </p>
        </div>
      </div>
    </div>
  );
}
