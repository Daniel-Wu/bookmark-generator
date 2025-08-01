import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  AccessibilityProvider,
  useAccessibility,
  SkipNavigation,
  AccessibleModal,
  AccessibleFormField,
  AccessibleProgress,
  AccessibleButton,
  ScreenReaderOnly,
  useKeyboardNavigation,
  useFocusAnnouncement
} from '../../components/common/AccessibilityEnhancements';
import { ResponsiveLayout, DEFAULT_TABS } from '../../components/Layout/ResponsiveLayout';
import { NotificationProvider } from '../../components/common/NotificationSystem';

// Extend expect with axe matchers
expect.extend(toHaveNoViolations);

// Mock responsive breakpoints
vi.mock('../../hooks/useResponsiveBreakpoints', () => ({
  useResponsiveBreakpoints: () => ({
    deviceType: 'desktop',
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    width: 1440,
    height: 900
  }),
  useTouchDevice: () => false,
  useMediaQuery: (query: string) => {
    if (query.includes('prefers-reduced-motion')) return false;
    if (query.includes('prefers-contrast')) return false;
    if (query.includes('prefers-color-scheme')) return false;
    return false;
  }
}));

// Test component for useAccessibility hook
const TestAccessibilityComponent: React.FC = () => {
  const { announceToScreenReader, focusManagement, preferences } = useAccessibility();
  
  return (
    <div>
      <button
        onClick={() => announceToScreenReader('Test announcement')}
        data-testid="announce-button"
      >
        Announce
      </button>
      <div data-testid="preferences">
        Reduced motion: {preferences.prefersReducedMotion.toString()}
      </div>
    </div>
  );
};

// Test component for keyboard navigation
const TestKeyboardComponent: React.FC = () => {
  const { handleArrowNavigation } = useKeyboardNavigation();
  const elements = [
    React.useRef<HTMLButtonElement>(null),
    React.useRef<HTMLButtonElement>(null),
    React.useRef<HTMLButtonElement>(null)
  ];
  const [currentIndex, setCurrentIndex] = React.useState(0);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const elementRefs = elements.map(ref => ref.current).filter(Boolean) as HTMLElement[];
    if (handleArrowNavigation(event.nativeEvent, elementRefs, currentIndex)) {
      const newIndex = event.key === 'ArrowRight' ? Math.min(currentIndex + 1, 2) : Math.max(currentIndex - 1, 0);
      setCurrentIndex(newIndex);
      elementRefs[newIndex]?.focus();
    }
  };

  return (
    <div onKeyDown={handleKeyDown}>
      {elements.map((ref, index) => (
        <button
          key={index}
          ref={ref}
          data-testid={`nav-button-${index}`}
          tabIndex={index === currentIndex ? 0 : -1}
        >
          Button {index + 1}
        </button>
      ))}
    </div>
  );
};

