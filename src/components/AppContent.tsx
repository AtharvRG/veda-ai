// src/components/AppContent.tsx
'use client';
import React, { useEffect, useState } from 'react';
import { useExam } from '@/store/ExamContext';
import { UploadScreen } from './upload/UploadScreen';
import { ExtractingScreen } from './upload/ExtractingScreen';
import { MappingScreen } from './MappingScreen';

export function AppContent() {
  const { step } = useExam();
  
  // 1. Add a mounted state
  const [mounted, setMounted] = useState(false);

  // 2. Set it to true only after the browser has taken over
 useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  // 3. Return a blank placeholder (or null) during server-side rendering to prevent hydration errors
  if (!mounted) {
    return null; 
  }
  
  if (step === 'upload') return <UploadScreen />;
  if (step === 'extracting') return <ExtractingScreen />;
  if (step === 'mapping') return <MappingScreen />;
  
  return null;
}