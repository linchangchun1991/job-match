
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
        if (rawJobs.length === 0) throw new Error("无法识别有效岗位，请检查格式 (公司|岗位|地点|链接)");

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
              岗位极速入库 (Zeabur Cloud) <Zap className="w-3 h-3 text-blue-500 fill-blue-500" />
            </h3>
            <p className="text-[11px] text-gray-500">
               {isLoading ? '正在解析并上传...' : `当前库存：${jobs.length} 个岗位 | 数据库状态：${syncStatus.type === 'error' ? '连接异常' : '正常'}`}
            </p>
          </div>
        </div>
      </div>
      
      <div className="bg-[#0a0a0f] border border-[#1c1c21] rounded-2xl p-8 shadow-2xl relative">
        {isLoading && (
           <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-2xl animate-in fade-in">
              <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
              <p className="text-xs font-bold text-white uppercase tracking-widest">智能拆分岗位并入库中...</p>
           </div>
        )}

        <div className="space-y-6">
          <textarea
            className="w-full h-72 bg-black/60 border border-white/5 rounded-2xl p-6 text-xs font-mono text-blue-100/70 focus:border-blue-500/50 focus:outline-none transition-all placeholder-gray-700 custom-scrollbar leading-relaxed"
            placeholder={`在此处直接粘贴您的岗位列表，系统会自动拆分多岗位：\n\n4399 | 产品类，技术类，职能类 | 广州 | https://...\n乐信 | 研发类，风险类，运营类 | 深圳,上海 | https://...\n益普索 | 助理咨询顾问，定量研究员，定性研究员 | 北京,广州 | https://...\n\n(支持格式：公司 | 岗位1，岗位2 | 地点 | 链接)`}
            value={pasteContent}
            onChange={(e) => setPasteContent(e.target.value)}
          />

          {syncStatus.msg && (
             <div className={`p-4 rounded-xl flex items-center justify-between gap-3 animate-in slide-in-from-top-2 ${syncStatus.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                <div className="flex items-center gap-3">
                   {syncStatus.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                   <p className="text-[11px] font-bold">{syncStatus.msg}</p>
                </div>
             </div>
          )}
          
          <div className="flex items-center gap-4 pt-2">
            <button 
              disabled={isLoading || !pasteContent}
              onClick={() => processUpload(true)} 
              className="flex-1 py-4 bg-white text-black rounded-xl text-xs font-black uppercase hover:bg-red-500 hover:text-white transition-all active:scale-95 disabled:opacity-30"
            >
              清空旧数据并同步
            </button>
            <button 
              disabled={isLoading || !pasteContent}
              onClick={() => processUpload(false)} 
              className="flex-1 py-4 border border-white/10 text-white rounded-xl text-xs font-black uppercase hover:bg-blue-600 transition-all active:scale-95 disabled:opacity-30"
            >
              增量追加新岗位
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobManager;
