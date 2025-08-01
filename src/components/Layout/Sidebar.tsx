import React from 'react';

interface SidebarProps {
  children: React.ReactNode;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ children, className = '' }) => {
  return <div className={`p-6 space-y-6 ${className}`}>{children}</div>;
};