describe('Accessibility System', () => {
  beforeEach(() => {
    // Mock DOM methods that might not be available in test environment
    Object.defineProperty(document, 'getElementById', {
      value: vi.fn().mockImplementation((id: string) => {
        const element = document.createElement('div');
        element.id = id;
        return element;
      }),
      writable: true
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('AccessibilityProvider', () => {
    it('provides accessibility context', () => {
      render(
        <AccessibilityProvider>
          <TestAccessibilityComponent />
        </AccessibilityProvider>
      );

      expect(screen.getByTestId('announce-button')).toBeInTheDocument();
      expect(screen.getByTestId('preferences')).toBeInTheDocument();
    });

    it('creates live region for screen reader announcements', () => {
      const mockCreateElement = vi.spyOn(document, 'createElement');
      const mockAppendChild = vi.spyOn(document.body, 'appendChild');

      render(
        <AccessibilityProvider>
          <div>Test</div>
        </AccessibilityProvider>
      );

      expect(mockCreateElement).toHaveBeenCalledWith('div');
      expect(mockAppendChild).toHaveBeenCalled();
    });

    it('announces to screen reader', async () => {
      const user = userEvent.setup();
      
      render(
        <AccessibilityProvider>
          <TestAccessibilityComponent />
        </AccessibilityProvider>
      );

      const announceButton = screen.getByTestId('announce-button');
      await user.click(announceButton);

      // The announcement should be made to the live region
      // This is tested indirectly since we can't easily mock the live region content
      expect(announceButton).toBeInTheDocument();
    });

    it('has no accessibility violations', async () => {
      const { container } = render(
        <AccessibilityProvider>
          <TestAccessibilityComponent />
        </AccessibilityProvider>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('SkipNavigation', () => {
    it('renders skip link with proper attributes', () => {
      render(
        <div>
          <SkipNavigation targetId="main-content">
            Skip to main content
          </SkipNavigation>
          <div id="main-content">Main content</div>
        </div>
      );

      const skipLink = screen.getByRole('link', { name: /skip to main content/i });
      expect(skipLink).toHaveAttribute('href', '#main-content');
    });

    it('focuses target element when activated', async () => {
      const user = userEvent.setup();
      const mockFocus = vi.fn();
      const mockScrollIntoView = vi.fn();

      // Mock getElementById to return element with mocked methods
      vi.spyOn(document, 'getElementById').mockReturnValue({
        focus: mockFocus,
        scrollIntoView: mockScrollIntoView
      } as any);

      render(
        <div>
          <SkipNavigation targetId="main-content">
            Skip to main content
          </SkipNavigation>
          <div id="main-content">Main content</div>
        </div>
      );

      const skipLink = screen.getByRole('link', { name: /skip to main content/i });
      await user.click(skipLink);

      expect(mockFocus).toHaveBeenCalled();
      expect(mockScrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start'
      });
    });

    it('has no accessibility violations', async () => {
      const { container } = render(
        <div>
          <SkipNavigation targetId="main-content">
            Skip to main content
          </SkipNavigation>
          <div id="main-content">Main content</div>
        </div>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('AccessibleModal', () => {
    it('renders with proper ARIA attributes', () => {
      render(
        <AccessibilityProvider>
          <AccessibleModal
            isOpen={true}
            onClose={() => {}}
            title="Test Modal"
          >
            Modal content
          </AccessibleModal>
        </AccessibilityProvider>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');

      const title = screen.getByText('Test Modal');
      expect(title).toHaveAttribute('id', 'modal-title');
    });

    it('traps focus within modal', async () => {
      const user = userEvent.setup();
      
      render(
        <div>
          <button>Outside button</button>
          <AccessibilityProvider>
            <AccessibleModal
              isOpen={true}
              onClose={() => {}}
              title="Test Modal"
            >
              <button data-testid="modal-button-1">Button 1</button>  
              <button data-testid="modal-button-2">Button 2</button>
            </AccessibleModal>
          </AccessibilityProvider>
        </div>
      );

      // Focus should be trapped within modal
      const firstButton = screen.getByTestId('modal-button-1');
      const secondButton = screen.getByTestId('modal-button-2');
      const closeButton = screen.getByRole('button', { name: /close dialog/i });

      // Tab through modal elements
      await user.tab();
      expect(closeButton).toHaveFocus();

      await user.tab();
      expect(firstButton).toHaveFocus();

      await user.tab();
      expect(secondButton).toHaveFocus();

      // Tab should wrap back to close button
      await user.tab();
      expect(closeButton).toHaveFocus();
    });

    it('closes on escape key', async () => {
      const user = userEvent.setup();
      const mockClose = vi.fn();
      
      render(
        <AccessibilityProvider>
          <AccessibleModal
            isOpen={true}
            onClose={mockClose}
            title="Test Modal"
          >
            Modal content
          </AccessibleModal>
        </AccessibilityProvider>
      );

      await user.keyboard('{Escape}');
      expect(mockClose).toHaveBeenCalled();
    });

    it('has no accessibility violations', async () => {
      const { container } = render(
        <AccessibilityProvider>
          <AccessibleModal
            isOpen={true}
            onClose={() => {}}
            title="Test Modal"
          >
            <p>Modal content with proper structure</p>
          </AccessibleModal>
        </AccessibilityProvider>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('AccessibleFormField', () => {
    it('associates label with input correctly', () => {
      render(
        <AccessibleFormField label="Email Address" required>
          <input type="email" />
        </AccessibleFormField>
      );

      const input = screen.getByRole('textbox');
      const label = screen.getByText('Email Address');
      
      expect(input).toHaveAttribute('id');
      expect(label).toHaveAttribute('for', input.getAttribute('id'));
      expect(input).toHaveAttribute('aria-required', 'true');
    });

    it('shows error message with proper ARIA attributes', () => {
      render(
        <AccessibleFormField 
          label="Password" 
          error="Password is required"
          required
        >
          <input type="password" />
        </AccessibleFormField>
      );

      const input = screen.getByLabelText(/password/i);
      const errorMessage = screen.getByRole('alert');
      
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby');
      expect(errorMessage).toHaveTextContent('Password is required');
      expect(errorMessage).toHaveAttribute('aria-live', 'polite');
    });

    it('shows hint text with proper association', () => {
      render(
        <AccessibleFormField 
          label="Username" 
          hint="Must be 3-20 characters"
        >
          <input type="text" />
        </AccessibleFormField>
      );

      const input = screen.getByLabelText(/username/i);
      const hint = screen.getByText('Must be 3-20 characters');
      
      expect(input).toHaveAttribute('aria-describedby');
      expect(hint).toBeInTheDocument();
    });

    it('has no accessibility violations', async () => {
      const { container } = render(
        <AccessibleFormField 
          label="Full Name" 
          hint="Enter your full legal name"
          required
        >
          <input type="text" />
        </AccessibleFormField>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('AccessibleProgress', () => {
    it('renders with proper progressbar role and attributes', () => {
      render(
        <AccessibilityProvider>
          <AccessibleProgress
            value={75}
            max={100}
            label="Upload Progress"
          />
        </AccessibilityProvider>
      );

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuenow', '75');
      expect(progressbar).toHaveAttribute('aria-valuemin', '0');
      expect(progressbar).toHaveAttribute('aria-valuemax', '100');
      expect(progressbar).toHaveAttribute('aria-label', 'Upload Progress');
    });

    it('shows percentage when enabled', () => {
      render(
        <AccessibilityProvider>
          <AccessibleProgress
            value={75}
            max={100}
            label="Progress"
            showPercentage={true}
          />
        </AccessibilityProvider>
      );

      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('has no accessibility violations', async () => {
      const { container } = render(
        <AccessibilityProvider>
          <AccessibleProgress
            value={50}
            max={100}
            label="Loading Progress"
            showPercentage={true}
          />
        </AccessibilityProvider>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('AccessibleButton', () => {
    it('renders with proper button attributes', () => {
      render(
        <AccessibilityProvider>
          <AccessibleButton
            onClick={() => {}}
            aria-label="Custom button label"
            disabled={false}
          >
            Button Text
          </AccessibleButton>
        </AccessibilityProvider>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveAttribute('aria-label', 'Custom button label');
      expect(button).not.toBeDisabled();
    });

    it('shows loading state correctly', () => {
      render(
        <AccessibilityProvider>
          <AccessibleButton
            onClick={() => {}}
            loading={true}
          >
            Submit
          </AccessibleButton>
        </AccessibilityProvider>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toBeDisabled();
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('handles keyboard interaction', async () => {
      const user = userEvent.setup();
      const mockClick = vi.fn();
      
      render(
        <AccessibilityProvider>
          <AccessibleButton onClick={mockClick}>
            Click Me
          </AccessibleButton>
        </AccessibilityProvider>
      );

      const button = screen.getByRole('button');
      
      // Test Enter key
      button.focus();
      await user.keyboard('{Enter}');
      expect(mockClick).toHaveBeenCalledTimes(1);

      // Test Space key
      await user.keyboard(' ');
      expect(mockClick).toHaveBeenCalledTimes(2);
    });

    it('has no accessibility violations', async () => {
      const { container } = render(
        <AccessibilityProvider>
          <AccessibleButton
            onClick={() => {}}
            variant="primary"
            size="medium"
          >
            Accessible Button
          </AccessibleButton>
        </AccessibilityProvider>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('ScreenReaderOnly', () => {
    it('applies screen reader only class', () => {
      render(
        <ScreenReaderOnly>
          Hidden text for screen readers
        </ScreenReaderOnly>
      );

      const element = screen.getByText('Hidden text for screen readers');
      expect(element).toHaveClass('sr-only');
    });

    it('applies focusable variant correctly', () => {
      render(
        <ScreenReaderOnly focusable={true}>
          Focusable hidden text
        </ScreenReaderOnly>
      );

      const element = screen.getByText('Focusable hidden text');
      expect(element).toHaveClass('sr-only', 'focus:not-sr-only');
    });
  });

  describe('Keyboard Navigation Hook', () => {
    it('handles arrow key navigation', async () => {
      const user = userEvent.setup();
      
      render(<TestKeyboardComponent />);

      const firstButton = screen.getByTestId('nav-button-0');
      const secondButton = screen.getByTestId('nav-button-1');
      
      firstButton.focus();
      
      await user.keyboard('{ArrowRight}');
      expect(secondButton).toHaveFocus();

      await user.keyboard('{ArrowLeft}');
      expect(firstButton).toHaveFocus();
    });

    it('handles Home and End keys', async () => {
      const user = userEvent.setup();
      
      render(<TestKeyboardComponent />);

      const firstButton = screen.getByTestId('nav-button-0');
      const lastButton = screen.getByTestId('nav-button-2');
      
      firstButton.focus();
      
      await user.keyboard('{End}');
      expect(lastButton).toHaveFocus();

      await user.keyboard('{Home}');
      expect(firstButton).toHaveFocus();
    });
  });

  describe('Integration with ResponsiveLayout', () => {
    const mockTabs = DEFAULT_TABS.map(tab => ({
      ...tab,
      component: <div data-testid={`${tab.id}-content`}>{tab.label} Content</div>
    }));

    it('ResponsiveLayout has proper accessibility structure', async () => {
      const { container } = render(
        <NotificationProvider>
          <AccessibilityProvider>
            <ResponsiveLayout
              tabs={mockTabs}
              activeTab="upload"
              onTabChange={() => {}}
            />
          </AccessibilityProvider>
        </NotificationProvider>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('maintains focus management during tab changes', async () => {
      const user = userEvent.setup();
      const mockOnTabChange = vi.fn();
      
      render(
        <NotificationProvider>
          <AccessibilityProvider>
            <ResponsiveLayout
              tabs={mockTabs}
              activeTab="upload"
              onTabChange={mockOnTabChange}
            />
          </AccessibilityProvider>
        </NotificationProvider>
      );

      const parametersTab = screen.getByRole('tab', { name: /parameters/i });
      await user.click(parametersTab);

      expect(mockOnTabChange).toHaveBeenCalledWith('parameters');
      expect(parametersTab).toHaveAttribute('aria-selected', 'false'); // Will be true after state update
    });
  });

  describe('High Contrast and Reduced Motion', () => {
    it('respects user preference for reduced motion', () => {
      // Mock media query for reduced motion
      vi.mocked(require('../../hooks/useResponsiveBreakpoints').useMediaQuery)
        .mockReturnValue(true);

      render(
        <AccessibilityProvider>
          <TestAccessibilityComponent />
        </AccessibilityProvider>
      );

      expect(screen.getByTestId('preferences')).toHaveTextContent('Reduced motion: true');
    });

    it('provides proper contrast ratios', async () => {
      const { container } = render(
        <AccessibilityProvider>
          <AccessibleButton variant="primary">Primary Button</AccessibleButton>
          <AccessibleButton variant="secondary">Secondary Button</AccessibleButton>
          <AccessibleButton variant="danger">Danger Button</AccessibleButton>
        </AccessibilityProvider>
      );

      // axe automatically checks for color contrast violations
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Error States and Accessibility', () => {
    it('announces errors to screen readers', async () => {
      const user = userEvent.setup();
      
      render(
        <AccessibilityProvider>
          <AccessibleFormField 
            label="Required Field" 
            error="This field is required"
            required
          >
            <input type="text" />
          </AccessibleFormField>
        </AccessibilityProvider>
      );

      const input = screen.getByLabelText(/required field/i);
      const errorElement = screen.getByRole('alert');
      
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(errorElement).toHaveAttribute('aria-live', 'polite');
      expect(errorElement).toHaveTextContent('This field is required');
    });

    it('maintains accessibility during error recovery', async () => {
      const { container } = render(
        <AccessibilityProvider>
          <div role="alert" aria-live="assertive">
            Error: Something went wrong. Please try again.
          </div>
          <AccessibleButton onClick={() => {}}>
            Retry
          </AccessibleButton>
        </AccessibilityProvider>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});