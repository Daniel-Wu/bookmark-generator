import { useState, useEffect } from 'react';

/**
 * Responsive breakpoint definitions
 */
export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1200,
  desktop: 1200
} as const;

export type BreakpointKey = keyof typeof BREAKPOINTS;
export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export interface ResponsiveState {
  deviceType: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  height: number;
}

/**
 * Custom hook for responsive breakpoint management
 * Provides real-time screen size information and device type detection
 */
export function useResponsiveBreakpoints(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>(() => {
    const width = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const height = typeof window !== 'undefined' ? window.innerHeight : 800;
    
    return {
      deviceType: getDeviceType(width),
      isMobile: width < BREAKPOINTS.mobile,
      isTablet: width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet,
      isDesktop: width >= BREAKPOINTS.desktop,
      width,
      height
    };
  });

  useEffect(() => {
    let timeoutId: number;

    const handleResize = () => {
      // Debounce resize events to avoid excessive re-renders
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        setState({
          deviceType: getDeviceType(width),
          isMobile: width < BREAKPOINTS.mobile,
          isTablet: width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet,
          isDesktop: width >= BREAKPOINTS.desktop,
          width,
          height
        });
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    
    // Handle orientation change on mobile devices
    window.addEventListener('orientationchange', () => {
      // Small delay to ensure dimensions are updated after orientation change
      setTimeout(handleResize, 150);
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  return state;
}

/**
 * Determines device type based on screen width
 */
function getDeviceType(width: number): DeviceType {
  if (width < BREAKPOINTS.mobile) return 'mobile';
  if (width < BREAKPOINTS.tablet) return 'tablet';
  return 'desktop';
}

/**
 * Hook for checking if screen matches specific breakpoint
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
    // Legacy browsers
    else {
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
  }, [query]);

  return matches;
}

/**
 * Hook for touch device detection
 */
export function useTouchDevice(): boolean {
  const [isTouchDevice, setIsTouchDevice] = useState(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  });

  useEffect(() => {
    // Update touch capability detection
    const hasTouchSupport = 'ontouchstart' in window || 
                           navigator.maxTouchPoints > 0 ||
                           'ontouchstart' in document.documentElement;
    
    setIsTouchDevice(hasTouchSupport);
  }, []);

  return isTouchDevice;
}

/**
 * Predefined media queries for common use cases
 */
export const MEDIA_QUERIES = {
  mobile: `(max-width: ${BREAKPOINTS.mobile - 1}px)`,
  tablet: `(min-width: ${BREAKPOINTS.mobile}px) and (max-width: ${BREAKPOINTS.tablet - 1}px)`,
  desktop: `(min-width: ${BREAKPOINTS.desktop}px)`,
  mobileUp: `(min-width: ${BREAKPOINTS.mobile}px)`,
  tabletUp: `(min-width: ${BREAKPOINTS.tablet}px)`,
  touchDevice: '(hover: none) and (pointer: coarse)',
  reducedMotion: '(prefers-reduced-motion: reduce)',
  highContrast: '(prefers-contrast: high)',
  darkMode: '(prefers-color-scheme: dark)'
} as const;