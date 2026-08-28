// src/components/viewer/DocumentViewer.tsx
'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useExam } from '@/store/ExamContext';
import { ZoomInIcon, ZoomOutIcon, RotateIcon, FitWidthIcon } from '../icons';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export function DocumentViewer() {
  const { answerFile, questions, activeQuestionId } = useExam();
  
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(100);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [rotation, setRotation] = useState<number>(0);
  const [fitToWidth, setFitToWidth] = useState<boolean>(false);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Check if the uploaded file is an image instead of a PDF
  const isImage = useMemo(() => {
    return answerFile?.type.startsWith('image/') || false;
  }, [answerFile]);

  // Resize Observer for Fit to Width
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) setContainerWidth(entries[0].contentRect.width - 40); 
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

// Define the exact shape of our render boxes
  type RenderBox = {
    page: number;
    top: string;
    left: string;
    width: string;
    height: string;
    questionId: string;
    questionNumber: string;
    isTarget: boolean;
    index: number;
  };

  const boxesToRender = useMemo(() => {
    // Replace `const boxes: any[] = [];` with our new strict type:
    const boxes: RenderBox[] = [];
    
    questions.forEach(q => {
      const qBboxes = q.bboxes ?? (q.bbox ? [q.bbox] : []);
      qBboxes.forEach((b, i) => {
        if (b.page === pageNumber || isImage) {
          boxes.push({ 
            ...b, 
            questionId: q.id, 
            questionNumber: q.number, 
            isTarget: q.id === activeQuestionId, 
            index: i 
          });
        }
      });
    });
    return boxes.sort((a, b) => (a.isTarget === b.isTarget ? 0 : a.isTarget ? 1 : -1));
  }, [questions, activeQuestionId, pageNumber, isImage]);

  // Focus Mode
  useEffect(() => {
    const activeQuestion = questions.find(q => q.id === activeQuestionId);
    const primaryBox = activeQuestion?.bboxes?.[0] ?? activeQuestion?.bbox;
    
    if (primaryBox) {
      if (!isImage && primaryBox.page !== pageNumber) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPageNumber(primaryBox.page);
      }
      const timer = setTimeout(() => {
        const el = document.getElementById(`bbox-${activeQuestionId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activeQuestionId, questions, pageNumber, isImage]);

  useEffect(() => {
    if (answerFile) {
      const url = URL.createObjectURL(answerFile);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFileUrl(url);
      if (answerFile.type.startsWith('image/')) {
        setNumPages(1); // Images are always 1 page
      }
      return () => URL.revokeObjectURL(url);
    }
  }, [answerFile]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  return (
    <div className="h-full flex flex-col bg-[#323232] md:rounded-xl overflow-hidden relative shadow-inner">
      {/* Top Toolbar */}
      <div className="h-14 bg-[#2A2A2B] flex items-center justify-between px-4 shrink-0 shadow-sm z-10 overflow-x-auto hide-scrollbar">
        <span className="text-white text-sm font-medium mr-4">Answer Sheet</span>
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <div className="flex items-center bg-[#3D3D3E] rounded-lg p-1">
            <button onClick={() => setRotation(r => (r + 90) % 360)} className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded" title="Rotate Page"><RotateIcon /></button>
            <div className="w-px h-4 bg-gray-600 mx-1"></div>
            <button onClick={() => { setFitToWidth(!fitToWidth); if (!fitToWidth) setZoom(100); }} className={cn("p-1.5 rounded transition-colors", fitToWidth ? "text-[#FF5A36] bg-[#FF5A36]/10" : "text-gray-300 hover:text-white hover:bg-white/10")} title="Fit to Width"><FitWidthIcon /></button>
          </div>
          <div className="flex items-center bg-[#3D3D3E] rounded-lg p-1">
            <button disabled={fitToWidth} onClick={() => setZoom(z => Math.max(50, z - 10))} className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed"><ZoomOutIcon /></button>
            <span className={cn("text-xs w-10 text-center font-medium", fitToWidth ? "text-gray-500" : "text-white")}>{fitToWidth ? 'Auto' : `${zoom}%`}</span>
            <button disabled={fitToWidth} onClick={() => setZoom(z => Math.min(250, z + 10))} className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed"><ZoomInIcon /></button>
          </div>
          
          {!isImage && (
            <div className="flex items-center bg-[#3D3D3E] rounded-lg p-1 text-xs text-gray-300">
              <button disabled={pageNumber <= 1} onClick={() => setPageNumber(p => p - 1)} className="px-2 py-1 hover:text-white disabled:opacity-50">{'<'}</button>
              <div className="px-1 font-medium flex items-center">
                 <select value={pageNumber} onChange={(e) => setPageNumber(Number(e.target.value))} className="bg-transparent text-white font-medium cursor-pointer outline-none appearance-none hover:text-[#FF5A36] transition-colors pr-1">
                   {Array.from(new Array(numPages), (el, index) => ( <option key={`page_${index + 1}`} value={index + 1} className="text-black">Page {index + 1}</option> ))}
                 </select>
                 <span>of {numPages || '-'}</span>
              </div>
              <button disabled={pageNumber >= numPages} onClick={() => setPageNumber(p => p + 1)} className="px-2 py-1 hover:text-white disabled:opacity-50">{'>'}</button>
            </div>
          )}
        </div>
      </div>

      {/* Viewer Canvas Area */}
      <div ref={containerRef} className="flex-1 overflow-auto flex justify-center p-4 md:p-6 bg-[#323232]">
        {fileUrl ? (
          <div className="flex flex-col items-center">
            <div 
              className="relative shadow-2xl mb-4 bg-white transition-all duration-300"
              style={{
                transform: `rotate(${rotation}deg)`,
                width: fitToWidth && containerWidth > 0 ? `${containerWidth}px` : undefined,
                transformOrigin: 'center center'
              }}
            >
              {isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                  src={fileUrl} 
                  alt="Student Answer Sheet" 
                  className="max-w-none transition-all duration-300"
                  style={{
                    width: fitToWidth && containerWidth > 0 ? '100%' : `${zoom}%`,
                    display: 'block'
                  }}
                />
              ) : (
                <Document file={fileUrl} onLoadSuccess={onDocumentLoadSuccess} loading={<div className="text-white mt-10 text-sm">Loading PDF...</div>}>
                  <Page pageNumber={pageNumber} scale={fitToWidth ? undefined : (zoom / 100)} width={fitToWidth && containerWidth > 0 ? containerWidth : undefined} renderTextLayer={false} renderAnnotationLayer={false} />
                </Document>
              )}
              
              {/* Highlight Bounding Box Overlays */}
              <AnimatePresence>
                {boxesToRender.map((box) => (
                  <motion.div
                    key={`${box.questionId}-${box.index}`}
                    id={box.isTarget ? `bbox-${box.questionId}` : undefined}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: box.isTarget ? 1 : 0.4, scale: box.isTarget ? 1 : 0.99 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "absolute pointer-events-none rounded-md border-[2px] md:border-[3px] transition-colors duration-300",
                      box.isTarget ? "border-[#22C55E] bg-[#22C55E]/15 shadow-[0_0_15px_rgba(34,197,94,0.3)] z-50" : "border-gray-400 bg-gray-300/10 z-10"
                    )}
                    style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
                  >
                    <div className={cn(
                      "absolute -top-3 -left-3 font-bold text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 md:py-1 rounded-md shadow-sm",
                      box.isTarget ? "bg-[#22C55E] text-white" : "bg-gray-400 text-white"
                    )}>
                      Q{box.questionNumber}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <div className="text-gray-400 mt-10 text-sm">No document loaded</div>
        )}
      </div>
    </div>
  );
}