// src/components/MappingScreen.tsx
'use client';
import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { QuestionList } from './viewer/QuestionList';
import { cn } from '@/lib/utils';

// Dynamically import the DocumentViewer and disable Server-Side Rendering
const DocumentViewer = dynamic(
  () => import('./viewer/DocumentViewer').then((mod) => mod.DocumentViewer),
  { 
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-[#323232] md:rounded-xl">
        <span className="text-gray-400 text-sm animate-pulse">Loading PDF Viewer...</span>
      </div>
    )
  }
);

export function MappingScreen() {
  const [mobileTab, setMobileTab] = useState<'questions' | 'document'>('questions');

  return (
    <div className="flex flex-col h-full w-full">
      {/* Mobile Segmented Control */}
      <div className="md:hidden p-4 bg-gray-50 border-b border-gray-200 shrink-0">
        <div className="flex bg-gray-200/80 p-1 rounded-full relative">
          <div 
            className={cn(
              "absolute inset-y-1 w-[calc(50%-4px)] bg-white rounded-full shadow-sm transition-all duration-300 ease-out",
              mobileTab === 'questions' ? "left-1" : "left-[calc(50%+2px)]"
            )}
          />
          <button 
            onClick={() => setMobileTab('questions')}
            className={cn("flex-1 py-2 text-sm font-semibold z-10 transition-colors", mobileTab === 'questions' ? "text-gray-900" : "text-gray-500")}
          >
            Questions
          </button>
          <button 
            onClick={() => setMobileTab('document')}
            className={cn("flex-1 py-2 text-sm font-semibold z-10 transition-colors", mobileTab === 'document' ? "text-gray-900" : "text-gray-500")}
          >
            Answer Sheet
          </button>
        </div>
      </div>

      {/* Main Responsive Layout */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Side: Questions List */}
        <div className={cn(
          "w-full md:w-[45%] h-full flex flex-col md:border-r border-gray-200",
          mobileTab !== 'questions' && "hidden md:flex"
        )}>
          <QuestionList />
        </div>

        {/* Right Side: Document Viewer */}
        <div className={cn(
          "w-full md:w-[55%] h-full md:p-4 bg-gray-50 relative",
          mobileTab !== 'document' && "hidden md:block"
        )}>
          <DocumentViewer />
        </div>

      </div>
    </div>
  );
}