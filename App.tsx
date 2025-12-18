import React, { useState, useEffect, useRef } from 'react';
import { Settings, FileText, Search, User, Briefcase, Award, Upload, Zap, BarChart3, Clock, LogOut } from './components/Icons';
import SettingsModal from './components/SettingsModal';
import JobManager from './components/JobManager';
import MatchResults from './components/MatchResults';
import Login from './components/Login';
import HistoryDrawer from './components/HistoryDrawer';
import { storage } from './services/storage';
import { parseResume, matchJobs } from './services/aiService';
import { parseFile } from './services/fileParser';
import { jobService } from './services/jobService';
import { AppState, Job, ParsedResume, UserRole, MatchSession } from './types';
import { isCloudEnabled } from './services/supabase';

/**
 * 核心修复：彻底解决 [object Object] 和 React Error #31
 * 确保即使 AI 返回了嵌套对象，也不会导致 React 渲染崩溃
 */
export const safeRender = (value: any): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  
  if (typeof value === 'object') {
    // 检查是否是 React 元素，防止循环渲染或版本冲突导致的 Error #31
    if (value.$$typeof) return '[React Element]';
    
    // 常见的 AI 返回字段映射
    if (value.name && typeof value.name === 'string') return value.name;
    if (value.title && typeof value.title === 'string') return value.title;
    if (value.company && typeof value.company === 'string') return value.company;
    if (value.institution && typeof value.institution === 'string') return value.institution;
    if (value.degree && typeof value.degree === 'string') return value.degree;
    if (value.label && typeof value.label === 'string') return value.label;
    
    // 如果是数组，尝试用逗号连接
    if (Array.isArray(value)) {
      return value.map(item => safeRender(item)).join(', ');
    }

    try {
      // 如果对象有 toString 但不是默认的 [object Object]
      const str = value.toString();
      if (str !== '[object Object]') return str;
      
      // 最后尝试序列化，如果太复杂则降级
      const json = JSON.stringify(value);
      return json.length > 100 ? '[Complex Data]' : json;
    } catch {
      return '[Data Object]';
    }
  }
  return String(value);
};

