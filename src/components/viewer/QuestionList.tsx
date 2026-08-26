// src/components/viewer/QuestionList.tsx
import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useExam, QuestionData } from '@/store/ExamContext';
import { ChevronDownIcon } from '../icons';
import { cn } from '@/lib/utils';

export function QuestionList() {
  const { questions, activeQuestionId, setActiveQuestionId, setAnswerFile, setStep } = useExam();

  // Calculate live score
  const totalAwarded = useMemo(() => questions.reduce((acc, q) => acc + q.marksAwarded, 0), [questions]);
  const totalMax = useMemo(() => questions.reduce((acc, q) => acc + q.maxMarks, 0), [questions]);
  const percentage = Math.round((totalAwarded / totalMax) * 100) || 0;

  // The "Evaluate Next Student" handler
  const handleNextStudent = () => {
    // 1. Clear the answer sheet
    setAnswerFile(null);
    // 2. Clear active question
    setActiveQuestionId(null);
    // 3. Reset step to upload screen (question paper will remain loaded!)
    setStep('upload');
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/30">
      {/* Scrollable Questions Area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900">Extracted Questions <span className="text-gray-500 font-normal text-sm">(from question paper)</span></h2>
          <button className="text-xs font-medium text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-full hover:bg-gray-50 transition-colors shadow-sm">
            Expand All
          </button>
        </div>

        <div className="space-y-3 pb-6">
          {questions.map((q) => (
            <QuestionCard 
              key={q.id} 
              question={q} 
              isActive={activeQuestionId === q.id}
              onClick={() => setActiveQuestionId(activeQuestionId === q.id ? null : q.id)}
            />
          ))}
        </div>
      </div>

      {/* NEW: Sticky Footer for Tally and Next Student */}
      <div className="bg-white border-t border-gray-200 p-4 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.02)] z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-500 font-medium mb-1">Total Score</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">{totalAwarded}</span>
              <span className="text-gray-400 font-medium">/ {totalMax}</span>
              <span className={cn(
                "ml-2 text-xs font-bold px-2 py-0.5 rounded-full",
                percentage >= 80 ? "bg-green-100 text-green-700" : percentage >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
              )}>
                {percentage}%
              </span>
            </div>
          </div>
          
          <button className="text-sm text-[#FF5A36] font-semibold hover:underline">
            Export CSV
          </button>
        </div>

        <button 
          onClick={handleNextStudent}
          className="w-full py-3 bg-[#2A2A2B] hover:bg-black text-white rounded-xl font-medium transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          Evaluate Next Answer Sheet <span>→</span>
        </button>
      </div>
    </div>
  );
}

// ... Keep the existing QuestionCard function exactly as it is below this ...
function QuestionCard({ question, isActive, onClick }: { question: QuestionData, isActive: boolean, onClick: () => void }) {
  const isFullMarks = question.marksAwarded === question.maxMarks;
  const isZero = question.marksAwarded === 0;

  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-white rounded-2xl border transition-all cursor-pointer overflow-hidden shadow-sm hover:shadow-md",
        isActive ? "border-[#FF5A36] ring-1 ring-[#FF5A36]" : "border-gray-200 hover:border-gray-300"
      )}
    >
      <div className="p-4 flex gap-4">
        {/* Number Badge */}
        <div className="w-8 h-8 rounded-full bg-gray-600 text-white font-bold flex items-center justify-center shrink-0 text-sm">
          {question.number}
        </div>
        
        {/* Content */}
        <div className="flex-1">
          <p className="text-sm text-gray-700 leading-relaxed pr-2">{question.text}</p>
        </div>
        
        {/* Score & Expand */}
        <div className="flex items-start gap-3 shrink-0">
          <div className={cn(
            "px-2 py-1 rounded font-bold text-sm",
            isFullMarks ? "bg-green-100 text-green-700" : isZero ? "bg-red-100 text-red-600" : "bg-yellow-100 text-yellow-700"
          )}>
            {question.marksAwarded}/{question.maxMarks}
          </div>
          <button className="text-gray-400 p-1">
            <motion.div animate={{ rotate: isActive ? 180 : 0 }}>
              <ChevronDownIcon />
            </motion.div>
          </button>
        </div>
      </div>

      {/* AI Feedback Accordion */}
      <AnimatePresence>
        {isActive && question.feedback && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 ml-12">
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <h4 className="text-xs font-bold text-gray-900 mb-1">AI Feedback</h4>
                <p className="text-xs text-gray-600 leading-relaxed">{question.feedback}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}