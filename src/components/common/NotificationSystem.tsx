import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Notification } from '../../types';

// Icons for different notification types
const CheckCircleIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ExclamationTriangleIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.08 16.5c-.77.833.192 2.5 1.732 2.5z" />
  </svg>
);

const ExclamationCircleIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const InformationCircleIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const XMarkIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export interface NotificationAction {
  label: string;
  action: () => void;
  variant?: 'primary' | 'secondary';
}

export interface ExtendedNotification extends Notification {
  actions?: NotificationAction[];
  progress?: number;
  persistent?: boolean;
  dismissible?: boolean;
}

interface NotificationContextType {
  notifications: ExtendedNotification[];
  addNotification: (notification: Omit<ExtendedNotification, 'id' | 'timestamp'>) => string;
  removeNotification: (id: string) => void;
  updateNotification: (id: string, updates: Partial<ExtendedNotification>) => void;
  clearAll: () => void;
  showSuccess: (title: string, message?: string, options?: Partial<ExtendedNotification>) => string;
  showError: (title: string, message?: string, options?: Partial<ExtendedNotification>) => string;
  showWarning: (title: string, message?: string, options?: Partial<ExtendedNotification>) => string;
  showInfo: (title: string, message?: string, options?: Partial<ExtendedNotification>) => string;
  showProgress: (title: string, progress: number, message?: string) => string;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

interface NotificationProviderProps {
  children: React.ReactNode;
  maxNotifications?: number;
  defaultAutoClose?: boolean;
  autoCloseDelay?: number;
}

export function NotificationProvider({ 
  children, 
  maxNotifications = 5,
  defaultAutoClose = true,
  autoCloseDelay = 5000
}: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<ExtendedNotification[]>([]);

  const addNotification = useCallback((notification: Omit<ExtendedNotification, 'id' | 'timestamp'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const timestamp = Date.now();
    
    const newNotification: ExtendedNotification = {
      id,
      timestamp,
      autoClose: defaultAutoClose,
      dismissible: true,
      ...notification,
    };

    setNotifications(prev => {
      const updated = [newNotification, ...prev];
      // Limit total number of notifications
      return updated.slice(0, maxNotifications);
    });

    // Auto-close if enabled and not persistent
    if (newNotification.autoClose && !newNotification.persistent) {
      setTimeout(() => {
        removeNotification(id);
      }, autoCloseDelay);
    }

    return id;
  }, [defaultAutoClose, maxNotifications, autoCloseDelay]);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const updateNotification = useCallback((id: string, updates: Partial<ExtendedNotification>) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, ...updates } : n)
    );
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const showSuccess = useCallback((
    title: string, 
    message?: string, 
    options?: Partial<ExtendedNotification>
  ) => {
    return addNotification({
      type: 'success',
      title,
      message: message || '',
      ...options
    });
  }, [addNotification]);

  const showError = useCallback((
    title: string, 
    message?: string, 
    options?: Partial<ExtendedNotification>
  ) => {
    return addNotification({
      type: 'error',
      title,
      message: message || '',
      persistent: true,
      autoClose: false,
      ...options
    });
  }, [addNotification]);

  const showWarning = useCallback((
    title: string, 
    message?: string, 
    options?: Partial<ExtendedNotification>
  ) => {
    return addNotification({
      type: 'warning',
      title,
      message: message || '',
      ...options
    });
  }, [addNotification]);

  const showInfo = useCallback((
    title: string, 
    message?: string, 
    options?: Partial<ExtendedNotification>
  ) => {
    return addNotification({
      type: 'info',
      title,
      message: message || '',
      ...options
    });
  }, [addNotification]);

  const showProgress = useCallback((
    title: string, 
    progress: number, 
    message?: string
  ) => {
    return addNotification({
      type: 'info',
      title,
      message: message || '',
      progress,
      persistent: true,
      dismissible: false,
      autoClose: false
    });
  }, [addNotification]);

  const contextValue: NotificationContextType = {
    notifications,
    addNotification,
    removeNotification,
    updateNotification,
    clearAll,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showProgress
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <NotificationContainer notifications={notifications} onDismiss={removeNotification} />
    </NotificationContext.Provider>
  );
}

interface NotificationContainerProps {
  notifications: ExtendedNotification[];
  onDismiss: (id: string) => void;
}

function NotificationContainer({ notifications, onDismiss }: NotificationContainerProps) {
  if (notifications.length === 0) return null;

  return createPortal(
    <div 
      className="fixed top-4 right-4 z-50 space-y-3 max-w-sm w-full"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {notifications.map(notification => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onDismiss={onDismiss}
        />
      ))}
    </div>,
    document.body
  );
}

interface NotificationToastProps {
  notification: ExtendedNotification;
  onDismiss: (id: string) => void;
}

function NotificationToast({ notification, onDismiss }: NotificationToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    if (!notification.dismissible) return;
    
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(notification.id);
    }, 300);
  };

  const getNotificationStyles = () => {
    const baseStyles = "relative p-4 rounded-lg shadow-lg border transition-all duration-300 ease-in-out transform";
    const visibilityStyles = isVisible && !isExiting 
      ? "translate-x-0 opacity-100" 
      : "translate-x-full opacity-0";

    const typeStyles = {
      success: "bg-green-50 border-green-200 text-green-800",
      error: "bg-red-50 border-red-200 text-red-800",
      warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
      info: "bg-blue-50 border-blue-200 text-blue-800"
    };

    return `${baseStyles} ${visibilityStyles} ${typeStyles[notification.type]}`;
  };

  const getIcon = () => {
    const iconStyles = {
      success: "text-green-400",
      error: "text-red-400",
      warning: "text-yellow-400",
      info: "text-blue-400"
    };

    const IconComponent = {
      success: CheckCircleIcon,
      error: ExclamationCircleIcon,
      warning: ExclamationTriangleIcon,
      info: InformationCircleIcon
    }[notification.type];

    return (
      <div className={`flex-shrink-0 ${iconStyles[notification.type]}`}>
        <IconComponent />
      </div>
    );
  };

  return (
    <div 
      className={getNotificationStyles()}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex">
        {getIcon()}
        
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium">
            {notification.title}
          </h3>
          
          {notification.message && (
            <p className="mt-1 text-sm opacity-90">
              {notification.message}
            </p>
          )}

          {typeof notification.progress === 'number' && (
            <div className="mt-2">
              <div className="flex justify-between text-xs mb-1">
                <span>Progress</span>
                <span>{Math.round(notification.progress * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${notification.progress * 100}%` }}
                />
              </div>
            </div>
          )}

          {notification.actions && notification.actions.length > 0 && (
            <div className="mt-3 flex space-x-2">
              {notification.actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.action}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    action.variant === 'primary'
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {notification.dismissible && (
          <button
            onClick={handleDismiss}
            className="ml-4 flex-shrink-0 p-1 rounded-full hover:bg-black hover:bg-opacity-10 transition-colors"
            aria-label="Dismiss notification"
          >
            <XMarkIcon />
          </button>
        )}
      </div>
    </div>
  );
}