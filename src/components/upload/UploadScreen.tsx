// src/components/upload/UploadScreen.tsx
'use client';
import React from 'react';
import { useExam } from '@/store/ExamContext';
import { FileDropzone } from './FileDropzone';

export function UploadScreen() {
  const { questionFile, setQuestionFile, answerFile, setAnswerFile, setStep } = useExam();

  const canStart = questionFile && answerFile;
  const isRetainedMode = questionFile && !answerFile; // True if they clicked "Evaluate Next"

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto py-12 px-4 h-full">
      {/* Title */}
      <h1 className="text-2xl md:text-[40px] leading-tight font-bold text-center text-gray-900 mb-2">
        {isRetainedMode ? 'Upload Next' : 'Upload'} <span className="text-[#FF5A36] bg-[#FF5A36]/10 px-2 py-0.5 md:py-1 rounded-lg inline-block">{isRetainedMode ? 'Answer Sheet' : 'Question Paper & Answer Sheets'}</span>
      </h1>
      <p className="text-gray-500 text-sm md:text-base mb-10 text-center">
        {isRetainedMode ? 'Question paper is already loaded. Just drop the next student\'s sheet.' : 'Upload both files to get started'}
      </p>

      {/* Replaced CSS Avatar with Real Image */}
      <div className="relative w-48 h-48 md:w-64 md:h-64 flex items-center justify-center mb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/dashboard.png" alt="Dashboard Illustration" className="w-full h-full object-contain" />
      </div>

      {/* Upload Dropzones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 w-full max-w-2xl bg-white/50 backdrop-blur-sm p-4 md:p-6 rounded-3xl border border-gray-100 shadow-sm">
        <FileDropzone 
          type="question" 
          file={questionFile} 
          onUpload={setQuestionFile} 
          onClear={() => setQuestionFile(null)} 
        />
        <FileDropzone 
          type="answer" 
          file={answerFile} 
          onUpload={setAnswerFile} 
          onClear={() => setAnswerFile(null)} 
        />
      </div>

      {/* Action Area */}
      <div className="mt-10 flex flex-col items-center">
        <button 
          disabled={!canStart}
          onClick={() => setStep('extracting')}
          className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all duration-300 ${
            canStart 
              ? 'bg-[#2A2A2B] text-white hover:bg-black shadow-lg translate-y-0' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
          }`}
        >
          Start Mapping <span>→</span>
        </button>
        <p className="text-xs md:text-sm text-gray-400 mt-4 text-center">
          Once both files are uploaded, you&apos;ll be able to map answers with questions
        </p>
      </div>
    </div>
  );
}