import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Edit, Trash2, ToggleLeft, ToggleRight, Loader2, X } from 'lucide-react';
import { listDetectionConfigs, createDetectionConfig, updateDetectionConfig, deleteDetectionConfig, DetectionConfig } from '../../services/cloudflare';

interface DetectionConfigPageProps {
  onBack: () => void;
}

export const DetectionConfigPage: React.FC<DetectionConfigPageProps> = ({ onBack }) => {
  const [configs, setConfigs] = useState<DetectionConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingConfig, setEditingConfig] = useState<DetectionConfig | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPrompt, setFormPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setLoading(true);
    const data = await listDetectionConfigs();
    setConfigs(data);
    setLoading(false);
  };

  const handleCreate = () => {
    setIsCreating(true);
    setFormName('');
    setFormPrompt('');
  };

  const handleEdit = (config: DetectionConfig) => {
    setEditingConfig(config);
    setFormName(config.name);
    setFormPrompt(config.prompt);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formPrompt.trim()) return;

    setSaving(true);
    if (isCreating) {
      const newConfig = await createDetectionConfig(formName, formPrompt);
      if (newConfig) {
        setConfigs([...configs, newConfig]);
      }
    } else if (editingConfig) {
      const success = await updateDetectionConfig(editingConfig.id, { name: formName, prompt: formPrompt });
      if (success) {
        setConfigs(configs.map(c => c.id === editingConfig.id ? { ...c, name: formName, prompt: formPrompt } : c));
      }
    }
    setSaving(false);
    setIsCreating(false);
    setEditingConfig(null);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingConfig(null);
  };

  const handleToggle = async (config: DetectionConfig) => {
    const success = await updateDetectionConfig(config.id, { isActive: !config.isActive });
    if (success) {
      setConfigs(configs.map(c => c.id === config.id ? { ...c, isActive: !c.isActive } : c));
    }
  };

  const handleDelete = async (id: string) => {
    const success = await deleteDetectionConfig(id);
    if (success) {
      setConfigs(configs.filter(c => c.id !== id));
    }
    setDeleteConfirmId(null);
  };

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-sm font-semibold text-gray-900">检测配置管理</h1>
        <button
          onClick={handleCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-md hover:bg-gray-800 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          新建配置
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-gray-400" />
            <span className="text-xs text-gray-500">加载中...</span>
          </div>
        ) : configs.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-xs">暂无配置</div>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-[10px]">
              <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                <tr>
                  <th className="text-left py-2 px-3 font-medium">配置名称</th>
                  <th className="text-left py-2 px-3 font-medium">提示词预览</th>
                  <th className="text-left py-2 px-3 font-medium">状态</th>
                  <th className="text-right py-2 px-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 divide-y divide-gray-100">
                {configs.map((config) => (
                  <tr key={config.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2 px-3 font-medium">{config.name}</td>
                    <td className="py-2 px-3 text-gray-500">
                      <div className="truncate max-w-md">{config.prompt}</div>
                    </td>
                    <td className="py-2 px-3">
                      <button
                        onClick={() => handleToggle(config)}
                        className="flex items-center gap-1 hover:opacity-70 transition"
                      >
                        {config.isActive ? (
                          <>
                            <ToggleRight className="w-4 h-4 text-green-600" />
                            <span className="text-green-600">启用</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-400">禁用</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(config)}
                          className="p-1 hover:bg-gray-200 rounded transition"
                        >
                          <Edit className="w-3.5 h-3.5 text-gray-600" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(config.id)}
                          className="p-1 hover:bg-red-50 rounded transition"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(isCreating || editingConfig) && (
        <div className="fixed inset-0 bg-black/30 z-[100] flex items-center justify-center p-4" onClick={handleCancel}>
          <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button onClick={handleCancel} className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 rounded-md transition">
              <X className="w-4 h-4 text-gray-400" />
            </button>

            <div className="p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">
                {isCreating ? '新建配置' : '编辑配置'}
              </h2>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1.5">配置名称</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="输入配置名称"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1.5">提示词</label>
                  <textarea
                    value={formPrompt}
                    onChange={(e) => setFormPrompt(e.target.value)}
                    placeholder="输入检测提示词"
                    rows={6}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-4">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-xs text-gray-600 hover:bg-gray-100 rounded-md transition"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={!formName.trim() || !formPrompt.trim() || saving}
                  className="px-4 py-2 text-xs bg-gray-900 text-white rounded-md hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/30 z-[100] flex items-center justify-center p-4" onClick={() => setDeleteConfirmId(null)}>
          <div className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">确认删除</h2>
              <p className="text-xs text-gray-600 mb-4">确定要删除这个配置吗？此操作无法撤销。</p>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 text-xs text-gray-600 hover:bg-gray-100 rounded-md transition"
                >
                  取消
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirmId)}
                  className="px-4 py-2 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 transition"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
