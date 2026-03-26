import { useEffect, useState } from 'react';

interface AlertProps {
  type: 'success' | 'error';
  message: string;
  onClose: () => void;
}

export function Alert({ type, message, onClose }: AlertProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger slide-in animation
    setTimeout(() => setIsVisible(true), 10);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 400); // Wait for slide-out animation
  };

  const bgColor = type === 'success' ? '#10b981' : '#ef4444';
  const icon = type === 'success' ? '✓' : '✕';

  return (
    <div
      className="fixed z-50 text-white font-semibold rounded-[10px] flex items-center justify-between gap-4 transition-all duration-400 ease-out"
      style={{
        top: '20px',
        right: isVisible ? '20px' : '-400px',
        padding: '16px 24px',
        background: bgColor,
        maxWidth: '400px'
      }}
    >
      <div className="flex items-center gap-3">
        <span className="text-[20px]">{icon}</span>
        <span>{message}</span>
      </div>
      <button
        onClick={handleClose}
        className="text-white text-[24px] leading-none cursor-pointer bg-transparent border-0 p-0 ml-2 hover:opacity-80 transition-opacity"
        aria-label="Close alert"
      >
        ×
      </button>

      <style>{`
        @media (max-width: 600px) {
          .fixed {
            right: ${isVisible ? '10px' : '-400px'} !important;
            left: 10px;
            max-width: none !important;
          }
        }
      `}</style>
    </div>
  );
}
