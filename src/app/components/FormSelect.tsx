import { ReactNode } from 'react';

interface FormSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error?: string;
  children: ReactNode;
}

export function FormSelect({ 
  label, 
  value, 
  onChange, 
  onBlur, 
  error,
  children
}: FormSelectProps) {
  return (
    <div>
      <label 
        className="block mb-2 text-[14px] font-semibold"
        style={{ color: '#333' }}
      >
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[10px] text-[14px] transition-all duration-200 outline-none"
        style={{
          padding: '12px 16px',
          border: error ? '2px solid #ef4444' : '2px solid #e0e0e0',
          boxShadow: error ? 'none' : undefined,
          backgroundColor: 'white',
          cursor: 'pointer'
        }}
        onFocus={(e) => {
          if (!error) {
            e.target.style.borderColor = '#5a8f5c';
            e.target.style.boxShadow = '0 0 0 4px rgba(90, 143, 92, 0.1)';
          }
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? '#ef4444' : '#e0e0e0';
          e.target.style.boxShadow = 'none';
          onBlur();
        }}
      >
        {children}
      </select>
      {error && (
        <p 
          className="mt-1.5 text-[12px]"
          style={{ color: '#ef4444' }}
        >
          {error}
        </p>
      )}
    </div>
  );
}