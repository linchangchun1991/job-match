
import React, { useState, useEffect } from 'react';
import { Database, Trash2, Zap, Sparkles, Lightbulb, ExternalLink, Lock, AlertTriangle, Filter, CheckCircle } from './Icons';
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
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [linkCount, setLinkCount] = useState(0);

  useEffect(() => { setIsOpen(defaultOpen); }, [defaultOpen]);

  const processUpload = async (shouldClear: boolean) => {
    if (!pasteContent.trim()) return;
    setIsLoading(true);
    setStatus("AI 极速引擎解析中...");
    
    try {
        const aiJobs = await parseSmartJobs(pasteContent, (current, total) => {
            setProgress({ current, total });
        });

        if (aiJobs.length === 0) {
          alert("未识别出有效岗位，请检查格式（公司 | 岗位 | 地点 | 链接）");
          setIsLoading(false);
          return;
        }

        const validLinks = aiJobs.filter(j => j.link && j.link.length > 5).length;
        setLinkCount(validLinks);

        if (shouldClear) await jobService.clearAll();
        
        const formattedJobs: Job[] = aiJobs.map((j, index) => ({
            id: `job-${Date.now()}-${index}`,
            company: j.company,
            title: j.title,
            location: j.location,
            type: '',
            requirement: '',
            link: j.link,
            updateTime: new Date().toISOString().split('T')[0]
        }));

        await jobService.bulkInsert(formattedJobs);
        alert(`✅ 同步完成！导入 ${formattedJobs.length} 个岗位 (包含链接: ${validLinks}个)`);
        setPasteContent('');
        onUpdate(await jobService.fetchAll());
    } catch (e: any) {
        alert("同步出错: " + e.message);
    } finally {
        setIsLoading(false);
        setStatus(null);
        setProgress({ current: 0, total: 0 });
    }
  };

  return (
    <div className={`w-full mt-8 border-t border-gray-800 pt-6 ${readOnly ? 'opacity-75' : ''}`}>
      <div className="flex items-center justify-between cursor-pointer group" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-900 rounded text-gray-500 group-hover:text-white">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              岗位管理控制台 <span className="text-[10px] bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded ml-2">V3.0 AI 驱动</span>
            </h3>
            <p className="text-[10px] text-gray-600">全库收录: {jobs.length} 岗位 | 实时解析模式已开启</p>
          </div>
        </div>
        <button className="px-3 py-1 text-xs text-gray-500 border border-gray-800 rounded hover:bg-white/5 transition-colors">
          {isOpen ? '隐藏控制面板' : '点击管理岗位库'}
        </button>
      </div>
      
      {isOpen && (
        <div className="mt-6 bg-[#111116] border border-[#27272a] rounded-xl p-6 shadow-inner animate-in slide-in-from-top-2 duration-300">
          {!readOnly ? (
            <>
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                   <label className="text-[10px] text-gray-500 uppercase font-bold">粘贴数据源（支持 Excel 复制、微信截图文字、PDF 文本）</label>
                   {isLoading && <span className="text-[10px] text-blue-400 animate-pulse">{status} {progress.current}/{progress.total}</span>}
                </div>
                <textarea
                  className="w-full h-64 bg-black/50 border border-[#333] rounded-lg p-4 text-xs font-mono text-gray-400 focus:border-blue-600 focus:outline-none transition-all placeholder-gray-800"
                  placeholder="示例格式：&#10;公司名称 | 招聘岗位 | 工作城市 | 投递链接&#10;Highmark | 商业分析师 | 广州 | https://highmark.com/job/1"
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                />
              </div>
              
              <div className="flex items-center gap-4">
                <button 
                  disabled={isLoading || !pasteContent}
                  onClick={() => processUpload(true)} 
                  className={`px-8 py-3 rounded-lg text-xs font-bold transition-all ${isLoading ? 'bg-gray-800 text-gray-600' : 'bg-white text-black hover:bg-blue-500 hover:text-white active:scale-95'}`}
                >
                  {isLoading ? '解析中...' : '清空全库并覆盖同步'}
                </button>
                <button 
                  disabled={isLoading || !pasteContent}
                  onClick={() => processUpload(false)} 
                  className={`px-8 py-3 rounded-lg text-xs font-bold transition-all border border-gray-700 ${isLoading ? 'opacity-50' : 'text-white hover:bg-gray-800 active:scale-95'}`}
                >
                  追加同步数据
                </button>
                
                <div className="ml-auto text-right">
                   <p className="text-[10px] text-gray-500 mb-1 italic">提示：分隔符支持 | 、 Tab 或 多个空格</p>
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center">
               <Lock className="w-8 h-8 text-gray-800 mx-auto mb-3" />
               <p className="text-xs text-gray-600">当前处于 [职业教练] 模式，仅拥有只读权限。<br/>如需更新岗位，请切换至 [企业/BD] 管理账号。</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default JobManager;
