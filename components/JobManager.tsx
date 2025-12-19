
import React, { useState, useEffect } from 'react';
import { Database, Zap, Lock, AlertTriangle, CheckCircle, Trash2, Upload, Settings } from './Icons';
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
        if (rawJobs.length === 0) throw new Error("识别失败。请确认格式：公司 | 岗位 | 地点 | [链接]");

        if (shouldClear) {
           await jobService.clearAll();
        }
        
        const formattedJobs: Job[] = rawJobs.map((j, index) => ({
            id: `job-${Date.now()}-${index}`,
            company: j.company,
            title: j.title,
            location: j.location,
            type: '',
            requirement: '',
            link: j.link || '',
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
    <div className={`w-full mt-12 border-t border-gray-900 pt-8 ${readOnly ? 'hidden' : ''}`}>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500 border border-blue-500/20">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
              BD 云端岗位中枢 <Zap className="w-3 h-3 text-blue-500 fill-blue-500" />
            </h3>
            <p className="text-[11px] text-gray-500">
               {isLoading ? '正在进行海量数据同步...' : `当前库存：${jobs.length} 个岗位 | 数据库已挂载`}
            </p>
          </div>
        </div>
      </div>
      
      <div className="bg-[#0a0a0f] border border-[#1c1c21] rounded-2xl p-8 shadow-2xl relative">
        {isLoading && (
           <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-2xl animate-in fade-in">
              <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
              <p className="text-xs font-bold text-white uppercase tracking-widest">正在上传云端...</p>
           </div>
        )}

        <div className="space-y-6">
          <textarea
            className="w-full h-72 bg-black/60 border border-white/5 rounded-2xl p-6 text-xs font-mono text-blue-100/70 focus:border-blue-500/50 focus:outline-none transition-all placeholder-gray-700 custom-scrollbar leading-relaxed"
            placeholder="粘贴岗位数据（自动识别分隔符）&#10;示例：&#10;字节跳动 | 前端工程师 | 北京 | https://...&#10;美团 | 产品经理 | 上海 | https://..."
            value={pasteContent}
            onChange={(e) => setPasteContent(e.target.value)}
          />

          {syncStatus.msg && (
             <div className={`p-4 rounded-xl flex items-center justify-between gap-3 animate-in slide-in-from-top-2 ${syncStatus.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                <div className="flex items-center gap-3">
                   {syncStatus.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                   <p className="text-[11px] font-bold">{syncStatus.msg}</p>
                </div>
                {syncStatus.type === 'error' && syncStatus.msg.includes('link') && (
                  <button 
                    onClick={() => {
                       // 这是一个 Hack 触发主 App 里的 SettingsOpen
                       const btn = document.querySelector('button[title="Settings"], .lucide-settings')?.parentElement;
                       (btn as any)?.click();
                    }}
                    className="text-[9px] font-black uppercase bg-red-500 text-white px-2 py-1 rounded hover:bg-white hover:text-red-500 transition-all shrink-0"
                  >
                    立即修复
                  </button>
                )}
             </div>
          )}
          
          <div className="flex items-center gap-4 pt-2">
            <button 
              disabled={isLoading || !pasteContent}
              onClick={() => processUpload(true)} 
              className="flex-1 py-4 bg-white text-black rounded-xl text-xs font-black uppercase hover:bg-red-500 hover:text-white transition-all active:scale-95 disabled:opacity-30"
            >
              清空并重载云端
            </button>
            <button 
              disabled={isLoading || !pasteContent}
              onClick={() => processUpload(false)} 
              className="flex-1 py-4 border border-white/10 text-white rounded-xl text-xs font-black uppercase hover:bg-blue-600 transition-all active:scale-95 disabled:opacity-30"
            >
              增量追加
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobManager;
