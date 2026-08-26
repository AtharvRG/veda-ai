// src/components/viewer/DocumentViewer.tsx
'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useExam } from '@/store/ExamContext';
import { ZoomInIcon, ZoomOutIcon } from '../icons';
import { motion, AnimatePresence } from 'framer-motion';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export function DocumentViewer() {
  const { answerFile, questions, activeQuestionId } = useExam();
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(100);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  // Find the active question to get its bounding box
  const activeQuestion = questions.find(q => q.id === activeQuestionId);
  const activeBboxes = useMemo(
    () => activeQuestion?.bboxes ?? (activeQuestion?.bbox ? [activeQuestion.bbox] : []),
    [activeQuestion]
  );

  // Automatically switch pages if the clicked question is on a different page
useEffect(() => {
    if (activeBboxes[0] && activeBboxes[0].page !== pageNumber) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPageNumber(activeBboxes[0].page);
    }
  }, [activeBboxes, pageNumber]);

useEffect(() => {
    if (answerFile) {
      const url = URL.createObjectURL(answerFile);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFileUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [answerFile]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  return (
    <div className="h-full flex flex-col bg-[#323232] md:rounded-xl overflow-hidden relative shadow-inner">
      {/* Top Toolbar */}
      <div className="h-14 bg-[#2A2A2B] flex items-center justify-between px-4 shrink-0 shadow-sm z-10">
        <span className="text-white text-sm font-medium">Answer Sheet</span>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-[#3D3D3E] rounded-lg p-1">
            <button onClick={() => setZoom(z => Math.max(50, z - 10))} className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded">
              <ZoomOutIcon />
            </button>
            <span className="text-xs text-white w-12 text-center font-medium">{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded">
              <ZoomInIcon />
            </button>
          </div>

          <div className="flex items-center bg-[#3D3D3E] rounded-lg p-1 text-xs text-gray-300">
            <button 
              disabled={pageNumber <= 1}
              onClick={() => setPageNumber(p => p - 1)} 
              className="px-2 py-1 hover:text-white disabled:opacity-50"
            >
              {'<'}
            </button>
            <span className="px-2 font-medium">Page {pageNumber} of {numPages || '-'}</span>
            <button 
              disabled={pageNumber >= numPages}
              onClick={() => setPageNumber(p => p + 1)} 
              className="px-2 py-1 hover:text-white disabled:opacity-50"
            >
              {'>'}
            </button>
          </div>
        </div>
      </div>

      {/* PDF Canvas Area */}
      <div className="flex-1 overflow-auto flex justify-center p-4 bg-[#323232]">
        {fileUrl ? (
          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            className="flex flex-col items-center"
            loading={<div className="text-white mt-10 text-sm">Loading Answer Sheet...</div>}
          >
            {/* The relative container is crucial! It keeps the absolute highlight locked to the PDF page */}
            <div className="relative shadow-xl mb-4 bg-white transition-all duration-300">
              <Page 
                pageNumber={pageNumber} 
                scale={zoom / 100} 
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
              
              {/* Highlight Bounding Box Overlay */}
              <AnimatePresence>
                {activeBboxes.filter((bbox) => bbox.page === pageNumber).map((bbox, index) => (
                  <motion.div
                    key={`${bbox.page}-${bbox.top}-${index}`}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="absolute z-50 pointer-events-none rounded-md border-[3px] border-[#22C55E] bg-[#22C55E]/15 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                    style={{
                      top: bbox.top,
                      left: bbox.left,
                      width: bbox.width,
                      height: bbox.height,
                    }}
                  >
                    <div className="absolute -top-3 -left-3 bg-[#22C55E] text-white font-bold text-xs px-2 py-1 rounded-md shadow-sm">
                      Q{activeQuestion?.number}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </Document>
        ) : (
          <div className="text-gray-400 mt-10 text-sm">No document loaded</div>
        )}
      </div>
    </div>
  );
}