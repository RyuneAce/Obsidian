import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export default function Select({ value, onChange, options, style, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Find the label for the current value
  const selectedOption = options.find(opt => opt.value === value) || options[0];

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (val) => {
    onChange({ target: { value: val } });
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block', ...style }}>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          padding: '8px 12px',
          background: 'var(--bg-input)',
          border: `1px solid ${isOpen ? 'var(--border-focus)' : 'var(--border)'}`,
          borderRadius: '8px',
          color: 'var(--text-main)',
          fontSize: '14px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          opacity: disabled ? 0.5 : 1,
          transition: 'all 0.2s ease',
          boxShadow: isOpen ? '0 0 0 2px var(--accent-glow)' : 'none'
        }}
      >
        <span>{selectedOption ? selectedOption.label : value}</span>
        <ChevronDown size={16} style={{ 
          color: 'var(--text-muted)',
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease'
        }} />
      </div>

      {isOpen && (
        <div className="animate-scale-in" style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: '4px',
          background: 'var(--bg-modal)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          boxShadow: 'var(--shadow-md)',
          zIndex: 1000,
          minWidth: '100%',
          maxHeight: '250px',
          overflowY: 'auto',
          transformOrigin: 'top left',
        }}>
          {options.map((opt, i) => (
            <div 
              key={i}
              onClick={() => handleSelect(opt.value)}
              style={{
                padding: '10px 12px',
                fontSize: '14px',
                cursor: 'pointer',
                background: value === opt.value ? 'rgba(20, 184, 166, 0.1)' : 'transparent',
                color: value === opt.value ? 'var(--accent)' : 'var(--text-main)',
                transition: 'background 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (value !== opt.value) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              }}
              onMouseLeave={(e) => {
                if (value !== opt.value) e.currentTarget.style.background = 'transparent';
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
