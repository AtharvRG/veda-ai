// src/components/viewer/QuestionList.tsx
import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useExam, QuestionData } from '@/store/ExamContext';
import { ChevronDownIcon, FilterIcon, EditIcon } from '../icons';
import { cn } from '@/lib/utils';

type FilterType = 'all' | 'answered' | 'unanswered' | 'correct' | 'partial' | 'incorrect';

export function QuestionList() {
  const { questions, setQuestions, activeQuestionId, setActiveQuestionId, setAnswerFile, setStep } = useExam();
  
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandAll, setExpandAll] = useState(false);

  // Live Score Tally
  const totalAwarded = useMemo(() => questions.reduce((acc, q) => acc + q.marksAwarded, 0), [questions]);
  const totalMax = useMemo(() => questions.reduce((acc, q) => acc + q.maxMarks, 0), [questions]);
  const percentage = Math.round((totalAwarded / Math.max(1, totalMax)) * 100) || 0;

  // Filter Logic
  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      if (filter === 'all') return true;
      if (filter === 'answered') return q.answered !== false;
      if (filter === 'unanswered') return q.answered === false;
      if (filter === 'correct') return q.marksAwarded === q.maxMarks && q.maxMarks > 0;
      if (filter === 'incorrect') return q.marksAwarded === 0 && q.answered !== false;
      if (filter === 'partial') return q.marksAwarded > 0 && q.marksAwarded < q.maxMarks;
      return true;
    });
  }, [questions, filter]);

  // Keyboard Shortcuts (Up/Down to navigate)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIndex = filteredQuestions.findIndex(q => q.id === activeQuestionId);
        if (e.key === 'ArrowDown') {
          const next = filteredQuestions[currentIndex + 1] || filteredQuestions[0];
          if (next) setActiveQuestionId(next.id);
        } else if (e.key === 'ArrowUp') {
          const prev = filteredQuestions[currentIndex - 1] || filteredQuestions[filteredQuestions.length - 1];
          if (prev) setActiveQuestionId(prev.id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredQuestions, activeQuestionId, setActiveQuestionId]);

  // Manual Override Update Handler
  const handleUpdateQuestion = (id: string, updates: Partial<QuestionData>) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  // Real CSV Export
  const handleExportCSV = () => {
    const headers = ["Question Number", "Question Text", "Max Marks", "Marks Awarded", "Status", "AI Feedback"];
    const rows = questions.map(q => {
      const status = q.answered === false ? 'Unanswered' : (q.marksAwarded === q.maxMarks ? 'Correct' : (q.marksAwarded === 0 ? 'Incorrect' : 'Partial'));
      const safeText = q.text.replace(/"/g, '""');
      const safeFeedback = (q.feedback || '').replace(/"/g, '""');
      return `"${q.number}","${safeText}","${q.maxMarks}","${q.marksAwarded}","${status}","${safeFeedback}"`;
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "student_grades.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleNextStudent = () => {
    setAnswerFile(null);
    setActiveQuestionId(null);
    setStep('upload');
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/30 relative">
      {/* Header & Filters */}
      <div className="px-4 md:px-6 pt-4 md:pt-6 pb-2 shrink-0 bg-white md:bg-transparent z-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            Questions <span className="text-gray-400 font-normal text-xs bg-gray-100 px-2 py-0.5 rounded-full">{filteredQuestions.length}</span>
          </h2>
          <div className="flex items-center gap-2">
            {/* Filter Dropdown */}
            <div className="relative flex items-center bg-white border border-gray-200 rounded-full px-2 py-1 shadow-sm hover:bg-gray-50 transition-colors">
              <FilterIcon className="text-gray-400 mr-1" />
              <select 
                value={filter} 
                onChange={(e) => setFilter(e.target.value as FilterType)}
                className="text-xs font-medium text-gray-600 bg-transparent outline-none cursor-pointer appearance-none pr-2"
              >
                <option value="all">All</option>
                <option value="answered">Answered</option>
                <option value="unanswered">Unanswered</option>
                <option value="correct">Correct</option>
                <option value="partial">Partial</option>
                <option value="incorrect">Incorrect</option>
              </select>
            </div>
            
            <button 
              onClick={() => setExpandAll(!expandAll)}
              className="text-xs font-medium text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded-full hover:bg-gray-50 transition-colors shadow-sm"
            >
              {expandAll ? 'Collapse All' : 'Expand All'}
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Questions Area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6 pt-2">
        <div className="space-y-3 pb-6">
          {filteredQuestions.map((q) => (
            <QuestionCard 
              key={q.id} 
              question={q} 
              isActive={activeQuestionId === q.id}
              forceExpand={expandAll}
              onClick={() => setActiveQuestionId(activeQuestionId === q.id ? null : q.id)}
              onUpdate={(updates) => handleUpdateQuestion(q.id, updates)}
            />
          ))}
          {filteredQuestions.length === 0 && (
            <div className="text-center text-gray-400 text-sm mt-10">No questions match this filter.</div>
          )}
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="bg-white border-t border-gray-200 p-4 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.02)] z-20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-500 font-medium mb-1">Total Score</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">{totalAwarded}</span>
              <span className="text-gray-400 font-medium">/ {totalMax}</span>
              <span className={cn("ml-2 text-xs font-bold px-2 py-0.5 rounded-full", percentage >= 80 ? "bg-green-100 text-green-700" : percentage >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700")}>
                {percentage}%
              </span>
            </div>
          </div>
          <button onClick={handleExportCSV} className="text-sm text-[#FF5A36] font-semibold hover:underline">
            Export CSV
          </button>
        </div>
        <button onClick={handleNextStudent} className="w-full py-3 bg-[#2A2A2B] hover:bg-black text-white rounded-xl font-medium transition-colors shadow-sm flex items-center justify-center gap-2">
          Evaluate Next Answer Sheet <span>→</span>
        </button>
      </div>
    </div>
  );
}

// Inline Editing Question Card
function QuestionCard({ 
  question, isActive, forceExpand, onClick, onUpdate 
}: { 
  question: QuestionData, isActive: boolean, forceExpand: boolean, onClick: () => void, onUpdate: (updates: Partial<QuestionData>) => void 
}) {
  const isFullMarks = question.maxMarks > 0 && question.marksAwarded === question.maxMarks;
  const isZero = question.marksAwarded === 0;
  const isUnanswered = question.answered === false;
  
  const isExpanded = isActive || forceExpand;

  // Edit States
  const [isEditingScore, setIsEditingScore] = useState(false);
  const [tempScore, setTempScore] = useState(question.marksAwarded.toString());
  
  const [isEditingFeedback, setIsEditingFeedback] = useState(false);
  const [tempFeedback, setTempFeedback] = useState(question.feedback || '');

  const saveScore = () => {
    const parsed = parseFloat(tempScore);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= question.maxMarks) {
      onUpdate({ marksAwarded: parsed });
    } else {
      setTempScore(question.marksAwarded.toString());
    }
    setIsEditingScore(false);
  };

  const saveFeedback = () => {
    onUpdate({ feedback: tempFeedback });
    setIsEditingFeedback(false);
  };

  return (
    <div 
      className={cn(
        "bg-white rounded-2xl border transition-all overflow-hidden shadow-sm hover:shadow-md",
        isActive ? "border-[#FF5A36] ring-1 ring-[#FF5A36]" : "border-gray-200"
      )}
    >
      <div className="p-4 flex gap-4 cursor-pointer" onClick={onClick}>
        <div className={cn("w-8 h-8 rounded-full text-white font-bold flex items-center justify-center shrink-0 text-sm", isUnanswered ? "bg-gray-300" : "bg-gray-600")}>
          {question.number}
        </div>
        
        <div className="flex-1">
          <p className="text-sm text-gray-700 leading-relaxed pr-2">{question.text}</p>
          {isUnanswered && <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Not answered</span>}
        </div>
        
        <div className="flex items-start gap-3 shrink-0">
          {/* Editable Score Pill */}
          <div 
            onClick={(e) => { e.stopPropagation(); setIsEditingScore(true); }}
            className={cn(
              "px-2 py-1 rounded font-bold text-sm cursor-text hover:opacity-80 transition-opacity flex items-center gap-1 group",
              isUnanswered ? "bg-gray-100 text-gray-400" : isFullMarks ? "bg-green-100 text-green-700" : isZero ? "bg-red-100 text-red-600" : "bg-yellow-100 text-yellow-700"
            )}
            title="Click to override score"
          >
            {isEditingScore ? (
              <input 
                type="number" 
                autoFocus
                className="w-10 bg-transparent outline-none text-center"
                value={tempScore}
                onChange={(e) => setTempScore(e.target.value)}
                onBlur={saveScore}
                onKeyDown={(e) => e.key === 'Enter' && saveScore()}
              />
            ) : (
              <span>{question.marksAwarded}</span>
            )}
            <span className="text-opacity-50">/{question.maxMarks}</span>
            {!isEditingScore && <EditIcon className="w-3 h-3 opacity-0 group-hover:opacity-100" />}
          </div>

          <button className="text-gray-400 p-1">
            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
              <ChevronDownIcon />
            </motion.div>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && question.feedback && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 pt-2 ml-12">
              <div 
                className="bg-gray-50 rounded-xl p-3 border border-gray-100 cursor-text group relative"
                onClick={() => setIsEditingFeedback(true)}
                title="Click to edit feedback"
              >
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-bold text-gray-900">AI Feedback</h4>
                  <EditIcon className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity w-3 h-3" />
                </div>
                
                {isEditingFeedback ? (
                  <textarea 
                    autoFocus
                    className="w-full text-xs text-gray-800 bg-white border border-gray-300 rounded p-2 outline-none focus:border-[#FF5A36] resize-none"
                    rows={3}
                    value={tempFeedback}
                    onChange={(e) => setTempFeedback(e.target.value)}
                    onBlur={saveFeedback}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveFeedback(); }}}
                  />
                ) : (
                  <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{question.feedback}</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}