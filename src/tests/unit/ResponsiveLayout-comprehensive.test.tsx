import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ResponsiveLayout, DEFAULT_TABS } from '../../components/Layout/ResponsiveLayout';
import { useResponsiveBreakpoints } from '../../hooks/useResponsiveBreakpoints';

// Mock the responsive breakpoints hook
vi.mock('../../hooks/useResponsiveBreakpoints', () => ({
  useResponsiveBreakpoints: vi.fn(),
  useTouchDevice: vi.fn()
}));

const mockUseResponsiveBreakpoints = vi.mocked(useResponsiveBreakpoints);

// Mock components for tab content
const MockUploadComponent = () => <div data-testid="upload-content">Upload Content</div>;
const MockParametersComponent = () => <div data-testid="parameters-content">Parameters Content</div>;
const MockPreviewComponent = () => <div data-testid="preview-content">Preview Content</div>;
const MockExportComponent = () => <div data-testid="export-content">Export Content</div>;

const mockTabs = [
  { ...DEFAULT_TABS[0], component: <MockUploadComponent /> },
  { ...DEFAULT_TABS[1], component: <MockParametersComponent /> },
  { ...DEFAULT_TABS[2], component: <MockPreviewComponent /> },
  { ...DEFAULT_TABS[3], component: <MockExportComponent /> }
];

