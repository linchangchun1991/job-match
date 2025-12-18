import React, { useState, useEffect, useRef } from 'react';
import { Settings, FileText, User, Upload, BarChart3, Clock, LogOut, Sparkles, User as UserIcon, Zap } from './components/Icons';
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

export const safeRender = (value: any): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.join(', ');
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { initData(); }, []);

  const initData = async () => {
    const history = storage.getSessions();
    const jobs = await jobService.fetchAll();
    setState(s => ({ ...s, jobs: jobs || [], matchHistory: history || [] }));
  };

  const refreshJobs = async () => {
    const jobs = await jobService.fetchAll();
    setState(s => ({ ...s, jobs: jobs || [] }));
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
      setLoadingStep('正在提取文件内容...');
      const text = await parseFile(file);
      setState(s => ({ ...s, currentResume: text, isAnalyzing: false }));
    } catch (error: any) {
      alert(error.message);
      setState(s => ({ ...s, isAnalyzing: false }));
    }
  };

  const handleStartAnalysis = async () => {
    if (!state.currentResume.trim()) { alert("请先上传或粘贴简历内容"); return; }
    if (state.jobs.length === 0) { alert("岗位库为空，请联系管理员导入岗位"); return; }

    setState(s => ({ ...s, isAnalyzing: true, matchResults: [], parsedResume: null }));
    setLoadingStep('AI 正在进行深度语义解析...');
    setProgress(20);

    try {
      const parsed = await parseResume(state.currentResume);
      setProgress(50);
      setLoadingStep('正在从全量库挖掘匹配项...');
      
      setState(s => ({ ...s, parsedResume: parsed, isAnalyzing: false, isMatching: true }));
      
      const finalMatches = await matchJobs(parsed, state.jobs, (newBatch) => {
        setProgress(85);
        setState(current => ({ ...current, matchResults: newBatch }));
      });
      
      setProgress(100);
      setLoadingStep('专家级匹配已完成');

      const newSession: MatchSession = { 
        id: Date.now().toString(), 
        timestamp: Date.now(), 
        candidateName: parsed.name || '候选人', 
        resumeText: state.currentResume, 
        parsedResume: parsed, 
        results: finalMatches 
      };
      storage.saveSession(newSession);
      setState(s => ({ ...s, matchResults: finalMatches, isMatching: false, matchHistory: storage.getSessions() }));
      
      setTimeout(() => {
        setLoadingStep('');
        setProgress(0);
      }, 2000);
    } catch (error: any) {
      alert("错误: " + error.message);
      setState(s => ({ ...s, isAnalyzing: false, isMatching: false }));
      setLoadingStep('');
      setProgress(0);
    }
  };

  const ScoreBar = ({ label, score, colorClass = "bg-blue-600" }: { label: string, score: number, colorClass?: string }) => (
    <div className="mb-4">
      <div className="flex justify-between text-[11px] text-gray-500 mb-1.5 uppercase font-bold tracking-wider">
        <span>{label}</span>
        <span className="font-mono text-white">{score}</span>
      </div>
      <div className="w-full h-1.5 bg-gray-900 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-1000 ${colorClass}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );

  if (!state.userRole) {
    return <Login onLogin={handleLogin} />;
  }

  const isCoach = state.userRole === 'coach';
  const isBD = state.userRole === 'bd';

  return (
    <div className="min-h-screen bg-black text-white pb-20 font-sans">
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Logo />
            <div className="h-4 w-[1px] bg-gray-800"></div>
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Smart Career Pro</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-blue-500 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20 mr-2 uppercase font-bold">
              {isCoach ? 'Coach' : 'Admin'}
            </span>
            {isCoach && (
              <button onClick={() => setState(s => ({ ...s, historyOpen: true }))} className="p-2 text-gray-400 hover:text-white transition-all"><Clock className="w-4 h-4" /></button>
            )}
            <button onClick={() => setState(s => ({ ...s, settingsOpen: true }))} className="p-2 text-gray-400 hover:text-white transition-all"><Settings className="w-4 h-4" /></button>
            <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-400 transition-all"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {isCoach && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-5 space-y-8">
              <div className="bg-[#111116] border border-[#27272a] rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <FileText className="w-3 h-3 text-blue-500" /> 简历解析系统
                </h2>
                
                <div 
                  className="border-2 border-dashed border-gray-800 rounded-xl p-8 mb-4 text-center hover:border-blue-500/50 hover:bg-blue-500/5 transition-all cursor-pointer group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.docx,.txt" onChange={handleFileUpload} />
                  <Upload className="w-8 h-8 text-gray-600 group-hover:text-blue-500 mx-auto mb-3 transition-colors" />
                  <p className="text-xs text-gray-500 font-medium">点击或拖拽简历文件 (PDF/Word)</p>
                </div>

                <textarea 
                  value={state.currentResume} 
                  onChange={(e) => setState(s => ({ ...s, currentResume: e.target.value }))}
                  placeholder="或者在此粘贴简历文本..."
                  className="w-full h-40 bg-black/50 border border-gray-800 rounded-xl p-4 text-xs text-gray-300 focus:border-blue-600 focus:outline-none transition-all resize-none custom-scrollbar font-mono mb-4"
                />

                <button 
                  onClick={handleStartAnalysis}
                  disabled={state.isAnalyzing || state.isMatching}
                  className="w-full py-4 bg-white text-black rounded-xl font-bold text-sm hover:bg-blue-500 hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 relative overflow-hidden shadow-2xl"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {state.isAnalyzing || state.isMatching ? (
                      <><Zap className="w-4 h-4 animate-spin text-blue-600" /> {loadingStep || '正在工作...'}</>
                    ) : (
                      <><Sparkles className="w-4 h-4" /> 开始猎头级智能匹配</>
                    )}
                  </span>
                  { (state.isAnalyzing || state.isMatching) && (
                    <div className="absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                  )}
                </button>
              </div>

              {state.parsedResume && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-[#111116] border border-[#27272a] rounded-2xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-[0.03]"><Sparkles className="w-24 h-24 text-white" /></div>
                    <h3 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                      <UserIcon className="w-3 h-3" /> 专家画像简述 PORTRAIT
                    </h3>
                    <div className="space-y-5">
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">核心领域</p>
                        <p className="text-sm font-bold text-white">{safeRender(state.parsedResume.coreDomain)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">资历评估</p>
                        <p className="text-sm font-bold text-blue-400">{safeRender(state.parsedResume.seniorityLevel)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">专家核心标签</p>
                        <div className="flex flex-wrap gap-2">
                          {state.parsedResume.coreTags?.map(tag => (
                            <span key={tag} className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] text-gray-400">#{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#111116] border border-[#27272a] rounded-2xl p-6">
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-6">ATS 胜任力模型维度</h3>
                    <div className="space-y-1">
                      <ScoreBar label="教育背景" score={state.parsedResume.atsDimensions.education} colorClass="bg-purple-500" />
                      <ScoreBar label="专业技能" score={state.parsedResume.atsDimensions.skills} colorClass="bg-blue-500" />
                      <ScoreBar label="项目经验" score={state.parsedResume.atsDimensions.project} colorClass="bg-indigo-500" />
                      <ScoreBar label="实习履历" score={state.parsedResume.atsDimensions.internship} colorClass="bg-cyan-500" />
                      <ScoreBar label="综合素质" score={state.parsedResume.atsDimensions.quality} colorClass="bg-emerald-500" />
                    </div>
                    {state.parsedResume.atsAnalysis && (
                      <div className="mt-6 pt-6 border-t border-gray-800">
                        <div className="text-[10px] font-bold text-blue-500 mb-2 flex items-center gap-2 uppercase tracking-wider">
                          <BarChart3 className="w-3 h-3" /> 猎头级诊断建议
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed font-sans italic">{safeRender(state.parsedResume.atsAnalysis)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-7">
              <MatchResults results={state.matchResults} candidateName={safeRender(state.parsedResume?.name) || '候选人'} />
            </div>
          </div>
        )}

        {isBD && (
          <div className="animate-in fade-in duration-500">
            <div className="text-center py-16 mb-10 bg-[#111116] border border-gray-800 rounded-3xl">
              <h1 className="text-4xl font-black text-white mb-3 tracking-tighter uppercase italic">Control Panel</h1>
              <p className="text-gray-500 text-sm tracking-widest font-medium">企业管理员控制台 | 全球岗位数据库管理</p>
            </div>
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

      <SettingsModal isOpen={state.settingsOpen} onClose={() => setState(s => ({ ...s, settingsOpen: false }))} onSave={() => { refreshJobs(); }} />
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
        onClear={() => { if(confirm('确定清空记录？')) { storage.clearSessions(); setState(s => ({ ...s, matchHistory: [] })); } }} 
      />
    </div>
  );
};

export default App;