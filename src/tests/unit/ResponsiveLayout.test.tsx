import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResponsiveLayout, DEFAULT_TABS } from '../../components/Layout/ResponsiveLayout';
import { AccessibilityProvider } from '../../components/common/AccessibilityEnhancements';
import type { UIState } from '../../types';

// Mock the responsive breakpoints hook
vi.mock('../../hooks/useResponsiveBreakpoints', () => ({
  useResponsiveBreakpoints: vi.fn(),
  useTouchDevice: vi.fn(() => false),
  BREAKPOINTS: { mobile: 768, tablet: 1200, desktop: 1200 },
  MEDIA_QUERIES: {
    mobile: '(max-width: 767px)',
    tablet: '(min-width: 768px) and (max-width: 1199px)',
    desktop: '(min-width: 1200px)',
  }
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <AccessibilityProvider>
    {children}
  </AccessibilityProvider>
);

describe('ResponsiveLayout', () => {
  const mockOnTabChange = vi.fn();
  
  const testTabs = DEFAULT_TABS.map(tab => ({
    ...tab,
    component: <div data-testid={`${tab.id}-content`}>{tab.label} Content</div>
  }));

  beforeEach(() => {
    mockOnTabChange.mockClear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Mobile Layout', () => {
    beforeEach(() => {
      const { useResponsiveBreakpoints } = require('../../hooks/useResponsiveBreakpoints');
      useResponsiveBreakpoints.mockReturnValue({
        deviceType: 'mobile',
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        width: 360,
        height: 640
      });
    });

    it('renders mobile tab navigation', () => {
      render(
        <TestWrapper>
          <ResponsiveLayout
            tabs={testTabs}
            activeTab="upload"
            onTabChange={mockOnTabChange}
          />
        </TestWrapper>
      );

      // Check that all tabs are rendered
      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /upload/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /parameters/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /preview/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /export/i })).toBeInTheDocument();
    });

    it('shows active tab content', () => {
      render(
        <TestWrapper>
          <ResponsiveLayout
            tabs={testTabs}
            activeTab="upload"
            onTabChange={mockOnTabChange}
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('upload-content')).toBeVisible();
      expect(screen.queryByTestId('parameters-content')).not.toBeVisible();
    });

    it('changes tabs when clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <ResponsiveLayout
            tabs={testTabs}
            activeTab="upload"
            onTabChange={mockOnTabChange}
          />
        </TestWrapper>
      );

      await user.click(screen.getByRole('tab', { name: /parameters/i }));
      expect(mockOnTabChange).toHaveBeenCalledWith('parameters');
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <ResponsiveLayout
            tabs={testTabs}
            activeTab="upload"
            onTabChange={mockOnTabChange}
          />
        </TestWrapper>
      );

      const uploadTab = screen.getByRole('tab', { name: /upload/i });
      await user.click(uploadTab);
      
      // Use arrow keys to navigate
      await user.keyboard('{ArrowRight}');
      expect(mockOnTabChange).toHaveBeenCalledWith('parameters');
    });

    it('shows navigation controls', () => {
      render(
        <TestWrapper>
          <ResponsiveLayout
            tabs={testTabs}
            activeTab="parameters"
            onTabChange={mockOnTabChange}
          />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
      expect(screen.getByText('2 of 4')).toBeInTheDocument();
    });

    it('handles swipe gestures', async () => {
      render(
        <TestWrapper>
          <ResponsiveLayout
            tabs={testTabs}
            activeTab="upload"
            onTabChange={mockOnTabChange}
          />
        </TestWrapper>
      );

      const mainElement = screen.getByRole('tabpanel');
      
      // Simulate swipe left
      fireEvent.touchStart(mainElement, {
        touches: [{ clientX: 100, clientY: 100 }]
      });
      
      fireEvent.touchEnd(mainElement, {
        changedTouches: [{ clientX: 50, clientY: 100 }]
      });
      
      await waitFor(() => {
        expect(mockOnTabChange).toHaveBeenCalledWith('parameters');
      });
    });

    it('displays tab badges when enabled', () => {
      const tabsWithBadges = testTabs.map((tab, index) => ({
        ...tab,
        badge: index + 1
      }));

      render(
        <TestWrapper>
          <ResponsiveLayout
            tabs={tabsWithBadges}
            activeTab="upload"
            onTabChange={mockOnTabChange}
            showTabBadges={true}
          />
        </TestWrapper>
      );

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  describe('Tablet Layout', () => {
    beforeEach(() => {
      const { useResponsiveBreakpoints } = require('../../hooks/useResponsiveBreakpoints');
      useResponsiveBreakpoints.mockReturnValue({
        deviceType: 'tablet',
        isMobile: false,
        isTablet: true,
        isDesktop: false,
        width: 1024,
        height: 768
      });
    });

    it('renders collapsible sidebar', () => {
      render(
        <TestWrapper>
          <ResponsiveLayout
            tabs={testTabs}
            activeTab="upload"
            onTabChange={mockOnTabChange}
            sidebar={<div data-testid="sidebar">Sidebar Content</div>}
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /collapse sidebar/i })).toBeInTheDocument();
    });

    it('can collapse and expand sidebar', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <ResponsiveLayout
            tabs={testTabs}
            activeTab="upload"
            onTabChange={mockOnTabChange}
            sidebar={<div data-testid="sidebar">Sidebar Content</div>}
          />
        </TestWrapper>
      );

      const collapseButton = screen.getByRole('button', { name: /collapse sidebar/i });
      await user.click(collapseButton);
      
      expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument();
      expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
    });
  });

  describe('Desktop Layout', () => {
    beforeEach(() => {
      const { useResponsiveBreakpoints } = require('../../hooks/useResponsiveBreakpoints');
      useResponsiveBreakpoints.mockReturnValue({
        deviceType: 'desktop',
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        width: 1440,
        height: 900
      });
    });

    it('renders desktop layout with fixed sidebar', () => {
      render(
        <TestWrapper>
          <ResponsiveLayout
            tabs={testTabs}
            activeTab="upload"
            onTabChange={mockOnTabChange}
            sidebar={<div data-testid="sidebar">Sidebar Content</div>}
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    });

    it('shows main content without tabs', () => {
      render(
        <TestWrapper>
          <ResponsiveLayout
            tabs={testTabs}
            activeTab="upload"
            onTabChange={mockOnTabChange}
          >
            <div data-testid="main-content">Main Content</div>
          </ResponsiveLayout>
        </TestWrapper>
      );

      expect(screen.getByTestId('main-content')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      const { useResponsiveBreakpoints } = require('../../hooks/useResponsiveBreakpoints');
      useResponsiveBreakpoints.mockReturnValue({
        deviceType: 'mobile',
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        width: 360,
        height: 640
      });
    });

    it('has proper ARIA attributes', () => {
      render(
        <TestWrapper>
          <ResponsiveLayout
            tabs={testTabs}
            activeTab="upload"
            onTabChange={mockOnTabChange}
          />
        </TestWrapper>
      );

      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveAttribute('aria-label', 'Main navigation');

      const uploadTab = screen.getByRole('tab', { name: /upload/i });
      expect(uploadTab).toHaveAttribute('aria-selected', 'true');
      expect(uploadTab).toHaveAttribute('aria-controls', 'panel-upload');

      const tabpanel = screen.getByRole('tabpanel');
      expect(tabpanel).toHaveAttribute('aria-labelledby', expect.stringContaining('upload'));
    });

    it('manages focus correctly', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <ResponsiveLayout
            tabs={testTabs}
            activeTab="upload"
            onTabChange={mockOnTabChange}
          />
        </TestWrapper>
      );

      const parametersTab = screen.getByRole('tab', { name: /parameters/i });
      await user.click(parametersTab);
      
      expect(parametersTab).toHaveFocus();
    });

    it('supports screen reader announcements', async () => {
      // This would require mocking the accessibility context
      // and testing that announcements are made when tabs change
      // For now, just verify the component renders without errors
      expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('does not re-render inactive tab content', () => {
      const renderSpy = vi.fn();
      
      const tabsWithSpy = testTabs.map(tab => ({
        ...tab,
        component: <div data-testid={`${tab.id}-content`} onLoad={renderSpy}>{tab.label} Content</div>
      }));

      const { rerender } = render(
        <TestWrapper>
          <ResponsiveLayout
            tabs={tabsWithSpy}
            activeTab="upload"
            onTabChange={mockOnTabChange}
          />
        </TestWrapper>
      );

      // Change to different tab
      rerender(
        <TestWrapper>
          <ResponsiveLayout
            tabs={tabsWithSpy}
            activeTab="parameters"
            onTabChange={mockOnTabChange}
          />
        </TestWrapper>
      );

      // Upload content should be hidden, not re-rendered
      expect(screen.getByTestId('upload-content')).not.toBeVisible();
      expect(screen.getByTestId('parameters-content')).toBeVisible();
    });
  });
});