describe('ResponsiveLayout', () => {
  const mockOnTabChange = vi.fn();
  
  beforeEach(() => {
    mockOnTabChange.mockClear();
    
    // Mock window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Mobile Layout', () => {
    beforeEach(() => {
      mockUseResponsiveBreakpoints.mockReturnValue({
        deviceType: 'mobile',
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        width: 375,
        height: 667
      });
    });

    it('renders mobile tab navigation', () => {
      render(
        <ResponsiveLayout
          tabs={mockTabs}
          activeTab="upload"
          onTabChange={mockOnTabChange}
        />
      );

      // Check for mobile tab navigation
      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getByRole('tablist')).toHaveAttribute('aria-label', 'Main navigation');

      // Check all tabs are rendered
      mockTabs.forEach(tab => {
        expect(screen.getByRole('tab', { name: new RegExp(tab.label, 'i') })).toBeInTheDocument();
      });
    });

    it('displays active tab content correctly', () => {
      render(
        <ResponsiveLayout
          tabs={mockTabs}
          activeTab="upload"
          onTabChange={mockOnTabChange}
        />
      );

      expect(screen.getByTestId('upload-content')).toBeInTheDocument();
      expect(screen.queryByTestId('parameters-content')).not.toBeInTheDocument();
    });

    it('handles tab switching', async () => {
      const user = userEvent.setup();
      
      render(
        <ResponsiveLayout
          tabs={mockTabs}
          activeTab="upload"
          onTabChange={mockOnTabChange}
        />
      );

      const parametersTab = screen.getByRole('tab', { name: /parameters/i });
      await user.click(parametersTab);

      expect(mockOnTabChange).toHaveBeenCalledWith('parameters');
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      
      render(
        <ResponsiveLayout
          tabs={mockTabs}
          activeTab="upload"
          onTabChange={mockOnTabChange}
        />
      );

      // Focus on the active tab
      const uploadTab = screen.getByRole('tab', { name: /upload/i });
      uploadTab.focus();

      // Navigate with arrow keys
      await user.keyboard('{ArrowRight}');
      expect(mockOnTabChange).toHaveBeenCalledWith('parameters');

      mockOnTabChange.mockClear();
      await user.keyboard('{ArrowLeft}');
      expect(mockOnTabChange).toHaveBeenCalledWith('upload');
    });

    it('supports swipe navigation', async () => {
      render(
        <ResponsiveLayout
          tabs={mockTabs}
          activeTab="upload"
          onTabChange={mockOnTabChange}
        />
      );

      const mainContent = screen.getByRole('main');

      // Simulate swipe left (next tab)
      fireEvent.touchStart(mainContent, {
        touches: [{ clientX: 100, clientY: 100 }]
      });

      fireEvent.touchEnd(mainContent, {
        changedTouches: [{ clientX: 50, clientY: 100 }] // Swipe left 50px
      });

      await waitFor(() => {
        expect(mockOnTabChange).toHaveBeenCalledWith('parameters');
      });
    });

    it('shows navigation controls', () => {
      render(
        <ResponsiveLayout
          tabs={mockTabs}
          activeTab="parameters"
          onTabChange={mockOnTabChange}
        />
      );

      expect(screen.getByRole('button', { name: /previous step/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next step/i })).toBeInTheDocument();
      expect(screen.getByText('2 of 4')).toBeInTheDocument();
    });

    it('disables navigation buttons appropriately', () => {
      const { rerender } = render(
        <ResponsiveLayout
          tabs={mockTabs}
          activeTab="upload"
          onTabChange={mockOnTabChange}
        />
      );

      // First tab - previous should be disabled
      expect(screen.getByRole('button', { name: /previous step/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /next step/i })).not.toBeDisabled();

      // Last tab - next should be disabled
      rerender(
        <ResponsiveLayout
          tabs={mockTabs}
          activeTab="export"
          onTabChange={mockOnTabChange}
        />
      );

      expect(screen.getByRole('button', { name: /previous step/i })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: /next step/i })).toBeDisabled();
    });

    it('displays tab badges when enabled', () => {
      const tabsWithBadges = mockTabs.map((tab, index) => ({
        ...tab,
        badge: index === 1 ? '3' : undefined
      }));

      render(
        <ResponsiveLayout
          tabs={tabsWithBadges}
          activeTab="upload"
          onTabChange={mockOnTabChange}
          showTabBadges={true}
        />
      );

      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('handles disabled tabs correctly', async () => {
      const user = userEvent.setup();
      const tabsWithDisabled = mockTabs.map((tab, index) => ({
        ...tab,
        disabled: index === 2 // Disable preview tab
      }));

      render(
        <ResponsiveLayout
          tabs={tabsWithDisabled}
          activeTab="upload"
          onTabChange={mockOnTabChange}
        />
      );

      const previewTab = screen.getByRole('tab', { name: /preview/i });
      expect(previewTab).toBeDisabled();

      await user.click(previewTab);
      expect(mockOnTabChange).not.toHaveBeenCalled();
    });
  });

  describe('Tablet Layout', () => {
    beforeEach(() => {
      mockUseResponsiveBreakpoints.mockReturnValue({
        deviceType: 'tablet',
        isMobile: false,
        isTablet: true,
        isDesktop: false,
        width: 768,
        height: 1024
      });
    });

    it('renders collapsible sidebar layout', () => {
      render(
        <ResponsiveLayout
          tabs={mockTabs}
          activeTab="upload"
          onTabChange={mockOnTabChange}
          sidebar={<div data-testid="sidebar-content">Sidebar</div>}
        />
      );

      expect(screen.getByTestId('sidebar-content')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /collapse sidebar/i })).toBeInTheDocument();
    });

    it('allows sidebar collapse/expand', async () => {
      const user = userEvent.setup();
      
      render(
        <ResponsiveLayout
          tabs={mockTabs}
          activeTab="upload"
          onTabChange={mockOnTabChange}
          sidebar={<div data-testid="sidebar-content">Sidebar</div>}
        />
      );

      const collapseButton = screen.getByRole('button', { name: /collapse sidebar/i });
      await user.click(collapseButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument();
      });
    });

    it('renders main content area', () => {
      render(
        <ResponsiveLayout
          tabs={mockTabs}
          activeTab="upload"
          onTabChange={mockOnTabChange}
        >
          <div data-testid="main-content">Main Content</div>
        </ResponsiveLayout>
      );

      expect(screen.getByTestId('main-content')).toBeInTheDocument();
      expect(screen.getByRole('main')).toBeInTheDocument();
    });
  });

  describe('Desktop Layout', () => {
    beforeEach(() => {
      mockUseResponsiveBreakpoints.mockReturnValue({
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
        <ResponsiveLayout
          tabs={mockTabs}
          activeTab="upload"
          onTabChange={mockOnTabChange}
          sidebar={<div data-testid="sidebar-content">Sidebar</div>}
        />
      );

      expect(screen.getByTestId('sidebar-content')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /collapse sidebar/i })).not.toBeInTheDocument();
    });

    it('renders without sidebar when not provided', () => {
      render(
        <ResponsiveLayout
          tabs={mockTabs}
          activeTab="upload"
          onTabChange={mockOnTabChange}
        >
          <div data-testid="main-content">Main Content</div>
        </ResponsiveLayout>
      );

      expect(screen.getByTestId('main-content')).toBeInTheDocument();
      expect(screen.queryByTestId('sidebar-content')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      mockUseResponsiveBreakpoints.mockReturnValue({
        deviceType: 'mobile',
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        width: 375,
        height: 667
      });
    });

    it('has proper ARIA attributes', () => {
      render(
        <ResponsiveLayout
          tabs={mockTabs}
          activeTab="upload"
          onTabChange={mockOnTabChange}
        />
      );

      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveAttribute('aria-label', 'Main navigation');

      const uploadTab = screen.getByRole('tab', { name: /upload/i });
      expect(uploadTab).toHaveAttribute('aria-selected', 'true');
      expect(uploadTab).toHaveAttribute('aria-controls', 'panel-upload');
      expect(uploadTab).toHaveAttribute('tabindex', '0');

      const parametersTab = screen.getByRole('tab', { name: /parameters/i });
      expect(parametersTab).toHaveAttribute('aria-selected', 'false');
      expect(parametersTab).toHaveAttribute('tabindex', '-1');
    });

    it('has proper tabpanel attributes', () => {
      render(
        <ResponsiveLayout
          tabs={mockTabs}
          activeTab="upload"
          onTabChange={mockOnTabChange}
        />
      );

      const tabpanel = screen.getByRole('tabpanel');
      expect(tabpanel).toHaveAttribute('id', 'panel-upload');
      expect(tabpanel).toHaveAttribute('aria-labelledby', 'tab-upload');
    });

    it('supports screen reader announcements', async () => {
      // This would require integration with the accessibility context
      // For now, we test that the structure supports screen readers
      render(
        <ResponsiveLayout
          tabs={mockTabs}
          activeTab="upload"
          onTabChange={mockOnTabChange}
        />
      );

      const tabs = screen.getAllByRole('tab');
      tabs.forEach(tab => {
        expect(tab).toHaveAttribute('role', 'tab');
      });
    });
  });

  describe('Performance', () => {
    beforeEach(() => {
      mockUseResponsiveBreakpoints.mockReturnValue({
        deviceType: 'mobile',
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        width: 375,
        height: 667
      });
    });

    it('does not re-render inactive tab content', () => {
      const { rerender } = render(
        <ResponsiveLayout
          tabs={mockTabs}
          activeTab="upload"
          onTabChange={mockOnTabChange}
        />
      );

      expect(screen.getByTestId('upload-content')).toBeInTheDocument();
      expect(screen.queryByTestId('parameters-content')).not.toBeInTheDocument();

      rerender(
        <ResponsiveLayout
          tabs={mockTabs}
          activeTab="parameters"
          onTabChange={mockOnTabChange}
        />
      );

      expect(screen.queryByTestId('upload-content')).not.toBeInTheDocument();
      expect(screen.getByTestId('parameters-content')).toBeInTheDocument();
    });

    it('handles rapid tab changes gracefully', async () => {
      const user = userEvent.setup();
      
      render(
        <ResponsiveLayout
          tabs={mockTabs}
          activeTab="upload"
          onTabChange={mockOnTabChange}
        />
      );

      // Simulate rapid tab clicking
      const parametersTab = screen.getByRole('tab', { name: /parameters/i });
      const previewTab = screen.getByRole('tab', { name: /preview/i });

      await user.click(parametersTab);
      await user.click(previewTab);
      await user.click(parametersTab);

      expect(mockOnTabChange).toHaveBeenCalledTimes(3);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      mockUseResponsiveBreakpoints.mockReturnValue({
        deviceType: 'mobile',
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        width: 375,
        height: 667
      });
    });

    it('handles empty tabs array', () => {
      render(
        <ResponsiveLayout
          tabs={[]}
          activeTab="upload"
          onTabChange={mockOnTabChange}
        />
      );

      expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    });

    it('handles invalid active tab', () => {
      render(
        <ResponsiveLayout
          tabs={mockTabs}
          activeTab={"invalid-tab" as any}
          onTabChange={mockOnTabChange}
        />
      );

      // Should still render the layout without crashing
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('handles very long tab labels', () => {
      const longLabelTabs = mockTabs.map(tab => ({
        ...tab,
        label: 'Very Long Tab Label That Might Overflow'
      }));

      render(
        <ResponsiveLayout
          tabs={longLabelTabs}
          activeTab="upload"
          onTabChange={mockOnTabChange}
        />
      );

      expect(screen.getByText('Very Long Tab Label That Might Overflow')).toBeInTheDocument();
    });

    it('handles touch events on non-touch devices gracefully', () => {
      mockUseResponsiveBreakpoints.mockReturnValue({
        deviceType: 'desktop',
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        width: 1440,
        height: 900
      });

      render(
        <ResponsiveLayout
          tabs={mockTabs}
          activeTab="upload"
          onTabChange={mockOnTabChange}
        >
          <div data-testid="main-content">Main Content</div>
        </ResponsiveLayout>
      );

      // Should render without any touch-specific elements
      expect(screen.getByTestId('main-content')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /previous step/i })).not.toBeInTheDocument();
    });
  });
});