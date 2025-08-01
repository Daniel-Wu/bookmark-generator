import React from 'react';
import { Header } from './Header';

interface LayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  className?: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, sidebar, className = '' }) => {
  return (
    <div className={`min-h-screen bg-slate-50 ${className}`}>
      <Header />

      <div className='flex'>
        {/* Desktop sidebar */}
        {sidebar && (
          <div className='hidden lg:block w-80 border-r border-gray-200 bg-white'>
            <div className='h-full overflow-y-auto'>{sidebar}</div>
          </div>
        )}

        {/* Main content */}
        <div className='flex-1 min-w-0'>
          <main className='h-full'>{children}</main>
        </div>
      </div>
    </div>
  );
};
