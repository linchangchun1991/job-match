
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
    setProgress({ current: 0, total: 0 });

    try {
        const aiJobs = await parseSmartJobs(pasteContent, (current, total) => {
            setProgress({ current, total });
            setStatus(`AI 深度解析中: 已完成 ${current}/${total} 组...`);
        });
        
        if (!aiJobs || aiJobs.length === 0) {
            throw new Error("AI 未能从文本中提取到有效岗位。请检查：1. API Key 是否有效 2. 文本是否包含管道符(|)分隔的结构。");
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

        setStatus(`正在将 ${formattedJobs.length} 个岗位同步至数据库...`);
        const result = await jobService.bulkInsert(formattedJobs);
        
        if (result.success) {
            setStatus(null);
            alert(`✅ 同步完成！\n共解析出 ${formattedJobs.length} 个岗位。`);
            setPasteContent('');
            const allJobs = await jobService.fetchAll();
            onUpdate(allJobs);
        } else {
            setErrorMsg(`数据库保存失败: ${result.message}\n请检查 Supabase 表结构或网络。`);
        }
    } catch (e: any) {
        console.error("Upload Error:", e);
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
                      <span className="text-[11px] font-bold text-blue-400 uppercase">数据格式说明</span>
                   </div>
                   <p className="text-[10px] text-gray-400 leading-relaxed">
                     支持包含管道符 <code className="bg-black px-1 text-blue-300">|</code> 的复杂文本。AI 会自动识别列索引并拆分第三列中的多个岗位名。
                   </p>
                </div>
                <div className="bg-orange-900/10 border border-orange-900/20 rounded-lg p-4">
                   <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-3 h-3 text-orange-400" />
                      <span className="text-[11px] font-bold text-orange-400 uppercase">DEEPSEEK 极速引擎</span>
                   </div>
                   <p className="text-[10px] text-gray-400 leading-relaxed">
                     采用每 5 行一次的高频微批处理技术，确保超长岗位列表（如银行类）拆分时不丢失、不报错。
                   </p>
                </div>
              </div>

              <textarea
                className="w-full h-64 bg-black border border-[#333] rounded-lg p-4 text-xs font-mono text-gray-300 focus:border-blue-600 focus:outline-none resize-none custom-scrollbar mb-4 transition-all"
                placeholder="直接粘贴含有管道符的岗位文本，例如：&#10;游戏 | 4399 | 产品类，技术类 | 广州 | http://...&#10;金融 | 乐信 | 研发类，运营类 | 深圳 | http://..."
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
              />

              <div className="flex flex-wrap items-center gap-3">
                <button 
                  onClick={() => processUpload(true)}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-white text-black hover:bg-blue-500 hover:text-white rounded-lg text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  清空数据库并覆盖同步
                </button>

                <button 
                  onClick={() => processUpload(false)}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  保留现有数据并追加
                </button>

                <button 
                  onClick={handleClearOnly}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2.5 border border-red-900/30 text-red-500 hover:bg-red-600 hover:text-white text-xs font-bold transition-all rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                  紧急清空
                </button>
              </div>

              {(status || errorMsg) && (
                <div className={`mt-4 p-4 border rounded-lg animate-in fade-in duration-300 ${errorMsg ? 'bg-red-900/10 border-red-900/30' : 'bg-blue-900/10 border-blue-900/30'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[11px] font-bold flex items-center gap-2 ${errorMsg ? 'text-red-400' : 'text-blue-400'}`}>
                      {errorMsg ? <AlertTriangle className="w-3 h-3" /> : <Zap className="w-3 h-3 animate-pulse" />}
                      {errorMsg ? '解析任务终止' : 'AI 引擎正在分析'}
                    </span>
                    {progress.total > 0 && <span className="text-[10px] font-mono text-gray-500">BATCH: {progress.current} / {progress.total}</span>}
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
               <p className="text-sm text-gray-500 font-medium">您当前处于“教练模式”，岗位库仅供匹配，无修改权限。</p>
               <p className="text-[10px] text-gray-700 mt-2">如需更新岗位，请以“企业管理员”身份登录。</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default JobManager;
