// src/components/AppContent.tsx
'use client';
import React from 'react';
import { useExam } from '@/store/ExamContext';
import { UploadScreen } from './upload/UploadScreen';
import { ExtractingScreen } from './upload/ExtractingScreen';
import { MappingScreen } from './MappingScreen';

export function AppContent() {
  const { step } = useExam();
  
  if (step === 'upload') return <UploadScreen />;
  if (step === 'extracting') return <ExtractingScreen />;
  if (step === 'mapping') return <MappingScreen />;
  
  return null;
}