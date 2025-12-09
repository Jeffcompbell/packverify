import React, { useState } from 'react';
import { X } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: 'free' | 'pro' | 'enterprise';
  quotaUsed: number;
  quotaTotal: number;
}

export function UpgradeModal({ isOpen, onClose, currentPlan, quotaUsed, quotaTotal }: UpgradeModalProps) {
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
      // Initialize Stripe
      const stripe = (window as any).Stripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

      // TODO: Replace with your actual Stripe price IDs
      const priceId = billingCycle === 'monthly'
        ? 'price_monthly_pro_id'
        : 'price_yearly_pro_id';

      // Redirect to Stripe Checkout
      const { error } = await stripe.redirectToCheckout({
        lineItems: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        successUrl: `${window.location.origin}/app?payment=success`,
        cancelUrl: `${window.location.origin}/app?payment=cancelled`,
      });

      if (error) {
        console.error('Stripe checkout error:', error);
        alert('支付出现问题，请稍后重试');
      }
    } catch (err) {
      console.error('Subscribe error:', err);
      alert('支付出现问题，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const quotaPercentage = (quotaUsed / quotaTotal) * 100;
  const isQuotaLow = quotaPercentage > 80;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">升级订阅</h2>
            <p className="text-sm text-gray-600 mt-1">
              解锁更多功能，提升工作效率
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Current Usage */}
        {currentPlan === 'free' && (
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">本月配额使用</span>
              <span className={`text-sm font-medium ${isQuotaLow ? 'text-red-600' : 'text-gray-900'}`}>
                {quotaUsed} / {quotaTotal}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  isQuotaLow ? 'bg-red-500' : 'bg-purple-600'
                }`}
                style={{ width: `${Math.min(quotaPercentage, 100)}%` }}
              />
            </div>
            {isQuotaLow && (
              <p className="text-xs text-red-600 mt-2">
                配额即将用完，升级专业版享受更多额度
              </p>
            )}
          </div>
        )}

        {/* Billing Toggle */}
        <div className="px-6 py-4 flex justify-center">
          <div className="inline-flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition ${
                billingCycle === 'monthly'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600'
              }`}
            >
              月付
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition ${
                billingCycle === 'yearly'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600'
              }`}
            >
              年付
              <span className="ml-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                省20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="px-6 pb-6">
          <div className="grid md:grid-cols-3 gap-4">
            {/* Free Plan */}
            <div className={`rounded-xl border-2 p-6 ${
              currentPlan === 'free' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">免费版</h3>
                {currentPlan === 'free' && (
                  <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-full">
                    当前方案
                  </span>
                )}
              </div>
              <div className="mb-6">
                <span className="text-3xl font-bold text-gray-900">¥0</span>
                <span className="text-gray-600 text-sm">/月</span>
              </div>
              <ul className="space-y-3 mb-6 text-sm">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                  <span className="text-gray-700">10次/月 AI分析</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                  <span className="text-gray-700">基础AI模型</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                  <span className="text-gray-700">本地存储</span>
                </li>
              </ul>
              {currentPlan !== 'free' && (
                <button
                  disabled
                  className="w-full bg-gray-100 text-gray-400 py-2 rounded-lg text-sm font-medium cursor-not-allowed"
                >
                  当前方案
                </button>
              )}
            </div>

            {/* Pro Plan */}
            <div className={`rounded-xl border-2 p-6 relative ${
              currentPlan === 'pro'
                ? 'border-purple-500 bg-purple-50'
                : 'border-purple-500 bg-gradient-to-br from-purple-50 to-white'
            }`}>
              {currentPlan !== 'pro' && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-purple-500 to-purple-700 text-white px-4 py-1 rounded-full text-xs font-semibold">
                    推荐
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">专业版</h3>
                {currentPlan === 'pro' && (
                  <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-full">
                    当前方案
                  </span>
                )}
              </div>
              <div className="mb-6">
                {billingCycle === 'monthly' ? (
                  <>
                    <span className="text-3xl font-bold text-gray-900">¥199</span>
                    <span className="text-gray-600 text-sm">/月</span>
                  </>
                ) : (
                  <>
                    <span className="text-3xl font-bold text-gray-900">¥159</span>
                    <span className="text-gray-600 text-sm">/月</span>
                    <p className="text-xs text-green-600 mt-1">年付可节省 ¥480</p>
                  </>
                )}
              </div>
              <ul className="space-y-3 mb-6 text-sm">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-purple-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                  <span className="text-gray-700">500次/月 AI分析</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-purple-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                  <span className="text-gray-700">全部AI模型</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-purple-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                  <span className="text-gray-700">云端同步</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-purple-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                  <span className="text-gray-700">优先支持</span>
                </li>
              </ul>
              {currentPlan === 'pro' ? (
                <button
                  disabled
                  className="w-full bg-gray-100 text-gray-400 py-2 rounded-lg text-sm font-medium cursor-not-allowed"
                >
                  当前方案
                </button>
              ) : (
                <button
                  onClick={() => handleUpgrade('pro')}
                  disabled={isLoading}
                  className="w-full bg-purple-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? '处理中...' : '立即升级'}
                </button>
              )}
            </div>

            {/* Enterprise Plan */}
            <div className={`rounded-xl border-2 p-6 ${
              currentPlan === 'enterprise' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">企业版</h3>
                {currentPlan === 'enterprise' && (
                  <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-full">
                    当前方案
                  </span>
                )}
              </div>
              <div className="mb-6">
                <span className="text-3xl font-bold text-gray-900">定制</span>
              </div>
              <ul className="space-y-3 mb-6 text-sm">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                  <span className="text-gray-700">无限次数</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                  <span className="text-gray-700">私有化部署</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                  <span className="text-gray-700">专属客服</span>
                </li>
              </ul>
              <button
                onClick={() => handleUpgrade('enterprise')}
                className="w-full bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition"
              >
                联系销售
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-600">
            支持信用卡、支付宝、微信支付 · 7天无理由退款 · 随时取消订阅
          </p>
        </div>
      </div>

      {/* Load Stripe.js */}
      {!document.getElementById('stripe-js') && (
        <script
          id="stripe-js"
          src="https://js.stripe.com/v3/"
          async
        />
      )}
    </div>
  );
}
