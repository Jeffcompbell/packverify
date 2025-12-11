import React, { useState, useEffect } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '../ui/button';

interface DetectionConfigPageProps {
  onBack: () => void;
}

const STORAGE_KEY = 'packverify_custom_prompt';
const ENABLED_KEY = 'packverify_custom_prompt_enabled';

const DEFAULT_PROMPT = `你是一个专业的印刷品质量检测专家。请仔细检查图片中的以下问题：

1. 文字错误：错别字、漏字、多字
2. 标点符号：中英文标点混用、标点位置错误
3. 空格问题：多余空格、缺少空格
4. 排版问题：对齐不整齐、间距不一致
5. 图片质量：模糊、变形、颜色异常

请用中文回复，列出发现的所有问题。`;

export const DetectionConfigPage: React.FC<DetectionConfigPageProps> = ({ onBack }) => {
  const [enabled, setEnabled] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const storedEnabled = localStorage.getItem(ENABLED_KEY);
    const storedPrompt = localStorage.getItem(STORAGE_KEY);
    setEnabled(storedEnabled === 'true');
    setPrompt(storedPrompt || DEFAULT_PROMPT);
  }, []);

  const handleToggle = () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    localStorage.setItem(ENABLED_KEY, String(newEnabled));
  };

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
        <div className="max-w-3xl mx-auto space-y-6">
          {/* 开关 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary">自定义提示词</p>
              <p className="text-xs text-text-muted mt-0.5">开启后使用自定义提示词进行检测</p>
            </div>
            <button
              onClick={handleToggle}
              className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-text-primary' : 'bg-surface-200'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'left-6' : 'left-1'}`} />
            </button>
          </div>

          {/* 编辑区域 */}
          {enabled && (
            <div className="bg-surface-0 rounded-xl border border-border overflow-hidden">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="输入你的自定义提示词..."
                className="w-full h-64 p-4 text-sm text-text-primary bg-transparent resize-none focus:outline-none"
              />
              <div className="border-t border-border px-4 py-3 flex items-center justify-between bg-surface-50">
                <button onClick={handleReset} className="text-xs text-text-muted hover:text-text-primary transition-colors">
                  恢复默认
                </button>
                <div className="flex items-center gap-3">
                  {saved && <span className="text-xs text-success">已保存</span>}
                  <Button onClick={handleSave} disabled={saving} size="sm">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    保存
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
