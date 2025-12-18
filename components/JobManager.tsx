
import React, { useState, useEffect } from 'react';
import { Database, Trash2, Zap, Sparkles, Lightbulb, ExternalLink, Lock, AlertTriangle } from './Icons';
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => { setIsOpen(defaultOpen); }, [defaultOpen]);

  const processUpload = async (shouldClear: boolean) => {
    if (!pasteContent.trim()) {
        setErrorMsg("请输入或粘贴内容");
        return;
    }

    setIsLoading(true);
    setStatus("AI 引擎正在逐行扫描数据...");
    setErrorMsg(null);
    setProgress({ current: 0, total: 0 });

    try {
        const aiJobs = await parseSmartJobs(pasteContent, (current, total) => {
            setProgress({ current, total });
            setStatus(`正在解析第 ${current} 条企业信息，共 ${total} 条...`);
        });
        
        if (!aiJobs || aiJobs.length === 0) {
            throw new Error("未能识别到有效岗位。请确保文本包含 '|' 分隔符，例如：公司 | 岗位A, 岗位B | 地点 | 链接");
        }

        if (shouldClear) {
            setStatus("正在清理旧数据...");
            await jobService.clearAll();
        }

        const formattedJobs: Job[] = aiJobs.map((j: any, index: number) => ({
            id: `job-${Date.now()}-${index}`,
            company: String(j.company || '未知公司').trim(),
            title: String(j.title || '待定岗位').trim(),
            location: String(j.location || '全国').trim(),
            type: '',
            requirement: '',
            link: String(j.link || '').trim(),
            updateTime: new Date().toISOString().split('T')[0]
        }));

        setStatus(`正在将解析出的 ${formattedJobs.length} 个岗位同步至云端...`);
        const result = await jobService.bulkInsert(formattedJobs);
        
        if (result.success) {
            setStatus(null);
            alert(`✅ 处理成功！\n共从文本中拆分出 ${formattedJobs.length} 个独立岗位并同步。`);
            setPasteContent('');
            const allJobs = await jobService.fetchAll();
            onUpdate(allJobs);
        } else {
            setErrorMsg(`数据库同步失败: ${result.message}`);
        }
    } catch (e: any) {
        console.error("Critical Error:", e);
        setErrorMsg(e.message);
    } finally {
        setIsLoading(false);
        setStatus(null);
    }
  };

  const handleClearOnly = async () => {
    if(confirm('🚨 确定要清空云端数据库的所有岗位吗？此操作不可撤销。')) {
      setIsLoading(true);
      const result = await jobService.clearAll();
      if (result.success) {
        onUpdate([]);
        alert("数据库已清空");
      } else {
        alert("清空失败: " + result.message);
      }
      setIsLoading(false);
    }
  };

  return (
    <div className={`w-full mt-8 border-t border-gray-800 pt-6 ${readOnly ? 'opacity-75' : ''}`}>
      <div className="flex items-center justify-between cursor-pointer group" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-900 rounded text-gray-500 group-hover:text-white transition-colors">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              岗位数据库管理控制台
              {isLoading && <span className="text-[10px] text-blue-500 animate-pulse ml-2 font-mono">SYSTEM PROCESSING...</span>}
            </h3>
            <p className="text-[10px] text-gray-600 font-mono">当前云端库容: {jobs.length} 条有效岗位</p>
          </div>
        </div>
        <button className="px-3 py-1 text-xs text-gray-500 hover:text-white transition-colors font-medium border border-gray-800 rounded">
          {isOpen ? '收起面板' : '展开面板'}
        </button>
      </div>

      {isOpen && (
        <div className="mt-6 bg-[#111116] border border-[#27272a] rounded-xl p-6 animate-in slide-in-from-top-2 duration-300">
          {!readOnly ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-900/10 border border-blue-900/20 rounded-lg p-4">
                   <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-3 h-3 text-blue-400" />
                      <span className="text-[11px] font-bold text-blue-400 uppercase">逐行扫描模式</span>
                   </div>
                   <p className="text-[10px] text-gray-400 leading-relaxed">
                     针对超长岗位列表优化的扫描引擎。即使一行内包含 50 个岗位，AI 也能确保 100% 拆分且不丢失。
                   </p>
                </div>
                <div className="bg-orange-900/10 border border-orange-900/20 rounded-lg p-4">
                   <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-3 h-3 text-orange-400" />
                      <span className="text-[11px] font-bold text-orange-400 uppercase">DEEPSEEK V3 驱动</span>
                   </div>
                   <p className="text-[10px] text-gray-400 leading-relaxed">
                     采用 DeepSeek JSON 模式进行结构化输出，确保数据清洗的严谨性。
                   </p>
                </div>
              </div>

              <textarea
                className="w-full h-64 bg-black border border-[#333] rounded-lg p-4 text-xs font-mono text-gray-300 focus:border-blue-600 focus:outline-none resize-none custom-scrollbar mb-4 transition-all"
                placeholder="在此粘贴包含管道符的原始文本..."
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
              />

              <div className="flex flex-wrap items-center gap-3">
                <button 
                  onClick={() => processUpload(true)}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-white text-black hover:bg-blue-500 hover:text-white rounded-lg text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  一键清空并同步
                </button>

                <button 
                  onClick={() => processUpload(false)}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  增量追加岗位
                </button>

                <button 
                  onClick={handleClearOnly}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2.5 border border-red-900/30 text-red-500 hover:bg-red-600 hover:text-white text-xs font-bold transition-all rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                  清空库
                </button>
              </div>

              {(status || errorMsg) && (
                <div className={`mt-4 p-4 border rounded-lg animate-in fade-in duration-300 ${errorMsg ? 'bg-red-900/10 border-red-900/30' : 'bg-blue-900/10 border-blue-900/30'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[11px] font-bold flex items-center gap-2 ${errorMsg ? 'text-red-400' : 'text-blue-400'}`}>
                      {errorMsg ? <AlertTriangle className="w-3 h-3" /> : <Zap className="w-3 h-3 animate-pulse" />}
                      {errorMsg ? '解析终止' : 'AI 引擎处理中'}
                    </span>
                    {progress.total > 0 && <span className="text-[10px] font-mono text-gray-500">{progress.current} / {progress.total}</span>}
                  </div>
                  <div className={`text-[11px] font-mono leading-relaxed whitespace-pre-wrap ${errorMsg ? 'text-red-300' : 'text-gray-400'}`}>
                    {errorMsg || status}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
               <div className="p-4 bg-gray-900/50 inline-block rounded-full mb-4">
                  <Lock className="w-8 h-8 text-gray-700" />
               </div>
               <p className="text-sm text-gray-500 font-medium">管理员模式已锁定，当前仅供查看。</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default JobManager;
