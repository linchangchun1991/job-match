
import React, { useState, useEffect } from 'react';
import { XCircle, Database, Trash2, Settings, Zap, AlertTriangle } from './Icons';
import { storage } from '../services/storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave }) => {
  const [sbUrl, setSbUrl] = useState('');
  const [sbKey, setSbKey] = useState('');

  useEffect(() => {
    if (isOpen) {
      const sb = storage.getSupabaseConfig();
      setSbUrl(sb.url);
      setSbKey(sb.key);
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
               <h3 className="text-sm font-medium text-gray-300">AI 核心引擎</h3>
            </div>
            
            <div className="space-y-3">
              <div className="bg-blue-600/5 border border-blue-600/20 p-3 rounded-lg mb-2">
                <p className="text-[10px] text-blue-400 font-bold mb-1">Gemini 3 Flash 尊享版</p>
                <p className="text-[10px] text-gray-500 leading-relaxed italic">当前已锁定 Gemini 作为全系统唯一解析与匹配引擎，确保专家级输出稳定性。</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">API Key (已于 index.html 预加载)</label>
                <input
                  type="password"
                  value="************************"
                  disabled
                  className="w-full bg-black/40 border border-white/5 rounded-lg px-4 py-2 text-gray-500 text-sm cursor-not-allowed"
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
            <h3 className="text-sm font-medium text-gray-400 mb-3">辅助工具</h3>
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
            <div className="mt-4 flex items-start gap-2 bg-orange-900/10 p-3 rounded-lg border border-orange-900/20">
               <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
               <p className="text-[10px] text-orange-300 leading-relaxed">
                 系统现采用 3000 字符极细粒度分块解析技术，能彻底解决多岗位拆分时的 JSON 溢出问题。
               </p>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={() => {
                storage.setSupabaseConfig(sbUrl, sbKey);
                onSave();
                onClose();
              }}
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg text-white font-bold text-sm hover:opacity-90 transition-opacity"
            >
              保存并刷新配置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
