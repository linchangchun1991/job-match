import React, { useState } from 'react';
import { UserRole } from '../types';
import { Briefcase, ChevronRight, Lock, User } from './Icons';

interface LoginProps {
  onLogin: (role: UserRole) => void;
}

const Logo: React.FC<{ className?: string }> = ({ className = "h-10" }) => {
  const [error, setError] = useState(false);
  if (error) {
    return (
      <div className={`flex flex-col justify-center ${className}`}>
        <h1 className="text-2xl font-bold text-white tracking-widest">HIGHMARK</h1>
      </div>
    );
  }
  return (
    <img 
      src="logo.png" 
      alt="HIGHMARK" 
      className={`${className} object-contain filter brightness-110`} 
      onError={() => setError(true)}
    />
  );
};

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [activeTab, setActiveTab] = useState<'coach' | 'bd'>('coach');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    setError('');
    
    if (activeTab === 'bd') {
      if (password !== 'hm2025') {
        setError('企业管理员密码错误 (默认: hm2025)');
        return;
      }
    }

    onLogin(activeTab);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-black to-black">
      <div className="relative w-full max-w-sm px-4">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-blue-500/10 blur-[100px] rounded-full pointer-events-none"></div>

        <div className="relative bg-[#111116] border border-[#27272a] rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">
          
          <div className="p-8 pb-6 text-center border-b border-[#27272a]/50">
             <div className="flex items-center justify-center mb-4">
                <Logo className="h-10" />
             </div>
            <p className="text-[10px] text-gray-500 tracking-[0.3em] uppercase font-medium">智能选岗系统 Professional</p>
          </div>

          <div className="flex border-b border-[#27272a]">
            <button
              onClick={() => { setActiveTab('coach'); setError(''); }}
              className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                activeTab === 'coach' 
                  ? 'bg-white text-black shadow-[0_4px_20px_-5px_rgba(255,255,255,0.3)]' 
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <User className="w-3 h-3" /> 职业教练
              </div>
            </button>
            <button
              onClick={() => { setActiveTab('bd'); setError(''); }}
              className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                activeTab === 'bd' 
                  ? 'bg-blue-600 text-white shadow-[0_4px_20px_-5px_rgba(37,99,235,0.5)]' 
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Briefcase className="w-3 h-3" /> 企业 / BD
              </div>
            </button>
          </div>

          <div className="p-8 space-y-5">
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  {activeTab === 'coach' ? '教练昵称 / ID' : '管理员账户'}
                </label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-black/50 border border-[#333] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all placeholder-gray-700"
                  placeholder={activeTab === 'coach' ? "请输入您的名字" : "admin"}
                  autoFocus
                />
              </div>
              
              <div className={`transition-all duration-300 overflow-hidden ${activeTab === 'bd' ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'}`}>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex justify-between">
                  <span>访问密码</span>
                  <Lock className="w-3 h-3" />
                </label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-black/50 border border-[#333] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all placeholder-gray-700"
                  placeholder="请输入管理员密码"
                />
              </div>

              {error && (
                <div className="text-red-500 text-xs font-medium bg-red-500/10 p-2 rounded border border-red-500/20 animate-pulse">
                  ⚠️ {error}
                </div>
              )}
              
              <button
                onClick={handleLogin}
                className={`w-full py-3.5 mt-2 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-95 ${
                    activeTab === 'bd' 
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20' 
                    : 'bg-white hover:bg-gray-100 text-black shadow-white/10'
                }`}
              >
                {activeTab === 'coach' ? '开始匹配工作' : '进入管理后台'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="mt-6 text-center">
               <p className="text-[10px] text-gray-600">
                 {activeTab === 'bd' ? '🔒 仅限数据管理人员访问' : '✨ 极速 AI 简历解析与岗位匹配'}
               </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;