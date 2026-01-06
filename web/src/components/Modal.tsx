import { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      {/* Backdrop/overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* Modal content */}
      <div className="absolute inset-0 flex items-end sm:items-center justify-center sm:p-4 pointer-events-none">
        <div
          className="bg-white dark:bg-gray-800 rounded-t-lg sm:rounded-lg shadow-xl w-full sm:max-w-lg sm:max-h-[90vh] overflow-y-auto max-h-[85vh] sm:max-h-[90vh] pointer-events-auto relative"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 pr-4">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 -mr-1 sm:mr-0 touch-manipulation"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
