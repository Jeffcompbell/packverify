import React, { useState, useEffect } from 'react';
import { Loader2, Save, Sparkles, Info } from 'lucide-react';

interface DetectionConfigPageProps {
  onBack: () => void;
}

const STORAGE_KEY = 'packverify_custom_prompt';

const DEFAULT_PROMPT = `你是一个专业的印刷品质量检测专家。请仔细检查图片中的以下问题：

1. 文字错误：错别字、漏字、多字
2. 标点符号：中英文标点混用、标点位置错误
3. 空格问题：多余空格、缺少空格
4. 排版问题：对齐不整齐、间距不一致
5. 图片质量：模糊、变形、颜色异常

请用中文回复，列出发现的所有问题。`;

export const DetectionConfigPage: React.FC<DetectionConfigPageProps> = ({ onBack }) => {
  const [prompt, setPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setPrompt(stored || DEFAULT_PROMPT);
  }, []);

  const handleSave = () => {
    setSaving(true);
    localStorage.setItem(STORAGE_KEY, prompt);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 300);
  };

  const handleReset = () => {
    setPrompt(DEFAULT_PROMPT);
  };

  return (
    <div className="flex-1 flex flex-col bg-surface-50 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        {/* 标题卡片 */}
        <div className="mb-6 p-6 rounded-2xl bg-gradient-to-br from-blue-50 to-purple-50 border border-border">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shrink-0">
              <Sparkles size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary mb-1">个性化检测提示词</h2>
              <p className="text-sm text-text-muted">
                自定义 AI 分析时使用的提示词，让检测更符合你的需求
              </p>
            </div>
          </div>
        </div>

        {/* 提示信息 */}
        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-100 flex items-start gap-2">
          <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            提示词会在每次 AI 分析图片时使用。你可以根据产品类型、行业要求等自定义检测重点。
          </p>
        </div>

        {/* 编辑区域 */}
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="输入你的自定义提示词..."
            className="w-full h-80 p-4 text-sm text-text-primary resize-none focus:outline-none"
          />

          {/* 底部操作栏 */}
          <div className="border-t border-border px-4 py-3 flex items-center justify-between bg-surface-50">
            <button
              onClick={handleReset}
              className="text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              恢复默认
            </button>
            <div className="flex items-center gap-3">
              {saved && (
                <span className="text-xs text-green-600">已保存</span>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                保存设置
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
