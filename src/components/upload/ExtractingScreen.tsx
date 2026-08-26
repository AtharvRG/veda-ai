// src/components/upload/ExtractingScreen.tsx
'use client';
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useExam } from '@/store/ExamContext';

const Sparkle = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C12 6.62742 17.3726 12 24 12C17.3726 12 12 17.3726 12 24C12 17.3726 6.62742 12 0 12C6.62742 12 12 6.62742 12 0Z" />
  </svg>
);

export function ExtractingScreen() {
  const { questionFile, answerFile, setQuestions, setStep } = useExam();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function processDocuments() {
      if (!questionFile || !answerFile) return;

      try {
        // Prepare files for the API route
        const formData = new FormData();
        formData.append('questionFile', questionFile);
        formData.append('answerFile', answerFile);

        // Call our Next.js backend
        const response = await fetch('/api/extract', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Something went wrong');
        }

        // Successfully got real AI data! Update the context and move to mapping
        setQuestions(data.questions);
        setStep('mapping');

} catch (err: unknown) {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to analyze documents. Please try again.';
        setError(errorMessage);
      }
    }

    processDocuments();
  }, [questionFile, answerFile, setQuestions, setStep]);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full min-h-[60vh]">
      {/* Sparkles Container */}
      <div className="relative w-32 h-32 mb-6 flex items-center justify-center">
        <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="absolute top-2 right-4 text-[#FF5A36] w-14 h-14 drop-shadow-[0_0_15px_rgba(255,90,54,0.4)]">
          <Sparkle className="w-full h-full" />
        </motion.div>
        <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }} className="absolute bottom-4 left-4 text-[#FF5A36] w-11 h-11 drop-shadow-[0_0_10px_rgba(255,90,54,0.3)]">
          <Sparkle className="w-full h-full" />
        </motion.div>
        <motion.div animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.5, 0.9, 0.5] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.2 }} className="absolute bottom-8 right-0 text-[#FF5A36] opacity-70 w-5 h-5">
          <Sparkle className="w-full h-full" />
        </motion.div>
      </div>

      {error ? (
        <div className="flex flex-col items-center">
          <h2 className="text-2xl font-bold text-red-600 tracking-tight mb-2">Extraction Failed</h2>
          <p className="text-gray-500 text-sm mb-4">{error}</p>
          <button onClick={() => setStep('upload')} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">Go Back</button>
        </div>
      ) : (
        <>
          <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold text-gray-900 tracking-tight mb-2">
            Extracting & Grading...
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-gray-500 text-sm text-center">
            Mistral AI is mapping answers and evaluating scores.<br/>This may take 10-20 seconds.
          </motion.p>
        </>
      )}
    </div>
  );
}