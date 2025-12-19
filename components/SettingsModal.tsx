
import React from 'react';
import { XCircle, Settings, Zap, CheckCircle, Cpu, Server, ShieldCheck, Timer } from './Icons';
import { UserRole } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  userRole: UserRole;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, userRole }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="bg-[#0c0c10] border border-[#27272a] w-full max-w-md p-8 rounded-3xl shadow-[0_0_50px_-12px_rgba(37,99,235,0.5)] animate-in fade-in zoom-in duration-300">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-xl font-black text-white flex items-center gap-3 italic uppercase tracking-tighter">
            <Settings className="w-5 h-5 text-blue-500" /> 系统核心看板
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <XCircle className="w-7 h-7" />
          </button>
        </div>

        <div className="space-y-6">
          {/* AI 引擎状态 */}
          <div className="bg-blue-500/5 border border-blue-500/20 p-5 rounded-2xl">
             <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                   <Zap className="w-4 h-4 text-blue-400 fill-blue-400" />
                   <h4 className="text-[11px] font-black text-blue-400 uppercase tracking-widest">Gemini 3.0 Pro</h4>
                </div>
                <div className="flex items-center gap-1">
                   <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]"></div>
                   <span className="text-[9px] text-green-500 font-bold uppercase">Ready</span>
                </div>
             </div>
             <p className="text-[11px] text-gray-400 leading-relaxed">
               分布式 AI 推理集群已就绪。采用 RAG 架构进行海量岗位语义对齐，支持多模态简历深度解析。
             </p>
          </div>

          {/* 数据库与安全状态 */}
          <div className="grid grid-cols-2 gap-4">
             <div className="p-4 bg-black/40 border border-white/5 rounded-xl">
                <div className="flex items-center gap-2 mb-2 text-gray-500">
                   <Server className="w-3.5 h-3.5" />
                   <span className="text-[9px] font-bold uppercase">Cloud Storage</span>
                </div>
                <p className="text-[10px] text-gray-300 font-mono">SUPABASE_PRO_01</p>
             </div>
             <div className="p-4 bg-black/40 border border-white/5 rounded-xl">
                <div className="flex items-center gap-2 mb-2 text-gray-500">
                   <ShieldCheck className="w-3.5 h-3.5" />
                   <span className="text-[9px] font-bold uppercase">Security Protocol</span>
                </div>
                <p className="text-[10px] text-gray-300 font-mono">AES-256 / RLS</p>
             </div>
          </div>

          <div className="pt-6 border-t border-white/5 space-y-3">
             <div className="flex justify-between items-center text-[10px] uppercase font-bold text-gray-600">
                <span>匹配引擎延迟</span>
                <span className="text-blue-500">~850ms</span>
             </div>
             <div className="flex justify-between items-center text-[10px] uppercase font-bold text-gray-600">
                <span>岗位库实时负载</span>
                <span className="text-blue-500">Online Syncing</span>
             </div>
          </div>

          <button
            onClick={onClose}
            className="w-full mt-4 py-4 bg-white text-black rounded-xl font-bold text-sm hover:bg-blue-600 hover:text-white transition-all active:scale-95 shadow-lg"
          >
            返回工作台
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
