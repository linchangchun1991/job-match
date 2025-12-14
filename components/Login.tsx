import React, { useState } from 'react';
import { UserRole } from '../types';
import { Briefcase, ChevronRight } from './Icons';

interface LoginProps {
  onLogin: (role: UserRole) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [activeTab, setActiveTab] = useState<'coach' | 'bd'>('coach');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="relative w-full max-w-sm">
        <div className="bg-[#111116] border border-[#27272a] rounded-xl overflow-hidden shadow-2xl">
          
          <div className="p-8 pb-6 text-center border-b border-[#27272a]">
             <img src="logo.png" alt="HIGHMARK" className="h-10 mx-auto mb-4 object-contain filter brightness-100" onError={(e) => {
               (e.target as HTMLImageElement).style.display = 'none';
               ((e.target as HTMLImageElement).nextSibling as HTMLElement).style.display = 'block';
             }}/>
            <div className="hidden text-xl font-bold text-white tracking-widest uppercase mb-1" style={{display: 'none'}}>HIGHMARK</div>
            <p className="text-xs text-gray-500 tracking-[0.2em] uppercase">智能选岗系统 Professional</p>
          </div>

          <div className="flex border-b border-[#27272a]">
            <button
              onClick={() => setActiveTab('coach')}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === 'coach' ? 'bg-white text-black' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              职业教练
            </button>
            <button
              onClick={() => setActiveTab('bd')}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === 'bd' ? 'bg-white text-black' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              企业 / BD
            </button>
          </div>

          <div className="p-8">
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  {activeTab === 'coach' ? '教练 ID' : '账户 ID'}
                </label>
                <input 
                  type="text" 
                  className="w-full bg-black border border-[#333] rounded px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-600 transition-colors"
                  placeholder="admin"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  密码
                </label>
                <input 
                  type="password" 
                  className="w-full bg-black border border-[#333] rounded px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-600 transition-colors"
                  placeholder="••••••••"
                />
              </div>
              
              <button
                onClick={() => onLogin(activeTab)}
                className="w-full py-3 mt-4 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
              >
                登录系统
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="mt-8 flex justify-center opacity-50">
               <span className="text-[10px] text-gray-600 uppercase tracking-widest">Powered by Qwen-Plus AI</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;