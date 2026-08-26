// src/components/layout/MobileTopbar.tsx
import React from 'react';
import { ArrowLeftIcon, BellIcon, MenuIcon } from '../icons';

export function MobileTopbar() {
  return (
    <header className="md:hidden flex items-center justify-between w-full h-16 px-4 bg-white border-b border-gray-100 shrink-0">
      <div className="flex items-center gap-3">
        <button className="text-gray-700 p-1">
          <ArrowLeftIcon className="w-6 h-6" />
        </button>
        <span className="font-bold text-lg tracking-tight">VedaAI</span>
      </div>
      
      <div className="flex items-center gap-4">
        <button className="relative text-gray-600 p-1">
          <BellIcon className="w-6 h-6" />
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#FF5A36] border-2 border-white rounded-full"></span>
        </button>
        
        {/* Placeholder Avatar */}
        <div className="w-8 h-8 bg-gray-200 rounded-full overflow-hidden shrink-0">
          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Madhur" alt="Avatar" className="w-full h-full object-cover" />
        </div>
        
        <button className="text-gray-700 p-1">
          <MenuIcon className="w-6 h-6" />
        </button>
      </div>
    </header>
  );
}