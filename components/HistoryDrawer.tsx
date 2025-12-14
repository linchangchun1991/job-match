import React from 'react';
import { XCircle, Clock, Trash2, ChevronRight, User } from './Icons';
import { MatchSession } from '../types';
import { storage } from '../services/storage';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: MatchSession[];
  onSelect: (session: MatchSession) => void;
  onClear: () => void;
}

const HistoryDrawer: React.FC<HistoryDrawerProps> = ({ isOpen, onClose, history, onSelect, onClear }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md h-full bg-[#0e0e15] border-l border-white/10 shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right duration-300">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-400" /> 历史匹配记录
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Clock className="w-12 h-12 mb-4 opacity-20" />
            <p>暂无历史记录</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((session) => (
              <div 
                key={session.id}
                onClick={() => onSelect(session)}
                className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.02] group"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center border border-white/10">
                       <User className="w-4 h-4 text-purple-300" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">{session.candidateName || '未命名候选人'}</h4>
                      <p className="text-xs text-gray-500">{new Date(session.timestamp).toLocaleString('zh-CN')}</p>
                    </div>
                  </div>
                  <span className="text-xs bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/20">
                    {session.parsedResume?.atsScore}分
                  </span>
                </div>
                <div className="text-xs text-gray-400 pl-10">
                   <p className="line-clamp-1">{session.parsedResume?.graduationType} | {session.parsedResume?.education} | {session.parsedResume?.major}</p>
                   <p className="mt-1 text-gray-500">匹配岗位: {session.results.length}个</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {history.length > 0 && (
          <div className="mt-8 pt-6 border-t border-white/10">
            <button 
              onClick={onClear}
              className="flex items-center justify-center gap-2 w-full py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors text-sm"
            >
              <Trash2 className="w-4 h-4" /> 清空历史记录
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryDrawer;