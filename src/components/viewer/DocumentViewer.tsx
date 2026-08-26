// src/components/viewer/DocumentViewer.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useExam } from '@/store/ExamContext';
import { ZoomInIcon, ZoomOutIcon, ExpandIcon } from '../icons';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export function DocumentViewer() {
  const { answerFile } = useExam();
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(100);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  // Convert File object to URL for react-pdf
  useEffect(() => {
    if (answerFile) {
      const url = URL.createObjectURL(answerFile);
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
          {/* Zoom Controls */}
          <div className="flex items-center bg-[#3D3D3E] rounded-lg p-1">
            <button onClick={() => setZoom(z => Math.max(50, z - 10))} className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded">
              <ZoomOutIcon />
            </button>
            <span className="text-xs text-white w-12 text-center font-medium">{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded">
              <ZoomInIcon />
            </button>
          </div>

          {/* Pagination Controls */}
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
      <div className="flex-1 overflow-auto flex justify-center p-4">
        {fileUrl ? (
          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            className="flex flex-col items-center"
            loading={<div className="text-white mt-10 text-sm">Loading Answer Sheet...</div>}
          >
            <div className="relative shadow-xl mb-4 bg-white">
              <Page 
                pageNumber={pageNumber} 
                scale={zoom / 100} 
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
              {/* This is where the Highlight Bounding Box overlay will go in the next step */}
            </div>
          </Document>
        ) : (
          <div className="text-gray-400 mt-10 text-sm">No document loaded</div>
        )}
      </div>
    </div>
  );
}