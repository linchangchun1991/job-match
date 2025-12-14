import React from 'react';
import { MatchResult } from '../types';
import { MapPin, Calendar, CheckCircle, XCircle, Download, ExternalLink } from './Icons';

declare const XLSX: any;

interface MatchResultsProps {
  results: MatchResult[];
  candidateName: string;
}

const MatchResults: React.FC<MatchResultsProps> = ({ results, candidateName }) => {
  const displayResults = results.slice(0, 20);

  const handleExport = () => {
    if (displayResults.length === 0) return;

    const data = displayResults.map(r => ({
      '匹配分数': r.score,
      '推荐程度': r.recommendation,
      '公司名称': r.job.company,
      '岗位名称': r.job.title,
      '工作地点': r.job.location,
      '匹配优势': r.matchReasons.join('; '),
      '风险提示': r.mismatchReasons.join('; '),
      'AI建议': r.tips,
      '投递链接': r.job.link || getApplyLink(r.job.company, r.job.title)
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "岗位推荐表");
    
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `${candidateName}_岗位匹配报告_${dateStr}.xlsx`;
    
    XLSX.writeFile(wb, fileName);
  };

  const getApplyLink = (company: string, title: string) => {
    const query = `${company} ${title} 招聘官网`;
    return `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`;
  };

  if (results.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
        <div className="p-4 rounded-full bg-gray-900 mb-4">
          <Calendar className="w-6 h-6 text-gray-500" />
        </div>
        <p className="text-sm">等待分析结果...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            推荐岗位 TOP MATCHES <span className="bg-blue-900/30 text-blue-400 border border-blue-800 text-[10px] px-1.5 py-0.5 rounded font-mono">{displayResults.length}</span>
          </h2>
        </div>
        <button 
          onClick={handleExport}
          className="flex items-center gap-2 px-3 py-1.5 bg-white text-black hover:bg-gray-200 rounded text-xs font-bold transition-colors"
        >
          <Download className="w-3 h-3" />
          导出Excel报表
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
        {displayResults.map((res, idx) => (
          <div 
            key={res.jobId}
            className="bg-[#111116] border border-[#27272a] rounded-lg p-5 hover:border-gray-600 transition-all duration-200 group relative"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                    {res.job.company}
                  </h3>
                  {res.recommendation === '极力推荐' && (
                    <span className="text-[10px] bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded border border-blue-800 font-medium">强烈推荐</span>
                  )}
                  {res.recommendation === '推荐' && (
                    <span className="text-[10px] bg-green-900/30 text-green-400 px-1.5 py-0.5 rounded border border-green-800 font-medium">推荐</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1 font-mono">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {res.job.location}</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {res.job.type}</span>
                  <span className="text-gray-300">{res.job.title}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className={`text-xl font-bold font-mono ${
                    res.score >= 85 ? 'text-blue-500' : 
                    res.score >= 70 ? 'text-white' : 'text-gray-500'
                  }`}>
                    {res.score}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-800">
              <div>
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">匹配优势 MATCH</h4>
                <ul className="text-xs text-gray-400 space-y-1">
                  {res.matchReasons.slice(0, 3).map((r, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1 w-1 h-1 rounded-full bg-blue-500 shrink-0"></span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
              {res.mismatchReasons.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">风险提示 RISK</h4>
                  <ul className="text-xs text-gray-400 space-y-1">
                    {res.mismatchReasons.slice(0, 2).map((r, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1 w-1 h-1 rounded-full bg-gray-600 shrink-0"></span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-between mt-4 pt-3">
               <div className="text-xs text-gray-500 italic max-w-[70%] truncate">
                💡 {res.tips}
               </div>
               <a 
                 href={res.job.link || getApplyLink(res.job.company, res.job.title)}
                 target="_blank"
                 rel="noopener noreferrer"
                 className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded font-medium transition-colors ${
                   res.job.link 
                    ? "bg-blue-600 hover:bg-blue-500 text-white" 
                    : "bg-gray-800 hover:bg-gray-700 text-gray-300"
                 }`}
               >
                 {res.job.link ? "立即投递" : "官网搜索"} <ExternalLink className="w-3 h-3" />
               </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MatchResults;