// src/store/ExamContext.tsx
'use client';
import React, { createContext, useContext, useState } from 'react';

export type QuestionData = {
  id: string;
  number: string;
  text: string;
  marksAwarded: number;
  maxMarks: number;
  feedback?: string;
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

const mockQuestions: QuestionData[] = [
  { id: '1', number: '1', text: 'Which blood vessel carries blood away from the heart?', marksAwarded: 2, maxMarks: 2 },
  { id: '2', number: '2', text: 'Which of the following organelles is primarily involved in photosynthesis?', marksAwarded: 2, maxMarks: 2, feedback: 'Excellent work! You correctly identified the chloroplast as the organelle responsible for photosynthesis. Keep it up!' },
  { id: '3', number: '3', text: 'Explain the role of chloroplasts in photosynthesis, naming the main pigments involved and briefly outlining the two major stages of the process.', marksAwarded: 2, maxMarks: 2 },
  { id: '4', number: '4', text: 'Describe the flow of blood through the human heart starting from the right atrium and ending at the aorta; include the names of valves crossed.', marksAwarded: 0, maxMarks: 2 },
  { id: '11a', number: '11a', text: 'A diagram shows two potted plants — Plant A in bright light with broad green leaves, Plant B kept in dim light with pale, elongated leaves.', marksAwarded: 2, maxMarks: 2 },
  { id: '11b', number: '11b', text: 'Suggest one practical measure to help Plant B recover.', marksAwarded: 1, maxMarks: 3 },
];

const ExamContext = createContext<ExamState | undefined>(undefined);

export function ExamProvider({ children }: { children: React.ReactNode }) {
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [answerFile, setAnswerFile] = useState<File | null>(null);
  const [step, setStep] = useState<'upload' | 'extracting' | 'mapping'>('upload');
  
  // New state for mapping screen
  const [questions, setQuestions] = useState<QuestionData[]>(mockQuestions);
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