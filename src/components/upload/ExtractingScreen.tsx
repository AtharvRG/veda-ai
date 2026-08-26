// src/components/upload/ExtractingScreen.tsx
'use client';
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useExam } from '@/store/ExamContext';

const Sparkle = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C12 6.62742 17.3726 12 24 12C17.3726 12 12 17.3726 12 24C12 17.3726 6.62742 12 0 12C6.62742 12 12 6.62742 12 0Z" />
  </svg>
);

export function ExtractingScreen() {
  const { setStep } = useExam();

  // Temporary simulation of API processing time
  useEffect(() => {
    const timer = setTimeout(() => {
      setStep('mapping');
    }, 3000); // Wait 3 seconds then go to mapping
    return () => clearTimeout(timer);
  }, [setStep]);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full min-h-[60vh]">
      
      {/* Sparkles Container */}
      <div className="relative w-32 h-32 mb-6 flex items-center justify-center">
        
        {/* Large Top Right Sparkle */}
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-2 right-4 text-[#FF5A36] w-14 h-14 drop-shadow-[0_0_15px_rgba(255,90,54,0.4)]"
        >
          <Sparkle className="w-full h-full" />
        </motion.div>

        {/* Medium Bottom Left Sparkle */}
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          className="absolute bottom-4 left-4 text-[#FF5A36] w-11 h-11 drop-shadow-[0_0_10px_rgba(255,90,54,0.3)]"
        >
          <Sparkle className="w-full h-full" />
        </motion.div>

        {/* Small Bottom Right Sparkle */}
        <motion.div
          animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
          className="absolute bottom-8 right-0 text-[#FF5A36] opacity-70 w-5 h-5"
        >
          <Sparkle className="w-full h-full" />
        </motion.div>

        {/* Tiny Dot Left */}
        <motion.div
          animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
          className="absolute top-12 left-2 bg-[#FF5A36] w-2.5 h-2.5 rounded-full"
        />
      </div>

      {/* Text Content */}
      <motion.h2 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-bold text-gray-900 tracking-tight mb-2"
      >
        Extracting...
      </motion.h2>
      
      <motion.p 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-gray-500 text-sm"
      >
        This may take a while
      </motion.p>
    </div>
  );
}