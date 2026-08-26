// src/store/ExamContext.tsx
'use client';
import React, { createContext, useContext, useState } from 'react';

// 1. Update the QuestionData type
export type QuestionData = {
  id: string;
  number: string;
  text: string;
  marksAwarded: number;
  maxMarks: number;
  feedback?: string;
  answered?: boolean;
  bbox?: {
    page: number;
    top: string;
    left: string;
    width: string;
    height: string;
  };
  bboxes?: {
    page: number;
    top: string;
    left: string;
    width: string;
    height: string;
  }[];
};

type ExamState = {
  questionFile: File | null;
  answerFile: File | null;
  setQuestionFile: (file: File | null) => void;
  setAnswerFile: (file: File | null) => void;
  step: 'upload' | 'extracting' | 'mapping';
  setStep: (step: 'upload' | 'extracting' | 'mapping') => void;
  questions: QuestionData[];
  setQuestions: (q: QuestionData[]) => void;
  activeQuestionId: string | null;
  setActiveQuestionId: (id: string | null) => void;
};

const ExamContext = createContext<ExamState | undefined>(undefined);

export function ExamProvider({ children }: { children: React.ReactNode }) {
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [answerFile, setAnswerFile] = useState<File | null>(null);
  const [step, setStep] = useState<'upload' | 'extracting' | 'mapping'>('upload');
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

  return (
    <ExamContext.Provider value={{
      questionFile, setQuestionFile, answerFile, setAnswerFile, step, setStep,
      questions, setQuestions, activeQuestionId, setActiveQuestionId
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