import React from 'react';
import { APP_NAME } from '../../constants';

interface HeaderProps {
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({ className = '' }) => {
  return (
    <header className={`bg-white border-b border-gray-200 ${className}`}>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex items-center justify-between h-16'>
          {/* Logo and title */}
          <div className='flex items-center space-x-3'>
            <div className='text-2xl'>📖</div>
            <h1 className='text-xl font-semibold text-gray-900'>{APP_NAME}</h1>
          </div>

          {/* Navigation */}
          <nav className='hidden md:flex items-center space-x-6'>
            <a href='#help' className='text-gray-600 hover:text-gray-900 transition-colors'>
              Help
            </a>
            <a href='#about' className='text-gray-600 hover:text-gray-900 transition-colors'>
              About
            </a>
            <a
              href='https://github.com'
              target='_blank'
              rel='noopener noreferrer'
              className='text-gray-600 hover:text-gray-900 transition-colors'
            >
              GitHub
            </a>
          </nav>

          {/* Mobile menu button */}
          <button className='md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100'>
            <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M4 6h16M4 12h16M4 18h16'
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
};
