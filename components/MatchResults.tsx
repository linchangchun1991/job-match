
import React, { useState, useMemo } from 'react';
import { MatchResult } from '../types';
import { 
  MapPin, Download, ExternalLink, Sparkles, Filter, Briefcase, CheckCircle, Ban
} from './Icons';

declare const XLSX: any;

interface MatchResultsProps {
  results: MatchResult[];
  candidateName: string;
}

const getCleanLink = (link?: string) => {
  if (!link || link === 'null' || link === 'undefined') return undefined;
  let clean = link.trim();
  if (!clean) return undefined;
  if (!clean.startsWith('http') && !clean.startsWith('https')) {
       if (clean.startsWith('www') || clean.includes('.')) clean = `https://${clean}`;
       else return undefined; 
  }
  return clean;
};

// 修复后的卡片组件
const JobCard: React.FC<{ res: MatchResult }> = ({ res }) => {
  const finalLink = getCleanLink(res.job.link);
  
  // 评分颜色逻辑
  const scoreColor = res.score >= 85 ? 'text-green-400' : res.score >= 75 ? 'text-blue-400' : 'text-yellow-500';
  const scoreBg = res.score >= 85 ? 'bg-green-400/10' : res.score >= 75 ? 'bg-blue-400/10' : 'bg-yellow-500/10';

  return (
    <div className="group bg-[#111116] border border-[#27272a] hover:border-blue-500/40 rounded-xl p-5 mb-4 transition-all duration-300 hover:shadow-lg hover:shadow-black/50">
      
      {/* 1. 顶部：公司名称 + 匹配分数 */}
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-blue-400 transition-colors truncate pr-4">
          {res.job.company}
        </h3>
        <div className={`flex flex-col items-end shrink-0 ${scoreColor}`}>
          <span className="text-xl font-mono font-bold leading-none">{res.score}</span>
          <span className="text-[10px] opacity-60 uppercase">Match</span>
        </div>
      </div>

      {/* 2. 岗位名称 */}
      <div className="flex items-center gap-2 mb-3">
         <Briefcase className="w-4 h-4 text-gray-500" />
         <span className="text-base font-medium text-gray-300">
           {res.job.title}
         </span>
      </div>

      {/* 3. 推荐理由 (简短) */}
      {res.matchReasons && res.matchReasons.length > 0 && (
        <div className="mb-4 bg-gray-900/50 border border-gray-800 rounded-lg p-3">
          <div className="flex items-start gap-2">
             <CheckCircle className="w-3 h-3 text-gray-500 mt-0.5 shrink-0" />
             <p className="text-xs text-gray-400 leading-relaxed">
               <span className="text-gray-500 font-bold mr-1">推荐理由:</span>
               {res.matchReasons[0]}
               {res.matchReasons.length > 1 && `，${res.matchReasons[1]}`}
             </p>
          </div>
        </div>
      )}

      {/* 4. 底部栏：地点 + 严格的投递按钮 */}
      <div className="flex items-center justify-between border-t border-gray-800/50 pt-4 mt-2">
        {/* 工作地点 */}
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <MapPin className="w-4 h-4 text-gray-600" />
          <span>{res.job.location || '地点未说明'}</span>
        </div>

        {/* 投递链接按钮 - 严格模式 */}
        <div>
          {finalLink ? (
            <a 
              href={finalLink} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition-all shadow-lg shadow-blue-900/20 active:scale-95 hover:shadow-blue-500/20"
            >
              立即投递
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
             <div className="flex items-center gap-2 px-4 py-2 bg-[#1a1a20] text-gray-600 text-xs font-medium rounded-lg border border-gray-800 cursor-not-allowed select-none" title="该岗位暂未收录直投链接">
                <Ban className="w-3 h-3" />
                暂无投递链接
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MatchResults: React.FC<MatchResultsProps> = ({ results, candidateName }) => {
  const [filterCity, setFilterCity] = useState<string>('all');

  // 提取所有城市用于筛选
  const cities = useMemo(() => {
    const s = new Set<string>();
    results.forEach(r => {
      // 提取城市名（通常是前两个字或空格前）
      if (r.job.location) s.add(r.job.location.split(/[\s/-]/)[0]);
    });
    return Array.from(s).filter(Boolean);
  }, [results]);

  // 过滤逻辑
  const filteredResults = useMemo(() => {
    if (filterCity === 'all') return results;
    return results.filter(r => r.job.location.includes(filterCity));
  }, [results, filterCity]);

  // 导出功能
  const handleExport = () => {
    if (results.length === 0) return;
    const data = results.map(r => ({
      '匹配分数': r.score,
      '公司名称': r.job.company,
      '岗位名称': r.job.title,
      '工作地点': r.job.location,
      '推荐理由': r.matchReasons.join('; '),
      '投递链接': getCleanLink(r.job.link) || '无链接'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "岗位清单");
    XLSX.writeFile(wb, `${candidateName}_岗位推荐表.xlsx`);
  };

  if (results.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50 py-12">
        <div className="p-4 rounded-full bg-gray-900 mb-4">
          <Briefcase className="w-8 h-8 text-gray-500" />
        </div>
        <p className="text-sm">暂无匹配岗位</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
       {/* 顶部栏：标题 + 筛选器 */}
       <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-500" /> 
            推荐岗位 ({filteredResults.length})
          </h2>
        </div>
        
        <div className="flex items-center gap-2">
          {/* 城市筛选 */}
          <div className="relative">
            <Filter className="w-3 h-3 text-gray-500 absolute left-2.5 top-2.5" />
            <select 
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              className="bg-[#111116] border border-gray-800 text-xs text-gray-300 rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:border-blue-500 appearance-none min-w-[120px]"
            >
              <option value="all">所有城市</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          
          {/* 导出按钮 */}
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs font-bold transition-colors border border-white/5"
          >
            <Download className="w-3 h-3" />
            导出
          </button>
        </div>
      </div>

      {/* 岗位列表区域 */}
      <div className="overflow-y-auto pr-2 custom-scrollbar pb-20">
        {filteredResults.map(r => (
          <JobCard key={r.jobId} res={r} />
        ))}
        
        {/* 底部提示 */}
        <div className="text-center text-[10px] text-gray-600 mt-8 mb-4">
           已显示所有匹配岗位
        </div>
      </div>
    </div>
  );
};

export default MatchResults;
