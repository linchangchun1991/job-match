import React, { useState, useEffect } from 'react';
import { Database, Upload, Trash2, CheckCircle, Download, Zap, Lock, XCircle } from './Icons';
import { Job } from '../types';
import { jobService } from '../services/jobService';

interface JobManagerProps {
  jobs: Job[];
  onUpdate: (jobs: Job[]) => void;
  onRefresh?: () => void;
  readOnly?: boolean;     // 新增：是否只读（教练模式）
  defaultOpen?: boolean;  // 新增：是否默认展开（BD模式）
}

const PRELOADED_DATA = `济南历下控股集团有限公司2025年秋季校园招聘	北京 上海 广州 深圳 杭州 南京 成都 武汉 天津 青岛 宁波 济南 合肥 福州 香港	秋招正式批, 实习, 校招	（1）2026届应届统招统分毕业生； （2）2026年出站博士后；		2025-12-14
五粮液集团进出口有限公司2025年下半年公开招聘	北京 上海 广州	秋招正式批	2026届高校毕业生		2025-12-15
南京大学2025年事业编制岗位公开招聘	上海 广州 南京	秋招正式批	国内高校应届毕业生以及与国内高校应届生同期毕业国（境）外留学人员可凭即将获得的最高学历学位报名		2025-12-16
同济大学2025年一般管理岗统一公开招聘	北京 上海 广州 深圳 杭州 南京 成都 宁波 香港	秋招正式批, 实习	硕士研究生及以上学位		2025-12-17
海致2026届秋季校园招聘	内资	广州 深圳	秋招正式批			2025-12-10		https://haizhijt.cn/joins
2026年渠成集团管培生培养项目	内资	宁波	秋招正式批			2025-12-10		https://www.lumilegend.cn/jiaruwomen/chubeirencai/index.html`;

