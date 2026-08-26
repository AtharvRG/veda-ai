// src/store/ExamContext.tsx
'use client';
import React, { createContext, useContext, useState } from 'react';

type ExamState = {
  questionFile: File | null;
  answerFile: File | null;
  setQuestionFile: (file: File | null) => void;
  setAnswerFile: (file: File | null) => void;
  isExtracting: boolean;
  setIsExtracting: (val: boolean) => void;
  step: 'upload' | 'extracting' | 'mapping';
  setStep: (step: 'upload' | 'extracting' | 'mapping') => void;
};

const ExamContext = createContext<ExamState | undefined>(undefined);

export function ExamProvider({ children }: { children: React.ReactNode }) {
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [answerFile, setAnswerFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [step, setStep] = useState<'upload' | 'extracting' | 'mapping'>('upload');

  return (
    <ExamContext.Provider value={{
      questionFile, setQuestionFile,
      answerFile, setAnswerFile,
      isExtracting, setIsExtracting,
      step, setStep
    }}>
      {children}
    </ExamContext.Provider>
  );
}

export function useExam() {
  const context = useContext(ExamContext);
  if (context === undefined) throw new Error('useExam must be used within ExamProvider');
  return context;
}