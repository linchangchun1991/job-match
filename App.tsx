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
    const key = storage.getApiKey();
    setCloudEnabled(isCloudEnabled());
    
    const history = storage.getSessions();
    const results = storage.getHistory();
    
    try {
      const jobs = await jobService.fetchAll();
      setState(s => ({
        ...s,
        apiKey: key,
        jobs: jobs,
        matchHistory: history,
        matchResults: results
      }));
    } catch (e) {
      console.error("Failed to fetch jobs", e);
    }
  };

  const refreshJobs = async () => {
    const jobs = await jobService.fetchAll();
    setState(s => ({ ...s, jobs }));
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
    if (!state.apiKey) {
      setState(s => ({ ...s, settingsOpen: true }));
      return;
    }
    if (!state.currentResume.trim()) {
      alert("请先上传简历或粘贴文本内容");
      return;
    }

    setState(s => ({ ...s, isAnalyzing: true }));
    
    try {
      const parsed = await parseResume(state.apiKey, state.currentResume);
      setState(s => ({ ...s, parsedResume: parsed, isAnalyzing: false, isMatching: true }));

      const matches = await matchJobs(state.apiKey, parsed, state.jobs);
      
      const newSession: MatchSession = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        candidateName: parsed.name || '未命名候选人',
        resumeText: state.currentResume,
        parsedResume: parsed,
        results: matches
      };
      
      const updatedHistory = storage.saveSession(newSession);
      storage.saveHistory(matches); 
      
      setState(s => ({ 
        ...s, 
        matchResults: matches, 
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

  const ScoreBar = ({ label, score }: { label: string, score: number }) => (
    <div className="mb-3">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{label}</span>
        <span className="font-mono">{score}</span>
      </div>
      <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
        <div 
          className="h-full bg-blue-600 rounded-full transition-all duration-1000" 
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );

  const isCoach = state.userRole === 'coach';
  const isBD = state.userRole === 'bd';

  return (
    <div className="min-h-screen bg-black text-white pb-20 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/90 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Logo */}
            <div className="h-8">
               <img src="logo.png" alt="HIGHMARK" className="h-full object-contain filter brightness-110" onError={(e) => {
                 (e.target as HTMLImageElement).style.display = 'none';
                 ((e.target as HTMLImageElement).nextSibling as HTMLElement).style.display = 'flex';
               }}/>
               <div className="hidden flex-col" style={{display: 'none'}}>
                  <h1 className="text-lg font-bold tracking-tight text-white uppercase">HIGHMARK</h1>
               </div>
            </div>
            <div className="h-4 w-[1px] bg-gray-700"></div>
            <span className="text-xs text-gray-400 tracking-widest uppercase">
              智能选岗系统 <span className="text-[10px] opacity-50">PRO</span>
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 mr-2 hidden sm:flex items-center gap-2">
               <span>当前身份: {isCoach ? '职业教练' : '企业BD'}</span>
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
                <span className="hidden sm:inline">历史记录</span>
              </button>
            )}
            <button 
              onClick={() => setState(s => ({ ...s, settingsOpen: true }))}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-all relative"
              title="系统设置"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button 
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-md transition-all"
              title="退出登录"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Coach View: Resume & Match */}
        {isCoach && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
            {/* Left Column: Input */}
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
                  disabled={state.isAnalyzing || state.isMatching}
                  className="w-full py-3 rounded-lg bg-white text-black font-bold text-sm hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {state.isAnalyzing ? (
                    <span className="flex items-center gap-2"><div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin"></div> 正在深度解析...</span>
                  ) : state.isMatching ? (
                    <span className="flex items-center gap-2"><div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin"></div> 正在极速匹配...</span>
                  ) : (
                    '开始智能分析'
                  )}
                </button>
              </div>

              {/* Analysis Result */}
              {state.parsedResume && (
                <div className="bg-[#111116] border border-[#27272a] rounded-xl p-6 animate-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center justify-between mb-6">
                     <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">候选人画像 CANDIDATE PROFILE</h3>
                  </div>
                  
                  <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-800">
                     <div className="w-10 h-10 rounded bg-gray-800 flex items-center justify-center text-gray-400">
                        <User className="w-5 h-5" />
                     </div>
                     <div>
                        <div className="text-white font-bold text-base">{state.parsedResume.name || '未命名候选人'}</div>
                        <div className="text-xs text-gray-400 mt-0.5 font-mono">
                          {state.parsedResume.graduationType} | {state.parsedResume.education} | {state.parsedResume.major}
                        </div>
                     </div>
                  </div>

                  {state.parsedResume.atsDimensions && (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-6">
                      <ScoreBar label="教育背景" score={state.parsedResume.atsDimensions.education} />
                      <ScoreBar label="实习经历" score={state.parsedResume.atsDimensions.experience} />
                      <ScoreBar label="岗位匹配" score={state.parsedResume.atsDimensions.relevance} />
                      <ScoreBar label="稳定性" score={state.parsedResume.atsDimensions.stability} />
                      <ScoreBar label="专业技能" score={state.parsedResume.atsDimensions.skills} />
                      <ScoreBar label="领导力" score={state.parsedResume.atsDimensions.leadership} />
                      <ScoreBar label="语言能力" score={state.parsedResume.atsDimensions.language} />
                      <ScoreBar label="证书资质" score={state.parsedResume.atsDimensions.certificate} />
                    </div>
                  )}
                  
                  {state.parsedResume.atsAnalysis && (
                    <div className="bg-black/50 rounded-lg p-4 border border-gray-800">
                      <div className="text-xs font-bold text-blue-500 mb-2 flex items-center gap-2">
                        <BarChart3 className="w-3 h-3" /> AI 智能诊断
                      </div>
                      <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap font-sans">
                        {state.parsedResume.atsAnalysis}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Results */}
            <div className="lg:col-span-7">
               <MatchResults results={state.matchResults} candidateName={state.parsedResume?.name || '候选人'} />
            </div>
          </div>
        )}

        {/* BD View: Dashboard Header */}
        {isBD && (
          <div className="text-center py-12">
            <h1 className="text-3xl font-bold text-white mb-2">企业岗位库管理控制台</h1>
            <p className="text-gray-400">BD 专属权限 | 实时同步至所有教练终端</p>
          </div>
        )}

        {/* Job Manager (Always visible but read-only for coaches) */}
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
        onSave={(key) => {
          setState(s => ({ ...s, apiKey: key }));
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