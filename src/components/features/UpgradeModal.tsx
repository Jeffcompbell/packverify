import { useState } from 'react';
import { X, Check, Sparkles } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: 'free' | 'pro' | 'enterprise';
}

const plans = [
  { id: 'free' as const, name: '免费版', price: { monthly: 0, yearly: 0 }, features: ['10次/月 AI分析', '基础AI模型', '本地存储'] },
  { id: 'pro' as const, name: '专业版', price: { monthly: 199, yearly: 159 }, features: ['500次/月 AI分析', '全部AI模型', '云端同步', '优先支持'], recommended: true },
  { id: 'enterprise' as const, name: '企业版', price: { monthly: -1, yearly: -1 }, features: ['无限次数', '私有化部署', '专属客服'] },
];

export function UpgradeModal({ isOpen, onClose, currentPlan }: UpgradeModalProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleUpgrade = async (plan: 'pro' | 'enterprise') => {
    if (plan === 'enterprise') {
      window.location.href = 'mailto:sales@packverify.com?subject=企业版咨询';
      return;
    }
    setIsLoading(true);
    try {
      const stripe = (window as any).Stripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
      const priceId = billingCycle === 'monthly' ? 'price_monthly_pro_id' : 'price_yearly_pro_id';
      const { error } = await stripe.redirectToCheckout({
        lineItems: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        successUrl: `${window.location.origin}/app?payment=success`,
        cancelUrl: `${window.location.origin}/app?payment=cancelled`,
      });
      if (error) alert('支付出现问题，请稍后重试');
    } catch {
      alert('支付出现问题，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 rounded-md transition">
          <X className="w-4 h-4 text-gray-400" />
        </button>

        <div className="p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">升级订阅</h2>

          {/* 计费周期切换 */}
          <div className="flex justify-center mb-4">
            <div className="inline-flex bg-gray-100 rounded-md p-0.5 text-[11px]">
              {(['monthly', 'yearly'] as const).map(cycle => (
                <button
                  key={cycle}
                  onClick={() => setBillingCycle(cycle)}
                  className={`px-3 py-1 rounded font-medium transition ${
                    billingCycle === cycle ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  {cycle === 'monthly' ? '月付' : '年付'}
                  {cycle === 'yearly' && <span className="ml-1 text-green-600">省20%</span>}
                </button>
              ))}
            </div>
          </div>

          {/* 方案卡片 */}
          <div className="grid grid-cols-3 gap-2.5">
            {plans.map(plan => {
              const isCurrent = currentPlan === plan.id;
              const price = plan.price[billingCycle];

              return (
                <div
                  key={plan.id}
                  className={`rounded-lg border p-3 relative ${
                    plan.recommended && !isCurrent
                      ? 'border-violet-300 bg-violet-50/50'
                      : isCurrent
                      ? 'border-violet-500 bg-violet-50'
                      : 'border-gray-200'
                  }`}
                >
                  {plan.recommended && !isCurrent && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                      <span className="bg-violet-600 text-white px-2 py-0.5 rounded text-[9px] font-medium flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5" /> 推荐
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-gray-900">{plan.name}</h3>
                    {isCurrent && (
                      <span className="text-[9px] bg-violet-600 text-white px-1.5 py-0.5 rounded">当前</span>
                    )}
                  </div>

                  <div className="mb-3">
                    {price === -1 ? (
                      <span className="text-lg font-bold text-gray-900">定制</span>
                    ) : (
                      <>
                        <span className="text-lg font-bold text-gray-900">¥{price}</span>
                        <span className="text-gray-500 text-[10px]">/月</span>
                        {billingCycle === 'yearly' && plan.id === 'pro' && (
                          <p className="text-[9px] text-green-600">年付省 ¥480</p>
                        )}
                      </>
                    )}
                  </div>

                  <ul className="space-y-1.5 mb-3">
                    {plan.features.map(feature => (
                      <li key={feature} className="flex items-center gap-1.5 text-[10px] text-gray-600">
                        <Check className={`w-3 h-3 flex-shrink-0 ${plan.recommended ? 'text-violet-500' : 'text-green-500'}`} />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {plan.id !== 'free' && !isCurrent && (
                    <button
                      onClick={() => handleUpgrade(plan.id as 'pro' | 'enterprise')}
                      disabled={isLoading}
                      className={`w-full py-1.5 rounded text-[11px] font-medium transition ${
                        plan.id === 'pro'
                          ? 'bg-violet-600 text-white hover:bg-violet-700'
                          : 'bg-gray-900 text-white hover:bg-gray-800'
                      } disabled:opacity-50`}
                    >
                      {plan.id === 'enterprise' ? '联系销售' : isLoading ? '处理中...' : '立即升级'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* 底部提示 */}
          <p className="text-center text-[10px] text-gray-400 mt-4">
            支持信用卡、支付宝、微信支付 · 7天无理由退款 · 随时取消
          </p>
        </div>
      </div>
    </div>
  );
}
