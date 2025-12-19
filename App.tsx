
import React, { useState, useEffect, useRef } from 'react';
import { Settings, FileText, User, Upload, BarChart3, Clock, LogOut, Sparkles, User as UserIcon, Zap, AlertTriangle, Timer, Database, CheckCircle, XCircle } from './components/Icons';
import SettingsModal from './components/SettingsModal';
import JobManager from './components/JobManager';
import MatchResults from './components/MatchResults';
import Login from './components/Login';
import HistoryDrawer from './components/HistoryDrawer';
import { storage } from './services/storage';
import { parseResume, matchJobs } from './services/aiService';
import { parseFile } from './services/fileParser';
import { jobService } from './services/jobService';
import { isCloudEnabled } from './services/supabase';
import { AppState, Job, ParsedResume, UserRole, MatchSession } from './types';

export const safeRender = (value: any): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(v => safeRender(v)).join(', ');
  if (typeof value === 'object') {
    if (value.$$typeof) return '[React Element]';
    try {
      return JSON.stringify(value);
    } catch {
      return '[Object]';
    }
  }
  return String(value);
};

const Logo: React.FC<{ className?: string }> = ({ className = "h-8" }) => (
  <div className={`flex flex-col justify-center ${className}`}>
    <h1 className="text-xl font-black tracking-tighter text-white uppercase italic">Highmark</h1>
  </div>
);

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

  const [loadingStep, setLoadingStep] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [cloudActive, setCloudActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => { 
    initData(); 
  }, []);

  useEffect(() => {
    setCloudActive(isCloudEnabled());
  }, [state.settingsOpen]);

  useEffect(() => {
    if (state.isAnalyzing || state.isMatching) {
      timerRef.current = window.setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedTime(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state.isAnalyzing, state.isMatching]);

  const initData = async () => {
    try {
      const history = storage.getSessions();
      const jobs = await jobService.fetchAll();
      setState(s => ({ ...s, jobs: jobs || [], matchHistory: history || [] }));
      setCloudActive(isCloudEnabled());
    } catch (err) {
      console.error("Initialization failed:", err);
    }
  };

  const refreshJobs = async () => {
    const jobs = await jobService.fetchAll();
    setState(s => ({ ...s, jobs: jobs || [] }));
    setCloudActive(isCloudEnabled());
  };

  const handleLogin = (role: UserRole) => {
    setState(s => ({ ...s, userRole: role }));
    refreshJobs();
  };

  const handleLogout = () => setState(s => ({ ...s, userRole: null, parsedResume: null, matchResults: [], currentResume: '' }));

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setState(s => ({ ...s, isAnalyzing: true }));
      setLoadingStep('正在提取简历文本...');
      const text = await parseFile(file);
      setState(s => ({ ...s, currentResume: text, isAnalyzing: false }));
    } catch (error: any) {
      alert(error.message);
      setState(s => ({ ...s, isAnalyzing: false }));
    }
  };

  const handleStartAnalysis = async () => {
    if (!state.currentResume.trim()) { 
      alert("请先上传简历文件或输入简历文本"); 
      return; 
    }
    
    if (state.jobs.length === 0) { 
      alert("岗位库为空！正在尝试从云端同步数据，请稍后。"); 
      refreshJobs();
      return; 
    }

    const est = 15;
    setEstimatedTime(est);
    setState(s => ({ ...s, isAnalyzing: true, matchResults: [], parsedResume: null }));
    setLoadingStep('AI 画像建模中...');
    setProgress(10);

    try {
      const parsed = await parseResume(state.currentResume);
      setProgress(40);
      setLoadingStep('语义索引匹配中...');
      
      setState(s => ({ ...s, parsedResume: parsed, isMatching: true }));
      
      const finalMatches = await matchJobs(parsed, state.jobs, (newBatch) => {
        setProgress(85);
        setLoadingStep('生成教练推荐语中...');
        setState(current => ({ ...current, matchResults: newBatch }));
      });
      
      setProgress(100);
      setLoadingStep('匹配完成');

      const newSession: MatchSession = { 
        id: Date.now().toString(), 
        timestamp: Date.now(), 
        candidateName: parsed.name || '候选人', 
        resumeText: state.currentResume, 
        parsedResume: parsed, 
        results: finalMatches 
      };
      storage.saveSession(newSession);
      
      setState(s => ({ 
        ...s, 
        matchResults: finalMatches, 
        isAnalyzing: false, 
        isMatching: false, 
        matchHistory: storage.getSessions() 
      }));
      
      setTimeout(() => { setLoadingStep(''); setProgress(0); setEstimatedTime(0); }, 2000);
    } catch (error: any) {
      console.error("Workflow Error:", error);
      alert("处理失败: " + error.message);
      setState(s => ({ ...s, isAnalyzing: false, isMatching: false }));
      setLoadingStep('');
      setProgress(0);
      setEstimatedTime(0);
    }
  };

  if (!state.userRole) {
    return <Login onLogin={handleLogin} />;
  }

  const isCoach = state.userRole === 'coach';
  const isBD = state.userRole === 'bd';
  const remainingTime = Math.max(0, estimatedTime - elapsedTime);

  return (
    <div className="min-h-screen bg-black text-white pb-20 font-sans">
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Logo />
            <div className="h-4 w-[1px] bg-gray-800"></div>
            <div className="flex items-center gap-2">
               {cloudActive ? (
                 <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Cloud Sync</span>
                 </div>
               ) : (
                 <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-gray-800 border border-gray-700">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-500"></div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Local Mode</span>
                 </div>
               )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setState(s => ({ ...s, historyOpen: true }))}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="历史记录"
            >
              <Clock className="w-5 h-5 text-gray-400" />
            </button>
            <button 
              onClick={() => setState(s => ({ ...s, settingsOpen: true }))}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="设置"
            >
              <Settings className="w-5 h-5 text-gray-400" />
            </button>
            <div className="h-4 w-[1px] bg-gray-800"></div>
            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-red-500/20 rounded-lg transition-colors group"
              title="退出登录"
            >
              <LogOut className="w-5 h-5 text-gray-400 group-hover:text-red-400" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* 企业端/BD 专属界面：岗位管理 */}
        {isBD && (
          <div className="mb-12 animate-in slide-in-from-bottom-4 duration-500">
             <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                   <Upload className="w-6 h-6 text-white" />
                </div>
                <div>
                   <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Enterprise Dashboard</h2>
                   <p className="text-xs text-gray-500 font-medium">企业数据管理中心</p>
                </div>
             </div>
             
             <JobManager 
               jobs={state.jobs} 
               onUpdate={(updatedJobs) => setState(s => ({ ...s, jobs: updatedJobs }))} 
               defaultOpen={true}
             />
          </div>
        )}

        {/* 教练端/通用界面：简历匹配 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* 左侧：简历录入 */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-[#111116] border border-[#27272a] rounded-3xl p-6 shadow-2xl">
               <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                     <UserIcon className="w-4 h-4" /> 候选人档案
                  </h3>
                  <div className="text-[10px] px-2 py-1 bg-white/5 rounded text-gray-500">
                     支持 PDF / Word / TXT
                  </div>
               </div>

               <div className="mb-6">
                  <div className="relative group cursor-pointer">
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      accept=".pdf,.docx,.doc,.txt"
                    />
                    <div className="h-32 border-2 border-dashed border-gray-700 rounded-2xl flex flex-col items-center justify-center gap-2 group-hover:border-blue-500 group-hover:bg-blue-500/5 transition-all">
                       <Upload className="w-6 h-6 text-gray-500 group-hover:text-blue-500 transition-colors" />
                       <p className="text-xs text-gray-500 group-hover:text-blue-400 font-medium">点击或拖拽上传简历</p>
                    </div>
                  </div>
               </div>

               <div className="mb-6 relative">
                 <textarea
                   className="w-full h-64 bg-black/50 border border-gray-800 rounded-2xl p-4 text-xs text-gray-300 focus:border-blue-500 focus:outline-none transition-all resize-none custom-scrollbar leading-relaxed"
                   placeholder="或在此直接粘贴简历文本..."
                   value={state.currentResume}
                   onChange={(e) => setState(s => ({ ...s, currentResume: e.target.value }))}
                 />
                 {state.currentResume && (
                   <div className="absolute bottom-4 right-4">
                      <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-1 rounded-full">
                         {state.currentResume.length} 字
                      </span>
                   </div>
                 )}
               </div>

               <button
                 onClick={handleStartAnalysis}
                 disabled={state.isAnalyzing || !state.currentResume}
                 className="w-full py-4 bg-white hover:bg-gray-200 text-black rounded-xl font-black text-sm uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-white/10 flex items-center justify-center gap-2"
               >
                 {state.isAnalyzing ? (
                   <>
                     <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                     {loadingStep || 'Processing...'}
                   </>
                 ) : (
                   <>
                     <Sparkles className="w-4 h-4" /> 开始智能匹配
                   </>
                 )}
               </button>
            </div>

            {/* AI 分析状态卡片 */}
            {state.isAnalyzing && (
               <div className="bg-[#111116] border border-[#27272a] rounded-2xl p-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex justify-between items-end mb-2">
                     <span className="text-xs font-bold text-blue-400 uppercase">{loadingStep}</span>
                     <span className="text-xl font-black text-white">{progress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                     <div 
                       className="h-full bg-blue-500 transition-all duration-300 ease-out"
                       style={{ width: `${progress}%` }}
                     />
                  </div>
                  <div className="mt-4 flex items-center justify-between text-[10px] text-gray-500">
                     <span className="flex items-center gap-1"><Timer className="w-3 h-3" /> 预计剩余 {remainingTime}s</span>
                     <span>Gemini 3.0 Pro Thinking...</span>
                  </div>
               </div>
            )}
            
            {/* 候选人画像预览 */}
            {state.parsedResume && !state.isAnalyzing && (
              <div className="bg-[#111116] border border-[#27272a] rounded-2xl p-6 animate-in fade-in">
                 <div className="flex items-center gap-3 mb-4 border-b border-gray-800 pb-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold">
                       {state.parsedResume.name?.[0] || 'User'}
                    </div>
                    <div>
                       <h4 className="text-sm font-bold text-white">{state.parsedResume.name}</h4>
                       <p className="text-xs text-gray-500">{state.parsedResume.email}</p>
                    </div>
                    <div className="ml-auto text-center">
                       <span className="block text-xl font-black text-blue-400">{state.parsedResume.atsScore}</span>
                       <span className="text-[10px] text-gray-600 uppercase">ATS Score</span>
                    </div>
                 </div>
                 
                 <div className="space-y-3 text-xs text-gray-400">
                    <div className="flex justify-between">
                       <span>核心领域</span>
                       <span className="text-white font-medium">{state.parsedResume.coreDomain}</span>
                    </div>
                    <div className="flex justify-between">
                       <span>资历等级</span>
                       <span className="text-white font-medium">{state.parsedResume.seniorityLevel}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-800">
                       {state.parsedResume.coreTags?.map(tag => (
                          <span key={tag} className="px-2 py-1 bg-gray-800 rounded text-gray-300">{tag}</span>
                       ))}
                    </div>
                 </div>
              </div>
            )}
          </div>

          {/* 右侧：匹配结果 */}
          <div className="lg:col-span-8">
            <div className="h-full min-h-[500px] bg-[#0c0c10] border border-[#1c1c21] rounded-3xl p-6 shadow-2xl relative overflow-hidden">
               <MatchResults results={state.matchResults} candidateName={state.parsedResume?.name || ''} />
            </div>
          </div>
        </div>
      </main>

      <SettingsModal 
        isOpen={state.settingsOpen} 
        onClose={() => setState(s => ({ ...s, settingsOpen: false }))}
        onSave={() => {}}
        userRole={state.userRole}
      />

      <HistoryDrawer 
        isOpen={state.historyOpen}
        onClose={() => setState(s => ({ ...s, historyOpen: false }))}
        history={state.matchHistory}
        onSelect={(session) => {
           setState(s => ({ 
             ...s, 
             currentResume: session.resumeText, 
             parsedResume: session.parsedResume, 
             matchResults: session.results,
             historyOpen: false
           }));
        }}
        onClear={() => {
           storage.clearSessions();
           setState(s => ({ ...s, matchHistory: [] }));
        }}
      />
    </div>
  );
};

export default App;
