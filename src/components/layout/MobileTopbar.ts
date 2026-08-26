// src/components/layout/MobileTopbar.tsx
import React from 'react';
import { ArrowLeftIcon, BellIcon, MenuIcon } from '../icons';

export function MobileTopbar() {
  return React.createElement(
    'header',
    { className: 'md:hidden flex items-center justify-between w-full h-16 px-4 bg-white border-b border-gray-100 shrink-0' },
    React.createElement(
      'div',
      { className: 'flex items-center gap-3' },
      React.createElement('button', { className: 'text-gray-700 p-1' }, React.createElement(ArrowLeftIcon, { className: 'w-6 h-6' })),
      React.createElement('span', { className: 'font-bold text-lg tracking-tight' }, 'VedaAI'),
    ),
    React.createElement(
      'div',
      { className: 'flex items-center gap-4' },
      React.createElement(
        'button',
        { className: 'relative text-gray-600 p-1' },
        React.createElement(BellIcon, { className: 'w-6 h-6' }),
        React.createElement('span', { className: 'absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#FF5A36] border-2 border-white rounded-full' }),
      ),
      React.createElement(
        'div',
        { className: 'w-8 h-8 bg-gray-200 rounded-full overflow-hidden shrink-0' },
        React.createElement('img', { src: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Madhur', alt: 'Avatar', className: 'w-full h-full object-cover' }),
      ),
      React.createElement('button', { className: 'text-gray-700 p-1' }, React.createElement(MenuIcon, { className: 'w-6 h-6' })),
    ),
  );
}