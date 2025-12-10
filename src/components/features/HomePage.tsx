import React from 'react';
import { Search, Settings, FileText, HelpCircle } from 'lucide-react';

interface HomePageProps {
  onNavigate: (view: 'analysis' | 'detection-config' | 'batch-report') => void;
  userQuota?: { quota: number; used: number };
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate, userQuota }) => {
  const cards = [
    { id: 'analysis', icon: Search, label: '质检分析', desc: '上传图片进行质量检测' },
    { id: 'detection-config', icon: Settings, label: '检测配置', desc: '配置检测规则和参数' },
    { id: 'batch-report', icon: FileText, label: '批量报告', desc: '查看和导出批量报告' },
    { id: 'help', icon: HelpCircle, label: '帮助文档', desc: '使用指南和常见问题' }
  ];

  return (
    <div className="flex-1 bg-gray-50 p-4 overflow-auto">
      <div className="max-w-4xl mx-auto">
        {userQuota && (
          <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-gray-600">剩余额度</span>
              <span className="text-sm font-semibold text-gray-900 tabular-nums">
                {userQuota.quota - userQuota.used}
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {cards.map((card) => {
            const Icon = card.icon;
            const isHelp = card.id === 'help';
            return (
              <button
                key={card.id}
                onClick={() => !isHelp && onNavigate(card.id as any)}
                className="bg-white rounded-lg border border-gray-200 p-4 text-left hover:border-gray-300 transition-colors"
              >
                <Icon className="w-5 h-5 text-gray-700 mb-2" />
                <div className="text-sm font-medium text-gray-900 mb-0.5">{card.label}</div>
                <div className="text-xs text-gray-500">{card.desc}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
