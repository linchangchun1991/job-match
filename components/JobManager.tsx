
import React, { useState, useEffect } from 'react';
import { Database, Zap, Lock, AlertTriangle, CheckCircle, Trash2 } from './Icons';
import { Job } from '../types';
import { jobService } from '../services/jobService';
import { parseSmartJobs } from '../services/aiService';

interface JobManagerProps {
  jobs: Job[];
  onUpdate: (jobs: Job[]) => void;
  onRefresh?: () => void;
  readOnly?: boolean;
  defaultOpen?: boolean;
}

const JobManager: React.FC<JobManagerProps> = ({ jobs, onUpdate, onRefresh, readOnly = false, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [pasteContent, setPasteContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error' | null, msg: string }>({ type: null, msg: '' });

  useEffect(() => { setIsOpen(defaultOpen); }, [defaultOpen]);

  const processUpload = async (shouldClear: boolean) => {
    if (!pasteContent.trim()) return;
    setIsLoading(true);
    setSyncStatus({ type: null, msg: '' });
    
    try {
        const rawJobs = await parseSmartJobs(pasteContent);
        if (rawJobs.length === 0) throw new Error("无法识别出有效岗位数据。格式：公司 | 岗位 | 地点");

        if (shouldClear) {
           const clearRes = await jobService.clearAll();
           if (!clearRes.success) throw new Error(clearRes.message);
        }
        
        const formattedJobs: Job[] = rawJobs.map((j, index) => ({
            id: `job-${Date.now()}-${index}`,
            company: j.company,
            title: j.title,
            location: j.location,
            type: '',
            requirement: '',
            link: j.link,
            updateTime: new Date().toISOString().split('T')[0]
        }));

        const result = await jobService.bulkInsert(formattedJobs);
        
        if (result.success) {
          setSyncStatus({ type: 'success', msg: result.message });
          setPasteContent('');
          const allJobs = await jobService.fetchAll();
          onUpdate(allJobs);
        } else {
          setSyncStatus({ type: 'error', msg: result.message });
        }
    } catch (e: any) {
        setSyncStatus({ type: 'error', msg: e.message });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className={`w-full mt-12 border-t border-gray-900 pt-8 ${readOnly ? 'opacity-80' : ''}`}>
      <div className="flex items-center justify-between cursor-pointer group" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gray-900/50 rounded-xl text-gray-500 group-hover:text-blue-500 transition-colors border border-white/5">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-gray-200 uppercase tracking-[0.2em] flex items-center gap-2">
              岗位管理中心 <span className="text-[10px] bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full border border-blue-500/20">V3.5 云同步版</span>
            </h3>
            <p className="text-[11px] text-gray-600 font-medium">当前岗位基数: {jobs.length} | 支持一键云端覆盖</p>
          </div>
        </div>
        <button className="px-4 py-2 text-xs font-bold text-gray-400 border border-white/5 rounded-xl hover:bg-white/5 transition-all">
          {isOpen ? '收起面板' : '进入管理模式'}
        </button>
      </div>
      
      {isOpen && (
        <div className="mt-8 bg-[#0a0a0f] border border-[#1c1c21] rounded-2xl p-8 shadow-2xl animate-in slide-in-from-top-4 duration-500">
          {!readOnly ? (
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-4">
                   <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">源数据同步终端 (支持 CSV/EXCEL 格式粘贴)</label>
                   {isLoading && <span className="text-xs text-blue-500 font-bold animate-pulse">正在执行云端同步序列...</span>}
                </div>
                <textarea
                  className="w-full h-80 bg-black/60 border border-white/5 rounded-2xl p-6 text-xs font-mono text-blue-100/70 focus:border-blue-500/50 focus:outline-none transition-all placeholder-gray-800 leading-relaxed custom-scrollbar"
                  placeholder="示例格式：&#10;腾讯 | 产品经理 | 深圳 | https://careers.tencent.com/xxx&#10;阿里巴巴 | 算法工程师 | 杭州 | https://talent.alibaba.com/xxx"
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                />
              </div>

              {syncStatus.msg && (
                 <div className={`p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-left-4 ${syncStatus.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                    {syncStatus.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    <p className="text-xs font-bold">{syncStatus.msg}</p>
                 </div>
              )}
              
              <div className="flex items-center gap-4 pt-2">
                <button 
                  disabled={isLoading || !pasteContent}
                  onClick={() => processUpload(true)} 
                  className={`flex-1 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${isLoading ? 'bg-gray-800 text-gray-500' : 'bg-white text-black hover:bg-blue-600 hover:text-white shadow-xl shadow-white/5'}`}
                >
                  {isLoading ? '同步中...' : '清空并覆盖云端'}
                </button>
                <button 
                  disabled={isLoading || !pasteContent}
                  onClick={() => processUpload(false)} 
                  className={`flex-1 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-white/10 ${isLoading ? 'opacity-30' : 'text-white hover:bg-white/5'}`}
                >
                  追加至现有库
                </button>
              </div>
              <p className="text-[10px] text-gray-700 text-center italic">注：同步操作将实时写入 Supabase 数据库，所有关联账号将同步更新。</p>
            </div>
          ) : (
            <div className="py-20 text-center">
               <div className="inline-flex p-5 bg-gray-900/50 rounded-3xl border border-white/5 mb-6">
                  <Lock className="w-10 h-10 text-gray-800" />
               </div>
               <h4 className="text-sm font-bold text-gray-400 mb-2">权限受限</h4>
               <p className="text-xs text-gray-600 max-w-xs mx-auto leading-relaxed">当前为[教练]只读模式。如需同步或更新岗位，请使用[企业/BD]账户登录。</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default JobManager;
