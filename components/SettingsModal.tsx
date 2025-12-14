import React, { useState, useEffect } from 'react';
import { XCircle, Database, Trash2, Settings } from './Icons';
import { storage } from '../services/storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave }) => {
  const [key, setKey] = useState('');

  useEffect(() => {
    if (isOpen) {
      setKey(storage.getApiKey());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-card w-full max-w-md p-6 rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-purple-400" /> 系统设置
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              API Key 配置 (通义千问)
            </label>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="sk-..."
              className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
            />
            <p className="text-xs text-gray-500 mt-2">
              用于驱动 AI 匹配引擎，Key 仅存储在本地浏览器中。
            </p>
          </div>

          <div className="pt-4 border-t border-white/10">
            <h3 className="text-sm font-medium text-gray-400 mb-3">数据管理</h3>
            <button 
              onClick={() => {
                if(confirm('确定要清空所有岗位库数据吗？此操作不可恢复。')) {
                  storage.setJobs([]);
                  window.location.reload();
                }
              }}
              className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm transition-colors"
            >
              <Trash2 className="w-4 h-4" /> 清空岗位数据库
            </button>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={() => {
                storage.setApiKey(key);
                onSave(key);
                onClose();
              }}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
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