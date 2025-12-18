
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
        setErrorMsg("请输入内容");
        return;
    }
    setIsLoading(true);
    setStatus("极速引擎解析中...");
    setErrorMsg(null);
    try {
        const aiJobs = await parseSmartJobs(pasteContent, (current, total, errors) => {
            setProgress({ current, total });
            if (errors) setParsingErrors([...errors]);
        });
        if (shouldClear) await jobService.clearAll();
        const formattedJobs: Job[] = aiJobs.map((j, index) => ({
            id: `job-${Date.now()}-${index}`,
            company: j.company,
            title: j.title || '通用岗位',
            location: j.location || '全国',
            type: '',
            requirement: '',
            link: j.link,
            updateTime: new Date().toISOString().split('T')[0]
        }));
        await jobService.bulkInsert(formattedJobs);
        alert(`✅ 同步完成！导入 ${formattedJobs.length} 个岗位。`);
        setPasteContent('');
        onUpdate(await jobService.fetchAll());
    } catch (e: any) {
        setErrorMsg(e.message);
    } finally {
        setIsLoading(false);
        setStatus(null);
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
              岗位管理控制台 (Gemini 3.0 驱动)
            </h3>
            <p className="text-[10px] text-gray-600">已收录: {jobs.length} 岗位</p>
          </div>
        </div>
        <button className="px-3 py-1 text-xs text-gray-500 border border-gray-800 rounded">{isOpen ? '收起' : '管理数据'}</button>
      </div>
      {isOpen && (
        <div className="mt-6 bg-[#111116] border border-[#27272a] rounded-xl p-6">
          {!readOnly ? (
            <>
              <textarea
                className="w-full h-64 bg-black border border-[#333] rounded-lg p-4 text-xs font-mono text-gray-300 focus:border-blue-600 focus:outline-none mb-4"
                placeholder="公司 | 岗位 | 地点 | 链接"
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
              />
              <div className="flex gap-3">
                <button onClick={() => processUpload(true)} className="px-6 py-2 bg-white text-black rounded-lg text-xs font-bold">清空并同步</button>
                <button onClick={() => processUpload(false)} className="px-6 py-2 bg-gray-800 text-white rounded-lg text-xs font-bold">追加数据</button>
              </div>
            </>
          ) : <p className="text-xs text-gray-500 text-center py-8">只读模式：仅管理员可更新数据</p>}
        </div>
      )}
    </div>
  );
};

export default JobManager;
