// src/components/layout/Sidebar.tsx
import React from 'react';
import { 
  LogoIcon, LayoutPanelIcon, SparklesIcon, GridIcon, 
  UsersIcon, FileTextIcon, ClipboardIcon, ClockIcon, SettingsIcon 
} from '../icons';
import { cn } from '@/lib/utils';

const navItems = [
  { name: 'Home', icon: GridIcon, active: false },
  { name: 'My Classroom', icon: UsersIcon, active: false },
  { name: 'Assignments', icon: FileTextIcon, active: false },
  { name: 'Exams', icon: ClipboardIcon, active: true },
  { name: 'My Library', icon: ClockIcon, active: false },
];

export function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col w-[260px] h-full bg-white rounded-2xl p-4 shadow-sm shrink-0 mr-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 px-2">
        <div className="flex items-center gap-2">
          <LogoIcon className="w-8 h-8" />
          <span className="font-bold text-xl tracking-tight">VedaAI</span>
        </div>
        <button className="text-gray-400 hover:text-gray-700 transition-colors">
          <LayoutPanelIcon />
        </button>
      </div>

      {/* AI Action Button */}
      <button className="flex items-center justify-center gap-2 w-full py-3 mb-8 bg-[#2A2A2B] text-white rounded-full font-medium shadow-[0_0_0_2px_#FF5A36] hover:bg-[#333] transition-colors">
        <SparklesIcon />
        <span>AI Teacher&apos;s Toolkit</span>
      </button>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.name}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              item.active 
                ? "bg-gray-100 text-black" 
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {item.name}
          </button>
        ))}
      </nav>

      {/* Footer / Settings */}
      <div className="pt-4 border-t border-gray-100">
        <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors mb-4">
          <SettingsIcon className="w-5 h-5" />
          Settings
        </button>
        
        {/* School Profile Card */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0 border border-gray-100 overflow-hidden">
             {/* Using a simple placeholder for the badge to avoid external image dependencies */}
             <div className="w-6 h-6 border-2 border-green-600 rounded-full flex items-center justify-center">
               <div className="w-2 h-4 border-b-2 border-r-2 border-green-600 transform rotate-45 mb-1" />
             </div>
          </div>
          <div className="flex flex-col text-left">
            <span className="text-sm font-bold leading-tight">Delhi Public School</span>
            <span className="text-xs text-gray-500">Bokaro Steel City</span>
          </div>
        </div>
      </div>
    </aside>
  );
}