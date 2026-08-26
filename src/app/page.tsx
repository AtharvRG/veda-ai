// src/app/page.tsx
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileTopbar } from '@/components/layout/MobileTopbar';

export default function Home() {
  return (
    // Base container matches the gray background of the Figma mockup
    <div className="flex flex-col md:flex-row w-screen h-screen bg-[#F4F4F5] md:p-3 overflow-hidden">
      
      {/* Sidebar - Hidden on mobile, flex on desktop */}
      <Sidebar />
      
      {/* Mobile Header - Flex on mobile, hidden on desktop */}
      <MobileTopbar />

      {/* Main Content Area */}
      <main className="flex-1 bg-white md:rounded-2xl shadow-sm flex flex-col overflow-hidden relative">
        
        {/* Top Header Row (Desktop only) */}
        <header className="hidden md:flex items-center justify-between px-6 py-4 border-b border-gray-50">
          <div className="flex items-center gap-2 text-gray-400 font-medium text-sm">
            <span>←</span>
            <span className="bg-gray-100 p-1 rounded">📄</span>
            <span>Exams</span>
          </div>
          
          <div className="flex items-center gap-5">
            <button className="text-gray-500 hover:text-gray-800 font-medium text-sm flex items-center gap-1">
              <span className="border border-gray-300 rounded-full w-4 h-4 inline-flex items-center justify-center text-[10px]">?</span>
            </button>
            <button className="relative text-gray-500 hover:text-gray-800">
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#FF5A36] rounded-full"></span>
              🔔
            </button>
            <button className="text-gray-500 hover:text-gray-800">✨</button>
            
            <div className="flex items-center gap-2 ml-2 pl-4 border-l border-gray-200 cursor-pointer">
              <div className="w-7 h-7 bg-gray-200 rounded-full overflow-hidden">
                 <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Madhur" alt="Avatar" />
              </div>
              <span className="text-sm font-medium">Madhur Rastogi</span>
              <span className="text-xs text-gray-400">▼</span>
            </div>
          </div>
        </header>

        {/* Temporary placeholder for where the actual app will go */}
        <div className="flex-1 overflow-auto flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-white">
           <h1 className="text-gray-400 text-sm">Main workspace will go here in Commit 3</h1>
        </div>
      </main>
    </div>
  );
}