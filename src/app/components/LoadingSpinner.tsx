export function LoadingSpinner() {
  return (
    <div
      className="mr-2.5 rounded-full animate-spin"
      style={{
        width: '18px',
        height: '18px',
        border: '3px solid rgba(255, 255, 255, 0.3)',
        borderTopColor: 'white'
      }}
    >
      <style>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        
        .animate-spin {
          animation: spin 0.8s linear infinite;
        }
      `}</style>
    </div>
  );
}
