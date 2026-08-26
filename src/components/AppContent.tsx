// src/components/AppContent.tsx
'use client';

import React from 'react';
import { useExam } from '@/store/ExamContext';
import { UploadScreen } from './upload/UploadScreen';

export function AppContent() {
  const { step } = useExam();
  
  if (step === 'upload') return <UploadScreen />;
  if (step === 'extracting') return <div className="flex items-center justify-center h-full w-full">Extracting view coming next...</div>;
  if (step === 'mapping') return <div className="flex items-center justify-center h-full w-full">Mapping view coming later...</div>;
  
  return null;
}