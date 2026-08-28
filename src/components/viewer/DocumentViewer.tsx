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
  
  // PDF State
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(100);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  
  // New Layout & QoL State
  const [rotation, setRotation] = useState<number>(0);
  const [fitToWidth, setFitToWidth] = useState<boolean>(false);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeQuestion = questions.find(q => q.id === activeQuestionId);
  const activeBboxes = useMemo(
    () => activeQuestion?.bboxes ?? (activeQuestion?.bbox ? [activeQuestion.bbox] : []),
    [activeQuestion]
  );

  // Resize Observer to handle the "Fit to Width" feature dynamically
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        // Subtract a bit for padding and scrollbars
        setContainerWidth(entries[0].contentRect.width - 40); 
      }
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Jump to page if a mapped answer is clicked
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
      <div className="h-14 bg-[#2A2A2B] flex items-center justify-between px-4 shrink-0 shadow-sm z-10 overflow-x-auto hide-scrollbar">
        <span className="text-white text-sm font-medium mr-4">Answer Sheet</span>
        
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          
          {/* Layout Controls (Rotate & Fit) */}
          <div className="flex items-center bg-[#3D3D3E] rounded-lg p-1">
            <button 
              onClick={() => setRotation(r => (r + 90) % 360)} 
              className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded flex items-center gap-1"
              title="Rotate Page"
            >
              <RotateIcon />
            </button>
            <div className="w-px h-4 bg-gray-600 mx-1"></div>
            <button 
              onClick={() => {
                setFitToWidth(!fitToWidth);
                if (!fitToWidth) setZoom(100); // Reset zoom when switching to fit
              }} 
              className={cn("p-1.5 rounded flex items-center gap-1 transition-colors", fitToWidth ? "text-[#FF5A36] bg-[#FF5A36]/10" : "text-gray-300 hover:text-white hover:bg-white/10")}
              title="Fit to Width"
            >
              <FitWidthIcon />
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center bg-[#3D3D3E] rounded-lg p-1">
            <button 
              disabled={fitToWidth}
              onClick={() => setZoom(z => Math.max(50, z - 10))} 
              className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ZoomOutIcon />
            </button>
            <span className={cn("text-xs w-10 text-center font-medium", fitToWidth ? "text-gray-500" : "text-white")}>
              {fitToWidth ? 'Auto' : `${zoom}%`}
            </span>
            <button 
              disabled={fitToWidth}
              onClick={() => setZoom(z => Math.min(250, z + 10))} 
              className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ZoomInIcon />
            </button>
          </div>

          {/* Pagination Native Select Dropdown */}
          <div className="flex items-center bg-[#3D3D3E] rounded-lg p-1 text-xs text-gray-300">
            <button 
              disabled={pageNumber <= 1}
              onClick={() => setPageNumber(p => p - 1)} 
              className="px-2 py-1 hover:text-white disabled:opacity-50"
            >
              {'<'}
            </button>
            
            <div className="px-1 font-medium flex items-center">
               <select 
                 value={pageNumber} 
                 onChange={(e) => setPageNumber(Number(e.target.value))}
                 className="bg-transparent text-white font-medium cursor-pointer outline-none appearance-none hover:text-[#FF5A36] transition-colors pr-1"
               >
                 {Array.from(new Array(numPages), (el, index) => (
                   <option key={`page_${index + 1}`} value={index + 1} className="text-black">
                     Page {index + 1}
                   </option>
                 ))}
               </select>
               <span>of {numPages || '-'}</span>
            </div>

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
      <div ref={containerRef} className="flex-1 overflow-auto flex justify-center p-4 md:p-6 bg-[#323232]">
        {fileUrl ? (
          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            className="flex flex-col items-center"
            loading={<div className="text-white mt-10 text-sm">Loading Answer Sheet...</div>}
          >
            <div className="relative shadow-2xl mb-4 bg-white transition-all duration-300">
              <Page 
                pageNumber={pageNumber} 
                scale={fitToWidth ? undefined : (zoom / 100)} 
                width={fitToWidth && containerWidth > 0 ? containerWidth : undefined}
                rotate={rotation}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                className="transition-transform duration-300"
              />
              
              {/* Highlight Bounding Box Overlay */}
              <AnimatePresence>
                {activeBboxes.filter((bbox) => bbox.page === pageNumber).map((bbox, index) => {
                  
                  // Handle bounding box rotation matrix visually
                  // If rotation is 90 or 270, the Page canvas swaps width/height, but our absolute overlay might need adjustment.
                  // For now, we apply standard rendering, relying on react-pdf's internal scaling.
                  return (
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
                )})}
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