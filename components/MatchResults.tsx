import React, { useState, useMemo } from 'react';
import { MatchResult } from '../types';
import { 
  MapPin, Download, ExternalLink, Sparkles, Filter, Briefcase, CheckCircle, Ban
} from './Icons';
import { safeRender } from '../App';

declare const XLSX: any;

interface MatchResultsProps {
  results: MatchResult[];
  candidateName: string;
}

const getCleanLink = (link?: any) => {
  const cleanLink = safeRender(link);
  if (!cleanLink || cleanLink === 'null' || cleanLink === 'undefined' || cleanLink === '[Complex Data]') return undefined;
  let clean = cleanLink.trim();
  if (!clean) return undefined;
  if (!clean.startsWith('http') && !clean.startsWith('https')) {
       if (clean.startsWith('www') || clean.includes('.')) clean = `https://${clean}`;
       else return undefined; 
  }
  return clean;
};

const JobCard: React.FC<{ res: MatchResult }> = ({ res }) => {
  const finalLink = getCleanLink(res.job.link);
  
  const scoreColor = res.score >= 85 ? 'text-green-400' : res.score >= 75 ? 'text-blue-400' : 'text-yellow-500';

  return (
    <div className="group bg-[#111116] border border-[#27272a] hover:border-blue-500/40 rounded-xl p-5 mb-4 transition-all duration-300 hover:shadow-lg hover:shadow-black/50">
      
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

      {res.matchReasons && res.matchReasons.length > 0 && (
        <div className="mb-4 bg-gray-900/50 border border-gray-800 rounded-lg p-3">
          <div className="flex items-start gap-2">
             <CheckCircle className="w-3 h-3 text-gray-500 mt-0.5 shrink-0" />
             <p className="text-xs text-gray-400 leading-relaxed">
               <span className="text-gray-500 font-bold mr-1">推荐理由:</span>
               {safeRender(res.matchReasons[0])}
               {res.matchReasons.length > 1 && `，${safeRender(res.matchReasons[1])}`}
             </p>
          </div>
        </div>
      )}

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

  const cities = useMemo(() => {
    const s = new Set<string>();
    results.forEach(r => {
      const location = safeRender(r.job.location);
      if (location) s.add(location.split(/[\s/-]/)[0]);
    });
    return Array.from(s).filter(Boolean);
  }, [results]);

  const filteredResults = useMemo(() => {
    if (filterCity === 'all') return results;
    return results.filter(r => safeRender(r.job.location).includes(filterCity));
  }, [results, filterCity]);

  const handleExport = () => {
    if (results.length === 0) return;
    const data = results.map(r => ({
      '匹配分数': r.score,
      '公司名称': safeRender(r.job.company),
      '岗位名称': safeRender(r.job.title),
      '工作地点': safeRender(r.job.location),
      '推荐理由': r.matchReasons.map(reason => safeRender(reason)).join('; '),
      '投递链接': getCleanLink(r.job.link) || '无链接'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "岗位清单");
    XLSX.writeFile(wb, `${safeRender(candidateName)}_岗位推荐表.xlsx`);
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
            className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs font-bold transition-colors border border-white/5"
          >
            <Download className="w-3 h-3" />
            导出
          </button>
        </div>
      </div>

      <div className="overflow-y-auto pr-2 custom-scrollbar pb-20">
        {filteredResults.map(r => (
          <JobCard key={r.jobId} res={r} />
        ))}
        
        <div className="text-center text-[10px] text-gray-600 mt-8 mb-4">
           已显示所有匹配岗位
        </div>
      </div>
    </div>
  );
};

export default MatchResults;