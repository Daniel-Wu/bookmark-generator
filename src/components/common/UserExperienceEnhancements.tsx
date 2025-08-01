import React, { useState, useCallback, useEffect, useRef, createContext, useContext } from 'react';
import { useAccessibility } from './AccessibilityEnhancements';
import { useNotifications } from './NotificationSystem';
import { AccessibleModal } from './AccessibilityEnhancements';

// ========================
// User Experience Context
// ========================

interface UserAction {
  id: string;
  type: string;
  timestamp: number;
  data: any;
  description: string;
}

interface UXContextType {
  // Onboarding
  showOnboarding: () => void;
  completeOnboarding: () => void;
  isOnboardingComplete: boolean;
  
  // Help System
  showHelp: (context?: string) => void;
  hideHelp: () => void;
  isHelpVisible: boolean;
  
  // Undo/Redo
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  addAction: (action: Omit<UserAction, 'id' | 'timestamp'>) => void;
  
  // Auto-save
  enableAutoSave: boolean;
  setEnableAutoSave: (enabled: boolean) => void;
  lastSaveTime: number | null;
  
  // User Preferences
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
}

interface UserPreferences {
  showTooltips: boolean;
  enableKeyboardShortcuts: boolean;
  autoSaveInterval: number; // minutes
  showPerformanceMonitor: boolean;
  preferReducedMotion: boolean;
  theme: 'light' | 'dark' | 'auto';
  language: string;
}

const UXContext = createContext<UXContextType | null>(null);

export function useUserExperience() {
  const context = useContext(UXContext);
  if (!context) {
    throw new Error('useUserExperience must be used within a UXProvider');
  }
  return context;
}

// ========================
// Onboarding System
// ========================

interface OnboardingStep {
  id: string;
  title: string;
  content: React.ReactNode;
  target?: string; // CSS selector for element to highlight
  position?: 'top' | 'bottom' | 'left' | 'right';
  canSkip?: boolean;
  isOptional?: boolean;
}

interface OnboardingProps {
  isVisible: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Bookmark Generator!',
    content: (
      <div>
        <p className="mb-4">Create beautiful 3D bookmarks from your favorite images.</p>
        <p className="mb-4">This quick tour will show you the main features.</p>
        <ul className="list-disc list-inside space-y-2 text-sm text-gray-600">
          <li>Upload and crop images</li>
          <li>Adjust 3D parameters</li>
          <li>Preview in real-time</li>
          <li>Export for 3D printing</li>
        </ul>
      </div>
    ),
    canSkip: true
  },
  {
    id: 'upload',
    title: 'Upload Your Image',
    content: (
      <div>
        <p className="mb-4">Start by uploading an image you'd like to turn into a bookmark.</p>
        <p className="mb-2">Supported formats:</p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
          <li>PNG, JPEG, GIF, WebP</li>
          <li>Max file size: 10MB</li>
          <li>Best results with high contrast images</li>
        </ul>
      </div>
    ),
    target: '[data-tour="upload-area"]',
    position: 'bottom'
  },
  {
    id: 'parameters',
    title: 'Customize Parameters',
    content: (
      <div>
        <p className="mb-4">Adjust the 3D properties of your bookmark:</p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
          <li><strong>Colors:</strong> How many color layers (2-8)</li>
          <li><strong>Thickness:</strong> Layer height in millimeters</li>
          <li><strong>Dimensions:</strong> Final bookmark size</li>
          <li><strong>Corner radius:</strong> Rounded corners</li>
        </ul>
      </div>
    ),
    target: '[data-tour="parameters-panel"]',
    position: 'left'
  },
  {
    id: 'preview',
    title: '3D Preview',
    content: (
      <div>
        <p className="mb-4">See your bookmark in real-time 3D preview:</p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
          <li>Rotate with mouse/touch drag</li>
          <li>Zoom with mouse wheel/pinch</li>
          <li>Toggle layer visibility</li>
          <li>Change render modes</li>
        </ul>
      </div>
    ),
    target: '[data-tour="preview-area"]',
    position: 'top'
  },
  {
    id: 'export',
    title: 'Export for 3D Printing',
    content: (
      <div>
        <p className="mb-4">When you're happy with your design, export it:</p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
          <li><strong>STL:</strong> Standard 3D printing format</li>
          <li><strong>3MF:</strong> Multi-color format (preserves colors)</li>
          <li>Quality validation before export</li>
          <li>Estimated print time and material usage</li>
        </ul>
      </div>
    ),
    target: '[data-tour="export-panel"]',
    position: 'left'
  }
];

export const OnboardingTour: React.FC<OnboardingProps> = ({
  isVisible,
  onComplete,
  onSkip
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);
  const { announceToScreenReader } = useAccessibility();

  const step = ONBOARDING_STEPS[currentStep];
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

  useEffect(() => {
    if (isVisible && step?.target) {
      const element = document.querySelector(step.target) as HTMLElement;
      if (element) {
        setHighlightedElement(element);
        element.classList.add('onboarding-highlight');
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        announceToScreenReader(`Step ${currentStep + 1} of ${ONBOARDING_STEPS.length}: ${step.title}`);
      }
    }

    return () => {
      if (highlightedElement) {
        highlightedElement.classList.remove('onboarding-highlight');
      }
    };
  }, [currentStep, isVisible, step, highlightedElement, announceToScreenReader]);

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    if (highlightedElement) {
      highlightedElement.classList.remove('onboarding-highlight');
    }
    onSkip();
  };

  if (!isVisible || !step) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" />
      
      {/* Tour Dialog */}
      <div className="fixed z-50 max-w-md bg-white rounded-lg shadow-xl p-6" style={{
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      }}>
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {step.title}
          </h2>
          <div className="text-sm text-gray-500">
            {currentStep + 1} / {ONBOARDING_STEPS.length}
          </div>
        </div>

        <div className="mb-6">
          {step.content}
        </div>

        <div className="flex justify-between items-center">
          <div className="flex space-x-2">
            {currentStep > 0 && (
              <button
                onClick={handlePrevious}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Previous
              </button>
            )}
            
            {step.canSkip && (
              <button
                onClick={handleSkip}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Skip Tour
              </button>
            )}
          </div>

          <button
            onClick={handleNext}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            {isLastStep ? 'Get Started' : 'Next'}
          </button>
        </div>

        {/* Progress indicator */}
        <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / ONBOARDING_STEPS.length) * 100}%` }}
          />
        </div>
      </div>
    </>
  );
};

// ========================
// Context-Sensitive Help System
// ========================

interface HelpContent {
  title: string;
  content: React.ReactNode;
  shortcuts?: Array<{ key: string; description: string }>;
  tips?: string[];
}

const HELP_CONTENT: Record<string, HelpContent> = {
  upload: {
    title: 'Image Upload Help',
    content: (
      <div>
        <p className="mb-4">Upload an image to create your 3D bookmark.</p>
        <h4 className="font-medium mb-2">Best Practices:</h4>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 mb-4">
          <li>Use high-contrast images for better layer separation</li>
          <li>Avoid images with too many fine details</li>
          <li>Square or portrait orientations work best</li>
          <li>File size should be under 10MB</li>
        </ul>
      </div>
    ),
    shortcuts: [
      { key: 'Ctrl+O', description: 'Open file dialog' },
      { key: 'Ctrl+V', description: 'Paste image from clipboard' }
    ],
    tips: [
      'Try black and white images first - they often produce the best results',
      'You can drag and drop files directly onto the upload area'
    ]
  },
  parameters: {
    title: 'Parameter Adjustment Help',
    content: (
      <div>
        <p className="mb-4">Fine-tune your bookmark's 3D properties.</p>
        <div className="space-y-3">
          <div>
            <h4 className="font-medium">Color Count (2-8)</h4>
            <p className="text-sm text-gray-600">More colors = more detail but longer processing time</p>
          </div>
          <div>
            <h4 className="font-medium">Layer Thickness (0.1-0.5mm)</h4>
            <p className="text-sm text-gray-600">Thicker layers are more durable but less detailed</p>
          </div>
          <div>
            <h4 className="font-medium">Base Thickness (1-3mm)</h4>
            <p className="text-sm text-gray-600">The solid base layer - affects print stability</p>
          </div>
        </div>
      </div>
    ),
    shortcuts: [
      { key: '1-8', description: 'Set color count directly' },
      { key: 'R', description: 'Reset to defaults' }
    ],
    tips: [
      'Start with 4-5 colors for most images',
      'Use thinner layers for detailed images'
    ]
  },
  preview: {
    title: '3D Preview Help',
    content: (
      <div>
        <p className="mb-4">Navigate and inspect your 3D bookmark.</p>
        <div className="space-y-3">
          <div>
            <h4 className="font-medium">Mouse Controls</h4>
            <ul className="text-sm text-gray-600 list-disc list-inside">
              <li>Left drag: Rotate view</li>
              <li>Right drag: Pan view</li>
              <li>Scroll: Zoom in/out</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium">Touch Controls</h4>
            <ul className="text-sm text-gray-600 list-disc list-inside">
              <li>Single finger: Rotate view</li>
              <li>Pinch: Zoom in/out</li>
              <li>Two finger drag: Pan view</li>
            </ul>
          </div>
        </div>
      </div>
    ),
    shortcuts: [
      { key: 'Space', description: 'Reset camera position' },
      { key: 'L', description: 'Toggle layer visibility' },
      { key: 'W', description: 'Toggle wireframe mode' }
    ],
    tips: [
      'Use wireframe mode to see the internal structure',
      'Toggle layers to understand the height mapping'
    ]
  },
  export: {
    title: 'Export Help',
    content: (
      <div>
        <p className="mb-4">Export your bookmark for 3D printing.</p>
        <div className="space-y-3">
          <div>
            <h4 className="font-medium">STL Format</h4>
            <p className="text-sm text-gray-600">Standard format, single color, widely supported</p>
          </div>
          <div>
            <h4 className="font-medium">3MF Format</h4>
            <p className="text-sm text-gray-600">Multi-color format, preserves layer colors</p>
          </div>
        </div>
      </div>
    ),
    shortcuts: [
      { key: 'Ctrl+E', description: 'Export as STL' },
      { key: 'Ctrl+Shift+E', description: 'Export as 3MF' }
    ],
    tips: [
      'Check validation warnings before exporting',
      'STL files are smaller and more compatible'
    ]
  }
};

interface HelpSystemProps {
  isVisible: boolean;
  context: string;
  onClose: () => void;
}

export const HelpSystem: React.FC<HelpSystemProps> = ({
  isVisible,
  context,
  onClose
}) => {
  const helpContent = HELP_CONTENT[context] || HELP_CONTENT.upload;

  return (
    <AccessibleModal
      isOpen={isVisible}
      onClose={onClose}
      title={helpContent.title}
      className="max-w-2xl"
    >
      <div className="space-y-6">
        <div>{helpContent.content}</div>

        {helpContent.shortcuts && helpContent.shortcuts.length > 0 && (
          <div>
            <h4 className="font-medium mb-3">Keyboard Shortcuts</h4>
            <div className="space-y-2">
              {helpContent.shortcuts.map((shortcut, index) => (
                <div key={index} className="flex justify-between items-center py-1">
                  <span className="text-sm text-gray-600">{shortcut.description}</span>
                  <kbd className="px-2 py-1 text-xs bg-gray-100 border border-gray-300 rounded">
                    {shortcut.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        )}

        {helpContent.tips && helpContent.tips.length > 0 && (
          <div>
            <h4 className="font-medium mb-3">Pro Tips</h4>
            <div className="space-y-2">
              {helpContent.tips.map((tip, index) => (
                <div key={index} className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                  <span className="text-sm text-gray-600">{tip}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AccessibleModal>
  );
};

// ========================
// Undo/Redo System
// ========================

export function useUndoRedo<T>(initialState: T, maxHistorySize: number = 50) {
  const [history, setHistory] = useState<T[]>([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  const addAction = useCallback((newState: T) => {
    setHistory(prev => {
      // Remove any history after current index (when adding new action after undo)
      const newHistory = prev.slice(0, currentIndex + 1);
      newHistory.push(newState);
      
      // Limit history size
      if (newHistory.length > maxHistorySize) {
        return newHistory.slice(-maxHistorySize);
      }
      
      return newHistory;
    });
    
    setCurrentIndex(prev => Math.min(prev + 1, maxHistorySize - 1));
  }, [currentIndex, maxHistorySize]);

  const undo = useCallback(() => {
    if (canUndo) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [canUndo]);

  const redo = useCallback(() => {
    if (canRedo) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [canRedo]);

  const currentState = history[currentIndex] || initialState;

  return {
    currentState,
    canUndo,
    canRedo,
    undo,
    redo,
    addAction,
    historySize: history.length
  };
}

// ========================
// Auto-save System
// ========================

export function useAutoSave<T>(
  data: T,
  saveFunction: (data: T) => Promise<void> | void,
  interval: number = 30000, // 30 seconds default
  enabled: boolean = true
) {
  const [lastSaveTime, setLastSaveTime] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const dataRef = useRef(data);
  const saveTimeoutRef = useRef<number | undefined>(undefined);

  // Update data ref when data changes
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const performSave = useCallback(async () => {
    if (isSaving) return;

    try {
      setIsSaving(true);
      await saveFunction(dataRef.current);
      setLastSaveTime(Date.now());
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setIsSaving(false);
    }
  }, [saveFunction, isSaving]);

  // Set up auto-save interval
  useEffect(() => {
    if (!enabled) return;

    const scheduleNextSave = () => {
      saveTimeoutRef.current = window.setTimeout(performSave, interval);
    };

    scheduleNextSave();

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [enabled, interval, performSave]);

  // Manual save function
  const saveNow = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    performSave();
  }, [performSave]);

  return {
    lastSaveTime,
    isSaving,
    saveNow
  };
}

// ========================
// User Experience Provider
// ========================

export const UXProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(() => {
    return localStorage.getItem('bookmarkGenerator_onboardingComplete') === 'true';
  });
  
  const [isHelpVisible, setIsHelpVisible] = useState(false);
  const [helpContext, setHelpContext] = useState('upload');
  const [actionHistory, setActionHistory] = useState<UserAction[]>([]);
  const [currentActionIndex, setCurrentActionIndex] = useState(-1);
  const [enableAutoSave, setEnableAutoSave] = useState(true);
  const [lastSaveTime] = useState<number | null>(null);
  
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    const saved = localStorage.getItem('bookmarkGenerator_preferences');
    return saved ? JSON.parse(saved) : {
      showTooltips: true,
      enableKeyboardShortcuts: true,
      autoSaveInterval: 2, // minutes
      showPerformanceMonitor: false,
      preferReducedMotion: false,
      theme: 'auto',
      language: 'en'
    };
  });

  const { showSuccess, showInfo } = useNotifications();

  // Onboarding functions
  const showOnboarding = useCallback(() => {
    setIsOnboardingComplete(false);
  }, []);

  const completeOnboarding = useCallback(() => {
    setIsOnboardingComplete(true);
    localStorage.setItem('bookmarkGenerator_onboardingComplete', 'true');
    showSuccess('Welcome!', 'You\'re all set to create amazing 3D bookmarks.');
  }, [showSuccess]);

  // Help system functions
  const showHelp = useCallback((context: string = 'upload') => {
    setHelpContext(context);
    setIsHelpVisible(true);
  }, []);

  const hideHelp = useCallback(() => {
    setIsHelpVisible(false);
  }, []);

  // Undo/Redo functions
  const canUndo = currentActionIndex >= 0;
  const canRedo = currentActionIndex < actionHistory.length - 1;

  const addAction = useCallback((action: Omit<UserAction, 'id' | 'timestamp'>) => {
    const newAction: UserAction = {
      ...action,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now()
    };

    setActionHistory(prev => {
      const newHistory = prev.slice(0, currentActionIndex + 1);
      newHistory.push(newAction);
      return newHistory.slice(-50); // Keep last 50 actions
    });

    setCurrentActionIndex(prev => Math.min(prev + 1, 49));
  }, [currentActionIndex]);

  const undo = useCallback(() => {
    if (canUndo) {
      setCurrentActionIndex(prev => prev - 1);
      showInfo('Undone', 'Last action has been undone');
    }
  }, [canUndo, showInfo]);

  const redo = useCallback(() => {
    if (canRedo) {
      setCurrentActionIndex(prev => prev + 1);
      showInfo('Redone', 'Action has been redone');
    }
  }, [canRedo, showInfo]);

  // Preferences
  const updatePreferences = useCallback((updates: Partial<UserPreferences>) => {
    setPreferences(prev => {
      const newPreferences = { ...prev, ...updates };
      localStorage.setItem('bookmarkGenerator_preferences', JSON.stringify(newPreferences));
      return newPreferences;
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    if (!preferences.enableKeyboardShortcuts) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return; // Don't interfere with input fields
      }

      const { ctrlKey, shiftKey, key } = event;

      if (ctrlKey) {
        switch (key.toLowerCase()) {
          case 'z':
            if (shiftKey) {
              event.preventDefault();
              redo();
            } else {
              event.preventDefault();
              undo();
            }
            break;
          case 'y':
            event.preventDefault();
            redo();
            break;
          case '/':
            event.preventDefault();
            showHelp();
            break;
        }
      } else {
        switch (key) {
          case 'F1':
            event.preventDefault();
            showHelp();
            break;
          case 'Escape':
            if (isHelpVisible) {
              hideHelp();
            }
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [preferences.enableKeyboardShortcuts, undo, redo, showHelp, hideHelp, isHelpVisible]);

  const contextValue: UXContextType = {
    showOnboarding,
    completeOnboarding,
    isOnboardingComplete,
    showHelp,
    hideHelp,
    isHelpVisible,
    canUndo,
    canRedo,
    undo,
    redo,
    addAction,
    enableAutoSave,
    setEnableAutoSave,
    lastSaveTime,
    preferences,
    updatePreferences
  };

  return (
    <UXContext.Provider value={contextValue}>
      {children}
      
      {/* Onboarding Tour */}
      <OnboardingTour
        isVisible={!isOnboardingComplete}
        onComplete={completeOnboarding}
        onSkip={completeOnboarding}
      />
      
      {/* Help System */}
      <HelpSystem
        isVisible={isHelpVisible}
        context={helpContext}
        onClose={hideHelp}
      />
    </UXContext.Provider>
  );
};

// ========================
// Quick Action Toolbar
// ========================

export const QuickActionToolbar: React.FC = () => {
  const { canUndo, canRedo, undo, redo, showHelp, preferences } = useUserExperience();
  const {} = useNotifications();

  if (!preferences.enableKeyboardShortcuts) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-30">
      <div className="flex items-center space-x-2 bg-white rounded-lg shadow-lg border px-4 py-2">
        <button
          onClick={undo}
          disabled={!canUndo}
          className="p-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Undo (Ctrl+Z)"
          aria-label="Undo last action"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </button>

        <button
          onClick={redo}
          disabled={!canRedo}
          className="p-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Redo (Ctrl+Y)"
          aria-label="Redo last action"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6-6m6 6l-6 6" />
          </svg>
        </button>

        <div className="w-px h-6 bg-gray-300" />

        <button
          onClick={() => showHelp()}
          className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
          title="Help (F1)"
          aria-label="Show help"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

// CSS for onboarding highlight
const onboardingStyles = `
  .onboarding-highlight {
    position: relative;
    z-index: 51;
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 0 8px rgba(59, 130, 246, 0.2);
    border-radius: 8px;
  }
  
  .onboarding-highlight::before {
    content: '';
    position: absolute;
    inset: -8px;
    border: 2px solid #3b82f6;
    border-radius: 12px;
    pointer-events: none;
    animation: pulse-border 2s infinite;
  }
  
  @keyframes pulse-border {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = onboardingStyles;
  document.head.appendChild(styleElement);
}