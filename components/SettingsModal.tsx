import React, { useState, useEffect } from 'react';
import { XCircle, Database, Trash2, Settings, Zap } from './Icons';
import { storage } from '../services/storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave }) => {
  const [sbUrl, setSbUrl] = useState('');
  const [sbKey, setSbKey] = useState('');
  const [qwenKey, setQwenKey] = useState('');

  useEffect(() => {
    if (isOpen) {
      const sb = storage.getSupabaseConfig();
      setSbUrl(sb.url);
      setSbKey(sb.key);
      setQwenKey(storage.getQwenKey());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#111116] border border-[#27272a] w-full max-w-md p-6 rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-purple-400" /> 系统设置
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
          {/* AI Providers Config */}
          <div>
            <div className="flex items-center gap-2 mb-3">
               <Zap className="w-4 h-4 text-yellow-400" />
               <h3 className="text-sm font-medium text-gray-300">AI 引擎配置</h3>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">DeepSeek API Key (已内置默认值)</label>
                <input
                  type="password"
                  value="************************"
                  disabled
                  className="w-full bg-black/40 border border-white/5 rounded-lg px-4 py-2 text-gray-500 text-sm cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">阿里通义千问 (Qwen) API Key</label>
                <input
                  type="password"
                  value={qwenKey}
                  onChange={(e) => setQwenKey(e.target.value)}
                  placeholder="请输入您的 Qwen API Key"
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Cloud Database Config */}
          <div className="pt-4 border-t border-white/10">
            <div className="flex items-center gap-2 mb-3">
               <Database className="w-4 h-4 text-blue-400" />
               <h3 className="text-sm font-medium text-gray-300">云端数据库配置 (Supabase)</h3>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Project URL</label>
                <input
                  type="text"
                  value={sbUrl}
                  onChange={(e) => setSbUrl(e.target.value)}
                  placeholder="https://xxx.supabase.co"
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Anon Public Key</label>
                <input
                  type="password"
                  value={sbKey}
                  onChange={(e) => setSbKey(e.target.value)}
                  placeholder="eyJhb..."
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Local Data Management */}
          <div className="pt-4 border-t border-white/10">
            <h3 className="text-sm font-medium text-gray-400 mb-3">本地数据管理</h3>
            <button 
              onClick={() => {
                if(confirm('确定要清空所有本地岗位数据吗？(不影响云端)')) {
                  storage.setJobs([]);
                  window.location.reload();
                }
              }}
              className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm transition-colors"
            >
              <Trash2 className="w-4 h-4" /> 清空本地岗位缓存
            </button>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={() => {
                storage.setSupabaseConfig(sbUrl, sbKey);
                storage.setQwenKey(qwenKey);
                onSave();
                onClose();
              }}
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg text-white font-bold text-sm hover:opacity-90 transition-opacity"
            >
              保存配置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;