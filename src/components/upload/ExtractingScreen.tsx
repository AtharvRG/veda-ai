// src/components/upload/ExtractingScreen.tsx
'use client';
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useExam } from '@/store/ExamContext';

// 1.5x Faster SVG String
const loadingSvgString = `
<svg fill="none" height="100%" width="100%" viewBox="0 0 512 512" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg"><g opacity="0" display="inline" id="i0"><animate repeatCount="indefinite" begin="0s" calcMode="discrete" dur="2.63s" values="inline; none; none; none" keyTimes="0; 0.713915; 0.999935; 1" attributeName="display" /><animate repeatCount="indefinite" attributeName="opacity" dur="2.63s" begin="0s" fill="freeze" values="0; 1; 1; 0.01; 0.01" keyTimes="0; 0.064935; 0.668831; 0.714286; 1" keySplines="0 0 1 1; 0 0 1 1; 0 0 1 1; 0 0 1 1" calcMode="spline" /><g><g transform="translate(196.73,0)"><animateTransform repeatCount="indefinite" type="translate" attributeName="transform" dur="2.63s" begin="0s" calcMode="spline" values="196.73 0; 196.73 0; 354.58 0; 354.58 0" keyTimes="0; 0.064935; 0.675325; 1" keySplines="0 0 1 1; 0.297 0 0.587 1; 0 0 1 1" fill="freeze" /><g transform="translate(0,193.825)"><animateTransform repeatCount="indefinite" type="translate" attributeName="transform" dur="2.63s" begin="0s" calcMode="spline" values="0 193.825; 0 193.825; 0 317.64; 0 317.64" keyTimes="0; 0.064935; 0.675325; 1" keySplines="0 0 1 1; 0.315 0 0.559 1; 0 0 1 1" fill="freeze" /><g transform="scale(0,0)"><animateTransform repeatCount="indefinite" type="scale" attributeName="transform" dur="2.63s" begin="0s" calcMode="spline" values="0 0; 1 1; 0 0; 0 0" keyTimes="0; 0.389611; 0.714286; 1" keySplines="0.01 0 0.252 1; 0.401 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="translate(-78,-90)"><g id="i1" transform="matrix(1,0,0,1,79,90)" fill="#ff5a36"><path fill="#ff5a36" d="M-6.69,-85.362C-4.604,-91.546,4.141,-91.546,6.227,-85.362C6.227,-85.362,22.991,-35.658,22.991,-35.658C24.148,-32.227,26.622,-29.398,29.868,-27.793C29.868,-27.793,73.74,-6.11,73.74,-6.11C78.802,-3.609,78.802,3.609,73.74,6.111C73.74,6.111,29.868,27.794,29.868,27.794C26.622,29.398,24.148,32.227,22.991,35.658C22.991,35.658,6.227,85.362,6.227,85.362C4.141,91.546,-4.604,91.546,-6.69,85.362C-6.69,85.362,-23.454,35.658,-23.454,35.658C-24.611,32.227,-27.085,29.398,-30.331,27.794C-30.331,27.794,-74.204,6.111,-74.204,6.111C-79.265,3.609,-79.265,-3.609,-74.204,-6.11C-74.204,-6.11,-30.331,-27.793,-30.331,-27.793C-27.085,-29.398,-24.611,-32.227,-23.454,-35.658C-23.454,-35.658,-6.69,-85.362,-6.69,-85.362Z" /></g></g></g></g></g></g></g><g opacity="0" display="none" id="i2"><animate repeatCount="indefinite" begin="0s" calcMode="discrete" dur="2.63s" values="none; inline; none; none; none" keyTimes="0; 0.019155; 0.733394; 0.999935; 1" attributeName="display" /><animate repeatCount="indefinite" attributeName="opacity" dur="2.63s" begin="0s" fill="freeze" values="0; 0; 0.7; 0.7; 0.01; 0.01" keyTimes="0; 0.019481; 0.084416; 0.688312; 0.733766; 1" keySplines="0 0 1 1; 0 0 1 1; 0 0 1 1; 0 0 1 1; 0 0 1 1" calcMode="spline" /><g><g transform="translate(147.73,0)"><animateTransform repeatCount="indefinite" type="translate" attributeName="transform" dur="2.63s" begin="0s" calcMode="spline" values="147.73 0; 147.73 0; 311.455 0; 311.455 0" keyTimes="0; 0.084416; 0.720779; 1" keySplines="0 0 1 1; 0.579 0 0.782 1; 0 0 1 1" fill="freeze" /><g transform="translate(0,280.325)"><animateTransform repeatCount="indefinite" type="translate" attributeName="transform" dur="2.63s" begin="0s" calcMode="spline" values="0 280.325; 0 280.325; 0 378.265; 0 378.265" keyTimes="0; 0.084416; 0.720779; 1" keySplines="0 0 1 1; 0.506 0 0.779 1; 0 0 1 1" fill="freeze" /><g transform="scale(0,0)"><animateTransform repeatCount="indefinite" type="scale" attributeName="transform" dur="2.63s" begin="0s" calcMode="spline" values="0 0; 0 0; 0.7 0.7; 0 0; 0 0" keyTimes="0; 0.019481; 0.409091; 0.733766; 1" keySplines="0 0 1 1; 0.124 0 0.649 1; 0.853 0 0.988 1; 0 0 1 1" fill="freeze" /><g transform="translate(-78,-90)"><g id="i1" transform="matrix(1,0,0,1,79,90)"><path fill="#ff5a36" d="M-6.69,-85.362C-4.604,-91.546,4.141,-91.546,6.227,-85.362C6.227,-85.362,22.991,-35.658,22.991,-35.658C24.148,-32.227,26.622,-29.398,29.868,-27.793C29.868,-27.793,73.74,-6.11,73.74,-6.11C78.802,-3.609,78.802,3.609,73.74,6.111C73.74,6.111,29.868,27.794,29.868,27.794C26.622,29.398,24.148,32.227,22.991,35.658C22.991,35.658,6.227,85.362,6.227,85.362C4.141,91.546,-4.604,91.546,-6.69,85.362C-6.69,85.362,-23.454,35.658,-23.454,35.658C-24.611,32.227,-27.085,29.398,-30.331,27.794C-30.331,27.794,-74.204,6.111,-74.204,6.111C-79.265,3.609,-79.265,-3.609,-74.204,-6.11C-74.204,-6.11,-30.331,-27.793,-30.331,-27.793C-27.085,-29.398,-24.611,-32.227,-23.454,-35.658C-23.454,-35.658,-6.69,-85.362,-6.69,-85.362Z" /></g></g></g></g></g></g></g><g opacity="0" display="none" id="i3"><animate repeatCount="indefinite" begin="0s" calcMode="discrete" dur="2.63s" values="none; inline; inline; inline" keyTimes="0; 0.285371; 0.999935; 1" attributeName="display" /><animate repeatCount="indefinite" attributeName="opacity" dur="2.63s" begin="0s" fill="freeze" values="0; 0; 0.7; 0.7; 0.01; 0.01" keyTimes="0; 0.285714; 0.350649; 0.954546; 1; 1" keySplines="0 0 1 1; 0 0 1 1; 0 0 1 1; 0 0 1 1; 0 0 1 1" calcMode="spline" /><g><g transform="translate(222.23,0)"><animateTransform repeatCount="indefinite" type="translate" attributeName="transform" dur="2.63s" begin="0s" calcMode="spline" values="222.23 0; 222.23 0; 347.517 0; 347.517 0" keyTimes="0; 0.350649; 0.961039; 1" keySplines="0 0 1 1; 0.363 0 0.554 1; 0 0 1 1" fill="freeze" /><g transform="translate(0,176.825)"><animateTransform repeatCount="indefinite" type="translate" attributeName="transform" dur="2.63s" begin="0s" calcMode="spline" values="0 176.825; 0 176.825; 0 324.452; 0 324.452" keyTimes="0; 0.350649; 0.961039; 1" keySplines="0 0 1 1; 0.355 0 0.576 1; 0 0 1 1" fill="freeze" /><g transform="scale(0,0)"><animateTransform repeatCount="indefinite" type="scale" attributeName="transform" dur="2.63s" begin="0s" calcMode="spline" values="0 0; 0 0; 0.7 0.7; 0.019 0.019; 0.019 0.019" keyTimes="0; 0.285714; 0.675325; 0.993506; 1" keySplines="0 0 1 1; 0.01 0 0.271 1; 0.507 0 0.976 1; 0 0 1 1" fill="freeze" /><g transform="translate(-78,-90)"><g id="i1" transform="matrix(1,0,0,1,79,90)"><path fill="#ff5a36" d="M-6.69,-85.362C-4.604,-91.546,4.141,-91.546,6.227,-85.362C6.227,-85.362,22.991,-35.658,22.991,-35.658C24.148,-32.227,26.622,-29.398,29.868,-27.793C29.868,-27.793,73.74,-6.11,73.74,-6.11C78.802,-3.609,78.802,3.609,73.74,6.111C73.74,6.111,29.868,27.794,29.868,27.794C26.622,29.398,24.148,32.227,22.991,35.658C22.991,35.658,6.227,85.362,6.227,85.362C4.141,91.546,-4.604,91.546,-6.69,85.362C-6.69,85.362,-23.454,35.658,-23.454,35.658C-24.611,32.227,-27.085,29.398,-30.331,27.794C-30.331,27.794,-74.204,6.111,-74.204,6.111C-79.265,3.609,-79.265,-3.609,-74.204,-6.11C-74.204,-6.11,-30.331,-27.793,-30.331,-27.793C-27.085,-29.398,-24.611,-32.227,-23.454,-35.658C-23.454,-35.658,-6.69,-85.362,-6.69,-85.362Z" /></g></g></g></g></g></g></g></svg>
`;

export function ExtractingScreen() {
  const { questionFile, answerFile, setQuestions, setStep } = useExam();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function processDocuments() {
      if (!questionFile || !answerFile) return;

      try {
        const formData = new FormData();
        formData.append('questionFile', questionFile);
        formData.append('answerFile', answerFile);

        const response = await fetch('/api/extract', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Something went wrong');
        }

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
      
      {/* Animated SVG Container */}
      <div 
        className="relative w-64 h-64 mb-6 flex items-center justify-center"
        dangerouslySetInnerHTML={{ __html: loadingSvgString }}
      />

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