
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
    setStatus("AI 正在深度解析文本内容...");
    setErrorMsg(null);

    try {
        const aiJobs = await parseSmartJobs(pasteContent, (current, total) => {
            setProgress({ current, total });
            setStatus(`解析中: 第 ${current}/${total} 段...`);
        });
        
        if (!aiJobs || aiJobs.length === 0) {
            throw new Error("AI 未能从这段文本中识别到任何招聘岗位，请检查粘贴的内容格式。");
        }

        if (shouldClear) {
            setStatus("正在清理旧数据...");
            await jobService.clearAll();
        }

        const formattedJobs: Job[] = aiJobs.map((j: any, index: number) => ({
            id: `job-${Date.now()}-${index}`,
            company: j.company || '未知公司',
            title: j.title || '岗位',
            location: j.location || '全国',
            type: j.type || '',
            requirement: j.requirement || '',
            link: j.link || '',
            updateTime: new Date().toISOString().split('T')[0]
        }));

        setStatus(`正在同步 ${formattedJobs.length} 条岗位至数据库...`);
        const result = await jobService.bulkInsert(formattedJobs);
        
        if (result.success) {
            setStatus(null);
            alert(`✅ 同步成功！新增 ${formattedJobs.length} 条数据。`);
            setPasteContent('');
            const allJobs = await jobService.fetchAll();
            onUpdate(allJobs);
        } else {
            setErrorMsg(`数据库同步失败: ${result.message}`);
        }
    } catch (e: any) {
        setErrorMsg(e.message);
    } finally {
        setIsLoading(false);
        setStatus(null);
    }
  };

  const handleClearOnly = async () => {
    if(confirm('🚨 确定清空吗？')) {
      setIsLoading(true);
      const result = await jobService.clearAll();
      if (result.success) onUpdate([]);
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
              岗位数据库管理
              {isLoading && <span className="text-[10px] text-blue-500 animate-pulse">处理中...</span>}
            </h3>
            <p className="text-[10px] text-gray-600 font-mono">云端岗位总计: {jobs.length} 条</p>
          </div>
        </div>
        <button className="px-3 py-1 text-xs text-gray-500 hover:text-white transition-colors font-medium">
          {isOpen ? '收起控制台' : '管理面板'}
        </button>
      </div>

      {isOpen && (
        <div className="mt-6 bg-[#111116] border border-[#27272a] rounded-xl p-6">
          {!readOnly ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-900/10 border border-blue-900/20 rounded-lg p-4">
                   <p className="text-[10px] text-gray-400 leading-relaxed">
                     支持微信公众号链接格式提取。系统会自动识别包含在文本中的“公司、岗位、链接”等信息。
                   </p>
                </div>
                <div className="bg-orange-900/10 border border-orange-900/20 rounded-lg p-4">
                   <p className="text-[10px] text-gray-400 leading-relaxed">
                     Gemini API 解析非常快。建议单次粘贴不超过 500 条岗位信息以保证准确度。
                   </p>
                </div>
              </div>

              <textarea
                className="w-full h-48 bg-black border border-[#333] rounded p-4 text-xs font-mono text-gray-300 focus:border-blue-600 focus:outline-none resize-none custom-scrollbar mb-4"
                placeholder="直接粘贴腾讯云 ADP 后台或微信文章中的岗位列表..."
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
              />

              <div className="flex flex-wrap items-center gap-3">
                <button 
                  onClick={() => processUpload(true)}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-30"
                >
                  一键清空并同步
                </button>

                <button 
                  onClick={() => processUpload(false)}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-30"
                >
                  增量追加岗位
                </button>

                <button 
                  onClick={handleClearOnly}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2.5 border border-red-900/30 text-red-500 hover:bg-red-600 text-xs font-bold transition-all"
                >
                  清空库
                </button>
              </div>

              {(status || errorMsg) && (
                <div className={`mt-4 p-4 border rounded-lg ${errorMsg ? 'bg-red-900/10 border-red-900/20' : 'bg-blue-900/10 border-blue-900/20'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[11px] font-bold ${errorMsg ? 'text-red-400' : 'text-blue-400'}`}>
                      {errorMsg ? '解析终止' : 'AI 处理中'}
                    </span>
                    {progress.total > 0 && <span className="text-[10px] text-gray-500">{progress.current}/{progress.total}</span>}
                  </div>
                  <div className={`text-[11px] ${errorMsg ? 'text-red-300' : 'text-gray-400'} font-mono`}>
                    {errorMsg || status}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-10 text-gray-600 italic text-xs">
               教练模式已启动：岗位数据受保护，不可修改。
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default JobManager;
