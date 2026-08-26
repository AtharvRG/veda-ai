// src/components/AppContent.tsx
'use client';

import React from 'react';
import { useExam } from '@/store/ExamContext';
import { UploadScreen } from './upload/UploadScreen';
import { ExtractingScreen } from './upload/ExtractingScreen';

export function AppContent() {
  const { step } = useExam();
  
  if (step === 'upload') return <UploadScreen />;
  if (step === 'extracting') return <ExtractingScreen />;
  if (step === 'mapping') return <div className="flex items-center justify-center h-full w-full">Mapping UI coming next!</div>;
  
  return null;
}