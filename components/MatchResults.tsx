
import React, { useState, useMemo } from 'react';
import { MatchResult } from '../types';
import { 
  MapPin, Download, ExternalLink, Sparkles, Filter, Briefcase, Ban, Lightbulb
} from './Icons';
import { safeRender } from '../App';

declare const XLSX: any;

interface MatchResultsProps {
  results: MatchResult[];
  candidateName: string;
}

const getCleanLink = (link?: any) => {
  if (!link) return undefined;
  let clean = String(link).trim();
  if (clean === '' || clean === 'null' || clean === 'undefined' || clean === '暂无链接' || clean === 'null') return undefined;
  
  // 宽松的 URL 验证：只要包含点号且长度足够
  if (clean.includes('.') && clean.length > 5) {
    if (!clean.startsWith('http')) {
       // 自动补全协议
       if (clean.startsWith('www.')) return 'https://' + clean;
       return 'https://' + clean;
    }
    return clean;
  }
  
  return undefined;
};

const JobCard: React.FC<{ res: MatchResult }> = ({ res }) => {
  // 深度探测链接字段
  const job = res.job as any;
  const rawLink = job.link || job.url || job.applicationLink || job.application_link || job['投递链接'];
  const finalLink = getCleanLink(rawLink);
  
  const scoreColor = res.score >= 85 ? 'text-green-400' : res.score >= 75 ? 'text-blue-400' : 'text-yellow-500';

  return (
    <div className="group bg-[#111116] border border-[#27272a] hover:border-blue-500/40 rounded-xl p-5 mb-4 transition-all duration-300 hover:shadow-lg hover:shadow-black/50 relative overflow-hidden">
      
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-blue-400 transition-colors truncate pr-4">
          {safeRender(res.job.company)}
        </h3>
        <div className={`flex flex-col items-end shrink-0 ${scoreColor}`}>
          <span className="text-xl font-mono font-bold leading-none">{res.score}</span>
          <span className="text-[10px] opacity-60 uppercase">Match</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
         <Briefcase className="w-4 h-4 text-gray-500" />
         <span className="text-base font-medium text-gray-300">
           {safeRender(res.job.title)}
         </span>
      </div>

      <div className="mb-4 bg-blue-600/5 border border-blue-600/20 rounded-lg p-3">
        <div className="flex items-start gap-2">
           <Lightbulb className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
           <p className="text-xs text-blue-200 leading-relaxed font-medium">
             <span className="text-blue-400 font-bold mr-1">顶级教练推荐:</span>
             {safeRender(res.recommendation)}
           </p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-gray-800/50 pt-4 mt-2">
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <MapPin className="w-4 h-4 text-gray-600" />
          <span>{safeRender(res.job.location) || '地点未说明'}</span>
        </div>

        <div>
          {finalLink ? (
            <a 
              href={finalLink} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition-all shadow-lg shadow-blue-900/20 active:scale-95"
            >
              立即投递
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
             <div className="flex items-center gap-2 px-4 py-2 bg-[#1a1a20] text-gray-600 text-[10px] font-bold rounded-lg border border-gray-800 cursor-help" title="该岗位录入时未包含直接投递链接">
                <Ban className="w-3 h-3" />
                链接未收录
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MatchResults: React.FC<MatchResultsProps> = ({ results, candidateName }) => {
  const [filterCity, setFilterCity] = useState<string>('all');

  const cities = useMemo(() => {
    const s = new Set<string>();
    results.forEach(r => {
      const location = safeRender(r.job?.location);
      if (location && location !== '全国') s.add(location.split(/[|丨\s/-]/)[0]);
    });
    return Array.from(s).filter(Boolean);
  }, [results]);

  const filteredResults = useMemo(() => {
    if (filterCity === 'all') return results;
    return results.filter(r => safeRender(r.job?.location).includes(filterCity));
  }, [results, filterCity]);

  const handleExport = () => {
    if (results.length === 0) return;
    const data = results.map(r => ({
      '匹配分': r.score,
      '公司名称': safeRender(r.job.company),
      '岗位名称': safeRender(r.job.title),
      '工作地点': safeRender(r.job.location),
      '教练推荐理由': safeRender(r.recommendation),
      '投递链接': getCleanLink((r.job as any).link || (r.job as any).url) || '暂无链接'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "适配清单");
    XLSX.writeFile(wb, `${candidateName}_匹配岗位表.xlsx`);
  };

  if (results.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50 py-12">
        <div className="p-4 rounded-full bg-gray-900 mb-4">
          <Briefcase className="w-8 h-8 text-gray-500" />
        </div>
        <p className="text-sm">请上传简历并点击“开始智能匹配”</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
       <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-500" /> 
            推荐岗位 ({filteredResults.length})
          </h2>
        </div>
        
        <div className="flex items-center gap-2">
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
          
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg"
          >
            <Download className="w-3 h-3" />
            导出表格
          </button>
        </div>
      </div>

      <div className="overflow-y-auto pr-2 custom-scrollbar pb-20">
        {filteredResults.map(r => (
          <JobCard key={r.jobId} res={r} />
        ))}
      </div>
    </div>
  );
};

export default MatchResults;
