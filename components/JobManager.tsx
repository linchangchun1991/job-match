
import React, { useState, useEffect } from 'react';
import { Database, Trash2, Zap, Sparkles, Lightbulb, ExternalLink, Lock, AlertTriangle, Filter } from './Icons';
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
  const [parsingErrors, setParsingErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => { setIsOpen(defaultOpen); }, [defaultOpen]);

  const processUpload = async (shouldClear: boolean) => {
    if (!pasteContent.trim()) {
        setErrorMsg("请输入或粘贴内容");
        return;
    }

    setIsLoading(true);
    setStatus("本地高性能引擎解析中...");
    setErrorMsg(null);
    setParsingErrors([]);
    setProgress({ current: 0, total: 0 });

    try {
        // 调用升级后的本地解析逻辑
        const aiJobs = await parseSmartJobs(pasteContent, (current, total, errors) => {
            setProgress({ current, total });
            if (errors) setParsingErrors([...errors]);
        });
        
        if (!aiJobs || aiJobs.length === 0) {
            throw new Error("未能识别到有效岗位。请确保符合格式：公司 | 岗位 | 地点 | 链接");
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

        setStatus(`同步中: 识别到 ${formattedJobs.length} 个岗位...`);
        const result = await jobService.bulkInsert(formattedJobs);
        
        if (result.success) {
            setStatus(null);
            const errorCount = parsingErrors.length;
            alert(`✅ 同步成功！\n解析出 ${formattedJobs.length} 个岗位。\n${errorCount > 0 ? `⚠️ 注意：有 ${errorCount} 条数据存在异常已被跳过。` : ''}`);
            setPasteContent('');
            const allJobs = await jobService.fetchAll();
            onUpdate(allJobs);
        } else {
            setErrorMsg(`保存至数据库失败: ${result.message}`);
        }
    } catch (e: any) {
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
              岗位管理控制台 (极速引擎)
              {isLoading && <span className="text-[10px] text-blue-500 animate-pulse ml-2 font-mono">SCANNING...</span>}
            </h3>
            <p className="text-[10px] text-gray-600 font-mono">云端数据库容量: {jobs.length} / 2000</p>
          </div>
        </div>
        <button className="px-3 py-1 text-xs text-gray-500 hover:text-white transition-colors font-medium border border-gray-800 rounded">
          {isOpen ? '收起面板' : '管理数据'}
        </button>
      </div>

      {isOpen && (
        <div className="mt-6 bg-[#111116] border border-[#27272a] rounded-xl p-6 animate-in slide-in-from-top-2 duration-300">
          {!readOnly ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-900/10 border border-blue-900/20 rounded-lg p-4">
                   <div className="flex items-center gap-2 mb-1">
                      <Filter className="w-3 h-3 text-blue-400" />
                      <span className="text-[11px] font-bold text-blue-400 uppercase">本地解析规范</span>
                   </div>
                   <ul className="text-[10px] text-gray-400 space-y-1 mt-2 list-disc list-inside">
                     <li>格式：<code className="text-white px-1">公司 | 岗位 | 地点 | 链接</code></li>
                     <li>链接：必须以 <code className="text-blue-300">http(s)://</code> 开头</li>
                     <li>分隔符：支持英文 <code className="text-white">|</code> 或 中文 <code className="text-white">丨</code></li>
                     <li>性能：本地毫秒级解析，不再依赖 AI 接口进行清洗。</li>
                   </ul>
                </div>
                <div className="bg-orange-900/10 border border-orange-900/20 rounded-lg p-4">
                   <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-3 h-3 text-orange-400" />
                      <span className="text-[11px] font-bold text-orange-400 uppercase">容错处理</span>
                   </div>
                   <p className="text-[10px] text-gray-400 leading-relaxed mt-2">
                     系统会自动跳过空行、标题行及分割线。单行解析失败不影响全局，请放心粘贴大段文本。
                   </p>
                </div>
              </div>

              <textarea
                className="w-full h-64 bg-black border border-[#333] rounded-lg p-4 text-xs font-mono text-gray-300 focus:border-blue-600 focus:outline-none resize-none custom-scrollbar mb-4 transition-all"
                placeholder="直接粘贴岗位列表...&#10;腾讯 | 前端, 后端 | 深圳 | https://...&#10;字节 | 运营 | 北京 | https://..."
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
              />

              <div className="flex flex-wrap items-center gap-3">
                <button 
                  onClick={() => processUpload(true)}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-white text-black hover:bg-blue-500 hover:text-white rounded-lg text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  清空并覆盖同步
                </button>

                <button 
                  onClick={() => processUpload(false)}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  增量追加数据
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

              {(status || errorMsg || parsingErrors.length > 0) && (
                <div className="mt-4 space-y-3">
                  {status && !errorMsg && (
                    <div className="p-3 bg-blue-900/10 border border-blue-900/30 rounded-lg flex items-center justify-between">
                      <span className="text-[11px] text-blue-400 font-bold flex items-center gap-2">
                        <Zap className="w-3 h-3 animate-pulse" /> {status}
                      </span>
                      <span className="text-[10px] font-mono text-gray-500">
                        进度: {progress.current} / {progress.total} 行
                      </span>
                    </div>
                  )}

                  {errorMsg && (
                    <div className="p-4 bg-red-900/10 border border-red-900/30 rounded-lg">
                      <div className="flex items-center gap-2 text-red-400 font-bold text-xs mb-1">
                        <AlertTriangle className="w-4 h-4" /> 处理异常
                      </div>
                      <p className="text-[11px] text-red-300 font-mono whitespace-pre-wrap">{errorMsg}</p>
                    </div>
                  )}

                  {parsingErrors.length > 0 && (
                    <div className="p-4 bg-orange-900/5 border border-orange-900/20 rounded-lg">
                      <div className="flex items-center gap-2 text-orange-400 font-bold text-xs mb-2">
                        <AlertTriangle className="w-4 h-4" /> 格式异常报告 ({parsingErrors.length} 行)
                      </div>
                      <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-1">
                        {parsingErrors.map((err, i) => (
                          <div key={i} className="text-[10px] text-gray-500 font-mono border-l border-orange-900/30 pl-2 py-0.5">
                            {err}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
               <div className="p-4 bg-gray-900/50 inline-block rounded-full mb-4">
                  <Lock className="w-8 h-8 text-gray-700" />
               </div>
               <p className="text-sm text-gray-500 font-medium">管理员面板已锁定，仅供预览数据。</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default JobManager;