const Logo: React.FC<{ className?: string }> = ({ className = "h-8" }) => {
  const [error, setError] = useState(false);
  if (error) {
    return (
      <div className={`flex flex-col justify-center ${className}`}>
        <h1 className="text-lg font-bold tracking-tight text-white uppercase">HIGHMARK</h1>
      </div>
    );
  }
  return (
    <img 
      src="logo.png" 
      alt="HIGHMARK" 
      className={`${className} object-contain filter brightness-110`} 
      onError={() => setError(true)}
    />
  );
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    userRole: null,
    apiKey: '', 
    jobs: [],
    currentResume: '',
    parsedResume: null,
    matchResults: [],
    matchHistory: [],
    isAnalyzing: false,
    isMatching: false,
    settingsOpen: false,
    historyOpen: false
  });

  const [cloudEnabled, setCloudEnabled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    initData();
  }, []);

  const initData = async () => {
    try {
      setCloudEnabled(isCloudEnabled());
      const history = storage.getSessions();
      const results = storage.getHistory();
      
      const jobs = await jobService.fetchAll();
      setState(s => ({
        ...s,
        jobs: jobs || [],
        matchHistory: history || [],
        matchResults: results || []
      }));
    } catch (e) {
      console.error("Critical: Initialization error", e);
      const history = storage.getSessions();
      setState(s => ({ ...s, matchHistory: history || [] }));
    }
  };

  const refreshJobs = async () => {
    try {
      const jobs = await jobService.fetchAll();
      setState(s => ({ ...s, jobs: jobs || [] }));
    } catch (e) {
      console.error("Refresh jobs failed", e);
    }
  };

  const handleLogin = (role: UserRole) => {
    setState(s => ({ ...s, userRole: role }));
    refreshJobs();
  };

  const handleLogout = () => {
    setState(s => ({ ...s, userRole: null, parsedResume: null, matchResults: [] }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setState(s => ({ ...s, isAnalyzing: true }));
      const text = await parseFile(file);
      setState(s => ({ ...s, currentResume: text, isAnalyzing: false }));
    } catch (error: any) {
      alert(error.message);
      setState(s => ({ ...s, isAnalyzing: false }));
    }
  };

  const handleStartAnalysis = async () => {
    if (!state.currentResume.trim()) {
      alert("请先上传简历或粘贴文本内容");
      return;
    }

    setState(s => ({ ...s, isAnalyzing: true, matchResults: [] }));
    
    try {
      const parsed = await parseResume(state.currentResume);
      setState(s => ({ ...s, parsedResume: parsed, isAnalyzing: false, isMatching: true }));

      const finalMatches = await matchJobs(
        parsed, 
        state.jobs, 
        (newBatch) => {
          setState(current => {
            const all = [...current.matchResults, ...newBatch];
            const uniqueMap = new Map();
            all.forEach(r => {
                const company = safeRender(r.job.company)?.trim() || 'unknown';
                const title = safeRender(r.job.title)?.trim() || 'position';
                const key = `${company}-${title}`;
                if (!uniqueMap.has(key) || uniqueMap.get(key).score < r.score) {
                    uniqueMap.set(key, r);
                }
            });
            const sorted = Array.from(uniqueMap.values())
              .sort((a: any, b: any) => b.score - a.score)
              .slice(0, 50);

            return { ...current, matchResults: sorted };
          });
        }
      );
      
      const newSession: MatchSession = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        candidateName: safeRender(parsed.name) || '未命名候选人',
        resumeText: state.currentResume,
        parsedResume: parsed,
        results: finalMatches
      };
      
      const updatedHistory = storage.saveSession(newSession);
      storage.saveHistory(finalMatches); 
      
      setState(s => ({ 
        ...s, 
        matchResults: finalMatches, 
        matchHistory: updatedHistory,
        isMatching: false 
      }));
      
    } catch (error: any) {
      alert(`分析失败: ${error.message}`);
      setState(s => ({ ...s, isAnalyzing: false, isMatching: false }));
    }
  };

  const restoreSession = (session: MatchSession) => {
    setState(s => ({
      ...s,
      currentResume: session.resumeText,
      parsedResume: session.parsedResume,
      matchResults: session.results,
      historyOpen: false
    }));
    storage.saveHistory(session.results); 
  };

  if (!state.userRole) {
    return <Login onLogin={handleLogin} />;
  }

  const ScoreBar = ({ label, score, colorClass = "bg-blue-600" }: { label: string, score: number, colorClass?: string }) => (
    <div className="mb-3">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{label}</span>
        <span className={`font-mono font-bold ${score >= 80 ? 'text-green-400' : 'text-gray-300'}`}>{score}</span>
      </div>
      <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-1000 ${colorClass}`} 
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );

  const isCoach = state.userRole === 'coach';
  const isBD = state.userRole === 'bd';

  return (
    <div className="min-h-screen bg-black text-white pb-20 font-sans selection:bg-blue-500/30">
      <header className="sticky top-0 z-40 bg-black/90 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Logo className="h-6" />
            <div className="h-4 w-[1px] bg-gray-700 hidden xs:block"></div>
            <span className="text-xs text-gray-400 tracking-widest uppercase hidden xs:block">
              智能选岗系统 <span className="text-[10px] opacity-50">PRO (GEMINI 3.0)</span>
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 mr-2 hidden md:flex items-center gap-2">
               <span>身份: {isCoach ? '职业教练' : '企业BD'}</span>
               {cloudEnabled ? (
                 <span className="text-green-500 flex items-center gap-1 bg-green-900/20 px-2 py-0.5 rounded text-[10px] border border-green-900/50">
                   <Zap className="w-3 h-3" /> 云端同步
                 </span>
               ) : (
                 <span 
                   onClick={() => setState(s => ({...s, settingsOpen: true}))}
                   className="text-yellow-500 flex items-center gap-1 bg-yellow-900/20 px-2 py-0.5 rounded text-[10px] border border-yellow-900/50 cursor-pointer hover:bg-yellow-900/30"
                 >
                   <Settings className="w-3 h-3" /> 单机模式
                 </span>
               )}
            </span>
            {isCoach && (
              <button 
                onClick={() => setState(s => ({ ...s, historyOpen: true }))}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-all"
              >
                <Clock className="w-4 h-4" />
                <span className="hidden sm:inline">历史</span>
              </button>
            )}
            <button 
              onClick={() => setState(s => ({ ...s, settingsOpen: true }))}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-all relative"
              title="设置"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button 
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-md transition-all"
              title="退出"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {isCoach && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-[#111116] border border-[#27272a] rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" /> 简历解析 <span className="text-[10px] text-gray-600">RESUME PARSER</span>
                  </h2>
                  {state.parsedResume && (
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-900/30 text-blue-400 border border-blue-800">
                      ATS评分: {state.parsedResume.atsScore}
                    </span>
                  )}
                </div>

                <div 
                  className="border border-dashed border-gray-700 rounded-lg p-6 mb-4 text-center hover:border-blue-500 hover:bg-blue-500/5 transition-all cursor-pointer group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    className="hidden" 
                    accept=".pdf,.docx,.doc,.txt"
                    onChange={handleFileUpload}
                  />
                  <Upload className="w-6 h-6 text-gray-500 group-hover:text-blue-500 mx-auto mb-3 transition-colors" />
                  <p className="text-xs text-gray-400">点击上传简历 (PDF / Word / TXT)</p>
                </div>

                <textarea
                  value={state.currentResume}
                  onChange={(e) => setState(s => ({ ...s, currentResume: e.target.value }))}
                  placeholder="或直接在此处粘贴简历文本内容..."
                  className="w-full h-32 bg-black border border-gray-800 rounded-lg p-4 text-xs text-gray-300 focus:border-blue-600 focus:outline-none transition-all resize-none mb-4 custom-scrollbar font-mono"
                />

                <button
                  onClick={handleStartAnalysis}
                  disabled={state.isAnalyzing || (state.isMatching && state.matchResults.length === 0)}
                  className="w-full py-3 rounded-lg bg-white text-black font-bold text-sm hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {state.isAnalyzing ? (
                    <span className="flex items-center gap-2"><div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div> 正在深度解析...</span>
                  ) : state.isMatching ? (
                    <span className="flex items-center gap-2"><div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div> 正在极速匹配中...</span>
                  ) : (
                    '开始智能分析'
                  )}
                </button>
              </div>

              {state.parsedResume && (
                <div className="bg-[#111116] border border-[#27272a] rounded-xl p-6 animate-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center justify-between mb-6">
                     <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">岗位胜任力模型 COMPETENCY MODEL</h3>
                  </div>
                  
                  <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-800">
                     <div className="w-10 h-10 rounded bg-gray-800 flex items-center justify-center text-gray-400">
                        <User className="w-5 h-5" />
                     </div>
                     <div>
                        <div className="text-white font-bold text-base">{safeRender(state.parsedResume.name) || '未命名候选人'}</div>
                        <div className="text-xs text-gray-400 mt-0.5 font-mono">
                          {safeRender(state.parsedResume.graduationType)} | {safeRender(state.parsedResume.education)} | {safeRender(state.parsedResume.major)}
                        </div>
                     </div>
                  </div>

                  {state.parsedResume.atsDimensions && (
                    <div className="grid grid-cols-1 gap-y-1 mb-6">
                      <ScoreBar 
                        label="教育背景 (20%)" 
                        score={state.parsedResume.atsDimensions.education} 
                        colorClass="bg-purple-500"
                      />
                      <ScoreBar 
                        label="专业技能 (25%)" 
                        score={state.parsedResume.atsDimensions.skills} 
                        colorClass="bg-blue-500"
                      />
                      <ScoreBar 
                        label="项目经验 (25%)" 
                        score={state.parsedResume.atsDimensions.project} 
                        colorClass="bg-indigo-500"
                      />
                      <ScoreBar 
                        label="实习经历 (20%)" 
                        score={state.parsedResume.atsDimensions.internship} 
                        colorClass="bg-cyan-500"
                      />
                      <ScoreBar 
                        label="综合素质 (10%)" 
                        score={state.parsedResume.atsDimensions.quality} 
                        colorClass="bg-emerald-500"
                      />
                    </div>
                  )}
                  
                  {state.parsedResume.atsAnalysis && (
                    <div className="bg-black/50 rounded-lg p-4 border border-gray-800">
                      <div className="text-xs font-bold text-blue-500 mb-2 flex items-center gap-2">
                        <BarChart3 className="w-3 h-3" /> AI 智能诊断
                      </div>
                      <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap font-sans">
                        {safeRender(state.parsedResume.atsAnalysis)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="lg:col-span-7">
               <MatchResults results={state.matchResults} candidateName={safeRender(state.parsedResume?.name) || '候选人'} />
            </div>
          </div>
        )}

        {isBD && (
          <div className="text-center py-12">
            <h1 className="text-3xl font-bold text-white mb-2">企业岗位库管理控制台</h1>
            <p className="text-gray-400">BD 专属权限 | 实时同步至所有教练终端</p>
          </div>
        )}

        <JobManager 
          jobs={state.jobs} 
          onUpdate={(updated) => setState(s => ({ ...s, jobs: updated }))}
          onRefresh={refreshJobs}
          readOnly={isCoach}
          defaultOpen={isBD}
        />
      </main>

      <SettingsModal 
        isOpen={state.settingsOpen} 
        onClose={() => setState(s => ({ ...s, settingsOpen: false }))}
        onSave={() => {
          setCloudEnabled(isCloudEnabled());
          refreshJobs();
        }}
      />
      
      <HistoryDrawer 
        isOpen={state.historyOpen}
        onClose={() => setState(s => ({ ...s, historyOpen: false }))}
        history={state.matchHistory}
        onSelect={restoreSession}
        onClear={() => {
          if(confirm('确定要清空所有历史记录吗？')) {
            storage.clearSessions();
            setState(s => ({ ...s, matchHistory: [] }));
          }
        }}
      />
    </div>
  );
};

export default App;