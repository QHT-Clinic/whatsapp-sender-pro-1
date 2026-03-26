interface FormTextareaProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error?: string;
  maxLength: number;
}

export function FormTextarea({ 
  label, 
  placeholder, 
  value, 
  onChange, 
  onBlur, 
  error, 
  maxLength 
}: FormTextareaProps) {
  return (
    <div>
      <label 
        className="block mb-2 text-[14px] font-semibold"
        style={{ color: '#333' }}
      >
        {label}
      </label>
      <textarea
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        className="w-full rounded-[10px] text-[14px] transition-all duration-200 outline-none resize-none"
        style={{
          padding: '12px 16px',
          border: error ? '2px solid #ef4444' : '2px solid #e0e0e0',
          minHeight: '120px',
          boxShadow: error ? 'none' : undefined
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
      />
      <div className="flex justify-between items-center mt-1.5">
        {error && (
          <p 
            className="text-[12px]"
            style={{ color: '#ef4444' }}
          >
            {error}
          </p>
        )}
        <p 
          className="text-[12px] ml-auto"
          style={{ color: '#999' }}
        >
          {value.length}/{maxLength}
        </p>
      </div>
    </div>
  );
}