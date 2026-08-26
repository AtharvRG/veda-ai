// src/components/upload/FileDropzone.tsx
import React, { useRef } from 'react';
import { UploadIcon, FilePdfIcon, XIcon } from '../icons';
import { cn } from '@/lib/utils';

type Props = {
  type: 'question' | 'answer';
  file: File | null;
  onUpload: (file: File) => void;
  onClear: () => void;
};

export function FileDropzone({ type, file, onUpload, onClear }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isQuestion = type === 'question';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUpload(e.target.files[0]);
    }
  };

  const formatFileSize = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  };

  if (file) {
    return (
      <div className="relative flex items-center justify-center h-32 md:h-40 w-full bg-white border border-gray-100 shadow-sm rounded-2xl p-4 md:p-6 transition-all">
        <button 
          onClick={onClear}
          className="absolute -top-2 -right-2 bg-gray-500 hover:bg-gray-700 text-white p-1 rounded-full shadow-sm transition-colors z-10"
        >
          <XIcon className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-4 w-full">
          <FilePdfIcon className="w-10 h-10 shrink-0" />
          <div className="flex flex-col text-left overflow-hidden">
            <span className="font-semibold text-sm text-gray-900 truncate" title={file.name}>
              {file.name}
            </span>
            <span className="text-xs text-gray-400 mt-0.5">
              {formatFileSize(file.size)} • PDF Document
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      onClick={() => inputRef.current?.click()}
      className="flex flex-col items-center justify-center h-32 md:h-40 w-full border-2 border-dashed border-gray-200 bg-white rounded-2xl cursor-pointer hover:border-[#FF5A36] hover:bg-orange-50/30 transition-all group"
    >
      <input 
        type="file" 
        ref={inputRef} 
        onChange={handleFileChange} 
        accept="application/pdf" 
        className="hidden" 
      />
      <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-gray-600 mb-3 group-hover:bg-orange-100 group-hover:text-[#FF5A36] transition-colors">
        <UploadIcon className="w-5 h-5" />
      </div>
      <div className="text-sm font-medium text-gray-900">
        Upload <span className="text-[#FF5A36]">{isQuestion ? 'Question Paper' : 'Answer Sheet'}</span>
      </div>
      <div className="text-xs text-gray-400 mt-1">Max 10MB</div>
    </div>
  );
}