const JobManager: React.FC<JobManagerProps> = ({ jobs, onUpdate, onRefresh, readOnly = false, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [pasteContent, setPasteContent] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 监听 defaultOpen 变化，主要用于角色切换时
  useEffect(() => {
    setIsOpen(defaultOpen);
  }, [defaultOpen]);

  const parseRawData = (content: string) => {
    const rows = content.trim().split('\n');
    const newJobs: Job[] = [];
    let successCount = 0;

    rows.forEach((row, index) => {
      // 关键修复：先trim整行，防止空行干扰
      if (!row.trim()) return;
      
      // 关键修复：分割后对每个字段trim()，去除末尾的 \r 和多余空格
      let cols = row.split('\t').map(c => c.trim());
      
      if (cols.length >= 1) {
        const findLink = (columns: string[]) => {
          // 增强识别：支持 http, https 和 www 开头
          const match = columns.find(c => 
            c.startsWith('http://') || 
            c.startsWith('https://') || 
            c.startsWith('www.')
          );
          
          if (!match) return undefined;
          
          // 自动补全协议
          return match.startsWith('www.') ? `https://${match}` : match;
        };
        
        const link = findLink(cols);

        newJobs.push({
          id: `job-${Date.now()}-${index}`, 
          company: cols[0] || '未命名公司',
          location: cols[1] || '全国', 
          type: cols[2] || '全职',
          requirement: cols[3] || '不限',
          title: cols[4] || '通用岗', 
          updateTime: cols[5] || new Date().toISOString().split('T')[0],
          link: link
        });
        successCount++;
      }
    });
    return { newJobs, successCount };
  };

  const handleParseAndUpload = async () => {
    if (!pasteContent.trim()) return;
    setIsLoading(true);
    setFeedback(null);
    setErrorMsg(null);
    
    const { newJobs, successCount } = parseRawData(pasteContent);

    if (successCount > 0) {
      const result = await jobService.bulkInsert(newJobs);
      
      if (result.success) {
        setFeedback(`成功上传 ${successCount} 个岗位到云端`);
        setPasteContent('');
        const allJobs = await jobService.fetchAll();
        onUpdate(allJobs);
        setTimeout(() => setFeedback(null), 3000);
      } else {
        setErrorMsg(`上传失败: ${result.message}`);
      }
    } else {
      setErrorMsg('未发现有效数据，请检查格式');
    }
    setIsLoading(false);
  };

  const handleLoadDemo = async () => {
    setIsLoading(true);
    const { newJobs, successCount } = parseRawData(PRELOADED_DATA);
    await jobService.bulkInsert(newJobs);
    const allJobs = await jobService.fetchAll();
    onUpdate(allJobs);
    setFeedback(`已加载 ${successCount} 个演示岗位`);
    setTimeout(() => setFeedback(null), 3000);
    setIsLoading(false);
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    const allJobs = await jobService.fetchAll();
    onUpdate(allJobs);
    setIsLoading(false);
  };

  const handleClear = async () => {
    if(confirm('警告：这将清空云端数据库中所有岗位！确定吗？')) {
      setIsLoading(true);
      await jobService.clearAll();
      onUpdate([]);
      setIsLoading(false);
    }
  };

  return (
    <div className={`w-full mt-8 border-t border-gray-800 pt-6 ${readOnly ? 'opacity-75' : ''}`}>
      <div 
        className="flex items-center justify-between cursor-pointer group"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-900 rounded text-gray-500 group-hover:text-white transition-colors">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider group-hover:text-white transition-colors flex items-center gap-2">
              岗位数据库 CLOUD DB
              {isLoading && <span className="text-[10px] text-blue-500 animate-pulse">同步中...</span>}
              {readOnly && <Lock className="w-3 h-3 text-gray-600" />}
            </h3>
            <p className="text-[10px] text-gray-600 font-mono">
              云端实时库存: {jobs.length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
             onClick={(e) => { e.stopPropagation(); handleRefresh(); }}
             className="p-1 text-gray-500 hover:text-blue-500 transition-colors"
             title="刷新数据"
          >
            <Zap className="w-4 h-4" />
          </button>
          <button className="px-3 py-1 text-xs text-gray-500 hover:text-white transition-colors font-medium">
            {isOpen ? '收起' : '管理数据'}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="mt-6 bg-[#111116] border border-[#27272a] rounded-xl p-6 animate-in slide-in-from-top-2 duration-200">
          {readOnly ? (
            <div className="text-center py-8 text-gray-500">
              <Lock className="w-8 h-8 mx-auto mb-3 opacity-20" />
              <p className="text-sm">您是职业教练身份，仅拥有岗位库查看权限。</p>
              <p className="text-xs mt-1 text-gray-600">请联系 BD 部门更新岗位数据。</p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">
                  粘贴 Excel/CSV 数据 (支持Tab分隔) - 将自动同步至云端
                </label>
                <textarea
                  className="w-full h-32 bg-black border border-[#333] rounded p-4 text-xs font-mono text-gray-300 focus:border-blue-600 focus:outline-none resize-none custom-scrollbar"
                  placeholder={`公司名称\t工作地点\t招聘类型\t招聘要求\t岗位名称\t更新时间\t投递链接(可选)`}
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button 
                    onClick={handleParseAndUpload}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-black hover:bg-gray-200 rounded text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    <Upload className="w-3 h-3" /> 
                    {isLoading ? '同步中...' : '上传至云端'}
                  </button>
                  <button 
                     onClick={handleLoadDemo}
                     disabled={isLoading}
                     className="flex items-center gap-2 px-4 py-2 border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 rounded text-xs font-bold transition-colors"
                  >
                    <Download className="w-3 h-3" /> 加载演示
                  </button>
                  <button 
                    onClick={handleClear}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 text-red-500 hover:text-red-400 hover:bg-red-900/10 rounded text-xs font-bold transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> 清空云端
                  </button>
                </div>
                
                <div className="flex flex-col items-end">
                  {feedback && (
                    <span className="flex items-center gap-2 text-green-500 text-xs font-bold animate-pulse mb-1">
                      <CheckCircle className="w-3 h-3" /> {feedback}
                    </span>
                  )}
                  {errorMsg && (
                    <div className="bg-red-900/10 border border-red-900/20 px-3 py-2 rounded max-w-lg">
                      <div className="flex items-start gap-2">
                         <XCircle className="w-3 h-3 text-red-500 mt-0.5 shrink-0" />
                         <span className="text-red-300 text-[10px] font-mono whitespace-pre-wrap break-all leading-tight">
                           {errorMsg}
                         </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default JobManager;