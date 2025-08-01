import React, { useState, useCallback, useEffect } from 'react';
import { useResponsiveBreakpoints } from '../../hooks/useResponsiveBreakpoints';
import { Header } from './Header';
import type { UIState } from '../../types';

interface TabConfig {
  id: UIState['activeTab'];
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  component: React.ReactNode;
  disabled?: boolean;
  badge?: string | number;
}

interface ResponsiveLayoutProps {
  children?: React.ReactNode;
  tabs: TabConfig[];
  activeTab: UIState['activeTab'];
  onTabChange: (tab: UIState['activeTab']) => void;
  sidebar?: React.ReactNode;
  className?: string;
  showTabBadges?: boolean;
}

// Tab Icons
const UploadIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const ParametersIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
  </svg>
);

const PreviewIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const ExportIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const ChevronLeftIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const ChevronRightIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  tabs,
  activeTab,
  onTabChange,
  sidebar,
  className = '',
  showTabBadges = true
}) => {
  const { isMobile, isTablet } = useResponsiveBreakpoints();
  const [sidebarVisible, setSidebarVisible] = useState(!isMobile);
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.metaKey) {
        const tabNumbers = ['1', '2', '3', '4'];
        const pressedNumber = tabNumbers.indexOf(event.key);
        
        if (pressedNumber !== -1 && tabs[pressedNumber]) {
          event.preventDefault();
          onTabChange(tabs[pressedNumber].id);
        }
      }
      
      // Arrow key navigation
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const currentIndex = tabs.findIndex(tab => tab.id === activeTab);
        if (currentIndex !== -1) {
          const direction = event.key === 'ArrowRight' ? 1 : -1;
          const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
          const nextTab = tabs[nextIndex];
          
          if (nextTab && !nextTab.disabled) {
            event.preventDefault();
            onTabChange(nextTab.id);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, tabs, onTabChange]);

  // Touch/swipe navigation for mobile
  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    if (!isMobile) return;
    setSwipeStartX(event.touches[0].clientX);
  }, [isMobile]);

  const handleTouchEnd = useCallback((event: React.TouchEvent) => {
    if (!isMobile || swipeStartX === null) return;
    
    const swipeEndX = event.changedTouches[0].clientX;
    const swipeDistance = swipeStartX - swipeEndX;
    const minSwipeDistance = 50;
    
    if (Math.abs(swipeDistance) > minSwipeDistance) {
      const currentIndex = tabs.findIndex(tab => tab.id === activeTab);
      
      if (swipeDistance > 0) {
        // Swipe left - next tab
        const nextIndex = Math.min(currentIndex + 1, tabs.length - 1);
        const nextTab = tabs[nextIndex];
        if (nextTab && !nextTab.disabled) {
          onTabChange(nextTab.id);
        }
      } else {
        // Swipe right - previous tab
        const prevIndex = Math.max(currentIndex - 1, 0);
        const prevTab = tabs[prevIndex];
        if (prevTab && !prevTab.disabled) {
          onTabChange(prevTab.id);
        }
      }
    }
    
    setSwipeStartX(null);
  }, [isMobile, swipeStartX, activeTab, tabs, onTabChange]);

  // const _togglePanelCollapse = useCallback((panelId: string) => {
  //   setCollapsedPanels(prev => {
  //     const newSet = new Set(prev);
  //     if (newSet.has(panelId)) {
  //       newSet.delete(panelId);
  //     } else {
  //       newSet.add(panelId);
  //     }
  //     return newSet;
  //   });
  // }, []);

  const currentTabIndex = tabs.findIndex(tab => tab.id === activeTab);
  // const _currentTab = tabs[currentTabIndex];
  const canGoPrevious = currentTabIndex > 0;
  const canGoNext = currentTabIndex < tabs.length - 1;

  const previousTab = () => {
    if (canGoPrevious) {
      const prevTab = tabs[currentTabIndex - 1];
      if (!prevTab.disabled) {
        onTabChange(prevTab.id);
      }
    }
  };

  const nextTab = () => {
    if (canGoNext) {
      const nextTab = tabs[currentTabIndex + 1];
      if (!nextTab.disabled) {
        onTabChange(nextTab.id);
      }
    }
  };

  if (isMobile) {
    return (
      <div className={`min-h-screen bg-slate-50 flex flex-col ${className}`}>
        <Header />
        
        {/* Mobile Tab Navigation */}
        <nav 
          className="bg-white border-b border-gray-200 overflow-x-auto"
          role="tablist"
          aria-label="Main navigation"
        >
          <div className="flex">
            {tabs.map((tab, _index) => {
              const isActive = tab.id === activeTab;
              const Icon = tab.icon;
              
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`panel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  disabled={tab.disabled}
                  onClick={() => onTabChange(tab.id)}
                  className={`
                    flex-1 min-w-0 px-3 py-4 text-sm font-medium text-center border-b-2 transition-all duration-200
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset
                    ${isActive 
                      ? 'border-blue-500 text-blue-600 bg-blue-50' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                    ${tab.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  <div className="flex flex-col items-center space-y-1">
                    <div className="relative">
                      <Icon className="w-5 h-5" />
                      {showTabBadges && tab.badge && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1">
                          {tab.badge}
                        </span>
                      )}
                    </div>
                    <span className="truncate w-full">{tab.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Mobile Tab Content */}
        <main 
          className="flex-1 overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {tabs.map(tab => (
            <div
              key={tab.id}
              id={`panel-${tab.id}`}
              role="tabpanel"
              aria-labelledby={`tab-${tab.id}`}
              className={`h-full ${tab.id === activeTab ? 'block' : 'hidden'}`}
            >
              {tab.component}
            </div>
          ))}
        </main>

        {/* Mobile Navigation Controls */}
        <div className="bg-white border-t border-gray-200 px-4 py-2 flex justify-between items-center">
          <button
            onClick={previousTab}
            disabled={!canGoPrevious}
            className={`
              flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
              ${canGoPrevious 
                ? 'text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500' 
                : 'text-gray-400 cursor-not-allowed'
              }
            `}
            aria-label="Previous step"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <div className="text-sm text-gray-500">
            {currentTabIndex + 1} of {tabs.length}
          </div>

          <button
            onClick={nextTab}
            disabled={!canGoNext}
            className={`
              flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
              ${canGoNext 
                ? 'text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500' 
                : 'text-gray-400 cursor-not-allowed'
              }
            `}
            aria-label="Next step"
          >
            <span>Next</span>
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Tablet Layout
  if (isTablet) {
    return (
      <div className={`min-h-screen bg-slate-50 ${className}`}>
        <Header />
        
        <div className="flex h-[calc(100vh-4rem)]">
          {/* Collapsible Sidebar */}
          <div className={`
            bg-white border-r border-gray-200 transition-all duration-300 ease-in-out
            ${sidebarVisible ? 'w-80' : 'w-12'}
          `}>
            <div className="h-full flex flex-col">
              <button
                onClick={() => setSidebarVisible(!sidebarVisible)}
                className="p-3 hover:bg-gray-50 border-b border-gray-200 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label={sidebarVisible ? "Collapse sidebar" : "Expand sidebar"}
              >
                {sidebarVisible ? (
                  <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
                ) : (
                  <ChevronRightIcon className="w-5 h-5 text-gray-600" />
                )}
              </button>
              
              {sidebarVisible && (
                <div className="flex-1 overflow-y-auto">
                  {sidebar}
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <main className="h-full p-6">
              {children}
            </main>
          </div>
        </div>
      </div>
    );
  }

  // Desktop Layout (default)
  return (
    <div className={`min-h-screen bg-slate-50 ${className}`}>
      <Header />
      
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Desktop Sidebar */}
        {sidebar && (
          <div className="w-80 border-r border-gray-200 bg-white">
            <div className="h-full overflow-y-auto">
              {sidebar}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <main className="h-full p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

/**
 * Hook for managing responsive layout state
 */
export function useResponsiveLayoutState() {
  const { deviceType } = useResponsiveBreakpoints();
  const [activeTab, setActiveTab] = useState<UIState['activeTab']>('upload');
  const [collapsedPanels, setCollapsedPanels] = useState<Set<string>>(new Set());

  const togglePanelCollapse = useCallback((panelId: string) => {
    setCollapsedPanels(prev => {
      const newSet = new Set(prev);
      if (newSet.has(panelId)) {
        newSet.delete(panelId);
      } else {
        newSet.add(panelId);
      }
      return newSet;
    });
  }, []);

  const isPanelCollapsed = useCallback((panelId: string) => {
    return collapsedPanels.has(panelId);
  }, [collapsedPanels]);

  return {
    deviceType,
    activeTab,
    setActiveTab,
    collapsedPanels,
    togglePanelCollapse,
    isPanelCollapsed
  };
}

/**
 * Default tab configuration
 */
export const DEFAULT_TABS: TabConfig[] = [
  {
    id: 'upload',
    label: 'Upload',
    icon: UploadIcon,
    component: null // Will be populated by parent
  },
  {
    id: 'parameters',
    label: 'Parameters',
    icon: ParametersIcon,
    component: null
  },
  {
    id: 'preview',
    label: 'Preview',
    icon: PreviewIcon,
    component: null
  },
  {
    id: 'export',
    label: 'Export',
    icon: ExportIcon,
    component: null
  }
];

export default ResponsiveLayout;