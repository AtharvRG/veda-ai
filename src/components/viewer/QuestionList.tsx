// src/components/viewer/QuestionList.tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useExam, QuestionData } from '@/store/ExamContext';
import { ChevronDownIcon } from '../icons';
import { cn } from '@/lib/utils';

export function QuestionList() {
  const { questions, activeQuestionId, setActiveQuestionId } = useExam();

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/30 px-4 md:px-6 py-4 md:py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-gray-900">Extracted Questions <span className="text-gray-500 font-normal text-sm">(from question paper)</span></h2>
        <button className="text-xs font-medium text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-full hover:bg-gray-50 transition-colors shadow-sm">
          Expand All
        </button>
      </div>

      <div className="space-y-3 pb-20">
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
  );
}

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