
import React, { useEffect } from 'react';
import { SuccessIcon, ErrorIcon, CloseIcon } from './Icons';

export interface ToastProps {
  id: number;
  message: string;
  type: 'success' | 'error';
  onClose: (id: number) => void;
}

const Toast: React.FC<ToastProps> = ({ id, message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, 5000); // Auto-dismiss after 5 seconds

    return () => {
      clearTimeout(timer);
    };
  }, [id, onClose]);

  const isSuccess = type === 'success';
  const bgColor = isSuccess ? 'bg-green-50' : 'bg-red-50';
  const textColor = isSuccess ? 'text-green-800' : 'text-red-800';
  const iconColor = isSuccess ? 'text-green-500' : 'text-red-500';

  return (
    <div className={`w-full max-w-sm rounded-lg shadow-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden ${bgColor}`}>
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {isSuccess ? <SuccessIcon className={`h-6 w-6 ${iconColor}`} /> : <ErrorIcon className={`h-6 w-6 ${iconColor}`} />}
          </div>
          <div className="ms-3 w-0 flex-1 pt-0.5">
            <p className={`text-sm font-medium ${textColor}`}>
              {isSuccess ? 'نجاح' : 'خطأ'}
            </p>
            <p className={`mt-1 text-sm ${textColor}`}>
              {message}
            </p>
          </div>
          <div className="ms-4 flex-shrink-0 flex">
            <button
              onClick={() => onClose(id)}
              className={`inline-flex rounded-md p-1 focus:outline-none focus:ring-2 focus:ring-offset-2 ${isSuccess ? 'hover:bg-green-100 focus:ring-green-600' : 'hover:bg-red-100 focus:ring-red-600'}`}
            >
              <span className="sr-only">إغلاق</span>
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ToastContainer: React.FC<{ toasts: Omit<ToastProps, 'onClose'>[]; onRemoveToast: (id: number) => void; }> = ({ toasts, onRemoveToast }) => {
  if (!toasts.length) return null;
  
  return (
    <div aria-live="assertive" className="fixed inset-0 flex items-end px-4 py-6 pointer-events-none sm:p-6 sm:items-start z-50">
      <div className="w-full flex flex-col items-center space-y-4 sm:items-end">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            id={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={onRemoveToast}
          />
        ))}
      </div>
    </div>
  );
};
