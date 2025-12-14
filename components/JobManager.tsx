import React, { useState } from 'react';
import { Database, Upload, Trash2, CheckCircle, Download } from './Icons';
import { Job } from '../types';
import { storage } from '../services/storage';

interface JobManagerProps {
  jobs: Job[];
  onUpdate: (jobs: Job[]) => void;
}

const PRELOADED_DATA = `济南历下控股集团有限公司2025年秋季校园招聘	北京 上海 广州 深圳 杭州 南京 成都 武汉 天津 青岛 宁波 济南 合肥 福州 香港	秋招正式批, 实习, 校招	（1）2026届应届统招统分毕业生； （2）2026年出站博士后；		2025-12-14
五粮液集团进出口有限公司2025年下半年公开招聘	北京 上海 广州	秋招正式批	2026届高校毕业生		2025-12-15
南京大学2025年事业编制岗位公开招聘	上海 广州 南京	秋招正式批	国内高校应届毕业生以及与国内高校应届生同期毕业国（境）外留学人员可凭即将获得的最高学历学位报名		2025-12-16
同济大学2025年一般管理岗统一公开招聘	北京 上海 广州 深圳 杭州 南京 成都 宁波 香港	秋招正式批, 实习	硕士研究生及以上学位		2025-12-17
海致2026届秋季校园招聘	内资	广州 深圳	秋招正式批			2025-12-10		https://haizhijt.cn/joins
2026年渠成集团管培生培养项目	内资	宁波	秋招正式批			2025-12-10		https://www.lumilegend.cn/jiaruwomen/chubeirencai/index.html`;

const JobManager: React.FC<JobManagerProps> = ({ jobs, onUpdate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const parseRawData = (content: string) => {
    const rows = content.trim().split('\n');
    const newJobs: Job[] = [];
    let successCount = 0;

    rows.forEach((row, index) => {
      if (!row.trim()) return;
      let cols = row.split('\t');
      
      if (cols.length >= 1) {
        const findLink = (columns: string[]) => {
          return columns.find(c => c.trim().startsWith('http://') || c.trim().startsWith('https://')) || undefined;
        };
        const link = findLink(cols);

        newJobs.push({
          id: `job-${Date.now()}-${index}`,
          company: cols[0]?.trim() || '未命名公司',
          location: cols[1]?.trim() || '全国', 
          type: cols[2]?.trim() || '全职',
          requirement: cols[3]?.trim() || '不限',
          title: cols[4]?.trim() || '通用岗', 
          updateTime: cols[5]?.trim() || new Date().toISOString().split('T')[0],
          link: link
        });
        successCount++;
      }
    });
    return { newJobs, successCount };
  };

  const handleParse = () => {
    if (!pasteContent.trim()) return;
    const { newJobs, successCount } = parseRawData(pasteContent);

    if (successCount > 0) {
      const updatedJobs = [...jobs, ...newJobs];
      storage.setJobs(updatedJobs);
      onUpdate(updatedJobs);
      setFeedback(`成功导入 ${successCount} 个岗位`);
      setPasteContent('');
      setTimeout(() => setFeedback(null), 3000);
    } else {
      setFeedback('未发现有效数据');
    }
  };

  const handleLoadDemo = () => {
    const { newJobs, successCount } = parseRawData(PRELOADED_DATA);
    const updatedJobs = [...jobs, ...newJobs];
    storage.setJobs(updatedJobs);
    onUpdate(updatedJobs);
    setFeedback(`已加载 ${successCount} 个演示岗位`);
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="w-full mt-8 border-t border-gray-800 pt-6">
      <div 
        className="flex items-center justify-between cursor-pointer group"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-900 rounded text-gray-500 group-hover:text-white transition-colors">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider group-hover:text-white transition-colors">岗位数据库 JOB DATABASE</h3>
            <p className="text-[10px] text-gray-600 font-mono">
              当前库存: {jobs.length}
            </p>
          </div>
        </div>
        <button className="px-3 py-1 text-xs text-gray-500 hover:text-white transition-colors font-medium">
          {isOpen ? '收起' : '管理数据'}
        </button>
      </div>

      {isOpen && (
        <div className="mt-6 bg-[#111116] border border-[#27272a] rounded-xl p-6">
          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">
              粘贴 Excel/CSV 数据 (支持Tab分隔)
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
                onClick={handleParse}
                className="flex items-center gap-2 px-4 py-2 bg-white text-black hover:bg-gray-200 rounded text-xs font-bold transition-colors"
              >
                <Upload className="w-3 h-3" /> 确认导入
              </button>
              <button 
                 onClick={handleLoadDemo}
                 className="flex items-center gap-2 px-4 py-2 border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 rounded text-xs font-bold transition-colors"
              >
                <Download className="w-3 h-3" /> 加载演示数据
              </button>
              <button 
                onClick={() => {
                  if(confirm('确定要清空所有岗位数据吗？')) {
                    storage.setJobs([]);
                    onUpdate([]);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 text-red-500 hover:text-red-400 hover:bg-red-900/10 rounded text-xs font-bold transition-colors"
              >
                <Trash2 className="w-3 h-3" /> 清空
              </button>
            </div>
            
            {feedback && (
              <span className="flex items-center gap-2 text-green-500 text-xs font-bold animate-pulse">
                <CheckCircle className="w-3 h-3" /> {feedback}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default JobManager;