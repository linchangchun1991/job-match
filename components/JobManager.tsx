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
        setErrorMsg("请输入或粘贴要解析的内容");
        return;
    }

    setIsLoading(true);
    setStatus(shouldClear ? "正在重置云端数据..." : "正在分析内容...");
    setErrorMsg(null);

    try {
        if (shouldClear) {
            const clearRes = await jobService.clearAll();
            if (!clearRes.success) throw new Error(clearRes.message);
            onUpdate([]); 
        }

        setStatus("AI 正在解析您的新知识库数据...");
        const aiJobs = await parseSmartJobs(pasteContent, (current, total) => {
            setProgress({ current, total });
            setStatus(`解析中: 第 ${current}/${total} 段...`);
        });
        
        const formattedJobs: Job[] = aiJobs.map((j: any, index: number) => ({
            id: `job-adp-${Date.now()}-${index}`,
            company: j.company || '未知公司',
            title: j.title || '通用岗位',
            location: j.location || '全国',
            type: '',
            requirement: '',
            link: j.link || '',
            updateTime: new Date().toISOString().split('T')[0]
        }));

        setStatus(`正在同步 ${formattedJobs.length} 条岗位...`);
        const result = await jobService.bulkInsert(formattedJobs);
        if (result.success) {
            setStatus(null);
            alert(`✅ 成功！已同步 ${formattedJobs.length} 条数据至新数据库。`);
            setPasteContent('');
            const allJobs = await jobService.fetchAll();
            onUpdate(allJobs);
        } else {
            setErrorMsg(`同步失败: ${result.message}`);
        }
    } catch (e: any) {
        setErrorMsg(`操作异常: ${e.message}`);
    } finally {
        setIsLoading(false);
        setStatus(null);
    }
  };

  const handleClearOnly = async () => {
    if(confirm('🚨 确定要彻底清空云端岗位库吗？')) {
      setIsLoading(true);
      setErrorMsg(null);
      const result = await jobService.clearAll();
      if (result.success) {
          onUpdate([]);
          alert('云端数据已清空');
      } else {
          setErrorMsg(`清空操作失败: ${result.message}`);
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
              岗位数据库管理
              {isLoading && <span className="text-[10px] text-blue-500 animate-pulse">处理中...</span>}
              {readOnly && <Lock className="w-3 h-3 text-gray-600" />}
            </h3>
            <p className="text-[10px] text-gray-600 font-mono">云端岗位总计: {jobs.length} 条</p>
          </div>
        </div>
        <button className="px-3 py-1 text-xs text-gray-500 hover:text-white transition-colors font-medium">
          {isOpen ? '收起控制台' : '打开管理面板'}
        </button>
      </div>

      {isOpen && (
        <div className="mt-6 bg-[#111116] border border-[#27272a] rounded-xl p-6 animate-in slide-in-from-top-2 duration-200">
          {!readOnly ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-900/10 border border-blue-900/20 rounded-lg p-4">
                   <div className="flex items-center gap-2 text-blue-400 mb-2">
                      <Lightbulb className="w-4 h-4" />
                      <span className="text-xs font-bold">新知识库导入指引</span>
                   </div>
                   <p className="text-[10px] text-gray-400 leading-relaxed">
                     由于权限限制，请前往 <a href="https://adp.cloud.tencent.com/adp/#/app/knowledge/qa/source?spaceId=default_space&appid=2001565884896426560&appType=knowledge_qa" target="_blank" className="text-blue-500 underline inline-flex items-center gap-1">腾讯云 ADP 后台<ExternalLink className="w-2 h-2"/></a><br/>
                     全选并复制里面的岗位表格内容，然后粘贴到下方文本框。
                   </p>
                </div>
                <div className="bg-orange-900/10 border border-orange-900/20 rounded-lg p-4">
                   <div className="flex items-center gap-2 text-orange-400 mb-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-xs font-bold">注意事项</span>
                   </div>
                   <p className="text-[10px] text-gray-400 leading-relaxed">
                     点击“一键替换”会先清空旧数据库再导入新数据。由于旧应用已欠费，请确保在“设置”中已更新至最新的 Supabase 配置。
                   </p>
                </div>
              </div>

              <textarea
                className="w-full h-48 bg-black border border-[#333] rounded p-4 text-xs font-mono text-gray-300 focus:border-blue-600 focus:outline-none resize-none custom-scrollbar mb-4"
                placeholder="请在此粘贴从腾讯云 ADP 知识库复制的文本内容..."
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
              />

              <div className="flex flex-wrap items-center gap-3">
                <button 
                  onClick={() => processUpload(true)}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-orange-900/20 disabled:opacity-30"
                >
                  <Zap className="w-3 h-3" /> 一键清空并替换为新知识库
                </button>

                <button 
                  onClick={() => processUpload(false)}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-30"
                >
                  <Sparkles className="w-3 h-3" /> 增量追加新岗位
                </button>

                <button 
                  onClick={handleClearOnly}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2.5 border border-red-900/30 text-red-500 hover:bg-red-600 hover:text-white rounded-lg text-xs font-bold transition-all"
                >
                  <Trash2 className="w-3 h-3" /> 仅清空当前库
                </button>
              </div>

              {(status || errorMsg) && (
                <div className="mt-4 p-4 bg-black/40 border border-gray-800 rounded-lg flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isLoading && <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>}
                      <span className={`text-[11px] font-bold ${errorMsg ? 'text-red-400' : 'text-blue-400'}`}>
                        {errorMsg ? '❌ 发生错误' : '📡 执行状态'}
                      </span>
                    </div>
                    {progress.total > 0 && (
                      <div className="text-[10px] text-gray-500 font-mono">
                        PROGRESS: {Math.round((progress.current / progress.total) * 100)}%
                      </div>
                    )}
                  </div>
                  <div className={`text-[11px] ${errorMsg ? 'text-red-300' : 'text-gray-400'} whitespace-pre-wrap font-mono break-all`}>
                    {errorMsg || status}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-10 text-gray-600">
               <Lock className="w-10 h-10 mx-auto mb-4 opacity-20" />
               <p className="text-sm italic">教练模式已启动：岗位数据受保护，不可修改。</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default JobManager;