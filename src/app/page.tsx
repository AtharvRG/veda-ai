// src/app/page.tsx
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileTopbar } from '@/components/layout/MobileTopbar';
import { ExamProvider } from '@/store/ExamContext';
import { AppContent } from '@/components/AppContent';
import { FileTextIcon, BellIcon, SparklesIcon, ChevronDownIcon, ArrowLeftIcon } from '@/components/icons';

export default function Home() {
  return (
    <ExamProvider>
      <div className="flex flex-col md:flex-row w-screen h-screen bg-[#F4F4F5] md:p-3 overflow-hidden">
        <Sidebar />
        <MobileTopbar />

        <main className="flex-1 bg-[#F4F4F5] md:bg-white md:rounded-2xl md:shadow-sm flex flex-col overflow-hidden relative">
          
          {/* Clean, Emoji-Free Desktop Header */}
          <header className="hidden md:flex items-center justify-between px-6 py-4 md:border-b border-gray-50">
            <div className="flex items-center gap-2 text-gray-400 font-medium text-sm">
              <ArrowLeftIcon className="w-4 h-4" />
              <span className="bg-gray-100 p-1 rounded flex items-center justify-center">
                <FileTextIcon className="w-3.5 h-3.5 text-gray-500" />
              </span>
              <span>Exams</span>
            </div>
            
            <div className="flex items-center gap-5">
              <button className="text-gray-500 hover:text-gray-800 font-medium text-sm flex items-center gap-1">
                <span className="border border-gray-300 rounded-full w-4 h-4 inline-flex items-center justify-center text-[10px]">?</span>
              </button>
              <button className="relative text-gray-500 hover:text-gray-800">
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#FF5A36] rounded-full"></span>
                <BellIcon className="w-4 h-4" />
              </button>
              <button className="text-gray-500 hover:text-gray-800">
                <SparklesIcon className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-2 ml-2 pl-4 border-l border-gray-200 cursor-pointer">
                <div className="w-7 h-7 bg-gray-200 rounded-full overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/avatar.png" alt="Avatar" className="w-full h-full object-cover" />
                </div>
                <span className="text-sm font-medium text-gray-900">Name of the User</span>
                <ChevronDownIcon className="w-3 h-3 text-gray-400" />
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50/50 to-white">
             {/* The client-side view switcher is injected here */}
             <AppContent />
          </div>
        </main>
      </div>
    </ExamProvider>
  );
}