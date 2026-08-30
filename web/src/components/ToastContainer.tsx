import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (title: string, description?: string, type?: ToastType) => void;
  toast: {
    success: (title: string, description?: string) => void;
    error: (title: string, description?: string) => void;
    info: (title: string, description?: string) => void;
    warning: (title: string, description?: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface SingleToastProps {
  toast: ToastMessage;
  onRemove: (id: string) => void;
  key?: React.Key;
}

function SingleToast({ toast, onRemove }: SingleToastProps) {
  const [isExiting, setIsExiting] = useState(false);
  const duration = toast.duration || 4200;

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
    }, duration - 350);

    const removeTimer = setTimeout(() => {
      onRemove(toast.id);
    }, duration);

    return () => {
      clearTimeout(timer);
      clearTimeout(removeTimer);
    };
  }, [toast, duration, onRemove]);

  const borderColors = {
    error: 'border-red-500/40 bg-[#0d0607]/95 text-white shadow-[0_0_20px_rgba(239,68,68,0.2)]',
    success: 'border-emerald-500/40 bg-[#040d08]/95 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)]',
    warning: 'border-amber-500/40 bg-[#0d0b04]/95 text-white shadow-[0_0_20px_rgba(245,158,11,0.2)]',
    info: 'border-sky-500/40 bg-[#040a0e]/95 text-white shadow-[0_0_20px_rgba(56,189,248,0.2)]',
  };

  const progressColors = {
    error: 'bg-red-500',
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    info: 'bg-sky-400',
  };

  return (
    <div
      className={`relative overflow-hidden rounded-lg border backdrop-blur-md px-4 py-2.5 shadow-xl transition-all duration-300 pointer-events-auto ${
        borderColors[toast.type]
      } ${isExiting ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
    >
      <div className="flex flex-col gap-0.5 pr-2 font-sans">
        <h4 className="text-[11px] font-normal tracking-normal text-white leading-tight">
          {toast.title}
        </h4>
        {toast.description && (
          <p className="text-[10px] text-gray-300 font-normal leading-tight">
            {toast.description}
          </p>
        )}
      </div>

      {/* Bottom Progress Countdown Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10 overflow-hidden">
        <div
          className={`h-full ${progressColors[toast.type]}`}
          style={{
            animation: `toastProgress ${duration}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((title: string, description?: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastMessage = { id, title, description, type, duration: 4200 };
    setToasts((prev) => [...prev.slice(-3), newToast]);
  }, []);

  const toastHelpers = {
    success: (title: string, description?: string) => showToast(title, description, 'success'),
    error: (title: string, description?: string) => showToast(title, description, 'error'),
    info: (title: string, description?: string) => showToast(title, description, 'info'),
    warning: (title: string, description?: string) => showToast(title, description, 'warning'),
  };

  return (
    <ToastContext.Provider value={{ showToast, toast: toastHelpers }}>
      {children}
      {/* Container at top-right */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col items-end gap-2.5 max-w-sm pointer-events-none select-none">
        {toasts.map((t) => (
          <SingleToast key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>

      {/* Keyframe Animations */}
      <style>{`
        @keyframes slideInRight {
          0% {
            transform: translateX(120%);
            opacity: 0;
          }
          100% {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideOutRight {
          0% {
            transform: translateX(0);
            opacity: 1;
          }
          100% {
            transform: translateX(120%);
            opacity: 0;
          }
        }
        @keyframes toastProgress {
          0% {
            width: 100%;
          }
          100% {
            width: 0%;
          }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-slide-out-right {
          animation: slideOutRight 0.35s cubic-bezier(0.7, 0, 0.84, 0) forwards;
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
